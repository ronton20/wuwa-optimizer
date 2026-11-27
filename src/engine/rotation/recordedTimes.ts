import type { TimingKind } from './actions';

/**
 * Action times measured from the owner's gameplay recordings (skill `model-character-timings`), in seconds
 * from one input to the next. `moves` is keyed by the move's label as the rotation screen shows it
 * ("Heavy Attack - Bitterfrost: Foreclaimed Self"); `kinds` covers every other move of that kind.
 * Anything not here falls back to the machine's estimate, then DEFAULT_TIMES.
 */
export interface RecordedTimes {
  kinds?: Partial<Record<TimingKind, number>>;
  moves?: Record<string, number>;
  /** where the numbers came from: recording file name and date */
  source: string;
}

export const RECORDED_TIMES: Record<string, RecordedTimes> = {};
