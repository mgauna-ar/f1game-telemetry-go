import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatMessageList } from './ChatMessageList';
import type { ChatMessage } from '../../types/ai';

const at = new Date('2026-09-25T22:30:00');

const renderList = (messages: ChatMessage[], isGenerating = false) =>
  render(
    <ChatMessageList
      messages={messages}
      isGenerating={isGenerating}
      defaultProvider="gemini"
      onRetry={vi.fn()}
      onOpenSettings={vi.fn()}
    />
  );

describe('ChatMessageList', () => {
  it('formats a reply with tables and lists', () => {
    renderList([
      {
        id: 'a1',
        role: 'assistant',
        content: '## Sectors\n| Sector | Delta |\n|---|---|\n| S2 | +0.439 |\n\n- Brake later\n- Lift less',
        timestamp: at,
      },
    ]);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sectors' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps the line breaks of a question as typed', () => {
    renderList([{ id: 'u1', role: 'user', content: 'Line one\n**not bold**', timestamp: at }]);

    expect(screen.getByText(/Line one/).textContent).toBe('Line one\n**not bold**');
  });

  it('copies a finished reply', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderList([{ id: 'a1', role: 'assistant', content: 'Box this lap', timestamp: at }]);

    fireEvent.click(screen.getByRole('button', { name: 'Copy reply' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Box this lap'));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('offers no copy while a reply is still streaming', () => {
    renderList(
      [
        { id: 'u1', role: 'user', content: 'Gap?', timestamp: at },
        { id: 'a1', role: 'assistant', content: 'The gap is', timestamp: at },
      ],
      true
    );

    expect(screen.queryByRole('button', { name: 'Copy reply' })).not.toBeInTheDocument();
  });
});
