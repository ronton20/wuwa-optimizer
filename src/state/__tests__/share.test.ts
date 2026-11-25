import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { BUILDS } from '../../data/presets';
import { computeDamage } from '../../engine/damage';
import { decodeBuild, encodeBuild } from '../share';

const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('share links', () => {
  it.each(BUILDS.map((b) => [b.name, b.build] as const))('%s round-trips and gives the same damage', (_, build) => {
    const b = {
      ...build,
      skillLevels: { Liberation: 7 },
      enemy: { level: 95, res: { Glacio: 20, Fusion: 0, Electro: 0, Aero: -5, Spectro: 0, Havoc: 10, Physical: 0 } },
      conditions: { 'acct.lahairoi.bike': false },
      nodesOff: [5, 13, 9],
    };
    const code = encodeBuild(b);
    expect(code.length).toBeLessThan(2000);
    const back = decodeBuild(code, data)!;
    expect(plain(back)).toEqual(plain(b));
    const dmg = (x: typeof back) => computeDamage(x, data).hits.reduce((a, h) => a + h.avg, 0);
    expect(dmg(back)).toBeCloseTo(dmg(b), 6);
  });

  it('keeps empty echo slots and teammate slots in place', () => {
    const src = BUILDS[0].build;
    const b = { ...src, echoes: [src.echoes[0], null, src.echoes[2]], team: [null, src.team![1]] };
    expect(plain(decodeBuild(encodeBuild(b), data))).toEqual(plain(b));
  });

  it('rejects broken or foreign codes', () => {
    expect(decodeBuild('', data)).toBeNull();
    expect(decodeBuild('1garbage!!', data)).toBeNull();
    expect(decodeBuild('2' + encodeBuild(BUILDS[0].build).slice(1), data)).toBeNull();
  });
});
