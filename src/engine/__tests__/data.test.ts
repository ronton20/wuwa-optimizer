// Phase 0 gate: the data snapshot must match the in-game screens exactly.
import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { GOLDEN, GOLDEN_WEAPONS } from './golden';

const char = (name: string) => data.characters.find((c) => c.name === name)!;
const weapon = (name: string) => data.weapons.find((w) => w.name === name)!;

describe('snapshot matches in-game screens', () => {
  for (const g of GOLDEN) {
    describe(g.name, () => {
      const c = char(g.name);
      const w = weapon(g.weapon);

      it('exists with its weapon', () => {
        expect(c).toBeDefined();
        expect(w).toBeDefined();
      });

      it('base HP / ATK / DEF (character + weapon, as the More Stats screen shows)', () => {
        // the game truncates each part separately before adding them
        expect(Math.floor(c.base.hp)).toBe(g.base.hp);
        expect(Math.floor(c.base.atk) + Math.floor(w.baseAtk)).toBe(g.base.atk);
        expect(Math.floor(c.base.def)).toBe(g.base.def);
      });

      it('Lv 10 skill multipliers', () => {
        const rows = c.skills.flatMap((s) => s.rows);
        for (const [label, expected] of Object.entries(g.skillRows)) {
          const matches = rows.filter((r) => r.label === label).map((r) => r.values[9]);
          expect(matches, `${g.name}: ${label}`).toContain(expected);
        }
      });

      it('every damage row has hits for all 10 levels', () => {
        for (const r of c.skills.flatMap((s) => s.rows).filter((r) => r.hits)) {
          for (const h of r.hits!) expect(h.pct, r.label).toHaveLength(10);
        }
      });
    });
  }

  it('weapon screens', () => {
    for (const [name, g] of Object.entries(GOLDEN_WEAPONS)) {
      const w = weapon(name);
      expect(Math.floor(w.baseAtk), name).toBe(g.atk);
      expect(`${w.substat.stat} ${w.substat.value.toFixed(1)}`, name).toBe(g.substat);
    }
  });

  it('echo main stats at +25 match echo screens', () => {
    const four = data.echoStats.main['4'];
    expect(four).toContainEqual({ stat: 'critDmg', value: 44 }); // Calamity Effigy screen
    expect(data.echoStats.fixed['4']).toEqual({ stat: 'atk', value: 150 });
    expect(data.echoStats.main['1']).toContainEqual({ stat: 'atkPct', value: 18 }); // Tremor Warrior screen
    expect(data.echoStats.fixed['1']).toEqual({ stat: 'hp', value: 2280 });
  });
});

describe('hits read from the kit text', () => {
  const row = (name: string, label: string) => char(name).skills.flatMap((s) => s.rows).find((r) => r.label === label);

  it('adds hits the text gives a multiplier for, with their sequence, type and count', () => {
    const carlotta = row('Carlotta', 'S3 · Adelante, Cortado, Spinning in Grace DMG');
    expect(carlotta).toMatchObject({ fromText: true, seq: 3 });
    expect(carlotta!.hits![0]).toMatchObject({ count: 1, element: 'Glacio', scaling: 'atk', dmgType: 'Outro' });
    expect(carlotta!.hits![0].pct.at(-1)).toBe(1032.18);
    expect(row('Encore', 'Thermal Field DMG')!.hits![0].count).toBe(4); // every 1.5s for 6s
    expect(row('Lucy', 'S2 · The Blackwall, the Past, the Escape DMG')!.hits![0].dmgType).toBe('Heavy'); // "considered Heavy Attack DMG"
  });

  it('never duplicates a hit the data already has as a row', () => {
    for (const c of data.characters) {
      const pcts = c.skills.flatMap((s) => s.rows.filter((r) => !r.fromText).flatMap((r) => (r.hits ?? []).map((h) => h.pct.at(-1))));
      for (const r of c.skills.flatMap((s) => s.rows.filter((x) => x.fromText))) expect(pcts, `${c.name} · ${r.label}`).not.toContain(r.hits![0].pct.at(-1));
    }
  });
});
