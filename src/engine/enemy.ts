import type { Element } from '../data/types';
import type { Enemy } from './types';

const ALL: Element[] = ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'Physical'];
const uniformRes = (r: number) => Object.fromEntries(ALL.map((e) => [e, r])) as Record<Element, number>;

/** Most enemies have 10% resistance to every element; stages can raise or lower it (set it in Custom). */
export const ENEMY_PRESETS: Record<string, Enemy> = {
  'Tower of Adversity': { level: 100, res: uniformRes(10) },
  'Whimpering Wastes': { level: 100, res: uniformRes(10) },
  'Open world Lv 90': { level: 90, res: uniformRes(10) },
};
export const DEFAULT_ENEMY = ENEMY_PRESETS['Tower of Adversity'];

export const CHARACTER_LEVEL = 90;

/** Enemy DEF from level. */
export const enemyDef = (level: number) => 8 * level + 792;

/** DEF multiplier. `ignore` in percent. */
export function defMultiplier(enemyLevel: number, ignore: number, charLevel = CHARACTER_LEVEL) {
  const own = 800 + 8 * charLevel;
  return own / (own + enemyDef(enemyLevel) * (1 - Math.min(ignore, 100) / 100));
}

/** RES multiplier. `res` in percent after shred. */
export function resMultiplier(res: number) {
  const r = res / 100;
  if (r < 0) return 1 - r / 2;
  if (r < 0.8) return 1 - r;
  return 1 / (1 + 5 * r);
}
