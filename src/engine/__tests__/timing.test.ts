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
    // Hiyuki's Bitterfrost stops the ToA clock too; outside the Tower it takes its normal time
    expect(actionTime('Nobody', { label: 'x', timing: 'heavy', stopsClock: true }, true).source).toBe('frozen');
    expect(actionTime('Nobody', { label: 'x', timing: 'heavy', stopsClock: true }, false).source).toBe('default');
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
      const m = machineFor(c!.id, data, 6);
      const strip = (l: string) => l.replace(/ \([^)]*\)$/, '');
      const known = new Set(m.exact.map((b) => b.label));
      // every move the machine makes within 7 presses from the start (Intro included)
      let frontier = [m.initial()];
      for (let d = 0; d < 7; d++) {
        const next = [];
        for (const s of frontier) for (const b of [...m.buttons.map((x) => x.id), 'intro']) { const r = m.press(s, b); known.add(strip(r.move.label)); next.push(r.state); }
        const seen = new Set<string>();
        frontier = next.filter((s) => { const k = JSON.stringify(s); return !seen.has(k) && seen.add(k); }).slice(0, 5000);
      }
      for (const label of Object.keys(rec.moves ?? {}))
        expect(known.has(strip(label)) || label.split(' + ').every((p) => known.has(strip(p)) || p.startsWith('Echo Skill')), `${name} · ${label}`).toBe(true);
    }
  });
});
