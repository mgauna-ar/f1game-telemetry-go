import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { api } from './utils/apiClient';
import { useRaceEngineerActions, useRaceEngineerStream } from './context/RaceEngineerContext';

// The logo takes no props, so it renders exactly when AppContent (its parent) renders.
const renders = vi.hoisted(() => ({ appContent: 0, chat: 0 }));

vi.mock('./components/F1TelemetryLogo', () => ({
  F1TelemetryLogo: () => {
    renders.appContent++;
    return <span data-testid="logo" />;
  },
}));

vi.mock('./components/SessionHistory', () => ({
  SessionHistory: () => <div data-testid="session-history-view" />,
}));
vi.mock('./components/LapComparator', () => ({
  LapComparator: () => <div data-testid="lap-comparator-view" />,
}));
vi.mock('./components/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard-view" />,
}));

// A minimal chat panel: sends a message and shows the streamed reply.
vi.mock('./components/AiRaceEngineer', () => ({
  AiRaceEngineer: () => {
    renders.chat++;
    const { sendMessage } = useRaceEngineerActions();
    const { messages } = useRaceEngineerStream();
    return (
      <div>
        <button onClick={() => void sendMessage('Radio check')}>send</button>
        <p data-testid="reply">{messages[messages.length - 1]?.content}</p>
      </div>
    );
  },
}));

const CHUNKS = ['Loud ', 'and ', 'clear, ', 'radio ', 'check ', 'complete.'];

/** An SSE reply that delivers one chunk per macrotask, so each lands in its own render. */
function slowChatReply(): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream({
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (i < CHUNKS.length) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: CHUNKS[i++] })}\n\n`));
      } else {
        controller.close();
      }
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('AppContent re-renders', () => {
  beforeEach(() => {
    localStorage.clear();
    renders.appContent = 0;
    renders.chat = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/settings/ai') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              saved: false,
              provider: 'gemini',
              base_url: '',
              providers: {
                gemini: { model: 'gemini-flash-lite-latest', has_saved_key: false, has_env_key: true },
                openai: { model: '', has_saved_key: false, has_env_key: false },
                claude: { model: '', has_saved_key: false, has_env_key: false },
                custom: { model: '', has_saved_key: false, has_env_key: false },
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('does not re-render AppContent while a chat reply streams in', async () => {
    const streamSpy = vi.spyOn(api, 'stream').mockImplementation(async () => slowChatReply());
    render(<App />);
    await screen.findByTestId('session-history-view');
    // Let the startup requests (settings, version, endpoint) settle first.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const appRendersBefore = renders.appContent;
    const chatRendersBefore = renders.chat;

    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(screen.getByTestId('reply')).toHaveTextContent('Loud and clear, radio check complete.'));

    expect(streamSpy).toHaveBeenCalledTimes(1);
    // The chat panel did see every chunk...
    expect(renders.chat - chatRendersBefore).toBeGreaterThanOrEqual(CHUNKS.length);
    // ...and AppContent never re-rendered for them.
    expect(renders.appContent).toBe(appRendersBefore);
  });
});
