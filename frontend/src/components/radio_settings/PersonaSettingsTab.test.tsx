import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaSettingsTab } from './PersonaSettingsTab';
import {
  DEFAULT_CONFIG,
  NO_AI_KEYS,
  RaceEngineerStateContext,
  type RaceEngineerStateContextValue,
} from '../../context/RaceEngineerContextDefinitions';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import { api } from '../../utils/apiClient';

const aiState = (hasKey: boolean): RaceEngineerStateContextValue => ({
  isOpen: false,
  contextMode: 'general',
  comparatorTarget: null,
  sessionDebriefTarget: null,
  config: DEFAULT_CONFIG,
  keyStatus: { ...NO_AI_KEYS, [DEFAULT_CONFIG.provider]: { hasSavedKey: hasKey, hasEnvKey: false } },
  availableModels: [],
  isLoadingModels: false,
  modelsError: null,
});

const renderTab = (hasKey: boolean) =>
  render(
    <RaceEngineerStateContext.Provider value={aiState(hasKey)}>
      <PersonaSettingsTab />
    </RaceEngineerStateContext.Provider>
  );

describe('PersonaSettingsTab AI-worded calls', () => {
  beforeEach(() => {
    useRadioSettingsStore.setState({ aiRadioLines: true });
    // The switch saves the voice to the server.
    vi.spyOn(api, 'put').mockResolvedValue({});
  });

  it('turns the AI wording of routine calls off and on', () => {
    renderTab(true);
    const toggle = screen.getByRole('switch', { name: /AI words the routine calls/ });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(useRadioSettingsStore.getState().aiRadioLines).toBe(false);
  });

  it('says an AI provider is needed while none is set up', () => {
    const { unmount } = renderTab(false);
    expect(screen.getByText(/Set up an AI provider/)).toBeInTheDocument();
    unmount();

    renderTab(true);
    expect(screen.queryByText(/Set up an AI provider/)).not.toBeInTheDocument();
  });
});
