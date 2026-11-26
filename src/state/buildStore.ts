import type { Rotation } from '../engine/rotation/sim';
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import data from '../data/current';
import { signatureOf } from '../engine/signatures';
import type { Build, Teammate } from '../engine/types';

/** Starting build for a character nobody has built yet: S0, signature weapon (or a 5★ of its type) at R1, no echoes. */
export function defaultBuild(characterId: number): Build {
  const c = data.characters.find((x) => x.id === characterId)!;
  const w = signatureOf(c.name, data) ?? data.weapons.find((x) => x.type === c.weaponType && x.rarity === 5) ?? data.weapons.find((x) => x.type === c.weaponType)!;
  return { characterId, sequence: 0, skillLevels: {}, weapon: { id: w.id, rank: 1 }, echoes: [], conditions: {} };
}

type Builds = Record<number, Build>;

/** Attaches my own builds to linked teammates (one level deep: a teammate's own team is left out). */
export function linkTeam(b: Build, builds: Builds): Build {
  if (!b.team?.some((t) => t?.linked)) return b;
  return { ...b, team: b.team.map((t) => (t?.linked && builds[t.characterId] ? { ...t, build: { ...builds[t.characterId], team: undefined } } : t)) };
}

/**
 * A team member's build as the rotation sees it: their teammates are the other team members
 * (kept as set if the build already has them, otherwise following my builds).
 */
export function teamBuild(id: number, members: number[], builds: Builds): Build {
  const b = builds[id] ?? defaultBuild(id);
  const others = members.filter((m) => m !== id);
  const has = (m: number) => b.team?.some((t) => t?.characterId === m);
  const team = others.every(has) ? b.team : [0, 1].map((i) => (others.at(i) !== undefined ? (b.team?.find((t) => t?.characterId === others[i]) ?? linkedMate(others[i], builds)) : null));
  return linkTeam({ ...b, team }, builds);
}

/** Never store an attached build: the teammate keeps following my build of that Resonator. */
function strip(b: Build): Build {
  if (!b.team?.some((t) => t?.build)) return b;
  return { ...b, team: b.team.map((t) => { if (!t?.build) return t; const rest = { ...t }; delete rest.build; return rest; }) };
}

/** A named team of three of my Resonators. */
export interface Team { id: string; name: string; members: number[] }

/** Teammate entry that follows my build of that Resonator. */
export const linkedMate = (characterId: number, builds: Builds, prev?: Teammate | null): Teammate =>
  ({ ...(prev?.characterId === characterId ? prev : { custom: [] }), characterId, sequence: builds[characterId]?.sequence ?? 0, linked: true });

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
  importAll: (d: { builds?: Builds; saved?: SavedBuild[]; teams?: Team[]; mainTeam?: string | null; rotations?: Rotation[] }) => void;
  teams: Team[];
  mainTeam: string | null;
  /** makes a team and points each member's teammates at the other two (linked to their builds) */
  saveTeam: (team: Omit<Team, 'id'> & { id?: string }) => string;
  deleteTeam: (id: string) => void;
  setMainTeam: (id: string | null) => void;
  /** rotations, one or more per team */
  rotations: Rotation[];
  /** team whose rotation screen is open (not stored) */
  openTeam: string | null;
  showTeam: (id: string | null) => void;
  saveRotation: (r: Rotation) => void;
  deleteRotation: (id: string) => void;
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
        select: (id) => set({ activeId: id, ...(id ? { openTeam: null } : {}) }),
        update: (id, fn) => {
          const { builds, shared } = get();
          if (shared && shared.characterId === id) return set({ shared: strip(fn(shared)) });
          commit({ ...builds, [id]: strip(fn(builds[id] ?? defaultBuild(id))) });
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
        importAll: (d) => set({ builds: d.builds ?? {}, saved: d.saved ?? [], teams: d.teams ?? [], mainTeam: d.mainTeam ?? null, rotations: d.rotations ?? [], pinned: [], past: [], future: [], shared: null }),
        teams: [],
        mainTeam: null,
        saveTeam: (team) => {
          const id = team.id ?? uid();
          const members = team.members.slice(0, 3);
          const builds = { ...get().builds };
          for (const m of members) builds[m] ??= defaultBuild(m);
          for (const m of members) {
            const others = members.filter((x) => x !== m);
            const prev = builds[m].team ?? [];
            builds[m] = { ...builds[m], team: [0, 1].map((i) => (others.at(i) !== undefined ? linkedMate(others.at(i)!, builds, prev.find((p) => p?.characterId === others.at(i))) : null)) };
          }
          commit(builds);
          const teams = get().teams.filter((t) => t.id !== id);
          set({ teams: [...teams, { id, name: team.name.trim() || 'Team', members }], mainTeam: get().mainTeam ?? id });
          return id;
        },
        rotations: [],
        openTeam: null,
        showTeam: (id) => set({ openTeam: id, ...(id ? { activeId: null } : {}) }),
        saveRotation: (r) => set({ rotations: get().rotations.some((x) => x.id === r.id) ? get().rotations.map((x) => (x.id === r.id ? r : x)) : [...get().rotations, r] }),
        deleteRotation: (id) => set({ rotations: get().rotations.filter((r) => r.id !== id) }),
        deleteTeam: (id) => set({ rotations: get().rotations.filter((r) => r.teamId !== id), teams: get().teams.filter((t) => t.id !== id), mainTeam: get().mainTeam === id ? (get().teams.find((t) => t.id !== id)?.id ?? null) : get().mainTeam }),
        setMainTeam: (id) => set({ mainTeam: id }),
      };
    },
    {
      name: 'wuwa-optimizer:builds:v1',
      partialize: (s) => ({ builds: s.builds, activeId: s.activeId, saved: s.saved, pinned: s.pinned, teams: s.teams, mainTeam: s.mainTeam, rotations: s.rotations }),
      // storage can be unavailable (private mode); persist then quietly does nothing
    },
  ),
);

/** Current build of a character, live (the shared copy while one is open), with linked teammates' builds attached. */
export const useBuild = (id: number) => {
  const raw = useBuilds((s) => (s.shared?.characterId === id ? s.shared : s.builds[id]));
  const builds = useBuilds((s) => s.builds);
  return useMemo(() => linkTeam(raw ?? defaultBuild(id), builds), [raw, builds, id]);
};

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
