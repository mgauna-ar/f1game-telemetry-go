import React, { useEffect, useRef } from 'react';
import {
  providerHasKey,
  useRaceEngineerActions,
  useRaceEngineerState,
} from '../../context/RaceEngineerContextDefinitions';
import { AiSettingsFields } from '../ai_engineer/ChatSettingsDrawer';
import styles from './SettingsPage.module.css';

/** The AI provider, key and models: the chat's own settings fields plus the radio model. */
export const AiSettingsSection: React.FC = () => {
  const { config, keyStatus, availableModels, isLoadingModels, modelsError } = useRaceEngineerState();
  const { saveConfig, saveApiKey, fetchAvailableModels } = useRaceEngineerActions();

  // Load the model list on opening, switching provider or server, or once a key is saved
  const hasKey = providerHasKey(keyStatus, config.provider);
  const serverAddress = config.provider === 'custom' ? config.baseUrl : '';
  const fetchModelsRef = useRef(fetchAvailableModels);
  fetchModelsRef.current = fetchAvailableModels;
  useEffect(() => {
    if (hasKey) void fetchModelsRef.current();
  }, [config.provider, serverAddress, hasKey]);

  return (
    <div className={styles.aiFields}>
      <AiSettingsFields
        config={config}
        saveConfig={saveConfig}
        keyStatus={keyStatus}
        saveApiKey={saveApiKey}
        availableModels={availableModels}
        isLoadingModels={isLoadingModels}
        modelsError={modelsError}
        fetchAvailableModels={fetchAvailableModels}
        showRadioModel
      />
    </div>
  );
};
