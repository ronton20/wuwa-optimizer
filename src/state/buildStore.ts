import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import data from '../data/current';
import { signatureOf } from '../engine/signatures';
import type { Build } from '../engine/types';

/** Starting build for a character nobody has built yet: S0, signature weapon (or a 5★ of its type) at R1, no echoes. */
export function defaultBuild(characterId: number): Build {
  const c = data.characters.find((x) => x.id === characterId)!;
  const w = signatureOf(c.name, data) ?? data.weapons.find((x) => x.type === c.weaponType && x.rarity === 5) ?? data.weapons.find((x) => x.type === c.weaponType)!;
  return { characterId, sequence: 0, skillLevels: {}, weapon: { id: w.id, rank: 1 }, echoes: [], conditions: {} };
}

type Builds = Record<number, Build>;

/** A named copy of a build ("Crit set", "ER set"…), kept alongside the live build. */
export interface SavedBuild { id: string; name: string; build: Build; savedAt: number }

/** Compare: saved builds pinned next to the live one (the first pinned is the baseline). */
export const MAX_PINNED = 2;

interface State {
  builds: Builds;
  activeId: number | null;
  past: Builds[];
  future: Builds[];
  saved: SavedBuild[];
  pinned: string[];
  /** a build opened from a share link: edited in place of the character's own build until kept or discarded */
  shared: Build | null;
  select: (id: number | null) => void;
  update: (id: number, fn: (b: Build) => Build) => void;
  reset: (id: number) => void;
  undo: () => void;
  redo: () => void;
  saveAs: (name: string, build: Build) => string;
  renameSaved: (id: string, name: string) => void;
  deleteSaved: (id: string) => void;
  /** load a saved build into the live one; 'echoes' only swaps the 5 echoes */
  loadSaved: (id: string, what: 'all' | 'echoes') => void;
  togglePin: (id: string) => void;
  openShared: (b: Build) => void;
  /** 'replace' = becomes my build for that character, 'copy' = kept as a saved build */
  keepShared: (how: 'replace' | 'copy', name?: string) => void;
  discardShared: () => void;
  /** replace everything (import) */
  importAll: (d: { builds?: Builds; saved?: SavedBuild[] }) => void;
}

const HISTORY = 100;
const uid = () => Math.random().toString(36).slice(2, 10);

export const useBuilds = create<State>()(
  persist(
    (set, get) => {
      /** live edit with undo history */
      const commit = (builds: Builds) => {
        const { builds: prev, past } = get();
        set({ builds, past: [...past.slice(-HISTORY + 1), prev], future: [] });
      };
      return {
        builds: {},
        activeId: null,
        past: [],
        future: [],
        saved: [],
        pinned: [],
        shared: null,
        select: (id) => set({ activeId: id }),
        update: (id, fn) => {
          const { builds, shared } = get();
          if (shared && shared.characterId === id) return set({ shared: fn(shared) });
          commit({ ...builds, [id]: fn(builds[id] ?? defaultBuild(id)) });
        },
        reset: (id) => get().update(id, () => defaultBuild(id)),
        undo: () => {
          const { past, builds, future } = get();
          if (!past.length) return;
          set({ builds: past[past.length - 1], past: past.slice(0, -1), future: [builds, ...future] });
        },
        redo: () => {
          const { past, builds, future } = get();
          if (!future.length) return;
          set({ builds: future[0], past: [...past, builds], future: future.slice(1) });
        },
        saveAs: (name, build) => {
          const id = uid();
          set({ saved: [...get().saved, { id, name: name.trim() || 'Saved build', build: structuredClone(build), savedAt: Date.now() }] });
          return id;
        },
        renameSaved: (id, name) => set({ saved: get().saved.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)) }),
        deleteSaved: (id) => set({ saved: get().saved.filter((s) => s.id !== id), pinned: get().pinned.filter((p) => p !== id) }),
        loadSaved: (id, what) => {
          const s = get().saved.find((x) => x.id === id);
          if (!s) return;
          const copy = structuredClone(s.build);
          get().update(s.build.characterId, (b) => (what === 'all' ? copy : { ...b, echoes: copy.echoes }));
        },
        togglePin: (id) => {
          const { pinned } = get();
          set({ pinned: pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id].slice(-MAX_PINNED) });
        },
        openShared: (b) => set({ shared: b, activeId: b.characterId }),
        keepShared: (how, name) => {
          const { shared, builds } = get();
          if (!shared) return;
          if (how === 'replace') commit({ ...builds, [shared.characterId]: shared });
          else get().saveAs(name ?? 'Shared build', shared);
          set({ shared: null });
        },
        discardShared: () => set({ shared: null }),
        importAll: (d) => set({ builds: d.builds ?? {}, saved: d.saved ?? [], pinned: [], past: [], future: [], shared: null }),
      };
    },
    {
      name: 'wuwa-optimizer:builds:v1',
      partialize: (s) => ({ builds: s.builds, activeId: s.activeId, saved: s.saved, pinned: s.pinned }),
      // storage can be unavailable (private mode); persist then quietly does nothing
    },
  ),
);

/** Current build of a character, live (the shared copy while one is open). */
export const useBuild = (id: number) =>
  useBuilds((s) => (s.shared?.characterId === id ? s.shared : s.builds[id])) ?? defaultBuild(id);

/** Characters the user has done something with: a live build or a saved one, in that order. */
export const useMyCharacters = () => {
  const builds = useBuilds((s) => s.builds);
  const saved = useBuilds((s) => s.saved);
  return [...new Set([...Object.keys(builds).map(Number), ...saved.map((x) => x.build.characterId)])];
};

/** Saved builds of one character. */
export const useSavedFor = (id: number) => {
  const saved = useBuilds((s) => s.saved);
  return saved.filter((s) => s.build.characterId === id);
};
