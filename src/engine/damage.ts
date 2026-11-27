import type { Character, DmgType, Element, GameData, HitTerm, Skill, SkillKind, SkillRow, StatKey } from '../data/types';
import { DEFAULT_ENEMY, defMultiplier, resMultiplier } from './enemy';
import { collectEffects, modValue, resolveEffects } from './effects';
import { computeStats, type ContributionGroup, type Stats } from './stats';
import type { ActiveEffect, Build, Effect, Enemy, HitFilter } from './types';

const TYPE_BONUS: Partial<Record<DmgType, StatKey>> = {
  Basic: 'dmgBasic', Heavy: 'dmgHeavy', Skill: 'dmgSkill', Liberation: 'dmgLib', Intro: 'dmgIntro', Echo: 'dmgEcho',
};
const ELEMENT_BONUS: Record<Element, StatKey> = {
  Glacio: 'dmgGlacio', Fusion: 'dmgFusion', Electro: 'dmgElectro', Aero: 'dmgAero', Spectro: 'dmgSpectro', Havoc: 'dmgHavoc', Physical: 'dmgPhysical',
};

export interface HitContext { skillKind: SkillKind; row: string; element: Element; dmgType: DmgType }

export function matches(f: HitFilter | undefined, h: HitContext): boolean {
  if (!f) return true;
  if (f.element && f.element !== h.element) return false;
  if (f.dmgTypes && !f.dmgTypes.includes(h.dmgType)) return false;
  if (f.skillKinds && !f.skillKinds.includes(h.skillKind)) return false;
  if (f.rows && !f.rows.test(h.row)) return false;
  return true;
}

/** Every number that goes into one hit, kept so the UI can explain it. */
export interface Zones {
  scalingStat: number; multiplier: number; multBonus: number; dmgBonus: number; amplify: number;
  defMult: number; resMult: number; critRate: number; critDmg: number;
}
export interface HitValue { nonCrit: number; crit: number; avg: number; zones: Zones }


/** (stat − over) × per, between 0 and max. */
export const fromStatValue = (f: NonNullable<Effect['mods'][number]['fromStat']>, sheet: Stats['sheet']) =>
  Math.min(f.max, Math.max(0, (sheet[f.stat] - f.over) * f.per));

/** One hit with the given stats and effects. */
function hitValue(stats: Stats, effects: ActiveEffect[], term: HitTerm, level: number, h: HitContext, enemy: Enemy, skip: Set<ContributionGroup>): HitValue {
  const s = stats.sheet;
  let multBonus = 0, amplify = 0, resShred = 0;
  let dmgBonus = s.dmgAll + s[ELEMENT_BONUS[h.element]] + (TYPE_BONUS[h.dmgType] ? s[TYPE_BONUS[h.dmgType]!] : 0);
  let critRate = s.critRate, critDmg = s.critDmg, defIgnore = s.defIgnore;

  for (const { effect, level: lv } of effects) {
    if (lv <= 0 || skip.has(effect.group)) continue;
    const hitSpecific = Boolean(effect.appliesTo);
    if (hitSpecific && !matches(effect.appliesTo, h)) continue;
    for (const m of effect.mods) {
      const v = m.fromStat ? (hitSpecific ? fromStatValue(m.fromStat, s) : 0) : modValue(m, effect, lv);
      if (m.key === 'amplify') amplify += v;
      else if (m.key === 'multBonus') multBonus += v;
      else if (m.key === 'resShred') resShred += v;
      else if (!hitSpecific) continue; // plain stats are already in the sheet
      else if (m.key === 'critRate') critRate += v;
      else if (m.key === 'critDmg') critDmg += v;
      else if (m.key === 'defIgnore') defIgnore += v;
      else if (m.key === 'dmgAll' || m.key === ELEMENT_BONUS[h.element] || m.key === TYPE_BONUS[h.dmgType]) dmgBonus += v;
    }
  }

  const scalingStat = stats.total[term.scaling];
  const multiplier = term.pct[level - 1] / 100;
  const defMult = defMultiplier(enemy.level, defIgnore);
  const resMult = resMultiplier(enemy.res[h.element] - resShred);
  const nonCrit = scalingStat * multiplier * (1 + multBonus / 100) * (1 + dmgBonus / 100) * (1 + amplify / 100) * defMult * resMult;
  const cr = Math.min(Math.max(critRate, 0), 100) / 100;
  const crit = nonCrit * (critDmg / 100);
  return {
    nonCrit, crit, avg: nonCrit * (1 - cr) + crit * cr,
    zones: { scalingStat, multiplier, multBonus, dmgBonus, amplify, defMult, resMult, critRate, critDmg },
  };
}

export const BREAKDOWN_GROUPS: ContributionGroup[] = ['weapon', 'echo', 'sequence', 'self', 'team', 'enemy'];

export interface HitResult extends HitValue {
  skill: Skill; row: SkillRow; termIndex: number; term: HitTerm; level: number; count: number;
  /** average damage of one hit, split by source group; segments add up exactly to `avg` */
  segments: { group: ContributionGroup; value: number }[];
}

export interface DamageOptions {
  /** overrides build.enemy */
  enemy?: Enemy;
  /** effects not from the build itself: stage buffs, teammates (Phase 3) */
  extra?: Effect[];
  /** skip the per-source breakdown (much faster; segments are empty) */
  noBreakdown?: boolean;
  /** only compute these rows (by skill kind + row label); used by the optimizer */
  only?: { skillKind: SkillKind; row: string };
  /** effects to treat as off whatever their toggle says (the optimizer: buffs nobody in the team can trigger) */
  disable?: (e: Effect) => boolean;
  /** level override per effect (the rotation simulator: timed buffs are on only while they last); undefined = keep */
  level?: (a: ActiveEffect) => number | undefined;
  /** also compute the main echo's skill (kind 'Echo', row "Echo Skill DMG") */
  echo?: boolean;
}

export const ECHO_ROW = 'Echo Skill DMG';

/** The build's main echo skill as a skill of its own, when the game data has its damage. */
export function echoSkill(build: Build, data: GameData): Skill | undefined {
  const e = build.echoes[0] && data.echoes.find((x) => x.id === build.echoes[0]!.echoId);
  if (!e?.skill.hits?.length) return undefined;
  return { id: e.id, kind: 'Echo', name: e.name, description: e.skill.description, icon: e.icon, maxLevel: 1, rows: [{ label: ECHO_ROW, values: [], hits: e.skill.hits }] };
}

/** Damage of every hit of every skill for a build. */
export function computeDamage(build: Build, data: GameData, opts: DamageOptions = {}): { stats: Stats; hits: HitResult[] } {
  const c = data.characters.find((x) => x.id === build.characterId) as Character;
  const enemy = opts.enemy ?? build.enemy ?? DEFAULT_ENEMY;
  const effects = resolveEffects([...collectEffects(build, data), ...(opts.extra ?? [])], build.conditions)
    .map((a) => (opts.disable?.(a.effect) ? { ...a, level: 0 } : a))
    .map((a) => { const l = opts.level?.(a); return l === undefined ? a : { ...a, level: l }; });
  const full = computeStats(build, data, effects);

  // stats with one group removed, for the breakdown (and with everything removed for the grey base)
  const without = opts.noBreakdown ? new Map() : new Map(BREAKDOWN_GROUPS.map((g) => [g, computeStats(build, data, effects, [g])]));
  const bare = opts.noBreakdown ? full : computeStats(build, data, effects, BREAKDOWN_GROUPS);

  const hits: HitResult[] = [];
  const echo = opts.echo ? echoSkill(build, data) : undefined;
  for (const skill of echo ? [...c.skills, echo] : c.skills) {
    if (opts.only && skill.kind !== opts.only.skillKind) continue;
    const level = Math.min(build.skillLevels[skill.kind] ?? 10, 10);
    for (const row of skill.rows) {
      if (opts.only && row.label !== opts.only.row) continue;
      row.hits?.forEach((term, termIndex) => {
        const h: HitContext = { skillKind: skill.kind, row: row.label, element: term.element, dmgType: term.dmgType };
        const value = hitValue(full, effects, term, level, h, enemy, new Set());
        if (opts.noBreakdown) {
          hits.push({ ...value, skill, row, termIndex, term, level, count: term.count, segments: [] });
          return;
        }
        const base = hitValue(bare, effects, term, level, h, enemy, new Set(BREAKDOWN_GROUPS)).avg;
        const deltas = BREAKDOWN_GROUPS.map((g) => ({ group: g, value: value.avg - hitValue(without.get(g)!, effects, term, level, h, enemy, new Set([g])).avg }));
        const positive = deltas.filter((d) => d.value > 0);
        const sum = positive.reduce((a, d) => a + d.value, 0);
        const scale = sum > 0 ? (value.avg - base) / sum : 0;
        hits.push({
          ...value, skill, row, termIndex, term, level, count: term.count,
          segments: [{ group: 'base', value: base }, ...positive.map((d) => ({ group: d.group, value: d.value * scale }))],
        });
      });
    }
  }
  return { stats: full, hits };
}
