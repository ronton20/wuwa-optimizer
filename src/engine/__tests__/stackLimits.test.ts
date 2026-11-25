import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { collectEffects, conditionMaxes, resolveEffects } from '../effects';
import { computeDamage } from '../damage';
import { uniformRes } from '../enemy';
const DEFAULT_ENEMY = { level: 100, res: uniformRes(10) };
import { BUILDS } from './builds';

const carte = BUILDS.find((b) => b.name === 'Cartethyia')!.build;
const qing = BUILDS.find((b) => b.name === 'Qingxiao')!.build;
const max = (b: typeof carte, cond: Record<string, boolean | number>, key: string) => conditionMaxes(collectEffects({ ...b, conditions: cond }, data), cond)[key];
const level = (b: typeof carte, cond: Record<string, boolean | number>, id: string) =>
  resolveEffects(collectEffects({ ...b, conditions: cond }, data), cond).find((a) => a.effect.id === id)!.level;

describe('negative status stack limits', () => {
  it('Aero Erosion: 6 base, 9 with S2', () => {
    expect(max({ ...carte, sequence: 0 }, {}, 'c.carte.imprint')).toBe(6);
    expect(max(carte, {}, 'c.carte.imprint')).toBe(9);
    expect(max(carte, { 'c.carte.s2max': false }, 'c.carte.imprint')).toBe(6);
  });
  it('stacks above the limit are clamped', () => {
    expect(level({ ...carte, sequence: 0 }, { 'c.carte.imprint': 9 }, 'c.carte.imprint')).toBe(6);
    expect(level(carte, { 'c.carte.imprint': 9 }, 'c.carte.imprint')).toBe(9);
  });
  it('Mindlock: 15 base, 25 from S2', () => {
    expect(max({ ...qing, sequence: 1 }, {}, 'c.qing.mindlock')).toBe(15);
    expect(max(qing, {}, 'c.qing.mindlock')).toBe(25);
    expect(level({ ...qing, sequence: 1 }, { 'c.qing.mindlock': 25 }, 'c.qing.mindlock.lib')).toBe(15);
  });
});

describe('Blade of Howling Squall scales with Aero Erosion', () => {
  const blade = (stacks: number) =>
    computeDamage({ ...carte, conditions: { 'c.carte.imprint': stacks } }, data, { enemy: DEFAULT_ENEMY }).hits.find((h) => h.row.label === 'Blade of Howling Squall DMG')!;
  const basic = (stacks: number) =>
    computeDamage({ ...carte, conditions: { 'c.carte.imprint': stacks } }, data, { enemy: DEFAULT_ENEMY }).hits.find((h) => h.row.label === 'Stage 1 DMG')!;

  it('+20% Amplify per stack, capped at 5 stacks', () => {
    // amplify on Blade = inherent (30/40/50/60) + Blade (20/stack, max 100) + Defier's Thorn 20 + S6 40
    expect(blade(0).zones.amplify).toBeCloseTo(0 + 0 + 20 + 40, 6);
    expect(blade(3).zones.amplify).toBeCloseTo(30 + 60 + 20 + 40, 6);
    expect(blade(6).zones.amplify).toBeCloseTo(60 + 100 + 20 + 40, 6);
    expect(blade(9).zones.amplify).toBeCloseTo(blade(6).zones.amplify, 6);
  });
  it('only Blade gets it', () => {
    expect(basic(6).zones.amplify).toBeCloseTo(60 + 20, 6);
  });
});

it('stack counters default to the current limit', () => {
  expect(level(carte, {}, 'c.carte.imprint')).toBe(9);
  expect(level({ ...carte, sequence: 0 }, {}, 'c.carte.imprint')).toBe(6);
  expect(level(carte, { 'c.carte.s2max': false }, 'c.carte.imprint')).toBe(6);
  expect(level(qing, {}, 'c.qing.mindlock.lib')).toBe(25);
});
