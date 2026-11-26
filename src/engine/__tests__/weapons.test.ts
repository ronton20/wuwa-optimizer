import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { HAS_WEAPON_DEFINITIONS, weaponEffects } from '../effects/weapons';

const firstSentenceIsStat = /^(?:ATK is increased|ATK increased|Increases? ATK|Max HP is increased|HP is increased|Increases Max HP|Increase HP|DEF is increased|Increases DEF|Crit\. Rate is increased|Increase Crit\. Rate|Crit\. DMG is increased|Energy Regen is increased|Increases Energy Regen|Grants [\d.]+% (?:All-)?Attribute|Gain [\d.]+% (?:All-)?Attribute|Increases (?:All-)?Attribute)/;

describe('weapon passives', () => {
  it('every weapon has its passive written out', () => {
    const missing = data.weapons.filter((w) => !HAS_WEAPON_DEFINITIONS.includes(w.name)).map((w) => w.name);
    expect(missing).toEqual([]);
  });

  it('every buff has a real value at R1 and R5 (catches wrong number indexes)', () => {
    for (const w of data.weapons) {
      for (const rank of [1, 5]) {
        for (const e of weaponEffects(w, rank)) {
          for (const m of e.mods) expect(m.value, `${w.name} R${rank} · ${e.id} ${m.key}`).toBeGreaterThan(0);
          if (e.condition?.kind === 'stacks') expect(e.condition.max, `${w.name} · ${e.id} max`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('a stat first sentence is always picked up', () => {
    for (const w of data.weapons) {
      const text = w.passive.descriptions[0].replace(/\[\/?c[^\]]*\]/g, '');
      if (firstSentenceIsStat.test(text)) expect(weaponEffects(w, 1).some((e) => e.id.endsWith('.static')), w.name).toBe(true);
    }
  });

  it('values come from each rank\'s own text', () => {
    const w = (n: string) => data.weapons.find((x) => x.name === n)!;
    const val = (n: string, rank: number, id: string) => weaponEffects(w(n), rank).find((e) => e.id === id)!.mods[0].value;
    expect(val('Thunderflare Dominion', 5, 'w.thunderflare.def')).toBe(12); // not 2 × 7.2
    expect(val('Radiance Cleaver', 5, 'w.radiance')).toBe(36); // not 2 × 24
    expect(val('Frostburn', 1, 'w.frostburn.chafe')).toBe(28);
    expect(val('Frostburn', 5, 'w.frostburn.chafe')).toBe(56);
  });
});
