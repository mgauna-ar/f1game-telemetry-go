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

    expect(screen.getByText('Using the .env key')).toBeInTheDocument();
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
  const customConfig: AIConfig = { ...config, provider: 'custom', model: 'llama3', baseUrl: '' };

  it('saves the base URL when the field loses focus, not on every keystroke', () => {
    const props = renderDrawer({ config: customConfig });

    const input = screen.getByLabelText('Server address');
    fireEvent.change(input, { target: { value: 'http://localhost:11434/v1' } });
    expect(props.saveConfig).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(props.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://localhost:11434/v1' })
    );
  });

  it('fills in the address of a known server in one click', () => {
    const props = renderDrawer({ config: customConfig });

    fireEvent.click(screen.getByRole('button', { name: /LM Studio/ }));

    expect(props.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'http://localhost:1234/v1' }));
  });

  it('marks a key optional and says local servers need none', () => {
    renderDrawer({ config: { ...customConfig, baseUrl: 'http://localhost:11434/v1' } });

    expect(screen.getByText('API key (optional)')).toBeInTheDocument();
    expect(screen.getByText(/need no key/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ollama/ })).toHaveClass('is-selected');
  });

  it('links to where a hosted server hands out keys', () => {
    renderDrawer({ config: { ...customConfig, baseUrl: 'https://api.groq.com/openai/v1' } });

    expect(screen.getByText('Get a key at Groq').closest('a')).toHaveAttribute('href', 'https://console.groq.com/keys');
  });

  it('asks for the address before listing models', () => {
    renderDrawer({ config: customConfig });

    expect(screen.getByText('Enter the server address to see its models.')).toBeInTheDocument();
  });
});

describe('ChatSettingsDrawer providers', () => {
  it('shows every provider with whether it is ready to use', () => {
    renderDrawer({ keyStatus: { ...NO_AI_KEYS, claude: { hasSavedKey: true, hasEnvKey: false } } });

    const card = (provider: string) => document.querySelector(`[data-provider="${provider}"]`) as HTMLElement;
    expect(card('gemini')).toHaveAttribute('aria-checked', 'true');
    expect(card('gemini')).toHaveTextContent('Needs a key');
    expect(card('claude')).toHaveTextContent('Ready');
    expect(card('custom')).toHaveTextContent('Needs an address');
  });

  it('switches provider with that provider\'s own model', () => {
    const props = renderDrawer();

    fireEvent.click(document.querySelector('[data-provider="openai"]') as HTMLElement);

    expect(props.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai', model: 'gpt-4o-mini' }));
  });

  it('links a cloud provider to where its keys are made', () => {
    renderDrawer({ config: { ...config, provider: 'claude', model: 'claude-opus-5' } });

    expect(screen.getByText('Get a key at Claude Console').closest('a')).toHaveAttribute(
      'href',
      'https://platform.claude.com/settings/keys'
    );
    expect(screen.queryByLabelText('Server address')).not.toBeInTheDocument();
  });
});

describe('ChatSettingsDrawer model list', () => {
  const models = [
    { id: 'gemini-flash-latest', display_name: 'Gemini Flash' },
    { id: 'gemini-pro-latest', display_name: 'Gemini Pro' },
  ];
  const withKey = { ...NO_AI_KEYS, gemini: { hasSavedKey: true, hasEnvKey: false } };

  it('filters the list as you type and picks a model', () => {
    const props = renderDrawer({ keyStatus: withKey, availableModels: models });

    fireEvent.change(screen.getByPlaceholderText('Search models or type a name'), { target: { value: 'pro' } });
    expect(screen.queryByText('Gemini Flash')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Gemini Pro'));
    expect(props.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-pro-latest' }));
  });

  it('uses a typed model name that is not listed', () => {
    const props = renderDrawer({ keyStatus: withKey, availableModels: models });

    const search = screen.getByPlaceholderText('Search models or type a name');
    fireEvent.change(search, { target: { value: 'gemini-experimental' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(props.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-experimental' }));
  });

  it('saves a typed model name only when done typing when no list is loaded', () => {
    const props = renderDrawer();

    const input = screen.getByDisplayValue('gemini-flash-latest');
    fireEvent.change(input, { target: { value: 'gemini-pro-latest' } });
    expect(props.saveConfig).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-pro-latest' }));
  });
});
