import type { RadioHeardRequest } from '../types/telemetry';
import { api } from './apiClient';

/** A pit wall call on its way to the driver's ears, followed so the app log shows how long it took. */
export interface SpokenCall {
  /** The directive the call came in. */
  directiveId: string;
  /** Epoch ms the dashboard got it. */
  receivedAt: number;
  /** Whether the page was in front then, not hidden behind the game. */
  visible: boolean;
  /** An imminent traffic warning: it cuts whatever else is on the air. */
  cutIn: boolean;
  /** A traffic call with no number: a push-to-talk press keeps it, to say after the release. */
  keptOnPtt?: boolean;
}

/** Tells the app log what became of a pit wall call in this dashboard's radio. Fire and forget. */
export function reportRadioHeard(report: RadioHeardRequest): void {
  api.post('/api/ai/engineer/radio-heard', report).catch(() => {});
}
