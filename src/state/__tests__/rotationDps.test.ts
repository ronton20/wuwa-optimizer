import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import type { Rotation } from '../../engine/rotation/sim';
import { defaultBuild } from '../buildStore';
import { rotationDps, rotationFor } from '../rotationDps';

const id = (n: string) => data.characters.find((c) => c.name === n)!.id;
const [H, L, S, C] = ['Hiyuki', 'Lucilla', 'Suisui', 'Chisa'].map(id);
const frost = { id: 'frost', name: 'Frost', members: [H, L, S] };
const other = { id: 'other', name: 'Other', members: [C, H] };
const rot = (teamId: string, char: number): Rotation => ({ id: `r-${teamId}`, name: 'R', teamId, steps: [{ char, button: 'basic' }, { char, button: 'skill' }] });

describe('rotation DPS for a Resonator', () => {
  it('uses the main team when the Resonator is in it, else their first team with a rotation', () => {
    const s = { teams: [other, frost], mainTeam: 'frost', rotations: [rot('other', C), rot('frost', H)] };
    expect(rotationFor(H, s)?.team.id).toBe('frost');
    expect(rotationFor(C, s)?.team.id).toBe('other');
    expect(rotationFor(id('Jiyan'), s)).toBeUndefined();
    // a team whose rotations are all empty doesn't count
    expect(rotationFor(H, { ...s, rotations: [{ ...rot('frost', H), steps: [] }, rot('other', C)] })?.team.id).toBe('other');
  });

  it("swaps one member's build for a saved one", () => {
    const builds = { [H]: defaultBuild(H), [L]: defaultBuild(L), [S]: defaultBuild(S) };
    const base = rotationDps(frost, rot('frost', H), builds);
    const better = rotationDps(frost, rot('frost', H), builds, { ...defaultBuild(H), sequence: 6 });
    expect(base.dps).toBeGreaterThan(0);
    expect(better.dps).toBeGreaterThan(base.dps);
  });
});
