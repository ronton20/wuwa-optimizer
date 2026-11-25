import type { Character, GameData, Sonata } from '../../data/types';
import type { ActiveEffect, Build, Effect } from '../types';
import { characterEffects } from './characters';
import { mainEchoEffects, sonataEffects } from './echoes';
import { weaponEffects } from './weapons';

/** Account-wide upgrades. Passive in game, so the stat screen includes them; a toggle for players who lack them. */
export const ACCOUNT_EFFECTS: Effect[] = [{
  id: 'acct.lahairoi.bike', group: 'self', source: 'Lahai-Roi Bike upgrade', text: 'On-field Resonator Energy Regen +30%',
  condition: { kind: 'toggle', label: 'Bike Energy Regen upgrade unlocked', default: true },
  mods: [{ key: 'energyRegen', value: 30 }],
}];

/** Every effect the build could have, before conditions are applied. */
export function collectEffects(build: Build, data: GameData): Effect[] {
  const c = data.characters.find((x) => x.id === build.characterId)!;
  const w = data.weapons.find((x) => x.id === build.weapon.id);
  const effects: Effect[] = [];

  if (w) effects.push(...weaponEffects(w, build.weapon.rank));

  // sonata counts: one piece per distinct echo per set
  const counts = new Map<Sonata, number>();
  const seen = new Set<string>();
  for (const p of build.echoes) {
    const key = `${p.setId}:${p.echoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const set = data.sonatas.find((s) => s.id === p.setId);
    if (set) counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  effects.push(...sonataEffects(counts));

  const main = build.echoes[0] && data.echoes.find((e) => e.id === build.echoes[0].echoId);
  if (main) effects.push(...mainEchoEffects(main.name, c as Character));

  effects.push(...characterEffects(c.name, build.sequence));
  effects.push(...ACCOUNT_EFFECTS);
  return effects;
}

/** The id a toggle / stack count is stored under. */
export const conditionKey = (e: Effect) => e.condition?.key ?? e.id;

/** Level of a toggle / non-stacking effect: 0 = off, 1 = on. */
function toggleLevel(effect: Effect, conditions: Build['conditions']): number {
  const cond = effect.condition;
  if (!cond) return 1;
  if (cond.kind !== 'toggle') return 0;
  return (conditions[conditionKey(effect)] ?? cond.default) ? 1 : 0;
}

/**
 * Current stack limit of every stack condition, after active "max stacks +N" effects.
 * Raises in the same `exclusive` group don't add up (e.g. Cartethyia S2 and Chisa's Outro: +3 total).
 */
export function conditionMaxes(effects: Effect[], conditions: Build['conditions']): Record<string, number> {
  const base: Record<string, number> = {};
  for (const e of effects) if (e.condition?.kind === 'stacks') base[conditionKey(e)] = e.condition.max;
  const to: Record<string, number> = {};
  const by: Record<string, Record<string, number>> = {};
  for (const e of effects) {
    const r = e.raisesMax;
    if (!r || toggleLevel(e, conditions) <= 0) continue;
    if (r.to !== undefined) to[r.key] = Math.max(to[r.key] ?? 0, r.to);
    if (r.by) {
      const groups = (by[r.key] ??= {});
      const g = r.exclusive ?? e.id;
      groups[g] = Math.max(groups[g] ?? 0, r.by);
    }
  }
  const out: Record<string, number> = {};
  for (const [key, max] of Object.entries(base)) {
    out[key] = Math.max(max, to[key] ?? 0) + Object.values(by[key] ?? {}).reduce((a, b) => a + b, 0);
  }
  return out;
}

/** Applies the build's toggles / stack counts. Level 0 = off, 1 = on, N = stacks (clamped to the current limit). */
export function resolveEffects(effects: Effect[], conditions: Build['conditions']): ActiveEffect[] {
  const maxes = conditionMaxes(effects, conditions);
  return effects.map((effect) => {
    const cond = effect.condition;
    if (!cond || cond.kind === 'toggle') return { effect, level: toggleLevel(effect, conditions) };
    const key = conditionKey(effect);
    const limit = maxes[key] ?? cond.max;
    const v = conditions[key];
    const n = typeof v === 'number' ? v : cond.default === 'max' ? limit : cond.default;
    return { effect, level: Math.max(0, Math.min(limit, n)) };
  });
}

/** Value a mod contributes at the effect's level. */
export function modValue(mod: Effect['mods'][number], effect: Effect, level: number): number {
  if (level <= 0) return 0;
  if (mod.byStacks) return mod.byStacks[Math.min(level, mod.byStacks.length - 1)];
  return effect.condition?.kind === 'stacks' ? mod.value * level : mod.value;
}
