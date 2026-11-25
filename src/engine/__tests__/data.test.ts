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
