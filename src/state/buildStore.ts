import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import data from '../data/current';
import { BUILDS } from '../data/presets';
import type { Build } from '../engine/types';

/** Starting build: the user's own build for the 4 launch characters, otherwise their best weapon and no echoes. */
export function defaultBuild(characterId: number): Build {
  const preset = BUILDS.find((b) => b.build.characterId === characterId);
  if (preset) return structuredClone(preset.build);
  const c = data.characters.find((x) => x.id === characterId)!;
  const w = data.weapons.find((x) => x.type === c.weaponType && x.rarity === 5) ?? data.weapons.find((x) => x.type === c.weaponType)!;
  return { characterId, sequence: 0, skillLevels: {}, weapon: { id: w.id, rank: 1 }, echoes: [], conditions: {} };
}

type Builds = Record<number, Build>;

interface State {
  builds: Builds;
  activeId: number | null;
  past: Builds[];
  future: Builds[];
  select: (id: number | null) => void;
  build: (id: number) => Build;
  update: (id: number, fn: (b: Build) => Build) => void;
  reset: (id: number) => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY = 100;

export const useBuilds = create<State>()(
  persist(
    (set, get) => ({
      builds: {},
      activeId: null,
      past: [],
      future: [],
      select: (id) => set({ activeId: id }),
      build: (id) => get().builds[id] ?? defaultBuild(id),
      update: (id, fn) => {
        const { builds, past } = get();
        const next = fn(builds[id] ?? defaultBuild(id));
        set({ builds: { ...builds, [id]: next }, past: [...past.slice(-HISTORY + 1), builds], future: [] });
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
    }),
    {
      name: 'wuwa-optimizer:builds:v1',
      partialize: (s) => ({ builds: s.builds, activeId: s.activeId }),
      // storage can be unavailable (private mode); persist then quietly does nothing
    },
  ),
);

/** Current build of a character, live. */
export const useBuild = (id: number) => useBuilds((s) => s.builds[id]) ?? defaultBuild(id);
