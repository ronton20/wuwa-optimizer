import type { GameData, NegativeStatus } from '../data/types';
import { matches, type HitContext } from './damage';
import { collectEffects, inMode, modValue, resolveEffects } from './effects';
import { CHARACTER_LEVEL, DEFAULT_ENEMY, defMultiplier, resMultiplier } from './enemy';
import type { ActiveEffect, Build } from './types';

/**
 * Negative Status damage = level base (AbnormalDamageConfig, 3674 at Lv. 90) × the status's multiplier × the
 * target's DEF and RES multipliers × (1 + Amplify aimed at that status). No ATK, Crit or DMG Bonus.
 *
 * The community formula is "level × 1.25078 × stack multiplier"; its stack multipliers times 1.25078 are exactly
 * the game's tables (Spectro Frazzle: 0.240 → 30%, 1.995 → 249.51%), so with the game's numbers the factor is 1.
 * Unconfirmed against an in-game damage number: change here if one disagrees.
 */
export const NEGATIVE_STATUS_FACTOR = 1;

export const statusRow = (status: NegativeStatus) => `${status} DMG`;

/** Damage of one Negative Status hit with a multiplier of `pct` %, from the build of the Resonator who applied it. */
export function statusDamage(build: Build, data: GameData, status: NegativeStatus, pct: number,
  opts: { level?: (a: ActiveEffect) => number | undefined; amplify?: number } = {}): number {
  const def = data.negativeStatus.statuses[status];
  const enemy = build.enemy ?? DEFAULT_ENEMY;
  const h: HitContext = { skillKind: 'Forte', row: statusRow(status), element: def.element, dmgType: 'Other', status };
  let amplify = opts.amplify ?? 0, resShred = 0, defIgnore = 0;
  for (const a of resolveEffects(collectEffects(build, data), build.conditions)) {
    const lv = opts.level?.(a) ?? a.level;
    // only buffs aimed at Negative Status damage; general DMG buffs don't reach it
    if (lv <= 0 || !a.effect.appliesTo?.statuses || !inMode(a.effect, build.conditions) || !matches(a.effect.appliesTo, h)) continue;
    for (const m of a.effect.mods) {
      const v = modValue(m, a.effect, lv);
      if (m.key === 'amplify') amplify += v;
      else if (m.key === 'resShred') resShred += v;
      else if (m.key === 'defIgnore') defIgnore += v;
    }
  }
  const base = data.negativeStatus.levelBase[CHARACTER_LEVEL] * NEGATIVE_STATUS_FACTOR;
  return base * (pct / 100) * (1 + amplify / 100) * defMultiplier(enemy.level, defIgnore) * resMultiplier(enemy.res[def.element] - resShred);
}
