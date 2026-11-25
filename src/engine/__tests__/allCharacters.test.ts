import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { computeDamage } from '../damage';
import { defaultBuild } from '../../state/buildStore';

describe('every Resonator', () => {
  it.each(data.characters.map((c) => [c.name, c.id] as const))('%s: default build computes finite damage and has a full skill tree', (_, id) => {
    const c = data.characters.find((x) => x.id === id)!;
    const { hits, stats } = computeDamage(defaultBuild(id), data);
    expect(Number.isFinite(stats.total.atk)).toBe(true);
    for (const h of hits) expect(Number.isFinite(h.avg) && h.avg >= 0).toBe(true);
    expect(c.statNodes.map((n) => n.index).sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    for (const i of [1, 2, 3, 4, 5, 6, 7]) expect(c.skills.some((s) => s.treeIndex === i)).toBe(true);
  });
});
