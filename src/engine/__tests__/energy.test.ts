import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import expected from '../../../tests-support/cards.expected.json';
import { defaultBuild } from '../../state/buildStore';
import { computeDamage } from '../damage';
import type { Build } from '../types';
import { OFF_FIELD_ENERGY, moveResources, simulate, type RotationStep } from '../rotation/sim';

const C = (name: string) => data.characters.find((c) => c.name === name)!;
type Card = { character: string; sequence: number; skillLevels: Record<string, number>; weapon: string; echoes: { name: string; set: string; main: string; subs: string[] }[] };
const stat = (x: string) => { const [k, v] = x.split(' '); return { stat: k as never, value: Number(v) }; };
/** The owner's build from its card read (weapon ranks from tests-support/recordings/hiyuki/notes.txt). */
function fromCard(name: string, rank: number): Build {
  const c = Object.values(expected as Record<string, Card>).find((x) => x.character === name)!;
  const base = defaultBuild(C(name).id);
  return {
    ...base, sequence: c.sequence, skillLevels: { ...base.skillLevels, ...c.skillLevels },
    weapon: { id: data.weapons.find((w) => w.name === c.weapon)!.id, rank },
    echoes: c.echoes.map((e) => ({
      echoId: (data.echoes.find((x) => x.name === e.name) ?? data.echoes.find((x) => x.name.endsWith(e.name)))!.id,
      setId: data.sonatas.find((s) => s.name === e.set)!.id, main: stat(e.main), subs: e.subs.map(stat),
    })),
  };
}
const er = (b: Build) => computeDamage(b, data, { noBreakdown: true }).stats.sheet.energyRegen / 100;

describe('Resonance Energy off the field', () => {
  const [S, L, H] = ['Suisui', 'Lucilla', 'Hiyuki'].map((n) => C(n).id);
  const builds = { [S]: fromCard('Suisui', 5), [L]: fromCard('Lucilla', 1), [H]: fromCard('Hiyuki', 5) };

  it('off-field teammates gain 50% of the on-field hits\' base Energy, times their own Energy Regen', () => {
    const r = simulate({ steps: [{ char: S, button: 'liberation' }, { char: S, button: 'basic' }], fullConcerto: false }, builds, data);
    const basic = r.moves[1];
    const base = moveResources(C('Suisui'), basic.move).shared;
    expect(base).toBeGreaterThan(0);
    // Hiyuki started full: she stays capped; Lucilla holds 0
    expect(r.energies[1].get(H)).toBe(125);
    expect(r.energies[1].get(L)).toBe(0);
    const r2 = simulate({ steps: [{ char: S, button: 'basic' }], emptyEnergy: true }, builds, data);
    expect(r2.energies[0].get(H)).toBeCloseTo(base * OFF_FIELD_ENERGY * er(builds[H]));
  });

  it('toa_3 (owner\'s clip): Suisui is full again at her second switch-in, Hiyuki near the ~100 / 125 her ring shows', () => {
    const p = (c: number, ...b: string[]): RotationStep[] => b.map((button) => ({ char: c, button }));
    // the press list in tests-support/recordings/hiyuki/toa_3_rotation.txt
    const steps: RotationStep[] = [
      ...p(S, 'basic', 'basic', 'basic', 'basic', 'skill', 'liberation', 'basic', 'basic', 'basic', 'basic', 'echo'),
      { char: L, button: 'basic', swap: 'intro' }, ...p(L, 'echo', 'skill', 'liberation', 'basic'),
      { char: H, button: 'basic', swap: 'intro' },
      ...p(H, 'heavy', 'liberation', 'echo', 'basic', 'basic', 'basic', 'basic', 'basic', 'skill', 'skill', 'iai', 'iai', 'iai', 'basic', 'basic', 'heavy', 'liberation'),
      { char: S, button: 'liberation', swap: 'intro' }, ...p(S, 'basic', 'basic', 'basic', 'basic', 'basic', 'echo'),
      { char: L, button: 'skill', swap: 'intro' }, ...p(L, 'echo', 'liberation', 'basic'),
      { char: H, button: 'basic', swap: 'intro' }, ...p(H, 'heavy', 'liberation'),
    ];
    const r = simulate({ steps, freezeLiberation: true }, builds, data);
    const second = steps.findIndex((s, i) => i > 0 && s.char === S && steps[i - 1].char !== S);
    expect(r.energies[second - 1].get(S)).toBe(175);
    expect(r.moves.filter((m) => m.step === second && m.char === S).flatMap((m) => m.warn)).toEqual([]);
    // the clip's ring after her second Inward Vision is ~80–85% (100–105); the simulator gives ~92
    const iv = r.moves.filter((m) => m.char === H && m.move.label.includes('Inward Vision')).at(-1)!;
    expect(iv.energy).toBeGreaterThan(85);
    expect(iv.energy).toBeLessThan(110);
  });
});
