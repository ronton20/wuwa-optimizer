import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { computeDamage } from '../damage';
import { DEFAULT_ENEMY, defMultiplier, resMultiplier } from '../enemy';
import type { Effect } from '../types';
import { BUILDS } from './builds';

describe('formula pieces', () => {
  it('DEF multiplier: Lv 90 vs Lv 100 enemy', () => {
    expect(defMultiplier(100, 0)).toBeCloseTo(1520 / (1520 + 1592), 10);
    expect(defMultiplier(100, 100)).toBe(1);
  });
  it('RES multiplier is piecewise', () => {
    expect(resMultiplier(10)).toBeCloseTo(0.9);
    expect(resMultiplier(-20)).toBeCloseTo(1.1);
    expect(resMultiplier(80)).toBeCloseTo(0.2);
  });
});

describe('every hit of every launch character', () => {
  for (const g of BUILDS) {
    it(`${g.name}: crit = non-crit × Crit DMG, avg in between, segments add up`, () => {
      const { hits } = computeDamage(g.build, data, { enemy: DEFAULT_ENEMY });
      expect(hits.length).toBeGreaterThan(15);
      for (const h of hits) {
        expect(h.nonCrit, h.row.label).toBeGreaterThan(0);
        expect(h.crit).toBeCloseTo(h.nonCrit * (h.zones.critDmg / 100), 6);
        expect(h.avg).toBeGreaterThanOrEqual(h.nonCrit - 1e-9);
        expect(h.avg).toBeLessThanOrEqual(h.crit + 1e-9);
        const sum = h.segments.reduce((a, s) => a + s.value, 0);
        expect(sum, `${h.row.label} segments`).toBeCloseTo(h.avg, 6);
      }
    });
  }
});

describe('toggles move the numbers the right way', () => {
  const hiyuki = BUILDS[0].build;
  const iv = (conditions: Record<string, boolean | number>) =>
    computeDamage({ ...hiyuki, conditions }, data, { enemy: DEFAULT_ENEMY }).hits.find((h) => h.row.label === 'Foreclaiming: Inward Vision DMG')!;

  it('turning off Frostburn after Glacio Chafe lowers Liberation damage', () => {
    expect(iv({ 'w.frostburn.chafe': false }).avg).toBeLessThan(iv({}).avg);
  });
  it('S6 adds +500% Crit DMG only to Inward Vision / Blade Liberation', () => {
    const all = computeDamage(hiyuki, data, { enemy: DEFAULT_ENEMY }).hits;
    const ivHit = all.find((h) => h.row.label === 'Foreclaiming: Inward Vision DMG')!;
    const basic = all.find((h) => h.row.label === 'Basic Attack - Present Self Stage 1 DMG')!;
    expect(ivHit.zones.critDmg - basic.zones.critDmg).toBeCloseTo(500, 6);
  });
  it('skill level changes the multiplier', () => {
    const lv1 = computeDamage({ ...hiyuki, skillLevels: { Liberation: 1 } }, data, { enemy: DEFAULT_ENEMY }).hits.find((h) => h.row.label === 'Foreclaiming: Inward Vision DMG')!;
    expect(lv1.zones.multiplier).toBeCloseTo(2.0, 6);
    expect(iv({}).zones.multiplier).toBeCloseTo(3.9762, 6);
  });
});

/**
 * Sanity check against the one capture we have: Hiyuki's Inward Vision crit in Tower of Adversity
 * floor 1 (Lv 100 Crownless, stage: Glacio RES −10%, Crit DMG +25%, Glacio DMG +30%) showed 178,809.
 * The buff state at that moment isn't known exactly, so this only asserts we're within 8%.
 */
it('Hiyuki Liberation crit is in the right range of the in-game capture', () => {
  const stage: Effect[] = [{ id: 'stage', group: 'enemy', source: 'ToA floor 1', text: '', mods: [{ key: 'critDmg', value: 25 }, { key: 'dmgGlacio', value: 30 }] }];
  const enemy = { level: 100, res: { ...DEFAULT_ENEMY.res, Glacio: 0 } };
  const { hits } = computeDamage({ ...BUILDS[0].build, conditions: { 'c.hiyuki.s4': false } }, data, { enemy, extra: stage });
  const crit = hits.find((h) => h.row.label === 'Foreclaiming: Inward Vision DMG')!.crit;
  expect(Math.abs(crit / 178809 - 1)).toBeLessThan(0.08);
});
