// Shapes of the generated game-data snapshot (src/data/wuwa-<version>.json).
// Shared by the build script and the app.

export type Element = 'Glacio' | 'Fusion' | 'Electro' | 'Aero' | 'Spectro' | 'Havoc' | 'Physical';
export type WeaponType = 'Broadblade' | 'Sword' | 'Pistols' | 'Gauntlets' | 'Rectifier';
export type Scaling = 'atk' | 'hp' | 'def';

/** Every stat the calculator understands. Percent stats are stored as percent numbers (24.3 = 24.3%). */
export type StatKey =
  | 'hp' | 'atk' | 'def' // flat
  | 'hpPct' | 'atkPct' | 'defPct'
  | 'critRate' | 'critDmg' | 'energyRegen' | 'healing'
  | 'dmgGlacio' | 'dmgFusion' | 'dmgElectro' | 'dmgAero' | 'dmgSpectro' | 'dmgHavoc' | 'dmgPhysical'
  | 'dmgBasic' | 'dmgHeavy' | 'dmgSkill' | 'dmgLib' | 'dmgIntro' | 'dmgEcho' | 'dmgAll'
  | 'defIgnore';

export interface StatValue { stat: StatKey; value: number }

/** Damage category the game uses for "X DMG Bonus" matching. */
export type DmgType = 'Basic' | 'Heavy' | 'Skill' | 'Liberation' | 'Intro' | 'Outro' | 'Echo' | 'Other';

export interface HitTerm {
  /** Multiplier in percent at each skill level 1..10 (e.g. 37.72). */
  pct: number[];
  /** How many times this term hits (the "*10" in "33.41%*10"). */
  count: number;
  element: Element;
  scaling: Scaling;
  dmgType: DmgType;
  /** Raw game damage ids this term was matched to (empty = not matched, uses defaults). */
  damageIds: number[];
  /** Concerto Energy each hit gives (from the matched damage entry) */
  concerto?: number;
  /** Resonance Energy each hit gives, before Energy Regen */
  energy?: number;
  /**
   * The Resonator's own gauges each hit changes (damage.json SpecialEnergy1..5; negative = spends). Which slot is
   * which gauge is per kit: Hiyuki's Frostheart is [1]; Chisa's Ring of Chainsaw is [0] (spent by Sawring) and
   * [2] counts what Sawring spent.
   */
  special?: number[];
}

export interface SkillRow {
  label: string;
  /** Raw in-game strings per level 1..10, exactly as the Skill Detail tab shows them. */
  values: string[];
  /** Present when the row is a damage row. */
  hits?: HitTerm[];
  /** not a Skill Detail row: a hit the kit text states as a number (scripts/data/textHits.ts) */
  fromText?: true;
  /** only exists from this sequence on (a sequence's own hit) */
  seq?: number;
}

/** 'Echo': the main echo's skill, added to a build's moves (not a Resonator skill) */
export type SkillKind = 'Normal' | 'Skill' | 'Liberation' | 'Inherent' | 'Intro' | 'Forte' | 'Outro' | 'TuneBreak' | 'Echo';

export interface Skill {
  id: number;
  kind: SkillKind;
  name: string;
  /** Rich text: [c=Highlight]…[/c] marks coloured words, \n line breaks. */
  description: string;
  icon: string;
  maxLevel: number;
  rows: SkillRow[];
  /** position in the in-game skill tree (1 Normal, 2 Skill, 3 Liberation, 4/5 inherents, 6 Intro, 7 Forte, 8 Outro) */
  treeIndex?: number;
}

export interface Sequence { index: number; name: string; description: string; icon: string; buffIds: number[] }
/** Stat bonus node in the skill tree. index 9-12 = first row above Normal/Skill/Liberation/Intro, 13-16 = second row. */
export interface StatNode { id: number; index: number; name: string; stats: StatValue[]; icon: string }

export interface Character {
  id: number;
  name: string;
  element: Element;
  weaponType: WeaponType;
  rarity: 4 | 5;
  /** Lv 90 base stats (before any weapon/echo/node). */
  base: { hp: number; atk: number; def: number; critRate: number; critDmg: number; energyRegen: number };
  skills: Skill[];
  sequences: Sequence[];
  statNodes: StatNode[];
  images: { icon: string; card: string; portrait: string; stand: string };
}

export interface Weapon {
  id: number;
  name: string;
  type: WeaponType;
  rarity: number;
  /** Lv 90 values */
  baseAtk: number;
  substat: StatValue;
  passive: { name: string; descriptions: string[] /* R1..R5 */ };
  icon: string;
  /** 732x392 artwork */
  iconBig: string;
}

export interface Echo {
  id: number; // monster id
  name: string;
  cost: 1 | 3 | 4;
  sets: number[];
  skill: { description: string; cooldown?: number; /** its damage, at max rank */ hits?: HitTerm[] };
  icon: string;
  /** 732x392 artwork */
  iconBig: string;
}

export interface SonataPiece { pieces: number; description: string; stats: StatValue[]; buffIds: number[] }
export interface Sonata { id: number; name: string; effects: SonataPiece[]; icon: string }

export interface EchoStatTables {
  /** Allowed main stats per cost at +25. */
  main: Record<'1' | '3' | '4', StatValue[]>;
  /** The fixed second main stat per cost at +25. */
  fixed: Record<'1' | '3' | '4', StatValue>;
  /** Possible substat roll values (ascending). */
  subRolls: Partial<Record<StatKey, number[]>>;
}

export type NegativeStatus = 'Glacio Chafe' | 'Glacio Bite' | 'Aero Erosion' | 'Spectro Frazzle' | 'Electro Flare' | 'Fusion Burst' | 'Havoc Bane';

/** A Negative Status as the game's base buff on the target defines it (buff.json 100X0000). */
export interface StatusDef {
  element: Element;
  /** default stack limit */
  maxStacks: number;
  /** seconds it lasts; a new stack restarts it (Spectro Frazzle: per stack, see the sim) */
  duration: number;
  /** seconds between damage ticks; 0 = no periodic damage */
  period: number;
  /** one tick right when it's first inflicted */
  tickOnApply: boolean;
  /** DMG multiplier in % at 1..N stacks (index 0 = 1 stack); empty = it deals no damage */
  dmg: number[];
  /** Havoc Bane: target DEF change in % at 1..N stacks */
  def?: number[];
}

export interface GameData {
  meta: { gameVersion: string; dataCommit: string; builtAt: string; source: string };
  characters: Character[];
  weapons: Weapon[];
  echoes: Echo[];
  sonatas: Sonata[];
  echoStats: EchoStatTables;
  /** Negative Status damage: base by Resonator level (index = level) and each status's numbers */
  negativeStatus: { levelBase: number[]; statuses: Record<NegativeStatus, StatusDef> };
}
