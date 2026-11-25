import type { GameData, StatKey } from '../data/types';
import { computeDamage } from './damage';
import type { Build } from './types';

export type StatWeight = 'key' | 'minor' | 'none';

/**
 * How much each stat is worth to this build: the damage gained (summed over every hit of every skill)
 * from one max substat roll of it, or from the main-stat value for stats that only appear as main stats.
 * 'key' = at least 35% of the best substat's gain, 'none' = no effect on damage either way.
 * Measured both up and down, so a stat at its cap (Crit. Rate 100%) still counts as key.
 */
export function statWeights(build: Build, data: GameData): Record<string, StatWeight> {
  const total = (extra?: { key: StatKey; value: number }) =>
    computeDamage(build, data, {
      noBreakdown: true,
      extra: extra && [{ id: 'probe', group: 'echo', source: 'probe', text: '', mods: [extra] }],
    }).hits.reduce((a, h) => a + h.avg * h.count, 0);
  const base = total();
  const probes = new Map<StatKey, number>();
  for (const [k, rolls] of Object.entries(data.echoStats.subRolls)) probes.set(k as StatKey, Math.max(...rolls!));
  for (const cost of ['1', '3', '4'] as const) for (const m of data.echoStats.main[cost]) if (!probes.has(m.stat)) probes.set(m.stat, m.value);
  // a stat counts by what one roll adds OR what losing one roll costs, so capped stats
  // (Crit. Rate at 100%) stay highlighted instead of reading as worthless
  const gain = new Map([...probes].map(([k, v]) => [k, base > 0 ? Math.max(total({ key: k, value: v }) / base - 1, 1 - total({ key: k, value: -v }) / base) : 0]));
  // compare against the best SUBSTAT (main-stat-only element bonuses are much larger and would hide everything else)
  const best = Math.max(...Object.keys(data.echoStats.subRolls).map((k) => gain.get(k as StatKey) ?? 0));
  return Object.fromEntries([...gain].map(([k, g]) => [k, g <= 1e-6 ? 'none' : g >= best * 0.35 ? 'key' : 'minor']));
}

export interface RollValue { stat: StatKey; roll: number; gainPct: number; capped: boolean }

/**
 * "+1 roll of X = +Y% damage" on one damage row (summed over its hits), for every substat, best first.
 * The roll is the average of that substat's possible roll values. Average damage is used,
 * since that's what a roll changes (a crit hit ignores Crit. Rate). `capped` = adding gains nothing
 * but losing a roll would cost damage (Crit. Rate at 100%).
 */
export function rollValues(build: Build, data: GameData, rowLabel: string): RollValue[] {
  const row = (extra?: { key: StatKey; value: number }) =>
    computeDamage(build, data, {
      noBreakdown: true,
      extra: extra && [{ id: 'probe', group: 'echo', source: 'probe', text: '', mods: [extra] }],
    }).hits.filter((h) => h.row.label === rowLabel).reduce((a, h) => a + h.avg * h.count, 0);
  const base = row();
  if (!base) return [];
  return (Object.entries(data.echoStats.subRolls) as [StatKey, number[]][])
    .map(([stat, rolls]) => {
      const roll = Math.round((rolls.reduce((a, v) => a + v, 0) / rolls.length) * 10) / 10;
      const up = row({ key: stat, value: roll }) / base - 1;
      const down = 1 - row({ key: stat, value: -roll }) / base;
      return { stat, roll, gainPct: up * 100, capped: up <= 1e-9 && down > 1e-9 };
    })
    .sort((a, b) => b.gainPct - a.gainPct || Number(b.capped) - Number(a.capped));
}

export interface EchoScore {
  /** 0–100: how close the 5 substats are to the best 5 possible for this character (max rolls) */
  score: number;
  grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  /** each substat's share of the score, in score points */
  subs: { stat: StatKey; points: number }[];
}

/**
 * Echo substat scores for this build. A substat's weight is the damage one max roll of it adds to the
 * strongest hit (or what losing one would cost, so a capped Crit. Rate still counts), relative to the best stat.
 * An echo scores sum(value / maxRoll × weight) over its substats, against the 5 highest weights at max roll = 100.
 * Main stats don't count: every echo of a cost can have the right one, the substats are what you farm.
 */
export function echoScores(build: Build, data: GameData): (EchoScore | null)[] {
  const hits = computeDamage(build, data, { noBreakdown: true }).hits;
  const sums = new Map<string, number>();
  for (const h of hits) sums.set(h.row.label, (sums.get(h.row.label) ?? 0) + h.avg * h.count);
  const row = [...sums].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pieces = build.echoes;
  if (!row) return pieces.map(() => null);
  const dmg = (extra?: { key: StatKey; value: number }) =>
    computeDamage(build, data, { noBreakdown: true, extra: extra && [{ id: 'probe', group: 'echo', source: 'probe', text: '', mods: [extra] }] })
      .hits.filter((h) => h.row.label === row).reduce((a, h) => a + h.avg * h.count, 0);
  const base = dmg();
  const rolls = data.echoStats.subRolls as Record<StatKey, number[]>;
  const weight = new Map<StatKey, number>();
  for (const [stat, r] of Object.entries(rolls) as [StatKey, number[]][]) {
    const max = Math.max(...r);
    weight.set(stat, base > 0 ? Math.max(dmg({ key: stat, value: max }) / base - 1, 1 - dmg({ key: stat, value: -max }) / base, 0) : 0);
  }
  const best = Math.max(...weight.values()) || 1;
  for (const [k, v] of weight) weight.set(k, v / best);
  const ideal = [...weight.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, v) => a + v, 0) || 1;

  return pieces.map((p) => {
    if (!p) return null;
    const subs = p.subs.map((s) => {
      const max = Math.max(...(rolls[s.stat] ?? [1]));
      return { stat: s.stat, points: ((s.value / max) * (weight.get(s.stat) ?? 0) * 100) / ideal };
    });
    const score = Math.min(100, subs.reduce((a, s) => a + s.points, 0));
    const grade = score >= 80 ? 'SS' : score >= 65 ? 'S' : score >= 50 ? 'A' : score >= 35 ? 'B' : score >= 20 ? 'C' : 'D';
    return { score, grade, subs };
  });
}
