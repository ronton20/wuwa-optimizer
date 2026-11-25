import type { SkillKind, StatKey } from '../data/types';
// Every user-facing string lives here so more languages can be added later.
export const en = {
  appName: 'WuWa Build Optimizer',
  tagline: 'Min-max your Resonators. Every number, colour-coded.',
  chooseResonator: 'Choose a Resonator',
  comingSoon: 'Build calculator arrives in the next update',
  weaponType: 'Weapon',
  element: 'Element',
  baseStats: 'Lv 90 base',
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  scalesOn: 'Scales on',
  damageRows: 'damage hits',
  dataVersion: (v: string, d: string) => `Game data ${v} · built ${d}`,
  disclaimer: 'Fan-made tool, not affiliated with Kuro Games. Game data and art belong to Kuro Games.',
  discord: 'Discord: ronton20',
  coffee: 'Buy me a coffee',
};
export type Strings = typeof en;
export const t = en;


export const STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP', atk: 'ATK', def: 'DEF', hpPct: 'HP%', atkPct: 'ATK%', defPct: 'DEF%',
  critRate: 'Crit. Rate', critDmg: 'Crit. DMG', energyRegen: 'Energy Regen', healing: 'Healing Bonus',
  dmgGlacio: 'Glacio DMG Bonus', dmgFusion: 'Fusion DMG Bonus', dmgElectro: 'Electro DMG Bonus', dmgAero: 'Aero DMG Bonus',
  dmgSpectro: 'Spectro DMG Bonus', dmgHavoc: 'Havoc DMG Bonus', dmgPhysical: 'Physical DMG Bonus',
  dmgBasic: 'Basic Attack DMG Bonus', dmgHeavy: 'Heavy Attack DMG Bonus', dmgSkill: 'Resonance Skill DMG Bonus',
  dmgLib: 'Resonance Liberation DMG Bonus', dmgIntro: 'Intro Skill DMG Bonus', dmgEcho: 'Echo Skill DMG Bonus',
  dmgAll: 'All-Attribute DMG Bonus', defIgnore: 'DEF Ignore',
};

export const SKILL_LABEL: Record<SkillKind, string> = {
  Normal: 'Normal Attack', Skill: 'Resonance Skill', Forte: 'Forte Circuit', Liberation: 'Resonance Liberation',
  Intro: 'Intro Skill', Outro: 'Outro Skill', Inherent: 'Inherent Skill', TuneBreak: 'Tune Break',
};

export const ui = {
  back: 'All Resonators',
  tabs: { overview: 'Overview', weapon: 'Weapon', skills: 'Skills', sequences: 'Sequences', buffs: 'Buffs' },
  damage: 'Damage',
  average: 'Average',
  crit: 'Crit',
  nonCrit: 'Non-crit',
  perHit: 'per hit',
  enemy: (name: string, lv: number) => `vs ${name} · Lv ${lv}`,
  setAll10: 'Set all to Lv 10',
  level: 'Lv',
  rank: 'Rank',
  sequence: 'Sequence',
  sequenceHint: 'Click a node to jump to it. Click the last lit node to clear all.',
  noSequenceSelected: 'S0 — no sequence nodes active.',
  echoes: 'Echoes',
  echoesSoon: 'Echo editing arrives in the next update — showing your current echoes.',
  cost: 'Cost',
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
  reset: 'Reset to starting build',
  notModelled: 'Not in the numbers yet',
  buffsHint: 'Combat-triggered effects. Defaults assume a normal burst window.',
  stacks: 'stacks',
  passive: 'Passive',
  baseStats: 'Base stats',
  bonusStats: 'Bonuses',
  topHit: 'Strongest hit',
  multiplier: 'Multiplier',
};
