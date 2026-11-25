import data from '../data/current';
import type { StatKey } from '../data/types';

/** Which of the possible roll values a substat is (0 = lowest) and how many there are; null if unknown stat. */
export function rollIndex(stat: StatKey, value: number): { i: number; n: number } | null {
  const rolls = data.echoStats.subRolls[stat];
  if (!rolls?.length) return null;
  let i = 0;
  rolls.forEach((v, k) => { if (Math.abs(v - value) < Math.abs(rolls[i] - value)) i = k; });
  return { i, n: rolls.length };
}

/** Quality band 0–3: low, mid, high, top (each covers a quarter of the possible values). */
export function rollBand(stat: StatKey, value: number): number | null {
  const r = rollIndex(stat, value);
  return r ? Math.min(3, Math.floor((r.i / r.n) * 4)) : null;
}

/** grey → blue → purple → gold, like the in-game rarity colours. */
export const BAND_COLOR = ['#8b93a7', '#6fb7ff', '#c08bff', '#f0c75e'];
const BAND_NAME = ['Low roll', 'Mid roll', 'High roll', 'Top roll'];

export const rollColor = (stat: StatKey, value: number) => {
  const b = rollBand(stat, value);
  return b == null ? undefined : BAND_COLOR[b];
};
export const rollTitle = (stat: StatKey, value: number) => {
  const r = rollIndex(stat, value);
  return r ? `${BAND_NAME[rollBand(stat, value)!]}: ${r.i + 1} of ${r.n}` : undefined;
};
