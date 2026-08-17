import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Square, Sparkles, RefreshCw } from 'lucide-react';
import type { Session } from '../SessionHistory';
import type { DriverStanding } from './SessionClassificationTab';

interface SessionAiDebriefDrawerProps {
  session: Session;
  driverStandings: DriverStanding[];
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  onClose: () => void;
  formatLapTime: (ms: number) => string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const STORAGE_KEY_AI_CONFIG = 'f1_ai_engineer_config';

export const SessionAiDebriefDrawer: React.FC<SessionAiDebriefDrawerProps> = ({
  session,
  driverStandings,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
  onClose,
  formatLapTime,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your **AI Race Engineer**.\n\nI have loaded the telemetry and timing data for **${session.track_name} (${session.session_type})** with ${driverStandings.length} drivers.\n\nSelect a debrief topic below or ask me any question about race pace, tyre degradation, sector deltas, or strategy!`,
      timestamp: new Date(),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  // Generate contextual session telemetry summary
  const generateSessionSummaryText = () => {
    const top3Names = driverStandings.slice(0, 3).map((d, i) => `P${i + 1}: ${d.participant.name} (Best: ${formatLapTime(d.bestLapTimeMS)})`).join(', ');

    const ultimateMS = sessionBestS1 + sessionBestS2 + sessionBestS3;

    let text = `SESSION OVERVIEW:
- Circuit: ${session.track_name}
- Session Type: ${session.session_type}
- Weather: ${session.weather || 'Clear'}
- Total Drivers: ${driverStandings.length}
- Podium / Top Finishers: ${top3Names || 'None'}
- Session Record Sectors: S1: ${(sessionBestS1 / 1000).toFixed(3)}s, S2: ${(sessionBestS2 / 1000).toFixed(3)}s, S3: ${(sessionBestS3 / 1000).toFixed(3)}s
- Ultimate Session Theoretical Lap: ${ultimateMS > 0 ? formatLapTime(ultimateMS) : 'N/A'}

DRIVER DETAILS & TYRE STINTS:
`;

    driverStandings.slice(0, 8).forEach((d) => {
      const stints = d.laps.map((l) => `${l.tyre_compound || 'S'}`).filter(Boolean).join(' -> ');
      text += `- P${d.position} ${d.participant.name} (#${d.participant.race_number}): Best Lap: ${formatLapTime(d.bestLapTimeMS)}, S1: ${(d.bestS1MS / 1000).toFixed(3)}s, S2: ${(d.bestS2MS / 1000).toFixed(3)}s, S3: ${(d.bestS3MS / 1000).toFixed(3)}s, Max Speed: ${d.maxSpeed.toFixed(1)} km/h, Total Laps: ${d.laps.length}, Stints: ${stints || 'None'}, Status: ${d.isDSQ ? 'DSQ' : d.isDNF ? 'DNF' : 'Finished'}\n`;
    });

    return text;
  };

  const getAIConfig = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY_AI_CONFIG);
        if (saved) return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return { provider: 'gemini', model: 'gemini-flash-lite-latest', apiKey: '', baseUrl: '' };
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const text = customPrompt || inputMessage.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const assistantMsgId = `asst-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputMessage('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const config = getAIConfig();
      const sessionContext = generateSessionSummaryText();

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: {
            session_info: `Track: ${session.track_name}, Type: ${session.session_type}, Weather: ${session.weather}`,
            telemetry_summary: sessionContext,
          },
          config: {
            provider: config.provider || 'gemini',
            api_key: config.apiKey || '',
            model: config.model || 'gemini-flash-lite-latest',
            base_url: config.baseUrl || '',
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server responded with ${res.status}`);
      }

      if (!res.body) throw new Error('No response body from AI server');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                accumulatedContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
                  )
                );
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('AI chat error:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `⚠️ **Error communicating with AI Race Engineer:**\n${err.message || err}\n\n*Please ensure your AI provider and API key are configured in the settings.*`,
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const quickPromptChips = [
    { label: '🏎️ Tyre Strategy Debrief', prompt: 'Analyze the tyre strategies, stint lengths, and degradation across the field for this session. Who made the best strategy calls?' },
    { label: '⚡ Sector Performance Breakdown', prompt: 'Where was time gained or lost across Sector 1, Sector 2, and Sector 3? Compare the ultimate theoretical session lap to the actual fastest laps.' },
    { label: '🏆 Race Pace Consistency', prompt: 'Summarize the overall race pace consistency of the top drivers and identify key performance outliers or potential pit stop advantages.' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'rgba(15, 20, 30, 0.95)',
          borderLeft: '1px solid rgba(0, 242, 254, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          boxShadow: '-10px 0 30px rgba(0,0,0,0.8)',
          borderRadius: 0,
          padding: 0,
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(0, 242, 254, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00f2fe' }}>
              <Bot size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                AI Race Engineer <Sparkles size={14} color="#ffd700" />
              </h3>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {session.track_name} • {session.session_type}
              </span>
            </div>
          </div>

          <button
            className="nav-tab"
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Debrief Prompt Chips */}
        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', gap: '6px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          {quickPromptChips.map((chip, idx) => (
            <button
              key={idx}
              className="nav-tab"
              onClick={() => handleSendMessage(chip.prompt)}
              disabled={isStreaming}
              style={{
                padding: '4px 9px',
                fontSize: '0.73rem',
                borderRadius: '14px',
                background: 'rgba(0, 242, 254, 0.08)',
                borderColor: 'rgba(0, 242, 254, 0.25)',
                color: '#00f2fe',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Chat Messages List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                backgroundColor: m.role === 'user' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${m.role === 'user' ? 'rgba(0, 242, 254, 0.3)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {m.role === 'assistant' ? <Bot size={12} color="#00f2fe" /> : null}
                <span>{m.role === 'assistant' ? 'Race Engineer' : 'You'}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                {m.content || (isStreaming && m.role === 'assistant' ? <RefreshCw size={14} className="animate-spin" /> : '')}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <input
              type="text"
              placeholder="Ask AI Race Engineer about this session..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                fontSize: '0.85rem',
              }}
            />

            {isStreaming ? (
              <button
                type="button"
                className="nav-tab active"
                onClick={handleStopStreaming}
                style={{ padding: '0.6rem 1rem', background: '#ff4d4f', borderColor: '#ff4d4f' }}
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="nav-tab active"
                disabled={!inputMessage.trim()}
                style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Send size={15} />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
