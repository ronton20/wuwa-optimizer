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
