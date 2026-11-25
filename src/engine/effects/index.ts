import type { Character, GameData, Sonata } from '../../data/types';
import type { ActiveEffect, Build, Effect } from '../types';
import { characterEffects } from './characters';
import { mainEchoEffects, sonataEffects } from './echoes';
import { weaponEffects } from './weapons';

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
  return effects;
}

/** Applies the build's toggles / stack counts. Level 0 = off, 1 = on, N = stacks. */
export function resolveEffects(effects: Effect[], conditions: Build['conditions']): ActiveEffect[] {
  return effects.map((effect) => {
    const cond = effect.condition;
    if (!cond) return { effect, level: 1 };
    const v = conditions[effect.id];
    if (cond.kind === 'toggle') return { effect, level: (v ?? cond.default) ? 1 : 0 };
    const n = typeof v === 'number' ? v : cond.default;
    return { effect, level: Math.max(0, Math.min(cond.max, n)) };
  });
}

/** Value a mod contributes at the effect's level. */
export function modValue(mod: Effect['mods'][number], effect: Effect, level: number): number {
  if (level <= 0) return 0;
  if (mod.byStacks) return mod.byStacks[Math.min(level, mod.byStacks.length - 1)];
  return effect.condition?.kind === 'stacks' ? mod.value * level : mod.value;
}
