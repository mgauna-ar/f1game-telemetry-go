import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RaceEngineerActionsContext, useRaceEngineerActions } from '../../context/RaceEngineerContext';
import { AskAiButton } from './AskAiButton';

describe('AskAiButton', () => {
  it('opens the chat with its question, named for the chart it is about', () => {
    const openChat = vi.fn();
    const Harness = () => {
      const actions = useRaceEngineerActions();
      return (
        <RaceEngineerActionsContext.Provider value={{ ...actions, openChat }}>
          <AskAiButton prompt="Which stints wore fastest?" about="Tyre degradation" />
        </RaceEngineerActionsContext.Provider>
      );
    };
    render(<Harness />);

    const button = screen.getByRole('button', { name: 'Ask the AI engineer about Tyre degradation' });
    expect(button).toHaveTextContent('Ask AI');
    fireEvent.click(button);
    expect(openChat).toHaveBeenCalledWith('Which stints wore fastest?');
  });
});
