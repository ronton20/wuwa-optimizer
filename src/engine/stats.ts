import type { GameData, StatKey } from '../data/types';
import type { ActiveEffect, Build, SourceGroup } from './types';
import { modValue } from './effects';

/** Where a stat point came from — used for tooltips and the colour-coded breakdown. */
export type ContributionGroup = 'base' | SourceGroup;
export interface Contribution { group: ContributionGroup; source: string; stat: StatKey; value: number }

export type StatSheet = Record<StatKey, number>;

const ZERO: StatSheet = {
  hp: 0, atk: 0, def: 0, hpPct: 0, atkPct: 0, defPct: 0, critRate: 0, critDmg: 0, energyRegen: 0, healing: 0,
  dmgGlacio: 0, dmgFusion: 0, dmgElectro: 0, dmgAero: 0, dmgSpectro: 0, dmgHavoc: 0, dmgPhysical: 0,
  dmgBasic: 0, dmgHeavy: 0, dmgSkill: 0, dmgLib: 0, dmgIntro: 0, dmgEcho: 0, dmgAll: 0, defIgnore: 0,
};

export interface Stats {
  /** white numbers on the stat screen: character base (+ weapon base for ATK), truncated like the game */
  base: { hp: number; atk: number; def: number };
  /** sum of every stat from every always-on or active, non hit-specific source */
  sheet: StatSheet;
  /** final HP / ATK / DEF */
  total: { hp: number; atk: number; def: number };
  /** green numbers on the stat screen */
  bonus: { hp: number; atk: number; def: number };
  contributions: Contribution[];
}

/**
 * Builds the stat sheet. `exclude` drops whole source groups — the damage breakdown uses it to
 * measure how much each group adds.
 */
export function computeStats(build: Build, data: GameData, effects: ActiveEffect[], exclude: ContributionGroup[] = []): Stats {
  const c = data.characters.find((x) => x.id === build.characterId)!;
  const w = data.weapons.find((x) => x.id === build.weapon.id);
  const contributions: Contribution[] = [];
  const add = (group: ContributionGroup, source: string, stat: StatKey, value: number) => {
    if (value && !exclude.includes(group)) contributions.push({ group, source, stat, value });
  };

  // character + weapon base
  add('base', c.name, 'critRate', c.base.critRate);
  add('base', c.name, 'critDmg', c.base.critDmg);
  add('base', c.name, 'energyRegen', c.base.energyRegen);
  for (const n of c.statNodes) for (const s of n.stats) add('base', `Stat node · ${n.name}`, s.stat, s.value);
  if (w) add('weapon', `${w.name} substat`, w.substat.stat, w.substat.value);

  // echoes
  build.echoes.forEach((p, i) => {
    const echo = data.echoes.find((e) => e.id === p.echoId);
    const label = `${i === 0 ? 'Main echo' : `Echo ${i + 1}`} · ${echo?.name ?? p.echoId}`;
    add('echo', label, p.main.stat, p.main.value);
    const fixed = echo && data.echoStats.fixed[String(echo.cost) as '1' | '3' | '4'];
    if (fixed) add('echo', label, fixed.stat, fixed.value);
    for (const s of p.subs) add('echo', label, s.stat, s.value);
  });

  // effects that are plain stats (no hit filter); hit-specific mods are applied per hit in damage.ts
  for (const { effect, level } of effects) {
    if (effect.appliesTo || level <= 0) continue;
    for (const m of effect.mods) {
      if (m.key in ZERO) add(effect.group, effect.source, m.key as StatKey, modValue(m, effect, level));
    }
  }

  const sheet: StatSheet = { ...ZERO };
  for (const x of contributions) sheet[x.stat] += x.value;

  const base = {
    hp: Math.floor(c.base.hp),
    atk: Math.floor(c.base.atk) + (w ? Math.floor(w.baseAtk) : 0),
    def: Math.floor(c.base.def),
  };
  const raw = {
    hp: base.hp * (sheet.hpPct / 100) + sheet.hp,
    atk: base.atk * (sheet.atkPct / 100) + sheet.atk,
    def: base.def * (sheet.defPct / 100) + sheet.def,
  };
  const bonus = { hp: Math.floor(raw.hp), atk: Math.floor(raw.atk), def: Math.floor(raw.def) };
  return {
    base,
    sheet,
    bonus,
    total: { hp: base.hp + raw.hp, atk: base.atk + raw.atk, def: base.def + raw.def },
    contributions,
  };
}
