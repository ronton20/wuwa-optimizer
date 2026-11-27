import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { computeDamage } from '../damage';
import { defaultBuild } from '../../state/buildStore';
import { machineFor } from '../rotation/actions';
import { simulate } from '../rotation/sim';

describe('every Resonator', () => {
  it.each(data.characters.map((c) => [c.name, c.id] as const))('%s: default build computes finite damage and has a full skill tree', (_, id) => {
    const c = data.characters.find((x) => x.id === id)!;
    const { hits, stats } = computeDamage(defaultBuild(id), data);
    expect(Number.isFinite(stats.total.atk)).toBe(true);
    for (const h of hits) expect(Number.isFinite(h.avg) && h.avg >= 0).toBe(true);
    expect(c.statNodes.map((n) => n.index).sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    for (const i of [1, 2, 3, 4, 5, 6, 7]) expect(c.skills.some((s) => s.treeIndex === i)).toBe(true);
  });

  it.each(data.characters.map((c) => [c.name, c.id] as const))('%s: every button and every listed move simulates to finite damage', (_, id) => {
    const m = machineFor(id, data);
    const buttons = [...m.buttons.map((b) => b.id), ...m.buttons.map((b) => b.id), ...m.exact.map((b) => b.id)];
    const r = simulate({ steps: buttons.map((button) => ({ char: id, button })) }, { [id]: defaultBuild(id) }, data);
    expect(r.moves.length).toBeGreaterThanOrEqual(buttons.length);
    for (const mv of r.moves) expect(Number.isFinite(mv.damage) && mv.damage >= 0 && mv.seconds >= 0, mv.move.label).toBe(true);
    expect(r.moves.some((mv) => mv.damage > 0)).toBe(true);
    // Basic starts the first Basic Attack string ("Stage 1 DMG", "Basic Attack 1 DMG", "… - Basic Attack 1 DMG")
    const first = m.press(m.initial(), 'basic').move.rows[0]?.row ?? '';
    expect(first, 'first Basic press').toMatch(/\b(Stage|Basic Attack) 1\b|^Basic Attack/);
  });
});

describe('sequence hits', () => {
  it('only count from their sequence on', () => {
    const id = data.characters.find((c) => c.name === 'Carlotta')!.id;
    const has = (sequence: number) => computeDamage({ ...defaultBuild(id), sequence }, data, { noBreakdown: true }).hits.some((h) => h.row.seq === 3);
    expect(has(2)).toBe(false);
    expect(has(3)).toBe(true);
  });
});
