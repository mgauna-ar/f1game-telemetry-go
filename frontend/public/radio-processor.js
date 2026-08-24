/**
 * F1 Radio AudioWorklet Processor
 * Runs on the dedicated Web Audio rendering thread for zero main-thread CPU overhead.
 * Handles realtime noise generation, band-limited squelch, and subtle cockpit saturation.
 */
class F1RadioProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'staticLevel', defaultValue: 0.05, minValue: 0, maxValue: 1 },
      { name: 'distortion', defaultValue: 0.15, minValue: 0, maxValue: 1 },
      { name: 'active', defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this.lastNoise = 0.0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const input = inputs[0];
    if (!output || output.length === 0) return true;

    const staticLevel = parameters.staticLevel ? parameters.staticLevel[0] : 0.05;
    const distortion = parameters.distortion ? parameters.distortion[0] : 0.15;
    const active = parameters.active ? parameters.active[0] : 1;

    const channelCount = output.length;
    const bufferLength = output[0].length;

    // Squelch gate: If inactive or no audio input stream is connected, output silence
    if (active < 0.5 || !input || input.length === 0 || !input[0] || input[0].length === 0) {
      for (let channel = 0; channel < channelCount; channel++) {
        if (output[channel]) {
          output[channel].fill(0);
        }
      }
      return true;
    }

    for (let i = 0; i < bufferLength; i++) {
      // 1. Generate integrated pink/bandpass radio hiss
      const white = Math.random() * 2 - 1;
      this.lastNoise = (this.lastNoise + 0.025 * white) / 1.025;
      const noiseSample = this.lastNoise * staticLevel * 2.5;

      for (let channel = 0; channel < channelCount; channel++) {
        let voiceSample = input[channel] ? input[channel][i] : 0.0;

        // 2. Mix voice and cockpit radio static
        let mixed = voiceSample + noiseSample;

        // 3. Subtle analog soft saturation / clipping
        if (distortion > 0.01) {
          const k = distortion * 10;
          mixed = Math.tanh(mixed * (1 + k)) / (1 + k * 0.5);
        }

        output[channel][i] = mixed;
      }
    }

    return true;
  }
}

registerProcessor('f1-radio-processor', F1RadioProcessor);
