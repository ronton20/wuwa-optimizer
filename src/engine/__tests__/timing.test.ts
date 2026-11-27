import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { machineFor } from '../rotation/actions';
import { RECORDED_TIMES } from '../rotation/recordedTimes';
import { actionTime, DEFAULT_TIMES, FROZEN_LIBERATION_TIME } from '../rotation/timing';

describe('action times', () => {
  it('recorded beats the machine estimate, which beats the default; frozen Liberations stay frozen', () => {
    const move = { label: 'Basic Attack - Test', timing: 'basic' as const };
    expect(actionTime('Nobody', move)).toEqual({ seconds: DEFAULT_TIMES.basic, source: 'default' });
    expect(actionTime('Nobody', { ...move, seconds: 4 })).toEqual({ seconds: 4, source: 'estimate' });
    expect(actionTime('Nobody', { label: 'x', timing: 'liberation' }, true)).toEqual({ seconds: FROZEN_LIBERATION_TIME, source: 'frozen' });
    RECORDED_TIMES.Nobody = { kinds: { basic: 0.7 }, moves: { 'Basic Attack - Test': 0.45 }, source: 'test' };
    try {
      expect(actionTime('Nobody', { ...move, seconds: 4 })).toEqual({ seconds: 0.45, source: 'recorded' });
      expect(actionTime('Nobody', { ...move, label: 'Other' })).toEqual({ seconds: 0.7, source: 'recorded' });
    } finally { delete RECORDED_TIMES.Nobody; }
  });

  it('every recorded time names a real Resonator and one of their moves', () => {
    for (const [name, rec] of Object.entries(RECORDED_TIMES)) {
      const c = data.characters.find((x) => x.name === name);
      expect(c, name).toBeDefined();
      const known = new Set(machineFor(c!.id, data).exact.map((b) => b.label));
      for (const label of Object.keys(rec.moves ?? {}))
        expect(label.split(' + ').every((p) => known.has(p) || p.startsWith('Echo Skill')), `${name} · ${label}`).toBe(true);
    }
  });
});
