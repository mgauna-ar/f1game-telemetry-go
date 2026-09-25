import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatSettingsDrawer, type ChatSettingsDrawerProps } from './ChatSettingsDrawer';
import { NO_AI_KEYS, type AIConfig } from '../../context/RaceEngineerContext';

const config: AIConfig = {
  provider: 'gemini',
  model: 'gemini-flash-latest',
  baseUrl: '',
  providerModels: { gemini: 'gemini-flash-latest', openai: 'gpt-4o-mini', claude: '', custom: 'llama3' },
};

const renderDrawer = (props: Partial<ChatSettingsDrawerProps> = {}) => {
  const allProps: ChatSettingsDrawerProps = {
    isOpen: true,
    onClose: vi.fn(),
    config,
    saveConfig: vi.fn(),
    keyStatus: NO_AI_KEYS,
    saveApiKey: vi.fn().mockResolvedValue(undefined),
    availableModels: [],
    isLoadingModels: false,
    modelsError: null,
    fetchAvailableModels: vi.fn().mockResolvedValue(undefined),
    ...props,
  };
  render(<ChatSettingsDrawer {...allProps} />);
  return allProps;
};

describe('ChatSettingsDrawer API key field', () => {
  it('never shows a saved key, only that one is saved', () => {
    renderDrawer({ keyStatus: { ...NO_AI_KEYS, gemini: { hasSavedKey: true, hasEnvKey: false } } });

    const input = screen.getByPlaceholderText(/Saved\. Enter a new key/i) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByText('Key saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove saved key' })).toBeInTheDocument();
  });

  it('shows when the key comes from .env', () => {
    renderDrawer({ keyStatus: { ...NO_AI_KEYS, gemini: { hasSavedKey: false, hasEnvKey: true } } });

    expect(screen.getByText('Server .env active')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove saved key' })).not.toBeInTheDocument();
  });

  it('sends a typed key to the server and clears the field', async () => {
    const props = renderDrawer();

    const input = screen.getByPlaceholderText('Enter your API key...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'AIza-new-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => expect(props.saveApiKey).toHaveBeenCalledWith('gemini', 'AIza-new-key'));
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('removes the saved key', async () => {
    const props = renderDrawer({ keyStatus: { ...NO_AI_KEYS, gemini: { hasSavedKey: true, hasEnvKey: false } } });

    fireEvent.click(screen.getByRole('button', { name: 'Remove saved key' }));

    await waitFor(() => expect(props.saveApiKey).toHaveBeenCalledWith('gemini', ''));
  });

  it('shows why a key could not be saved', async () => {
    renderDrawer({ saveApiKey: vi.fn().mockRejectedValue(new Error('settings storage not available')) });

    fireEvent.change(screen.getByPlaceholderText('Enter your API key...'), { target: { value: 'k' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    expect(await screen.findByText('settings storage not available')).toBeInTheDocument();
  });
});

describe('ChatSettingsDrawer custom endpoint', () => {
  it('saves the base URL when the field loses focus, not on every keystroke', () => {
    const props = renderDrawer({ config: { ...config, provider: 'custom', model: 'llama3' } });

    const input = screen.getByPlaceholderText('https://api.openai.com/v1');
    fireEvent.change(input, { target: { value: 'http://localhost:11434/v1' } });
    expect(props.saveConfig).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(props.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://localhost:11434/v1' })
    );
  });
});
