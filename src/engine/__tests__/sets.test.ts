import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { HAS_SET_DEFINITIONS, SET_NO_SELF_EFFECT, sonataEffects } from '../effects/echoes';

describe('set bonuses', () => {
  it('every set is written out (or known to only help teammates)', () => {
    const missing = data.sonatas.filter((s) => !HAS_SET_DEFINITIONS.includes(s.name) && !SET_NO_SELF_EFFECT.includes(s.name)).map((s) => s.name);
    expect(missing).toEqual([]);
  });

  it('a full set gives its 2-piece stats plus the conditional part, with unique ids', () => {
    for (const s of data.sonatas) {
      const top = Math.max(...s.effects.map((e) => e.pieces));
      const effects = sonataEffects(new Map([[s, 5]]));
      const ids = effects.map((e) => e.id);
      expect(new Set(ids).size, s.name).toBe(ids.length);
      if (!SET_NO_SELF_EFFECT.includes(s.name)) expect(effects.some((e) => e.source === `${s.name} ${top}pc`), s.name).toBe(true);
    }
  });
});

import { HAS_MAIN_ECHO_DEFINITIONS, MAIN_ECHO_NO_SELF } from '../effects/echoes';
describe('main echo passives', () => {
  it('every 4-cost echo is written out (or known to only help teammates)', () => {
    const names = [...new Set(data.echoes.filter((e) => e.cost === 4).map((e) => e.name.replace(/^Phantom:\s*/, '')))];
    expect(names.filter((n) => !HAS_MAIN_ECHO_DEFINITIONS.includes(n) && !MAIN_ECHO_NO_SELF.includes(n))).toEqual([]);
  });
});
