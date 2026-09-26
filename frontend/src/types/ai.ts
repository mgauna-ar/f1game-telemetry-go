export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  errorCode?: string;
  errorProvider?: string;
  errorRaw?: string;
  canRetry?: boolean;
  lastPrompt?: string;
}


export type { AIChatRequest, ChatContextMode, ChatContextRequest, ChatZoomRange } from './generated/ai';
