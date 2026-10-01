// Settings wire types generated from the Go structs (go run ./cmd/tsgen).
export type {
  AIProviderStatus,
  AISettingsResponse,
  ComparatorSettingsResponse,
  EngineerSettingsResponse,
  PTTConfigResponse,
  PTTSettingsResponse,
  SettingsChangedMessage,
  SettingsSection,
  VoiceSettingsResponse,
} from './generated/api';
export type {
  AIUpdate,
  Comparator as ComparatorSettings,
  ComparatorRivalMode,
  Engineer as EngineerSettings,
  GamepadButton,
  PTT,
  Voice,
} from './generated/settings';
export type { EngineerAlertSwitch, Tuning as EngineerTuning } from './generated/engineer';
export type { Mapping as GlobalPTTMapping } from './generated/input';
