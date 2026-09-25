import { AI_SERVER_PRESETS } from '../constants/f1';

const normalize = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase();

/** The known OpenAI-compatible server at `baseUrl`, if it is one. */
export const findServerPreset = (baseUrl: string) =>
  AI_SERVER_PRESETS.find((preset) => normalize(preset.baseUrl) === normalize(baseUrl));
