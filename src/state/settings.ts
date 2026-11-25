import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** App-wide display preferences, saved in the browser. */
interface Settings {
  /** which damage number is the big one: a crit hit (default) or the crit-weighted average */
  focus: 'crit' | 'avg';
  setFocus: (f: 'crit' | 'avg') => void;
}

export const useSettings = create<Settings>()(
  persist((set) => ({ focus: 'crit', setFocus: (focus) => set({ focus }) }), { name: 'wuwa-optimizer:settings:v1' }),
);
