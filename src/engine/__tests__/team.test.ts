import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { computeDamage } from '../damage';
import { collectEffects, conditionMaxes } from '../effects';
import { BUILDS } from './builds';
import { uniformRes } from '../enemy';

const id = (name: string) => data.characters.find((c) => c.name === name)!.id;
const hiyuki = BUILDS.find((b) => b.name === 'Hiyuki')!.build;
const carte = BUILDS.find((b) => b.name === 'Cartethyia')!.build;
const iv = (b: typeof hiyuki) => computeDamage({ enemy: { level: 100, res: uniformRes(10) }, ...b }, data).hits.find((h) => h.row.label === 'Foreclaiming: Inward Vision DMG')!;

describe('teammates', () => {
  it("Lucilla + Suisui add their kit and gear buffs to Hiyuki", () => {
    const solo = iv({ ...hiyuki, team: [] });
    const team = iv(hiyuki);
    expect(team.zones.amplify - solo.zones.amplify).toBeCloseTo(25 + 12, 6); // Suisui Outro + Reflecting Shadows
    expect(team.zones.dmgBonus - solo.zones.dmgBonus).toBeCloseTo(12 + 25, 6); // Lucilla's echo + set (typed)
    expect(team.zones.resMult).toBeGreaterThan(solo.zones.resMult); // Lucilla -8% Glacio RES
    expect(team.avg).toBeGreaterThan(solo.avg);
  });

  it('teammate buffs land in the "team" part of the breakdown', () => {
    const team = iv(hiyuki).segments.find((s) => s.group === 'team');
    expect(team?.value ?? 0).toBeGreaterThan(0);
    expect(iv({ ...hiyuki, team: [] }).segments.find((s) => s.group === 'team')).toBeUndefined();
  });

  it('two slots never share toggles', () => {
    const b = { ...hiyuki, team: [{ characterId: id('Suisui'), sequence: 0, custom: [] }, { characterId: id('Suisui'), sequence: 0, custom: [] }] };
    const ids = collectEffects(b, data).filter((e) => e.group === 'team').map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((x) => x.startsWith('t1.')) && ids.some((x) => x.startsWith('t2.'))).toBe(true);
  });

  it("Chisa's Outro raises Aero Erosion to 9, and doesn't stack with Cartethyia's S2", () => {
    const withChisa = (seq: number) => {
      const b = { ...carte, sequence: seq, team: [{ characterId: id('Chisa'), sequence: 0, custom: [] }] };
      return conditionMaxes(collectEffects(b, data), b.conditions)['c.carte.imprint'];
    };
    expect(withChisa(0)).toBe(9);
    expect(withChisa(6)).toBe(9);
  });

  it('the on-field character is never its own teammate', () => {
    const b = { ...hiyuki, team: [{ characterId: hiyuki.characterId, sequence: 6, custom: [] }] };
    expect(collectEffects(b, data).some((e) => e.id.startsWith('t1.'))).toBe(false);
  });

  it('enemy settings from the build are used', () => {
    const lv90 = iv({ ...hiyuki, enemy: { level: 90, res: { Glacio: 10, Fusion: 10, Electro: 10, Aero: 10, Spectro: 10, Havoc: 10, Physical: 10 } } });
    expect(lv90.zones.defMult).toBeGreaterThan(iv(hiyuki).zones.defMult);
  });
});

import { statWeights } from '../statWeights';
describe('stat weights', () => {
  const w = (name: string) => statWeights(BUILDS.find((b) => b.name === name)!.build, data);
  it('highlights what each character scales with and fades the rest', () => {
    expect(w('Hiyuki')).toMatchObject({ critRate: 'key', critDmg: 'key', atkPct: 'key', dmgGlacio: 'key', hpPct: 'none', defPct: 'none', dmgAero: 'none' });
    expect(w('Cartethyia')).toMatchObject({ hpPct: 'key', dmgAero: 'key', atkPct: 'none', atk: 'none' });
    expect(w('Chisa')).toMatchObject({ dmgHavoc: 'key', atkPct: 'key' });
  });
  it('a stat at its cap stays highlighted (Qingxiao is at 100% Crit. Rate)', () => {
    expect(w('Qingxiao')).toMatchObject({ critRate: 'key', critDmg: 'key', dmgAero: 'key', hpPct: 'none' });
  });
});

import { rollValues } from '../statWeights';
describe('roll values', () => {
  it("rank Hiyuki's best next substats on her Liberation", () => {
    const v = rollValues(BUILDS.find((b) => b.name === 'Hiyuki')!.build, data, 'Foreclaiming: Inward Vision DMG');
    expect(v[0].gainPct).toBeGreaterThan(1);
    expect(['critRate', 'critDmg', 'atkPct']).toContain(v[0].stat);
    expect(v.find((r) => r.stat === 'hpPct')!.gainPct).toBe(0);
  });
  it('a capped stat is flagged, not just shown as 0', () => {
    const v = rollValues(BUILDS.find((b) => b.name === 'Qingxiao')!.build, data, rowOf('Qingxiao'));
    expect(v.find((r) => r.stat === 'critRate')!.capped).toBe(true);
  });
});
function rowOf(name: string) {
  const hits = computeDamage(BUILDS.find((b) => b.name === name)!.build, data, { noBreakdown: true }).hits;
  return hits.reduce((a, h) => (h.avg * h.count > a.avg * a.count ? h : a)).row.label;
}

describe('skill tree switches', () => {
  it("switching off Hiyuki's Fine Snow inherent removes its buffs; stat nodes leave the sheet", () => {
    const h = BUILDS.find((b) => b.name === 'Hiyuki')!.build;
    const fine = data.characters.find((c) => c.id === h.characterId)!.skills.find((s) => s.name === 'Fine Snow')!.treeIndex!;
    const has = (b: typeof h) => collectEffects(b, data).some((e) => e.source === 'Inherent · Fine Snow');
    expect(has(h)).toBe(true);
    expect(has({ ...h, nodesOff: [fine] })).toBe(false);
    const cr = (b: typeof h) => computeDamage(b, data, { noBreakdown: true }).stats.sheet.critRate;
    expect(cr(h) - cr({ ...h, nodesOff: [9, 13] })).toBeCloseTo(1.2 + 2.8, 6);
  });
});
