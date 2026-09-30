#!/usr/bin/env node
/**
 * Deterministically regenerates docs/assets/demo.gif for README.md.
 *
 * Uses only Node.js 22+ built-in modules (fetch, WebSocket, child_process, fs, net),
 * an isolated Go server + SQLite DB, the built-in 20Hz UDP simulator, seeded F1 2026
 * sessions, headless Chrome via raw CDP, and 2-pass FFmpeg Lanczos palette encoding.
 */

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import dgram from 'node:dgram';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const DEFAULT_OPTIONS = {
  output: 'docs/assets/demo.gif',
  width: 900,
  height: 600,
  fps: 8,
  skipBuild: false,
  chrome: process.env.CHROME_BIN || '',
  keepTemp: false,
};

function parsePositiveInt(flag, rawValue) {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${flag}: ${rawValue ?? '(missing)'} (expected a positive integer)`);
  }
  return parsed;
}

function parseCliArgs(argv) {
  const opts = { ...DEFAULT_OPTIONS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--output':
        if (!argv[i + 1]) throw new Error('Missing value for --output');
        opts.output = argv[++i];
        break;
      case '--width':
        opts.width = parsePositiveInt('--width', argv[++i]);
        break;
      case '--height':
        opts.height = parsePositiveInt('--height', argv[++i]);
        break;
      case '--fps':
        opts.fps = parsePositiveInt('--fps', argv[++i]);
        break;
      case '--skip-build':
        opts.skipBuild = true;
        break;
      case '--chrome':
        if (!argv[i + 1]) throw new Error('Missing value for --chrome');
        opts.chrome = argv[++i];
        break;
      case '--keep-temp':
      case '--keep-frames':
        opts.keepTemp = true;
        break;
      case '--help':
      case '-h':
        console.log(
          'Usage: node generate-demo-gif.mjs [--output docs/assets/demo.gif] [--width 900] [--height 600] [--fps 8] [--skip-build] [--chrome <path>] [--keep-temp|--keep-frames]'
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }
  return opts;
}

function detectChromeBinary(explicitPath) {
  if (explicitPath) {
    if (fs.existsSync(explicitPath)) {
      return explicitPath;
    }
    throw new Error(
      `Configured Chrome binary does not exist: ${explicitPath}. Pass a valid path to --chrome or CHROME_BIN.`
    );
  }

  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/opt/homebrew/bin/chromium',
        ]
      : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
          ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const pathNames =
    process.platform === 'win32'
      ? ['chrome.exe', 'msedge.exe', 'chromium.exe']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  const locator = process.platform === 'win32' ? 'where' : 'which';
  for (const binName of pathNames) {
    try {
      const resolved = execFileSync(locator, [binName], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .split(/\r?\n/)[0]
        ?.trim();
      if (resolved && fs.existsSync(resolved)) {
        return resolved;
      }
    } catch {
      // Try next binary name
    }
  }

  throw new Error(
    'Could not locate Google Chrome / Chromium. Pass --chrome <path> or set CHROME_BIN.'
  );
}

function getFreeTcpPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on('error', reject);
  });
}

function getFreeUdpPort() {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    sock.bind(0, '127.0.0.1', () => {
      const addr = sock.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      sock.close(() => resolve(port));
    });
    sock.on('error', reject);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(baseUrl, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/system/version`);
      if (res.ok) return;
    } catch {
      // Keep polling until server binds
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for server at ${baseUrl}`);
}

/**
 * Minimal Chrome DevTools Protocol (CDP) client over Node 22 global WebSocket.
 */
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : event.data.toString();
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`CDP ${msg.error.message || JSON.stringify(msg.error)}`));
        } else {
          resolve(msg.result);
        }
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res?.exceptionDetails) {
      throw new Error(
        `Runtime.evaluate exception: ${res.exceptionDetails.text || 'unknown'}`
      );
    }
    return res?.result?.value;
  }

  async close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

async function launchHeadlessChrome(chromeBin, userDataDir, viewportWidth, viewportHeight) {
  const args = [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    '--disable-sync',
    '--hide-scrollbars',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`,
    `--window-size=${viewportWidth},${viewportHeight}`,
    '--remote-debugging-port=0',
    'about:blank',
  ];

  const proc = spawn(chromeBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  const wsEndpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for Chrome DevTools')), 15_000);
    let stderrBuf = '';
    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    proc.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited prematurely with code ${code}: ${stderrBuf}`));
    });
  });

  const browserUrl = new URL(wsEndpoint);
  const targetsRes = await fetch(`http://${browserUrl.host}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error('No inspectable page target found in headless Chrome');
  }

  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });

  return { proc, cdp };
}

/**
 * Builds the deterministic browser-side script injected before page scripts run.
 * Stubs network/version/AI/TTS endpoints and exposes a helper to emit proactive
 * pit-wall directives on /ws/engineer without needing external API keys.
 */
function buildPreloadScript() {
  return `
(() => {
  try {
    if (!sessionStorage.getItem('__demo_seeded_storage')) {
      localStorage.setItem('f1_telemetry_language', JSON.stringify('en'));
      localStorage.setItem('f1_active_tab', JSON.stringify('live'));
      localStorage.setItem('f1_live_view_mode', JSON.stringify('dashboard'));
      localStorage.setItem('f1_comparator_rival_mode', JSON.stringify('leader'));
      localStorage.setItem('f1_comparator_chart_view', JSON.stringify('cards'));
      localStorage.setItem('f1_ai_engineer_open', JSON.stringify(false));
      localStorage.setItem('f1_ai_engineer_expanded', JSON.stringify(false));
      sessionStorage.setItem('__demo_seeded_storage', '1');
    }
  } catch {}

  // Capture /ws/engineer WebSocket instances so we can emit deterministic directives on cue
  const NativeWebSocket = window.WebSocket;
  const engineerSockets = new Set();
  window.__demoEngineerSockets = engineerSockets;

  window.WebSocket = function(url, protocols) {
    const ws = protocols !== undefined ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);
    if (typeof url === 'string' && url.includes('/ws/engineer')) {
      engineerSockets.add(ws);
      ws.addEventListener('close', () => engineerSockets.delete(ws));
    }
    return ws;
  };
  window.WebSocket.prototype = NativeWebSocket.prototype;
  Object.assign(window.WebSocket, {
    CONNECTING: NativeWebSocket.CONNECTING,
    OPEN: NativeWebSocket.OPEN,
    CLOSING: NativeWebSocket.CLOSING,
    CLOSED: NativeWebSocket.CLOSED,
  });

  let directiveSeq = 1;
  window.__demoEmitDirective = (subAlert, category = 'strategy', urgency = 'high') => {
    const payload = JSON.stringify({
      type: 'directive',
      id: 'demo-directive-' + (directiveSeq++) + '-' + Date.now(),
      category,
      sub_alert: subAlert,
      urgency,
      timestamp: Date.now(),
    });
    for (const ws of engineerSockets) {
      if (typeof ws.onmessage === 'function') {
        ws.onmessage(new MessageEvent('message', { data: payload }));
      }
    }
  };

  // Provide animated harmonic frequency data when RadioWaveformCanvas samples AnalyserNode in headless mode
  if (typeof AnalyserNode !== 'undefined' && AnalyserNode.prototype.getByteFrequencyData) {
    const origGetFreq = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = function(array) {
      origGetFreq.call(this, array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) sum += array[i];
      if (sum === 0) {
        const now = Date.now();
        for (let i = 0; i < array.length; i++) {
          const w1 = Math.sin(now / 95 + i * 0.55);
          const w2 = Math.cos(now / 155 - i * 0.35);
          array[i] = Math.max(28, Math.min(245, Math.round(125 + 95 * w1 * w2)));
        }
      }
    };
  }

  // Generate a valid 1-second 22.05kHz mono 16-bit PCM WAV buffer for WebAudio decodeAudioData
  function makeWavBuffer(durationSec = 1.2) {
    const sampleRate = 22050;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * 440 * t) * 0.15;
      view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }
    return buffer;
  }

  const DEBRIEF_CHUNKS = [
    "### 🏁 Race Debrief — Spa-Francorchamps (P4 ➔ P1)\\n\\n",
    "**Clinical victory.** You converted a **P4 grid slot** into **P1 (+3 places)** with decisive pace in clean air and a textbook **Safety Car undercut on Lap 7**.\\n\\n",
    "- **Clean-Air Pace:** Averaged **1:45.092** on clean racing laps (**~0.68s/lap** faster than the field median and **−0.19s/lap** ahead of **Lando Norris**).\\n",
    "- **Key Strategy Call (Lap 7 SC):** Boxing from Softs onto **Medium (C3)** under the full Safety Car saved **~11.5s** of pit-lane delta and gave you track position for the Lap 9 restart.\\n",
    "- **Stint 2 Management:** Over 11 laps on the Medium compound, degradation held steady at **+0.036s/lap**, sealing fastest lap (**1:44.612**) on Lap 16 with **Straight-Mode Active Aero** on the Kemmel run."
  ];

  const COMPARATOR_CHUNKS = [
    "### 🔍 Corner Breakdown — T1 (La Source Hairpin)\\n\\n",
    "| Metric | #1 Max Verstappen (A) | #4 Lando Norris (B) | Delta |\\n",
    "| :--- | :---: | :---: | :---: |\\n",
    "| **Braking Point** | **115 m** before apex | **105 m** before apex | **+10 m earlier** |\\n",
    "| **Min Apex Speed** | **89 km/h** | **83 km/h** | **+6 km/h faster** |\\n",
    "| **Throttle Pickup** | **+20 m** after apex | **+30 m** after apex | **10 m earlier** |\\n\\n",
    "**Takeaway:** Braking **10 m earlier** into **T1** let you release the pedal sooner, rotate the car cleanly at the apex (**+6 km/h**), and get back to **>50% throttle 10 m earlier**—engaging **2026 Straight-Mode Aero** down the hill toward Eau Rouge for a **−0.036s** gain."
  ];

  function createSseStream(chunks, intervalMs = 55) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await new Promise((r) => setTimeout(r, intervalMs));
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ text: chunk }) + '\\n\\n'));
        }
        await new Promise((r) => setTimeout(r, intervalMs));
        controller.enqueue(encoder.encode('data: [DONE]\\n\\n'));
        controller.close();
      }
    });
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/api/system/network')) {
      return new Response(
        JSON.stringify({
          udp_addr: '0.0.0.0:20777',
          udp_port: 20777,
          local_ip: '192.168.1.42',
          lan_ips: ['192.168.1.42'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/system/version')) {
      return new Response(
        JSON.stringify({
          version: 'v1.10.0',
          commit: '2026dlc',
          build_date: '2026-09-29',
          is_dev: false,
          is_beta: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/system/check-updates')) {
      return new Response(
        JSON.stringify({
          update_available: false,
          current_version: 'v1.10.0',
          latest_version: 'v1.10.0',
          release_name: 'v1.10.0',
          release_notes: '',
          html_url: '',
          published_at: '',
          is_prerelease: false,
          assets: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/settings/ai') && (!init?.method || init.method === 'GET')) {
      return new Response(
        JSON.stringify({
          saved: true,
          provider: 'gemini',
          base_url: '',
          providers: {
            gemini: { model: 'gemini-2.5-flash', has_saved_key: true, has_env_key: true },
            openai: { model: 'gpt-4.1-mini', has_saved_key: false, has_env_key: false },
            claude: { model: 'claude-sonnet-4-20250514', has_saved_key: false, has_env_key: false },
            custom: { model: '', has_saved_key: false, has_env_key: false },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/ai/tts')) {
      // Hold speaking state for 3.2 seconds so the HUD and Voice Cockpit waveform animate cleanly
      await new Promise((r) => setTimeout(r, 3200));
      return new Response(makeWavBuffer(0.4), {
        status: 200,
        headers: { 'Content-Type': 'audio/wav' },
      });
    }

    if (url.endsWith('/api/ai/chat')) {
      let mode = 'session_debrief';
      try {
        const bodyObj = init?.body ? JSON.parse(init.body) : {};
        mode = bodyObj?.context?.context_mode || mode;
      } catch {}
      const chunks = mode === 'comparator' ? COMPARATOR_CHUNKS : DEBRIEF_CHUNKS;
      return new Response(createSseStream(chunks, 45), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    return origFetch(input, init);
  };
})();
`;
}

/**
 * Generates a closed-loop 7000m Spa-Francorchamps trajectory with 8 distinct corners (T1..T8)
 * and zero curvature on straights so DetectTrackTurns and analyzeCorners detect all 8 turns
 * with realistic entry speed, apex min speed, braking point, throttle pickup, and 2026 Active Aero.
 */
const SPA_CORNERS = [
  { turn: 1, center: 450, sigma: 24, angleRad: 2.15, apexSpeedA: 89, apexSpeedB: 83, brakeDistA: 115, brakeDistB: 105, pickupOffsetA: 15, pickupOffsetB: 25, gear: 2 },
  { turn: 2, center: 1200, sigma: 28, angleRad: -0.82, apexSpeedA: 248, apexSpeedB: 244, brakeDistA: 55, brakeDistB: 60, pickupOffsetA: 10, pickupOffsetB: 15, gear: 6 },
  { turn: 3, center: 2150, sigma: 26, angleRad: 1.48, apexSpeedA: 136, apexSpeedB: 139, brakeDistA: 105, brakeDistB: 95, pickupOffsetA: 20, pickupOffsetB: 15, gear: 3 },
  { turn: 4, center: 2980, sigma: 30, angleRad: 1.82, apexSpeedA: 118, apexSpeedB: 114, brakeDistA: 95, brakeDistB: 90, pickupOffsetA: 15, pickupOffsetB: 25, gear: 3 },
  { turn: 5, center: 3880, sigma: 28, angleRad: -1.36, apexSpeedA: 194, apexSpeedB: 190, brakeDistA: 75, brakeDistB: 80, pickupOffsetA: 15, pickupOffsetB: 20, gear: 5 },
  { turn: 6, center: 4760, sigma: 26, angleRad: 1.32, apexSpeedA: 148, apexSpeedB: 151, brakeDistA: 90, brakeDistB: 85, pickupOffsetA: 20, pickupOffsetB: 15, gear: 4 },
  { turn: 7, center: 5620, sigma: 26, angleRad: -0.78, apexSpeedA: 266, apexSpeedB: 262, brakeDistA: 45, brakeDistB: 50, pickupOffsetA: 10, pickupOffsetB: 15, gear: 7 },
  { turn: 8, center: 6450, sigma: 24, angleRad: 2.4731853, apexSpeedA: 78, apexSpeedB: 75, brakeDistA: 125, brakeDistB: 120, pickupOffsetA: 15, pickupOffsetB: 20, gear: 2 },
];

function buildSpaTrajectory(trackLength = 7000, stepMeters = 10) {
  const count = Math.floor(trackLength / stepMeters) + 1;
  const distances = Array.from({ length: count }, (_, i) => i * stepMeters);

  // Integrate heading angle theta(d) only inside [center - 3*sigma, center + 3*sigma]
  // so straights have strictly 0 curvature.
  const headings = new Array(count).fill(0);
  let theta = 0;
  for (let i = 1; i < count; i++) {
    const d = distances[i];
    let kappa = 0;
    for (const c of SPA_CORNERS) {
      const diff = d - c.center;
      if (Math.abs(diff) <= c.sigma * 3) {
        const norm = 1 / (Math.sqrt(2 * Math.PI) * c.sigma);
        kappa += c.angleRad * norm * Math.exp(-(diff * diff) / (2 * c.sigma * c.sigma));
      }
    }
    theta += kappa * stepMeters;
    headings[i] = theta;
  }

  const rawX = new Array(count).fill(0);
  const rawZ = new Array(count).fill(0);
  const scale = 0.42;
  for (let i = 1; i < count; i++) {
    rawX[i] = rawX[i - 1] + Math.cos(headings[i]) * stepMeters * scale;
    rawZ[i] = rawZ[i - 1] + Math.sin(headings[i]) * stepMeters * scale;
  }

  // Linear closure correction has zero second derivative, preserving zero curvature on straights
  const endX = rawX[count - 1];
  const endZ = rawZ[count - 1];
  return distances.map((d, i) => {
    const frac = d / trackLength;
    return {
      distance: d,
      worldX: Number((rawX[i] - frac * endX).toFixed(2)),
      worldZ: Number((rawZ[i] - frac * endZ).toFixed(2)),
    };
  });
}

function generateSpaLapTelemetry(slot, lapTimeMs, trajectory) {
  const isSlotA = slot === 'A';
  const topSpeed = isSlotA ? 332 : 330;
  const samples = [];
  let elapsedSec = 0;
  let ersStorePct = isSlotA ? 94.0 : 90.0;

  for (let i = 0; i < trajectory.length; i++) {
    const { distance, worldX, worldZ } = trajectory[i];
    let speed = topSpeed;
    let throttle = 1.0;
    let brake = 0.0;
    let steer = 0.0;
    let gear = 8;
    let activeAeroMode = 1; // 1 = Straight Mode (X-Mode), 0 = Corner Mode (Z-Mode)
    let activeAeroAvailable = 1;
    let overtakeActive = 0;

    // Kemmel straight & Blanchimont straight speed build-up and Overtake Boost
    if ((distance >= 1350 && distance <= 2000) || (distance >= 5750 && distance <= 6280)) {
      overtakeActive = isSlotA || distance < 6000 ? 1 : 0;
      speed = topSpeed + (overtakeActive ? 6 : 0);
    } else {
      // Gentle speed ramp along straights
      speed = 292 + Math.round(36 * Math.min(1, (distance % 850) / 500));
    }

    for (const c of SPA_CORNERS) {
      const rel = distance - c.center;
      const apexSpeed = isSlotA ? c.apexSpeedA : c.apexSpeedB;
      const brakeDist = isSlotA ? c.brakeDistA : c.brakeDistB;
      const pickupOffset = isSlotA ? c.pickupOffsetA : c.pickupOffsetB;

      if (rel >= -brakeDist - 30 && rel <= (isSlotA ? 115 : 135)) {
        activeAeroMode = 0; // Corner mode (high downforce) through braking and turn
        activeAeroAvailable = 0;
        overtakeActive = 0;
      }

      if (rel >= -brakeDist && rel < 0) {
        // Braking phase leading into the apex
        const progress = (rel + brakeDist) / brakeDist; // 0 at brake point -> 1 at apex
        const entrySpd = Math.min(topSpeed, 304 + (c.turn % 3) * 8);
        speed = Math.round(entrySpd - (entrySpd - apexSpeed) * Math.pow(progress, 0.82));
        brake = Number(Math.max(0.18, 0.95 * (1 - progress * 0.55)).toFixed(2));
        throttle = 0.0;
        gear = Math.max(c.gear, Math.round(8 - (8 - c.gear) * progress));
        steer = Number(((c.angleRad > 0 ? 1 : -1) * 0.45 * progress).toFixed(2));
        break;
      } else if (Math.abs(rel) < 10) {
        // Apex minimum speed
        speed = apexSpeed;
        brake = 0.0;
        throttle = 0.22;
        gear = c.gear;
        steer = Number(((c.angleRad > 0 ? 1 : -1) * 0.68).toFixed(2));
        break;
      } else if (rel > 0 && rel <= 150) {
        // Corner exit & throttle pickup
        const exitFrac = Math.min(1, rel / 150);
        const targetExitSpeed = 286;
        speed = Math.round(apexSpeed + (targetExitSpeed - apexSpeed) * Math.pow(exitFrac, 0.72));
        brake = 0.0;
        throttle = rel >= pickupOffset
          ? Number(Math.min(1.0, 0.58 + (rel - pickupOffset) / 95).toFixed(2))
          : 0.28;
        gear = Math.min(8, c.gear + Math.floor(exitFrac * (8 - c.gear)));
        steer = Number(((c.angleRad > 0 ? 1 : -1) * 0.62 * (1 - exitFrac)).toFixed(2));
        break;
      }
    }

    if (i > 0) {
      const stepDist = distance - trajectory[i - 1].distance;
      const avgSpeedKmh = Math.max(60, (speed + samples[i - 1].speed) / 2);
      const dt = stepDist / (avgSpeedKmh / 3.6);
      elapsedSec += dt;
    }

    if (brake > 0.2) {
      ersStorePct = Math.min(98.0, ersStorePct + 0.55);
    } else if (throttle > 0.85) {
      ersStorePct = Math.max(18.0, ersStorePct - (overtakeActive ? 0.58 : 0.16));
    }

    const rpm = Math.round(9_200 + ((speed % 45) / 45) * 3_100);
    samples.push({
      lap_distance: distance,
      session_time: Number(elapsedSec.toFixed(4)),
      speed,
      throttle,
      brake,
      steer,
      gear,
      engine_rpm: rpm,
      drs: activeAeroMode === 1 && throttle > 0.9,
      ers_deploy: throttle > 0.8 ? (overtakeActive ? 4.0 : 2.1) : 0.0,
      ers_store_energy: Number(ersStorePct.toFixed(2)),
      ers_deploy_mode: overtakeActive ? 3 : 2,
      world_pos_x: worldX,
      world_pos_y: 0,
      world_pos_z: worldZ,
      active_aero_mode: activeAeroMode,
      active_aero_available: activeAeroAvailable,
      overtake_active: overtakeActive,
    });
  }

  // Scale session_time so the final sample matches the official lapTimeMs
  const targetSec = lapTimeMs / 1000;
  const rawTotal = samples[samples.length - 1].session_time || targetSec;
  const timeScale = targetSec / rawTotal;
  for (const s of samples) {
    s.session_time = Number((s.session_time * timeScale).toFixed(4));
  }

  return samples;
}

const DRIVERS_2026 = [
  { carIndex: 0, name: 'Max Verstappen', driverId: 9, teamId: 478, raceNumber: 1, nationality: 22, grid: 4, pos: 1, points: 25 },
  { carIndex: 4, name: 'Lando Norris', driverId: 54, teamId: 484, raceNumber: 4, nationality: 10, grid: 1, pos: 2, points: 18 },
  { carIndex: 3, name: 'Charles Leclerc', driverId: 58, teamId: 477, raceNumber: 16, nationality: 53, grid: 2, pos: 3, points: 15 },
  { carIndex: 2, name: 'Lewis Hamilton', driverId: 7, teamId: 477, raceNumber: 44, nationality: 10, grid: 3, pos: 4, points: 12 },
  { carIndex: 5, name: 'Oscar Piastri', driverId: 112, teamId: 484, raceNumber: 81, nationality: 3, grid: 5, pos: 5, points: 10 },
  { carIndex: 6, name: 'George Russell', driverId: 50, teamId: 476, raceNumber: 63, nationality: 10, grid: 6, pos: 6, points: 8 },
  { carIndex: 7, name: 'Andrea-Kimi Antonelli', driverId: 165, teamId: 476, raceNumber: 12, nationality: 41, grid: 7, pos: 7, points: 6 },
  { carIndex: 8, name: 'Fernando Alonso', driverId: 3, teamId: 480, raceNumber: 14, nationality: 77, grid: 9, pos: 8, points: 4 },
  { carIndex: 13, name: 'Carlos Sainz', driverId: 0, teamId: 479, raceNumber: 55, nationality: 77, grid: 8, pos: 9, points: 2 },
  { carIndex: 20, name: 'Franco Colapinto', driverId: 162, teamId: 486, raceNumber: 43, nationality: 2, grid: 12, pos: 10, points: 1 },
  { carIndex: 12, name: 'Alexander Albon', driverId: 62, teamId: 479, raceNumber: 23, nationality: 80, grid: 10, pos: 11, points: 0 },
  { carIndex: 1, name: 'Liam Lawson', driverId: 113, teamId: 478, raceNumber: 30, nationality: 54, grid: 11, pos: 12, points: 0 },
  { carIndex: 10, name: 'Pierre Gasly', driverId: 59, teamId: 481, raceNumber: 10, nationality: 28, grid: 13, pos: 13, points: 0 },
  { carIndex: 14, name: 'Yuki Tsunoda', driverId: 94, teamId: 482, raceNumber: 22, nationality: 43, grid: 14, pos: 14, points: 0 },
  { carIndex: 16, name: 'Nico Hülkenberg', driverId: 10, teamId: 485, raceNumber: 27, nationality: 29, grid: 15, pos: 15, points: 0 },
  { carIndex: 17, name: 'Gabriel Bortoleto', driverId: 161, teamId: 485, raceNumber: 5, nationality: 9, grid: 16, pos: 16, points: 0 },
  { carIndex: 18, name: 'Esteban Ocon', driverId: 17, teamId: 483, raceNumber: 31, nationality: 28, grid: 17, pos: 17, points: 0 },
  { carIndex: 19, name: 'Oliver Bearman', driverId: 147, teamId: 483, raceNumber: 87, nationality: 10, grid: 18, pos: 18, points: 0 },
  { carIndex: 9, name: 'Lance Stroll', driverId: 19, teamId: 480, raceNumber: 18, nationality: 13, grid: 19, pos: 19, points: 0 },
  { carIndex: 15, name: 'Isack Hadjar', driverId: 149, teamId: 482, raceNumber: 6, nationality: 28, grid: 20, pos: 20, points: 0 },
  { carIndex: 21, name: 'Sergio Pérez', driverId: 14, teamId: 486, raceNumber: 11, nationality: 52, grid: 21, pos: 21, points: 0 },
  { carIndex: 11, name: 'Jack Doohan', driverId: 136, teamId: 481, raceNumber: 7, nationality: 3, grid: 22, pos: 22, points: 0 },
];

function buildHeroSpaRaceSession() {
  const trajectory = buildSpaTrajectory(7000, 10);
  const totalLaps = 18;
  const laps = [];

  for (let dIdx = 0; dIdx < DRIVERS_2026.length; dIdx++) {
    const drv = DRIVERS_2026[dIdx];
    const isPlayer = drv.carIndex === 0;
    const isNorris = drv.carIndex === 4;
    const pitLap = drv.pos % 3 === 0 ? 8 : 7;
    const basePaceMs =
      dIdx === 0
        ? 104_820
        : dIdx === 1
          ? 105_010
          : 105_110 + (dIdx - 2) * 44;

    for (let lapNum = 1; lapNum <= totalLaps; lapNum++) {
      const stint = lapNum <= pitLap ? 1 : 2;
      const compound = stint === 1 ? 'Soft' : 'Medium';
      const actualCompound = stint === 1 ? 'C4' : 'C3';
      const tyreAge = stint === 1 ? lapNum : lapNum - pitLap;
      const degMs = stint === 1 ? tyreAge * 85 : tyreAge * 48;

      let lapTimeMs = basePaceMs + degMs + ((lapNum * 19 + dIdx * 13) % 36) - 18;
      if (lapNum === 6) {
        // Full Safety Car deployment (>107% of median so cleanLapTimes and FieldPaceChart treat it as neutralised/outlier)
        lapTimeMs = basePaceMs + 8_900;
      } else if (lapNum === pitLap) {
        // Pit-in lap under SC: excluded by stintChanged ('pit_in') while staying within DegradationCurves' clean-lap Y-axis domain
        lapTimeMs = basePaceMs + degMs + 240;
      } else if (lapNum === pitLap + 1) {
        // Pit-out lap: excluded by stintChanged ('pit_out') while rendering as a hollow dot at Age 1 on DegradationCurves
        lapTimeMs = basePaceMs + 460;
      } else if (lapNum === 7 && pitLap === 8) {
        // Lap 7 under SC for drivers pitting on Lap 8: excluded by SCAR period ('sc') while rendering as a hollow dot at Age 7
        lapTimeMs = basePaceMs + degMs + 190;
      }

      if (isPlayer && lapNum === 16) {
        lapTimeMs = 104_612; // Fastest lap of the race
      } else if (isNorris && lapNum === 17) {
        lapTimeMs = 104_785; // Norris best lap
      }

      const s1Ms = Math.round(lapTimeMs * 0.295);
      const s2Ms = Math.round(lapTimeMs * 0.435);
      const s3Ms = lapTimeMs - s1Ms - s2Ms;

      // Evolve positions from grid to final classification across the first 14 laps
      const progress = Math.min(1, lapNum / 14);
      const carPosition = Math.max(1, Math.min(22, Math.round(drv.grid + (drv.pos - drv.grid) * progress)));

      let telemetry = undefined;
      if (isPlayer && lapNum === 16) {
        telemetry = generateSpaLapTelemetry('A', lapTimeMs, trajectory);
      } else if (isNorris && lapNum === 17) {
        telemetry = generateSpaLapTelemetry('B', lapTimeMs, trajectory);
      }

      laps.push({
        lap: {
          car_index: drv.carIndex,
          lap_number: lapNum,
          lap_time_ms: lapTimeMs,
          sector1_ms: s1Ms,
          sector2_ms: s2Ms,
          sector3_ms: s3Ms,
          is_valid: true,
          tyre_compound: compound,
          actual_compound: actualCompound,
          fuel_load: Number(Math.max(2.4, 34.0 - lapNum * 1.72).toFixed(2)),
          max_speed_kmh: 334 - Math.min(18, dIdx),
          penalties_seconds: isNorris && lapNum >= 11 ? 5 : 0,
          car_position: carPosition,
          result_status: 3, // Finished
          stint,
          sector1_valid: true,
          sector2_valid: true,
          sector3_valid: true,
        },
        telemetry,
      });
    }
  }

  const intervalStepsSec = [
    0, 8.42, 3.18, 4.26, 5.49, 6.18, 3.84, 5.12, 4.75, 6.31, 3.92,
    4.58, 5.64, 4.19, 6.05, 3.77, 5.28, 4.91, 6.42, 5.15, 7.08, 6.64,
  ];
  let cumulativeGapSec = 0;
  const participants = DRIVERS_2026.map((drv, idx) => {
    const penaltySec = drv.carIndex === 4 ? 5 : 0;
    cumulativeGapSec += intervalStepsSec[idx] || 4.5;
    return {
      car_index: drv.carIndex,
      name: drv.name,
      driver_id: drv.driverId,
      team_id: drv.teamId,
      race_number: drv.raceNumber,
      ai_controlled: drv.carIndex !== 0,
      nationality: drv.nationality,
      grid_position: drv.grid,
      position: drv.pos,
      points: drv.points,
      total_race_time: Number((1892.412 + cumulativeGapSec - penaltySec).toFixed(3)),
      penalties_time: penaltySec,
      num_penalties: penaltySec > 0 ? 1 : 0,
      result_reason: 0,
      num_pit_stops: 1,
      result_status: 3,
    };
  });

  const rawEvents = [
    {
      lap: 1,
      sessionTime: 5.2,
      data: { eventCode: 'LGOT', type: 'flag', severity: 'success', raceLap: 1, sessionTime: 5.2 },
    },
    {
      lap: 3,
      sessionTime: 245.8,
      data: {
        eventCode: 'OVTK',
        type: 'overtake',
        severity: 'info',
        vehicleIdx: 0,
        driverName: 'Max Verstappen',
        otherVehicleIdx: 2,
        targetDriverName: 'Lewis Hamilton',
        raceLap: 3,
        sessionTime: 245.8,
      },
    },
    {
      lap: 6,
      sessionTime: 562.0,
      data: {
        eventCode: 'SCAR',
        type: 'flag',
        severity: 'warning',
        safetyCarStatus: 1,
        raceLap: 6,
        sessionTime: 562.0,
      },
    },
    {
      lap: 7,
      sessionTime: 658.4,
      data: {
        eventCode: 'TMPT',
        type: 'pit',
        severity: 'info',
        vehicleIdx: 0,
        driverName: 'Max Verstappen',
        raceLap: 7,
        sessionTime: 658.4,
      },
    },
    {
      lap: 8,
      sessionTime: 785.0,
      data: {
        eventCode: 'SCAR',
        type: 'flag',
        severity: 'success',
        safetyCarStatus: 0,
        raceLap: 8,
        sessionTime: 785.0,
      },
    },
    {
      lap: 11,
      sessionTime: 1094.2,
      data: {
        eventCode: 'PENA',
        type: 'penalty',
        severity: 'warning',
        vehicleIdx: 4,
        driverName: 'Lando Norris',
        penaltyType: 4,
        infringementType: 7,
        penaltyTime: 5,
        raceLap: 11,
        sessionTime: 1094.2,
      },
    },
    {
      lap: 14,
      sessionTime: 1412.6,
      data: {
        eventCode: 'OVTK',
        type: 'overtake',
        severity: 'success',
        vehicleIdx: 0,
        driverName: 'Max Verstappen',
        otherVehicleIdx: 4,
        targetDriverName: 'Lando Norris',
        raceLap: 14,
        sessionTime: 1412.6,
      },
    },
    {
      lap: 16,
      sessionTime: 1635.9,
      data: {
        eventCode: 'FTLP',
        type: 'fastest_lap',
        severity: 'purple',
        vehicleIdx: 0,
        driverName: 'Max Verstappen',
        lapTime: 104.612,
        raceLap: 16,
        sessionTime: 1635.9,
      },
    },
    {
      lap: 18,
      sessionTime: 1892.4,
      data: {
        eventCode: 'RCWN',
        type: 'general',
        severity: 'success',
        vehicleIdx: 0,
        driverName: 'Max Verstappen',
        raceLap: 18,
        sessionTime: 1892.4,
      },
    },
  ];

  const events = rawEvents.map((e) => ({
    lap: e.lap,
    session_time: e.sessionTime,
    event_code: e.data.eventCode,
    data: e.data,
  }));

  const weatherForecast = JSON.stringify([
    { SessionType: 10, TimeOffset: 0, Weather: 1, TrackTemperature: 28, TrackTemperatureChange: 0, AirTemperature: 21, AirTemperatureChange: 0, RainPercentage: 15 },
    { SessionType: 10, TimeOffset: 15, Weather: 2, TrackTemperature: 26, TrackTemperatureChange: 1, AirTemperature: 20, AirTemperatureChange: 1, RainPercentage: 45 },
    { SessionType: 10, TimeOffset: 30, Weather: 1, TrackTemperature: 27, TrackTemperatureChange: 2, AirTemperature: 21, AirTemperatureChange: 0, RainPercentage: 20 },
  ]);

  return {
    version: '1.0',
    session: {
      session_uid: '0x0000202650A00001',
      track_id: 10,
      track_name: 'Spa-Francorchamps',
      session_type: 'Race',
      weather: 'Light Cloud',
      weather_forecast: weatherForecast,
      total_laps: totalLaps,
      ai_difficulty: 105,
      session_duration: 1892,
      packet_format: 2026,
      player_car_index: 0,
      player_car_source: 'game',
      created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    tags: [
      { name: 'WOR Tier 1', color: '#e10600' },
      { name: 'Medium DF', color: '#00d2be' },
    ],
    participants,
    laps,
    events,
  };
}

function buildCompactSession({
  uid,
  trackId,
  trackName,
  sessionType,
  weather,
  rainPct,
  totalLaps,
  playerGrid,
  playerPos,
  playerBestMs,
  leaderBestMs,
  spreadMs,
  hoursAgo,
  tags,
}) {
  const topDrivers = DRIVERS_2026.slice(0, 10);
  let nextOtherPos = 1;
  let nextOtherGrid = 1;
  const participants = topDrivers.map((drv) => {
    const isPlayer = drv.carIndex === 0;
    let pos = playerPos;
    if (!isPlayer) {
      if (nextOtherPos === playerPos) nextOtherPos++;
      pos = nextOtherPos++;
    }
    let grid = playerGrid;
    if (!isPlayer) {
      if (nextOtherGrid === playerGrid) nextOtherGrid++;
      grid = nextOtherGrid++;
    }
    return {
      car_index: drv.carIndex,
      name: drv.name,
      driver_id: drv.driverId,
      team_id: drv.teamId,
      race_number: drv.raceNumber,
      ai_controlled: !isPlayer,
      nationality: drv.nationality,
      grid_position: grid,
      position: pos,
      points: sessionType === 'Race' ? Math.max(0, 25 - (pos - 1) * 3) : 0,
      total_race_time: Number(((leaderBestMs / 1000) * totalLaps + (pos - 1) * 2.45).toFixed(3)),
      penalties_time: 0,
      num_penalties: 0,
      result_reason: 0,
      num_pit_stops: sessionType === 'Race' ? 1 : 0,
      result_status: 3,
    };
  });

  const offsets = [-1.5, -0.8, -0.2, 0.4, 0.9, 1.4, -1.1, 0.6, -0.4, 1.1];
  const laps = [];
  for (const p of participants) {
    const isPlayer = p.car_index === 0;
    const bestMs = isPlayer
      ? playerBestMs
      : p.position === 1
        ? leaderBestMs
        : leaderBestMs + (p.position - 1) * 210;

    for (let lapNum = 1; lapNum <= totalLaps; lapNum++) {
      const wave = Math.round((offsets[(lapNum - 1) % offsets.length] + 1.5) * spreadMs);
      const lapTimeMs =
        lapNum === totalLaps - 1
          ? bestMs
          : bestMs + wave + (lapNum === 1 && sessionType === 'Race' ? 2_100 : 120);
      const s1Ms = Math.round(lapTimeMs * 0.295);
      const s2Ms = Math.round(lapTimeMs * 0.435);
      const s3Ms = lapTimeMs - s1Ms - s2Ms;
      laps.push({
        lap: {
          car_index: p.car_index,
          lap_number: lapNum,
          lap_time_ms: lapTimeMs,
          sector1_ms: s1Ms,
          sector2_ms: s2Ms,
          sector3_ms: s3Ms,
          is_valid: true,
          tyre_compound: lapNum <= Math.ceil(totalLaps / 2) ? 'Soft' : 'Medium',
          actual_compound: lapNum <= Math.ceil(totalLaps / 2) ? 'C4' : 'C3',
          fuel_load: 18.0,
          max_speed_kmh: 331,
          penalties_seconds: 0,
          car_position: p.position,
          result_status: 3,
          stint: lapNum <= Math.ceil(totalLaps / 2) ? 1 : 2,
          sector1_valid: true,
          sector2_valid: true,
          sector3_valid: true,
        },
      });
    }
  }

  const weatherForecast = JSON.stringify([
    { SessionType: sessionType === 'Race' ? 10 : 5, TimeOffset: 0, Weather: rainPct > 40 ? 3 : 0, TrackTemperature: 30, TrackTemperatureChange: 0, AirTemperature: 22, AirTemperatureChange: 0, RainPercentage: rainPct },
    { SessionType: sessionType === 'Race' ? 10 : 5, TimeOffset: 15, Weather: rainPct > 25 ? 2 : 1, TrackTemperature: 29, TrackTemperatureChange: 1, AirTemperature: 21, AirTemperatureChange: 0, RainPercentage: Math.min(95, rainPct + 15) },
  ]);

  return {
    version: '1.0',
    session: {
      session_uid: uid,
      track_id: trackId,
      track_name: trackName,
      session_type: sessionType,
      weather,
      weather_forecast: weatherForecast,
      total_laps: totalLaps,
      ai_difficulty: 105,
      session_duration: Math.round((playerBestMs / 1000) * totalLaps),
      packet_format: 2026,
      player_car_index: 0,
      player_car_source: 'game',
      created_at: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
    },
    tags,
    participants,
    laps,
    events: [],
  };
}

function buildSeededSessions() {
  return [
    // 3 earlier Spa-Francorchamps sessions so /progress/Spa-Francorchamps has a 4-session trend
    buildCompactSession({
      uid: '0x0000202650A00002',
      trackId: 10,
      trackName: 'Spa-Francorchamps',
      sessionType: 'Race',
      weather: 'Overcast',
      rainPct: 30,
      totalLaps: 10,
      playerGrid: 6,
      playerPos: 3,
      playerBestMs: 105_940,
      leaderBestMs: 105_290,
      spreadMs: 420,
      hoursAgo: 168,
      tags: [{ name: 'League Practice', color: '#ff8700' }],
    }),
    buildCompactSession({
      uid: '0x0000202650A00003',
      trackId: 10,
      trackName: 'Spa-Francorchamps',
      sessionType: 'Qualifying',
      weather: 'Clear',
      rainPct: 5,
      totalLaps: 8,
      playerGrid: 2,
      playerPos: 2,
      playerBestMs: 105_320,
      leaderBestMs: 104_980,
      spreadMs: 310,
      hoursAgo: 96,
      tags: [{ name: 'Quali Trim', color: '#a855f7' }],
    }),
    buildCompactSession({
      uid: '0x0000202650A00004',
      trackId: 10,
      trackName: 'Spa-Francorchamps',
      sessionType: 'Race',
      weather: 'Light Cloud',
      rainPct: 15,
      totalLaps: 10,
      playerGrid: 4,
      playerPos: 2,
      playerBestMs: 104_960,
      leaderBestMs: 104_750,
      spreadMs: 240,
      hoursAgo: 48,
      tags: [{ name: 'WOR Tier 1', color: '#e10600' }],
    }),
    // Multi-track variety for Scene 3 (/history)
    buildCompactSession({
      uid: '0x0000202650A00005',
      trackId: 7,
      trackName: 'Silverstone',
      sessionType: 'Race',
      weather: 'Light Rain',
      rainPct: 65,
      totalLaps: 12,
      playerGrid: 3,
      playerPos: 1,
      playerBestMs: 88_420,
      leaderBestMs: 88_420,
      spreadMs: 210,
      hoursAgo: 30,
      tags: [
        { name: 'WOR Tier 1', color: '#e10600' },
        { name: 'Wet Setup', color: '#3b82f6' },
      ],
    }),
    buildCompactSession({
      uid: '0x0000202650A00006',
      trackId: 11,
      trackName: 'Monza',
      sessionType: 'Qualifying',
      weather: 'Clear',
      rainPct: 0,
      totalLaps: 8,
      playerGrid: 1,
      playerPos: 1,
      playerBestMs: 80_115,
      leaderBestMs: 80_115,
      spreadMs: 180,
      hoursAgo: 18,
      tags: [{ name: 'Low DF', color: '#22c55e' }],
    }),
    buildCompactSession({
      uid: '0x0000202650A00007',
      trackId: 26,
      trackName: 'Zandvoort',
      sessionType: 'Race',
      weather: 'Light Cloud',
      rainPct: 20,
      totalLaps: 12,
      playerGrid: 5,
      playerPos: 2,
      playerBestMs: 71_680,
      leaderBestMs: 71_490,
      spreadMs: 220,
      hoursAgo: 8,
      tags: [{ name: 'WOR Tier 1', color: '#e10600' }],
    }),
    // Hero 18-lap Spa-Francorchamps Race (most recent so it sits at the top of /history)
    buildHeroSpaRaceSession(),
  ];
}

async function seedSessions(baseUrl) {
  const packages = buildSeededSessions();
  let heroSpaId = 0;

  for (const pkg of packages) {
    const res = await fetch(`${baseUrl}/api/sessions/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify(pkg),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to import seeded session (${res.status}): ${text}`);
    }
    const body = await res.json();
    if (pkg.session.session_uid === '0x0000202650A00001') {
      heroSpaId = body.session_id || body.session_ids?.[0] || 0;
    }
  }

  if (!heroSpaId) {
    throw new Error('Did not receive session_id for hero Spa-Francorchamps session');
  }

  const lapsRes = await fetch(`${baseUrl}/api/sessions/${heroSpaId}/laps`);
  const laps = await lapsRes.json();
  const lapA = laps.find((l) => l.car_index === 0 && l.lap_number === 16 && l.has_telemetry);
  const lapB = laps.find((l) => l.car_index === 4 && l.lap_number === 17 && l.has_telemetry);
  if (!lapA || !lapB) {
    throw new Error(`Could not find telemetry laps for Spa session ${heroSpaId}`);
  }

  return { heroSpaId, lapAId: lapA.id, lapBId: lapB.id };
}

async function deleteTransientSessions(baseUrl) {
  const res = await fetch(`${baseUrl}/api/sessions`);
  if (!res.ok) return;
  const sessions = await res.json();
  for (const s of sessions) {
    await fetch(`${baseUrl}/api/sessions/${s.id}`, {
      method: 'DELETE',
      headers: { Origin: baseUrl },
    });
  }
}

async function navigateSpa(cdp, routePath) {
  await cdp.evaluate(`
    (() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.history.pushState({}, '', ${JSON.stringify(routePath)});
      window.dispatchEvent(new PopStateEvent('popstate'));
    })()
  `);
}

async function scrollHeadingIntoView(cdp, patternSource, offsetPx = 76) {
  await cdp.evaluate(`
    (() => {
      const re = new RegExp(${JSON.stringify(patternSource)}, 'i');
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="group"]'));
      const target = headings.find((el) => re.test((el.textContent || '').trim()));
      if (target) {
        const rect = target.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - ${offsetPx}), behavior: 'instant' });
      }
    })()
  `);
}

function createFrameRecorder(cdp, framesDir) {
  let frameIndex = 0;
  return {
    async captureFrames(count, intervalMs = 130) {
      for (let i = 0; i < count; i++) {
        const start = Date.now();
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        });
        frameIndex++;
        const fileName = `frame_${String(frameIndex).padStart(4, '0')}.png`;
        await fsp.writeFile(path.join(framesDir, fileName), Buffer.from(data, 'base64'));
        const elapsed = Date.now() - start;
        if (i + 1 < count && elapsed < intervalMs) {
          await sleep(intervalMs - elapsed);
        }
      }
    },
    getFrameCount() {
      return frameIndex;
    },
  };
}

async function captureWalkthrough({ cdp, framesDir, baseUrl, udpPort, simulatorBin }) {
  const recorder = createFrameRecorder(cdp, framesDir);

  // ---------------------------------------------------------------------------
  // PHASE A: Live 20Hz Telemetry Capture (Scene 1 & Scene 2)
  // ---------------------------------------------------------------------------
  console.log('▶ Phase A: Starting 20Hz F1 2026 rain simulator...');
  const simProc = spawn(
    simulatorBin,
    ['-format', '2026', '-scenario', 'rain', '-target', `127.0.0.1:${udpPort}`],
    { stdio: 'ignore' }
  );

  try {
    await cdp.send('Page.navigate', { url: `${baseUrl}/live/dashboard` });
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const ready = await cdp.evaluate(`
        Boolean(document.body && document.body.innerText.includes('Verstappen') && document.body.innerText.includes('LIVE'))
      `);
      if (ready) break;
      await sleep(200);
    }
    await sleep(600);

    // Trigger proactive rain crossover call so LiveRadioHUD displays BONO SPEAKING + waveform
    await cdp.evaluate(`window.__demoEmitDirective?.('flags_rain', 'weather', 'high')`);
    await sleep(250);

    console.log('  • Capturing Scene 1: Live Pit Wall & Race Control Hub (/live/dashboard)...');
    await recorder.captureFrames(11, 130);

    // Scroll directly to the 2x2 Race Control Hub (Feed, Weather Radar, Pit Strategy, Sectors)
    await scrollHeadingIntoView(cdp, 'Race Control & Incidents', 78);
    await cdp.evaluate(`window.__demoEmitDirective?.('tyre_crossover_inter', 'weather', 'high')`);
    await sleep(250);
    await recorder.captureFrames(11, 130);

    // Scene 2: Switch to Voice Cockpit Mode (/live/cockpit)
    console.log('  • Capturing Scene 2: Voice Cockpit Mode (/live/cockpit)...');
    await navigateSpa(cdp, '/live/cockpit');
    await sleep(350);
    await cdp.evaluate(`window.__demoEmitDirective?.('pit_window_open', 'strategy', 'high')`);
    await sleep(250);
    await recorder.captureFrames(15, 130);
  } finally {
    simProc.kill('SIGTERM');
  }

  await sleep(350);
  await deleteTransientSessions(baseUrl);

  // ---------------------------------------------------------------------------
  // PHASE B: Deterministic 2026 Session Seeding & Recorded Capture (Scenes 3–7)
  // ---------------------------------------------------------------------------
  console.log('▶ Phase B: Seeding 7 deterministic F1 2026 sessions...');
  const { heroSpaId, lapAId, lapBId } = await seedSessions(baseUrl);

  // Scene 3: Session History List (/history)
  console.log('  • Capturing Scene 3: Multi-Track Session History (/history)...');
  await cdp.send('Page.navigate', { url: `${baseUrl}/history` });
  const listDeadline = Date.now() + 10_000;
  while (Date.now() < listDeadline) {
    const ready = await cdp.evaluate(`
      Boolean(document.body && document.body.innerText.includes('Spa-Francorchamps') && document.body.innerText.includes('Silverstone'))
    `);
    if (ready) break;
    await sleep(150);
  }
  await sleep(450);
  await recorder.captureFrames(14, 130);

  // Scene 4: Session Story Tab (/history/:id) + Streaming AI Debrief
  console.log('  • Capturing Scene 4: Session Story & AI Debrief (/history/' + heroSpaId + ')...');
  await navigateSpa(cdp, `/history/${heroSpaId}`);
  await sleep(650);
  await recorder.captureFrames(9, 130);

  // Click "Write the debrief" button in SessionDebriefPanel and frame FieldPaceChart + KeyMoments + streaming Debrief
  await cdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const writeBtn = buttons.find((b) => /write.*debrief/i.test(b.textContent || ''));
      if (writeBtn) writeBtn.click();
    })()
  `);
  await scrollHeadingIntoView(cdp, 'Your pace against the field', -60);
  await sleep(250);
  await recorder.captureFrames(13, 130);

  // Scene 5: Classification (Gap/Interval) & Tyres & Stints (/history/:id/classification & /stints)
  console.log('  • Capturing Scene 5: Classification & Stint Degradation (/history/' + heroSpaId + '/stints)...');
  await navigateSpa(cdp, `/history/${heroSpaId}/classification`);
  await sleep(500);
  await scrollHeadingIntoView(cdp, 'Official Race Classification', 260);
  await sleep(200);
  await recorder.captureFrames(6, 130);

  // Toggle Interval mode in ClassificationTable
  await cdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const intervalBtn = buttons.find((b) => /^interval$/i.test((b.textContent || '').trim()));
      if (intervalBtn) intervalBtn.click();
    })()
  `);
  await sleep(250);
  await recorder.captureFrames(6, 130);

  // Switch to Tyres & Stints tab
  await navigateSpa(cdp, `/history/${heroSpaId}/stints`);
  await sleep(500);
  await recorder.captureFrames(7, 130);

  // Scroll to show DegradationTable rows + the full DegradationCurves chart (with hollow excluded-lap dots)
  await scrollHeadingIntoView(cdp, 'Tyre Degradation', -210);
  await sleep(300);
  await recorder.captureFrames(10, 130);

  // Scene 6: Lap Comparator, Track Map, Where Did I Lose Time, Strip Charts & Ask AI
  console.log('  • Capturing Scene 6: Lap Comparator, Strip Charts & Ask AI (/compare)...');
  await navigateSpa(cdp, `/compare?sa=${heroSpaId}&a=${lapAId}&b=${lapBId}`);
  const compareDeadline = Date.now() + 10_000;
  while (Date.now() < compareDeadline) {
    const ready = await cdp.evaluate(`
      Boolean(document.body && document.body.innerText.includes('Where did I lose time') && document.body.innerText.includes('T1'))
    `);
    if (ready) break;
    await sleep(150);
  }
  await sleep(450);
  await scrollHeadingIntoView(cdp, 'Where did I lose time', 220);
  await sleep(200);
  await recorder.captureFrames(9, 130);

  // Switch to Strip Charts view and scroll to frame the synchronized StripCharts (including 2026 Active Aero)
  await cdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const stripsBtn = buttons.find((b) => /^strips$/i.test((b.textContent || '').trim()));
      if (stripsBtn) stripsBtn.click();
    })()
  `);
  await sleep(250);
  await scrollHeadingIntoView(cdp, 'Zoom', -135);
  await sleep(300);
  await recorder.captureFrames(9, 130);

  // Scroll back to CornerTable and click "Ask the AI engineer about T1" to zoom to T1 and stream AI corner analysis
  await scrollHeadingIntoView(cdp, 'Where did I lose time', 220);
  await sleep(200);
  await cdp.evaluate(`
    (() => {
      const askBtn =
        Array.from(document.querySelectorAll('button')).find((b) =>
          /ask.*ai.*t1/i.test(b.getAttribute('aria-label') || '')
        );
      if (askBtn) askBtn.click();
    })()
  `);
  await sleep(300);
  await recorder.captureFrames(13, 130);

  // Close AI chat panel before navigating to Track Progress
  await cdp.evaluate(`
    (() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
          /close/i.test(b.getAttribute('aria-label') || '')
        );
        if (closeBtn) closeBtn.click();
      }
    })()
  `);
  await sleep(200);

  // Scene 7: Track Progress (/progress/Spa-Francorchamps)
  console.log('  • Capturing Scene 7: Track Progress (/progress/Spa-Francorchamps)...');
  await navigateSpa(cdp, '/progress/Spa-Francorchamps');
  const progressDeadline = Date.now() + 10_000;
  while (Date.now() < progressDeadline) {
    const ready = await cdp.evaluate(`
      Boolean(document.body && document.body.innerText.includes('PERSONAL BEST') && document.body.innerText.includes('Spa-Francorchamps'))
    `);
    if (ready) break;
    await sleep(150);
  }
  await sleep(450);
  await recorder.captureFrames(8, 130);
  await scrollHeadingIntoView(cdp, 'Best lap and sectors', 76);
  await sleep(250);
  await recorder.captureFrames(8, 130);

  return recorder.getFrameCount();
}

function encodeGifWithFfmpeg({ framesDir, palettePath, outputPath, width, height, fps }) {
  console.log(`▶ Encoding 2-pass Lanczos GIF (${width}x${height} @ ${fps} fps)...`);
  const inputPattern = path.join(framesDir, 'frame_%04d.png');

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      inputPattern,
      '-vf',
      `scale=${width}:${height}:flags=lanczos,palettegen=stats_mode=diff`,
      palettePath,
    ],
    { stdio: 'ignore' }
  );

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      inputPattern,
      '-i',
      palettePath,
      '-lavfi',
      `scale=${width}:${height}:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      '-loop',
      '0',
      outputPath,
    ],
    { stdio: 'ignore' }
  );
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  const chromeBin = detectChromeBinary(opts.chrome);
  const outputPath = path.resolve(REPO_ROOT, opts.output);

  // Keep headless viewport above the 1100px --laptop breakpoint while matching target aspect ratio
  const scale = Math.max(1, 1200 / opts.width);
  const viewportWidth = Math.round(opts.width * scale);
  const viewportHeight = Math.round(opts.height * scale);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'f1-demo-gif-'));
  const framesDir = path.join(tempDir, 'frames');
  const chromeProfileDir = path.join(tempDir, 'chrome-profile');
  const dbPath = path.join(tempDir, 'demo.db');
  const palettePath = path.join(tempDir, 'palette.png');
  const binExt = process.platform === 'win32' ? '.exe' : '';
  const serverBin = path.join(tempDir, `server${binExt}`);
  const simulatorBin = path.join(tempDir, `simulator${binExt}`);

  await fsp.mkdir(framesDir, { recursive: true });
  await fsp.mkdir(chromeProfileDir, { recursive: true });
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  let serverProc = null;
  let chromeProc = null;
  let cdp = null;

  try {
    if (!opts.skipBuild) {
      console.log('▶ Building production frontend (frontend/dist)...');
      execFileSync('npm', ['--prefix', 'frontend', 'run', 'build'], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
      });
    }

    console.log('▶ Compiling isolated server and simulator binaries...');
    execFileSync('go', ['build', '-o', serverBin, './cmd/server'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    execFileSync('go', ['build', '-o', simulatorBin, './cmd/simulator'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });

    const httpPort = await getFreeTcpPort();
    const udpPort = await getFreeUdpPort();
    const baseUrl = `http://127.0.0.1:${httpPort}`;

    console.log(`▶ Starting isolated Go server on ${baseUrl} (UDP 127.0.0.1:${udpPort})...`);
    serverProc = spawn(
      serverBin,
      [
        '-http',
        `127.0.0.1:${httpPort}`,
        '-udp',
        `127.0.0.1:${udpPort}`,
        '-db',
        dbPath,
        '-no-browser',
      ],
      {
        cwd: tempDir,
        stdio: 'ignore',
      }
    );

    await waitForServer(baseUrl);

    console.log(`▶ Launching headless Chrome (${viewportWidth}x${viewportHeight} viewport)...`);
    const launched = await launchHeadlessChrome(
      chromeBin,
      chromeProfileDir,
      viewportWidth,
      viewportHeight
    );
    chromeProc = launched.proc;
    cdp = launched.cdp;

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: buildPreloadScript(),
    });

    const totalFrames = await captureWalkthrough({
      cdp,
      framesDir,
      baseUrl,
      udpPort,
      simulatorBin,
    });

    encodeGifWithFfmpeg({
      framesDir,
      palettePath,
      outputPath,
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
    });

    const stat = await fsp.stat(outputPath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(
      `✔ Successfully generated ${path.relative(REPO_ROOT, outputPath)} (${totalFrames} frames, ${opts.width}x${opts.height} @ ${opts.fps} fps, ${sizeMb} MB)`
    );
  } finally {
    if (cdp) {
      await cdp.close().catch(() => {});
    }
    if (chromeProc) {
      chromeProc.kill('SIGTERM');
    }
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
    if (!opts.keepTemp) {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    } else {
      console.log(`ℹ Kept temporary directory at: ${tempDir}`);
    }
  }
}

main().catch((err) => {
  console.error('✖ Failed to generate demo GIF:', err);
  process.exit(1);
});
