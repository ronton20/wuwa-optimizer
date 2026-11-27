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
 * Checked in game (owner's ToA floor 1, 2026-11-27, their builds): Hiyuki's 590% Snow Rust Glacio Bite read 34,118;
 * factor 1 gives 34,092 (35,456 with Lucilla's −8% Glacio RES on, so it had run out or the boss has some Glacio
 * RES); factor 1.25078 gives 42,000+.
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
    if (lv <= 0 || !inMode(a.effect, build.conditions)) continue;
    const f = a.effect.appliesTo;
    // Amplify that reaches it: aimed at this status (Glacio Bite counts as Glacio Chafe), or at all damage ("all DMG
    // Amplified"; checked: Hiyuki's 590% Snow Rust Bite needs Suisui's Outro Amplify to match the game). RES cuts on
    // its element are a debuff on the target, so they count too. Stat buffs (ATK, DMG Bonus, Crit) never do.
    const aimed = !!f?.statuses && matches(f, h);
    const everything = !f;
    const elementOnly = !!f && !f.statuses && !f.rows && !f.skillKinds && !f.dmgTypes && f.element === def.element;
    for (const m of a.effect.mods) {
      const v = modValue(m, a.effect, lv);
      if (m.key === 'amplify' && (aimed || everything)) amplify += v;
      else if (m.key === 'resShred' && (aimed || everything || elementOnly)) resShred += v;
      else if (m.key === 'defIgnore' && aimed) defIgnore += v;
    }
  }
  const base = data.negativeStatus.levelBase[CHARACTER_LEVEL] * NEGATIVE_STATUS_FACTOR;
  return base * (pct / 100) * (1 + amplify / 100) * defMultiplier(enemy.level, defIgnore) * resMultiplier(enemy.res[def.element] - resShred);
}
