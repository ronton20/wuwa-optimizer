import { expect, it } from 'vitest';
import { valueLines } from '../effectText';

it('percent stats are not doubled ("+20% ATK"), flat stats stay plain ("+60 ATK")', () => {
  const line = (key: 'atkPct' | 'atk' | 'hpPct' | 'defPct', value: number) =>
    valueLines({ id: 'x', group: 'team', source: '', text: '', mods: [{ key, value }] }, 1)[0].text;
  expect(line('atkPct', 20)).toBe('+20% ATK');
  expect(line('hpPct', 12)).toBe('+12% HP');
  expect(line('defPct', 15)).toBe('+15% DEF');
  expect(line('atk', 60)).toBe('+60 ATK');
});
