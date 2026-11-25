import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PINNED, defaultBuild, useBuilds } from '../buildStore';

const HIYUKI = 1108;
const S = () => useBuilds.getState();

describe('saved builds, compare pins and shared copies', () => {
  beforeEach(() => S().importAll({}));

  it('saves a copy that later edits do not change', () => {
    const id = S().saveAs('Crit set', defaultBuild(HIYUKI));
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
