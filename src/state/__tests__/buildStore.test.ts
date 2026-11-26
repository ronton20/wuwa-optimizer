import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PINNED, defaultBuild, teamBuild, useBuilds } from '../buildStore';

const HIYUKI = 1108;
const S = () => useBuilds.getState();

describe('saved builds, compare pins and shared copies', () => {
  beforeEach(() => S().importAll({}));

  it('a new character starts empty: S0, signature weapon at R1, no echoes', () => {
    const b = defaultBuild(HIYUKI);
    expect(b).toMatchObject({ sequence: 0, weapon: { rank: 1 }, echoes: [] });
    expect(b.team).toBeUndefined();
  });

  it('saves a copy that later edits do not change', () => {
    const id = S().saveAs('Crit set', { ...defaultBuild(HIYUKI), sequence: 6 });
    S().update(HIYUKI, (b) => ({ ...b, sequence: 0 }));
    expect(S().saved.find((s) => s.id === id)!.build.sequence).toBe(6);
  });

  it('"Echoes only" swaps the echoes and keeps everything else', () => {
    const src = { ...defaultBuild(HIYUKI), echoes: [] };
    const id = S().saveAs('No echoes', src);
    S().update(HIYUKI, (b) => ({ ...b, sequence: 2 }));
    S().loadSaved(id, 'echoes');
    expect(S().builds[HIYUKI].echoes).toEqual([]);
    expect(S().builds[HIYUKI].sequence).toBe(2);
  });

  it(`keeps at most ${MAX_PINNED} pins, dropping the oldest, and deleting unpins`, () => {
    const ids = ['a', 'b', 'c'].map((n) => S().saveAs(n, defaultBuild(HIYUKI)));
    ids.forEach((id) => S().togglePin(id));
    expect(S().pinned).toEqual(ids.slice(1));
    S().deleteSaved(ids[2]);
    expect(S().pinned).toEqual([ids[1]]);
  });

  it('a shared build is edited on its own until kept, and never touches undo history', () => {
    S().openShared({ ...defaultBuild(HIYUKI), sequence: 1 });
    S().update(HIYUKI, (b) => ({ ...b, sequence: 3 }));
    expect(S().builds[HIYUKI]).toBeUndefined();
    expect(S().past).toHaveLength(0);
    S().keepShared('replace');
    expect(S().builds[HIYUKI].sequence).toBe(3);
    expect(S().shared).toBeNull();
  });

  it('"Save as a copy" keeps the live build as it was', () => {
    S().openShared({ ...defaultBuild(HIYUKI), sequence: 4 });
    S().keepShared('copy', 'From a friend');
    expect(S().builds[HIYUKI]).toBeUndefined();
    expect(S().saved.map((s) => [s.name, s.build.sequence])).toEqual([['From a friend', 4]]);
  });
});

describe('teams of full builds', () => {
  it('saving a team links each member to the other two, and teammates follow later edits', async () => {
    const { useBuilds, linkTeam } = await import('../buildStore');
    const data = (await import('../../data/current')).default;
    const id = (n: string) => data.characters.find((c) => c.name === n)!.id;
    const [hiyuki, lucilla, suisui] = [id('Hiyuki'), id('Lucilla'), id('Suisui')];
    useBuilds.getState().importAll({});
    useBuilds.getState().saveTeam({ name: 'Glacio', members: [hiyuki, lucilla, suisui] });
    const s = useBuilds.getState();
    expect(s.teams).toHaveLength(1);
    expect(s.mainTeam).toBe(s.teams[0].id);
    expect(s.builds[hiyuki].team?.map((t) => [t?.characterId, t?.linked])).toEqual([[lucilla, true], [suisui, true]]);

    // edit Lucilla: Hiyuki's view of her follows, and nothing is copied into storage
    s.update(lucilla, (b) => ({ ...b, sequence: 4 }));
    const after = useBuilds.getState();
    expect(after.builds[hiyuki].team?.[0]?.build).toBeUndefined();
    expect(linkTeam(after.builds[hiyuki], after.builds).team?.[0]?.build?.sequence).toBe(4);
  });
});

describe('rotations', () => {
  beforeEach(() => S().importAll({}));

  it('a team member without teammates set gets the other members, following my builds', () => {
    const b = teamBuild(HIYUKI, [HIYUKI, 1109, 1110], { 1109: { ...defaultBuild(1109), sequence: 2 } });
    expect(b.team?.map((t) => t?.characterId)).toEqual([1109, 1110]);
    expect(b.team?.[0]?.build?.sequence).toBe(2);
  });

  it('rotations are saved per team and go with the team', () => {
    const team = S().saveTeam({ name: 'Frost', members: [HIYUKI, 1109, 1110] });
    S().saveRotation({ id: 'r1', name: 'R', teamId: team, steps: [{ char: HIYUKI, button: 'basic' }] });
    S().saveRotation({ id: 'r1', name: 'R2', teamId: team, steps: [] });
    expect(S().rotations).toHaveLength(1);
    expect(S().rotations[0].name).toBe('R2');
    S().deleteTeam(team);
    expect(S().rotations).toHaveLength(0);
  });
});
