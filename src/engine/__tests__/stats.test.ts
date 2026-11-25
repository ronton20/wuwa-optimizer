// Phase 1 gate: the engine must reproduce each in-game "More Stats" screen.
import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import type { StatKey } from '../../data/types';
import { collectEffects, resolveEffects } from '../effects';
import { computeStats } from '../stats';
import { BUILDS } from './builds';

/**
 * The menu shows a resting character: every combat-triggered effect is off.
 * Account-wide upgrades (acct.*) are passive, so they stay at their default (on).
 */
function screenStats(build: (typeof BUILDS)[number]['build']) {
  const effects = collectEffects(build, data);
  const off = Object.fromEntries(effects.filter((e) => e.condition && !e.id.startsWith('acct.')).map((e) => [e.id, e.condition!.kind === 'toggle' ? false : 0]));
  return computeStats(build, data, resolveEffects(effects, off));
}

// Echo screens round every substat to 0.1%, hiding up to ±0.05% per roll. On HP/ATK/DEF that
// adds up to a few points on large totals, so flat bonuses are allowed 0.03% of the total (min 2).
const flatTolerance = (total: number) => Math.max(2, total * 0.0003);

const PCT_KEYS: StatKey[] = [
  'critRate', 'critDmg', 'energyRegen', 'healing', 'dmgBasic', 'dmgHeavy', 'dmgSkill', 'dmgLib', 'dmgIntro', 'dmgEcho',
  'dmgGlacio', 'dmgFusion', 'dmgElectro', 'dmgAero', 'dmgSpectro', 'dmgHavoc', 'dmgPhysical',
];

describe('engine reproduces the in-game stat screens', () => {
  for (const g of BUILDS) {
    describe(g.name, () => {
      const s = screenStats(g.build);

      it('white base numbers match exactly', () => {
        expect([s.base.hp, s.base.atk, s.base.def]).toEqual([g.screen.hp[0], g.screen.atk[0], g.screen.def[0]]);
      });

      for (const k of ['hp', 'atk', 'def'] as const) {
        it(`${k.toUpperCase()} bonus within rounding of the echo screens`, () => {
          const [white, green] = g.screen[k];
          expect(Math.abs(s.bonus[k] - green), `engine ${s.bonus[k]} vs screen ${green}`).toBeLessThanOrEqual(flatTolerance(white + green));
        });
      }

      it('every % line matches to 0.1%', () => {
        for (const key of PCT_KEYS) {
          const expected = g.screen.pct[key] ?? 0;
          const engine = s.sheet[key];
          expect(Math.round(engine * 10) / 10, key).toBeCloseTo(expected, 5);
        }
      });
    });
  }
});
