import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { defaultBuild } from '../../state/buildStore';
import { computeDamage } from '../damage';
import { collectEffects, conditionMaxes } from '../effects';
import { KITS } from '../effects/characters';
import { TEAM_KITS } from '../effects/team';
import { uniformRes } from '../enemy';
import type { Build, Teammate } from '../types';

const char = (name: string) => data.characters.find((c) => c.name === name)!;
const build = (name: string, patch: Partial<Build> = {}): Build => ({ ...defaultBuild(char(name).id), enemy: { level: 100, res: uniformRes(0) }, ...patch });
const mate = (name: string, sequence = 0): Teammate => ({ characterId: char(name).id, sequence, custom: [] });
const hit = (b: Build, label: string) => {
  const h = computeDamage(b, data, { noBreakdown: true }).hits.find((x) => x.row.label === label);
  if (!h) throw new Error(`no row ${label}`);
  return h;
};

describe('new kits', () => {
  it('every row filter in a kit matches at least one of that Resonator\'s rows', () => {
    const labels = (name: string) => char(name).skills.flatMap((s) => s.rows.map((r) => r.label));
    for (const [name, list] of Object.entries(KITS)) {
      for (const e of list) {
        if (e.appliesTo?.rows) expect(labels(name).some((l) => e.appliesTo!.rows!.test(l)), `${name} · ${e.id}`).toBe(true);
      }
    }
  });

  it('team kits only name Resonators that exist', () => {
    for (const [name, list] of Object.entries(TEAM_KITS)) {
      expect(char(name), name).toBeDefined();
      for (const e of list) if (e.onlyFor) expect(char(e.onlyFor), e.onlyFor).toBeDefined();
    }
  });

  it("Hsin's Resonance Mode switches her inherent between Electro DMG and ATK", () => {
    const flare = build('Hsin');
    const uni = build('Hsin', { conditions: { 'c.hsin.mode': 1 } });
    const row = 'Resonance Skill - Illumining Form DMG';
    expect(hit(flare, row).zones.dmgBonus - hit(uni, row).zones.dmgBonus).toBeCloseTo(50, 6); // 2 × 25% Electro
    expect(hit(uni, row).zones.scalingStat).toBeGreaterThan(hit(flare, row).zones.scalingStat); // +50% ATK
    expect(hit(uni, row).zones.amplify - hit(flare, row).zones.amplify).toBeCloseTo(9, 6); // 3 Unison Boon (2 + inherent) × 3%
  });

  it("Hsin's Unison Boon limit grows with her inherent and S6", () => {
    const max = (seq: number) => { const b = build('Hsin', { sequence: seq, conditions: { 'c.hsin.mode': 1 } }); return conditionMaxes(collectEffects(b, data), b.conditions)['c.hsin.boon']; };
    expect(max(0)).toBe(3);
    expect(max(6)).toBe(4);
  });

  it('Hsin as a teammate: Outro depends on her mode, and her Rover bonus reaches only Rover: Electro', () => {
    const amp = (b: Build, row: string) => hit(b, row).zones.amplify;
    const rover = build('Rover: Electro', { team: [mate('Hsin')] });
    expect(amp(rover, 'Overshock DMG')).toBeCloseTo(20, 6);
    expect(hit(rover, 'Overshock DMG').zones.dmgBonus - hit(build('Rover: Electro'), 'Overshock DMG').zones.dmgBonus).toBeCloseTo(20, 6);
    // Unison mode: Shared Light amplifies every element; the Rover-only bonus is gone
    const roverUni = build('Rover: Electro', { team: [mate('Hsin')], conditions: { 't1.c.hsin.mode': 1 } });
    expect(amp(roverUni, 'Thrum of All Sounds: Aero DMG')).toBeCloseTo(20, 6);
    expect(amp(rover, 'Thrum of All Sounds: Aero DMG')).toBeCloseTo(0, 6);
    const suoming = collectEffects(build('Suoming', { team: [mate('Hsin')] }), data);
    expect(suoming.some((e) => e.id === 't1.rover')).toBe(false);
  });

  it("Lily's Eternal Bloom crits scale with her Energy Regen", () => {
    const b = build('Lily');
    const er = computeDamage(b, data, { noBreakdown: true }).stats.sheet.energyRegen;
    const h = hit(b, 'Intro Skill - Eternal Bloom DMG');
    const base = hit(b, 'Intro Skill - First Bloom DMG');
    expect(h.zones.critRate - base.zones.critRate).toBeCloseTo(Math.min(80, (er - 100) * 0.5), 6);
    expect(h.zones.critDmg - base.zones.critDmg).toBeCloseTo(Math.min(160, er - 100), 6);
  });

  it("Lucilla's Echo mode drops the Glacio RES cut and gives the team Echo DMG instead", () => {
    const hiyuki = (mode: number) => build('Hiyuki', { team: [mate('Lucilla', 2)], conditions: { 't1.c.luc.mode': mode } });
    const row = 'Basic Attack - Iai DMG';
    expect(hit(hiyuki(0), row).zones.resMult).toBeGreaterThan(hit(hiyuki(1), row).zones.resMult);
    const ids = collectEffects(hiyuki(1), data).map((e) => e.id);
    expect(ids).toContain('t1.c.luc.s2');
  });

  it('Suoming Seal Master adds Crit. DMG only in its own set-up', () => {
    const row = 'Basic Attack - Unfurled Canopy Stage 1 DMG';
    const aligned = hit(build('Suoming'), row);
    const master = hit(build('Suoming', { conditions: { 'c.suo.seal': 1 } }), row);
    expect(master.zones.critDmg - aligned.zones.critDmg).toBeCloseTo(100, 6);
    expect(master.zones.multBonus - aligned.zones.multBonus).toBeCloseTo(100, 6);
  });

  it("Suisui's Ceaseless Landscape raises Aero Erosion like Chisa's Outro, without stacking with it", () => {
    const carte = (team: Teammate[]) => { const b = build('Cartethyia', { team }); return conditionMaxes(collectEffects(b, data), b.conditions)['c.carte.imprint']; };
    expect(carte([mate('Suisui')])).toBe(9);
    expect(carte([mate('Suisui'), mate('Chisa')])).toBe(9);
  });

  it('Ciaccona S4 ignores DEF on Quadruple Downbeat and her Liberation only', () => {
    const b = build('Ciaccona', { sequence: 4 });
    const s0 = build('Ciaccona');
    expect(hit(b, 'Quadruple Downbeat DMG').zones.defMult).toBeGreaterThan(hit(s0, 'Quadruple Downbeat DMG').zones.defMult);
    expect(hit(b, 'Improvised Symphonic Poem Skill DMG').zones.defMult).toBeGreaterThan(hit(s0, 'Improvised Symphonic Poem Skill DMG').zones.defMult);
    expect(hit(b, 'Stage 1 DMG').zones.defMult).toBeCloseTo(hit(s0, 'Stage 1 DMG').zones.defMult, 9);
  });

  it("Mornye's Critical Protocol scales with DEF and gets crits from Energy Regen", () => {
    const b = build('Mornye');
    const er = computeDamage(b, data, { noBreakdown: true }).stats.sheet.energyRegen;
    const hits = computeDamage(b, data, { noBreakdown: true }).hits;
    const lib = hits.find((h) => h.skill.kind === 'Liberation')!;
    const intro = hits.find((h) => h.skill.kind === 'Intro')!; // both rows are called "Skill DMG"
    expect(lib.term.scaling).toBe('def');
    expect(lib.zones.critRate - intro.zones.critRate).toBeCloseTo(Math.min(80, (er - 100) * 0.5), 6);
  });

  it("Aemeath's mode picks which Between the Stars applies", () => {
    const row = 'Heavenfall Edict: Finale DMG';
    const burst = hit(build('Aemeath'), row).zones.critDmg;
    const rupture = hit(build('Aemeath', { conditions: { 'c.aem.mode': 1 } }), row).zones.critDmg;
    expect(burst - rupture).toBeCloseTo(60 - 60, 6); // 2 × 30% vs 3 × 20%
    expect(hit(build('Aemeath', { sequence: 3 }), row).zones.critDmg - burst).toBeCloseTo(0, 6); // S3: flat 60% replaces the stacks
  });

  it("Lupa's S6 DEF ignore skips her normal Intro Skill", () => {
    const s6 = build('Lupa', { sequence: 6 });
    const s0 = build('Lupa');
    const intro = (b: Build) => computeDamage(b, data, { noBreakdown: true }).hits.find((h) => h.skill.kind === 'Intro' && h.row.label === 'Skill Damage')!.zones.defMult;
    const lib = (b: Build) => computeDamage(b, data, { noBreakdown: true }).hits.find((h) => h.skill.kind === 'Liberation' && h.row.label === 'Skill Damage')!.zones.defMult;
    expect(intro(s6)).toBeCloseTo(intro(s0), 9);
    expect(lib(s6)).toBeGreaterThan(lib(s0));
  });

  it('Outro buffs from the new supports reach the on-field Resonator', () => {
    const solo = hit(build('Carlotta'), 'Death Knell DMG').zones.amplify;
    const withZhezhi = hit(build('Carlotta', { team: [mate('Zhezhi'), mate('Shorekeeper')] }), 'Death Knell DMG');
    expect(withZhezhi.zones.amplify - solo).toBeCloseTo(20 + 25 + 15, 6); // Glacio + Skill (Zhezhi), all (Shorekeeper)
  });

  it("a linked teammate brings their own build's weapon, main echo and set", () => {
    const own = { ...defaultBuild(char('Lucilla').id), weapon: { id: data.weapons.find((w) => w.name === 'Freeze Frame')!.id, rank: 1 } };
    const b = build('Hiyuki', { team: [{ characterId: char('Lucilla').id, sequence: 0, custom: [], linked: true, build: own }] });
    const sources = collectEffects(b, data).filter((e) => e.group === 'team').map((e) => e.source);
    expect(sources.some((x) => x.includes('Freeze Frame'))).toBe(true);
  });
});

