import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { collectEffects } from '../effects';
import { applyCandidate, optimize, rowValue } from '../optimizer';
import { BUILDS } from './builds';

const hiyuki = BUILDS.find((b) => b.name === 'Hiyuki')!.build;
const target = { skillKind: 'Liberation' as const, row: 'Foreclaiming: Inward Vision DMG' };

describe('optimizer', () => {
  const r = optimize(hiyuki, data, { target, metric: 'crit', weapons: 'all', otherRank: 1, sets: 'all', can: ['Glacio Chafe'] });

  it('never does worse than the current build, and applying #1 gives its number', () => {
    expect(r.best[0].value).toBeGreaterThanOrEqual(r.current);
    expect(rowValue(applyCandidate(hiyuki, data, r.best[0]), data, target, 'crit', (e) => /Havoc Bane/.test(e.condition?.label ?? ''))).toBeCloseTo(r.best[0].value, 0);
  });

  it('skips buffs nobody in the team can trigger', () => {
    for (const c of r.best) expect(c.relies?.some((x) => /Havoc Bane/.test(x)), JSON.stringify(c.relies)).toBe(false);
  });

  it('applied builds fill 4-3-3-1-1 with five different echoes, so the set counts in game', () => {
    for (const c of r.best) {
      const b = applyCandidate(hiyuki, data, c);
      const names = b.echoes.map((p) => data.echoes.find((e) => e.id === p!.echoId)!.name.replace(/^Phantom:\s*/, '').replace(/:/g, '').toLowerCase());
      expect(new Set(names).size).toBe(5);
      expect(b.echoes.map((p) => data.echoes.find((e) => e.id === p!.echoId)!.cost)).toEqual([4, 3, 3, 1, 1]);
      const top = data.sonatas.find((s) => s.id === c.sets[0])!;
      const need = Math.max(...top.effects.map((e) => e.pieces));
      expect(collectEffects(b, data).some((e) => e.source === `${top.name} ${need}pc`) || top.name === 'Moonlit Clouds', top.name).toBe(true);
    }
  });

  it('keeps each slot\'s substats', () => {
    const b = applyCandidate(hiyuki, data, r.best[0]);
    b.echoes.forEach((p, i) => expect(p!.subs).toEqual(hiyuki.echoes[i]?.subs ?? []));
  });
});
