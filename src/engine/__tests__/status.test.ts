import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { defaultBuild } from '../../state/buildStore';
import { defMultiplier } from '../enemy';
import { statusDamage } from '../negative';
import { STATUS_ROWS, type Move, type RowRef } from '../rotation/actions';
import { statusTracker } from '../rotation/status';
import type { Build } from '../types';

const id = (name: string) => data.characters.find((c) => c.name === name)!.id;
const S = data.negativeStatus.statuses;
const move = (rows: RowRef[]): Move => ({ label: 'x', kind: 'Normal', rows, timing: 'basic', events: [] });
const tracker = (names: string[], patch: Record<string, Partial<Build>> = {}) =>
  statusTracker(names.map(id), Object.fromEntries(names.map((n) => [id(n), { ...defaultBuild(id(n)), ...patch[n] }])), data);
const hit = (t: ReturnType<typeof tracker>, who: string, at: number, ref: RowRef) => t.step({ t: at, char: id(who), onField: id(who), move: move([ref]), events: [] }).hits;

describe('Negative Status data and damage', () => {
  it('reads the game tables: level base, stack limits and per-stack multipliers', () => {
    expect(data.negativeStatus.levelBase[90]).toBe(3674);
    expect(S['Spectro Frazzle']).toMatchObject({ element: 'Spectro', maxStacks: 10, period: 3 });
    expect(S['Spectro Frazzle'].dmg.slice(0, 2)).toEqual([30, 54.39]);
    expect(S['Aero Erosion']).toMatchObject({ maxStacks: 3, period: 3, tickOnApply: true });
    expect(S['Havoc Bane'].def?.[0]).toBe(-2); // "Each stack reduces the target's DEF by 2%"
  });

  it('one hit = level base × multiplier × DEF × RES, with only status-aimed Amplify', () => {
    const b = defaultBuild(id('Phoebe'));
    const plain = statusDamage(b, data, 'Spectro Frazzle', 100, {});
    expect(plain).toBeCloseTo(3674 * defMultiplier(100, 0), 3); // default enemy: Lv 100, 0% RES
    expect(statusDamage(b, data, 'Spectro Frazzle', 100, { amplify: 50 })).toBeCloseTo(plain * 1.5, 6);
  });

  it('every status row names a real row of that Resonator', () => {
    for (const [name, rows] of Object.entries(STATUS_ROWS)) {
      const c = data.characters.find((x) => x.name === name)!;
      expect(c, name).toBeDefined();
      for (const key of Object.keys(rows)) {
        const [kind, label] = key.includes('|') ? key.split('|') : [undefined, key];
        expect(c.skills.some((s) => (!kind || s.kind === kind) && s.rows.some((r) => r.label === label)), `${name} · ${key}`).toBe(true);
      }
    }
  });
});

describe('Negative Status on the target', () => {
  it('Aero Erosion: a hit when first inflicted, then every 3s at its stacks, until 14.8s after the last stack', () => {
    const t = tracker(['Ciaccona']);
    const first = hit(t, 'Ciaccona', 0, { skillKind: 'Skill', row: 'Skill DMG' });
    expect(first.map((h) => h.pct)).toEqual([S['Aero Erosion'].dmg[0]]);
    expect(hit(t, 'Ciaccona', 1, { skillKind: 'Forte', row: 'Quadruple Downbeat DMG' })).toHaveLength(0); // 2 stacks, no tick yet
    expect(t.advance(6.5).map((h) => h.pct)).toEqual([S['Aero Erosion'].dmg[1], S['Aero Erosion'].dmg[1]]); // ticks at 3s and 6s
    expect(t.advance(30)).toHaveLength(3); // 9, 12, 15 (15 ≤ 1 + 14.8); then it ends
  });

  it('Spectro Frazzle: a hit every 3s, losing 1 stack each', () => {
    const t = tracker(['Phoebe']);
    hit(t, 'Phoebe', 0, { skillKind: 'Forte', row: 'Absolution Litany DMG' });
    hit(t, 'Phoebe', 0.5, { skillKind: 'Forte', row: 'Utter Confession DMG' });
    expect(t.advance(20).map((h) => h.pct)).toEqual([S['Spectro Frazzle'].dmg[1], S['Spectro Frazzle'].dmg[0]]);
  });

  it('Electro Flare: a hit every 5s, halving the stacks; stacks past the limit become Electro Rage for the next hit', () => {
    const t = tracker(['Rover: Electro']);
    hit(t, 'Rover: Electro', 0, { skillKind: 'Forte', row: 'Overshock DMG' }); // 10
    hit(t, 'Rover: Electro', 1, { skillKind: 'Forte', row: 'Overshock DMG' }); // +10 at the limit: 10 Rage
    const d = S['Electro Flare'].dmg;
    expect(t.advance(16).map((h) => h.pct)).toEqual([d[9] + d[9], d[4], d[1]]); // 10 (+Rage) → 5 → 2 → (15s after the last stack: ends)
  });

  it('Fusion Burst explodes at its limit and clears; only in Denia\'s Fusion Burst mode', () => {
    const t = tracker(['Denia']);
    const ref = { skillKind: 'Intro' as const, row: 'Knock Knock DMG' };
    for (let k = 0; k < 4; k++) expect(hit(t, 'Denia', k * 3, ref)).toHaveLength(0);
    expect(hit(t, 'Denia', 12, ref).map((h) => h.pct)).toEqual([S['Fusion Burst'].dmg[9]]);
    const strain = tracker(['Denia'], { Denia: { conditions: { 'c.den.mode': 1 } } });
    for (let k = 0; k < 6; k++) expect(hit(strain, 'Denia', k, ref)).toHaveLength(0);
  });

  it('Glacio Chafe without Hiyuki: a hit at its stacks each time, freezing (and clearing) at the limit', () => {
    const t = tracker(['Lucilla']);
    const ref = { skillKind: 'Intro' as const, row: 'Clip It DMG' };
    const pcts = Array.from({ length: 11 }, (_, k) => hit(t, 'Lucilla', k, ref)[0]?.pct);
    expect(pcts.slice(0, 3)).toEqual(S['Glacio Chafe'].dmg.slice(0, 3));
    expect(pcts[9]).toBe(S['Glacio Chafe'].dmg[9]); // 10th: frozen
    expect(pcts[10]).toBe(S['Glacio Chafe'].dmg[0]); // starts over
  });

  it('Cartethyia S3: those moves inflict 2 stacks from S3 only', () => {
    const ref = { skillKind: 'Forte' as const, row: 'May Tempest Break the Tides DMG' };
    expect(hit(tracker(['Cartethyia']), 'Cartethyia', 0, ref)).toHaveLength(0);
    expect(hit(tracker(['Cartethyia'], { Cartethyia: { sequence: 3 } }), 'Cartethyia', 0, ref).map((h) => h.pct)).toEqual([S['Aero Erosion'].dmg[1]]);
  });
});
