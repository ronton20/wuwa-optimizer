import type { StatKey } from '../../src/data/types.ts';

// Possible substat roll values on a +25 echo. The game files don't expose these tiers directly,
// so they are the community-known values; every value seen on your echo screenshots appears here.
const PCT_8 = [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6];

export const SUB_ROLLS: Partial<Record<StatKey, number[]>> = {
  critRate: [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5],
  critDmg: [12.6, 13.8, 15.0, 16.2, 17.4, 18.6, 19.8, 21.0],
  atkPct: PCT_8,
  hpPct: PCT_8,
  defPct: [8.1, 9.0, 10.0, 10.9, 11.8, 12.8, 13.8, 14.7],
  energyRegen: [6.8, 7.6, 8.4, 9.2, 10.0, 10.8, 11.6, 12.4],
  dmgBasic: PCT_8,
  dmgHeavy: PCT_8,
  dmgSkill: PCT_8,
  dmgLib: PCT_8,
  atk: [30, 40, 50, 60],
  hp: [320, 360, 390, 430, 470, 510, 540, 580],
  def: [40, 50, 60, 70],
};
