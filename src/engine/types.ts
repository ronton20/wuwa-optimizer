import type { DmgType, Element, SkillKind, StatKey } from '../data/types';

// ---------------------------------------------------------------- build (what the user sets)

export interface EchoPiece {
  echoId: number;
  /** sonata set this copy belongs to (echoes can drop in several sets) */
  setId: number;
  main: { stat: StatKey; value: number };
  subs: { stat: StatKey; value: number }[];
}

/** A teammate: only what reaches the on-field Resonator matters. */
export interface Teammate {
  characterId: number;
  sequence: number;
  weapon?: { id: number; rank: number };
  /** main echo name (team-buff echoes only) */
  mainEcho?: string;
  /** 5-piece set name (team-buff sets only) */
  set?: string;
  /** anything else the teammate gives, typed by the user */
  custom: { key: ModKey; value: number; label: string }[];
}

export interface Build {
  characterId: number;
  sequence: number; // 0..6
  skillLevels: Partial<Record<SkillKind, number>>; // default 10
  weapon: { id: number; rank: number }; // rank 1..5
  /** index 0 is the main echo; empty slots are null */
  echoes: (EchoPiece | null)[];
  /** effect id -> toggle (boolean) or stack count (number). Missing = the effect's default. */
  conditions: Record<string, boolean | number>;
  /** up to 2 teammates */
  team?: (Teammate | null)[];
  /** missing = Tower of Adversity default */
  enemy?: Enemy;
}

export interface Enemy {
  level: number;
  /** resistance per element in percent, e.g. 10 = 10% */
  res: Record<Element, number>;
}

// ---------------------------------------------------------------- effects (buff definitions)

/** What an effect can change. Stat keys go into the stat sheet; the rest are damage-formula zones. */
export type ModKey = StatKey | 'amplify' | 'multBonus' | 'resShred';

export interface Mod {
  key: ModKey;
  /** value for 1 stack / when active */
  value: number;
  /** value at 0..N stacks, overrides `value` for stack conditions with non-linear scaling */
  byStacks?: number[];
}

/** Which hits a mod is limited to. All given fields must match. */
export interface HitFilter {
  element?: Element;
  dmgTypes?: DmgType[];
  skillKinds?: SkillKind[];
  /** regex tested against the in-game Skill Detail row label */
  rows?: RegExp;
  /** plain-words name of what `rows` matches, shown in the Buffs tab */
  label?: string;
}

export type SourceGroup = 'weapon' | 'echo' | 'sequence' | 'self' | 'team' | 'enemy';

export interface Effect {
  id: string;
  group: SourceGroup;
  /** short UI label, e.g. "Frostburn R5" or "S3 · No Self, No Bound" */
  source: string;
  /** one line describing what it does */
  text: string;
  mods: Mod[];
  /** no condition = always on (and shown on the in-game stat screen if it has no hit filter) */
  condition?: ({ kind: 'toggle'; label: string; default: boolean } | { kind: 'stacks'; label: string; max: number; /** 'max' = follow the current stack limit */ default: number | 'max' }) & {
    /** effects with the same key share one toggle / stack count (default: the effect id) */
    key?: string;
  };
  appliesTo?: HitFilter;
  /**
   * While active, raises the stack limit of another condition (by its key).
   * `by`: adds stacks; `to`: sets a new limit. Raises sharing an `exclusive` group don't stack — the biggest wins.
   */
  raisesMax?: { key: string; by?: number; to?: number; exclusive?: string };
}

/** A resolved effect with its current activation level (0 = off). */
export interface ActiveEffect { effect: Effect; level: number }
