import type { Character, GameData, Sonata } from '../../data/types';
import type { ActiveEffect, Build, Effect, Teammate } from '../types';
import { characterEffects, KITS } from './characters';
import { TEAM_ECHOES, TEAM_KITS, TEAM_SETS, TEAM_WEAPONS, echoBaseName } from './team';
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
    if (!p) continue;
    const key = `${p.setId}:${p.echoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const set = data.sonatas.find((s) => s.id === p.setId);
    if (set) counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  effects.push(...sonataEffects(counts));

  const first = build.echoes[0];
  const main = first && data.echoes.find((e) => e.id === first.echoId);
  if (main) effects.push(...mainEchoEffects(main.name, c as Character));

  // inherent skills switched off in the skill tree (tree index 4/5) take their buffs with them
  const offInherents = c.skills.filter((s) => s.kind === 'Inherent' && s.treeIndex && build.nodesOff?.includes(s.treeIndex)).map((s) => s.name);
  effects.push(...characterEffects(c.name, build.sequence).filter((e) => !(e.source.startsWith('Inherent') && offInherents.some((n) => e.source.includes(n)))));
  effects.push(...ACCOUNT_EFFECTS);
  (build.team ?? []).forEach((t, slot) => { if (t && t.characterId !== build.characterId) effects.push(...teammateEffects(t, slot, data)); });
  return effects;
}

/** Everything a teammate gives the on-field Resonator. Ids/keys are prefixed per slot ("t1.", "t2."). */
export function teammateEffects(t: Teammate, slot: number, data: GameData): Effect[] {
  const c = data.characters.find((x) => x.id === t.characterId);
  if (!c) return [];
  const prefix = `t${slot + 1}.`;
  const who = `Teammate ${slot + 1} (${c.name})`;
  const raw: Effect[] = [
    ...(TEAM_KITS[c.name] ?? []).filter((e) => t.sequence >= e.seq),
    ...(KITS[c.name] ?? []).filter((e) => e.team && t.sequence >= e.seq),
  ];
  const w = t.weapon && data.weapons.find((x) => x.id === t.weapon!.id);
  if (w) raw.push(...(TEAM_WEAPONS[w.name]?.(t.weapon!.rank) ?? []));
  if (t.mainEcho) raw.push(...(TEAM_ECHOES[echoBaseName(t.mainEcho)] ?? []));
  if (t.set) raw.push(...(TEAM_SETS[t.set] ?? []));
  const out: Effect[] = raw.map((e) => ({
    ...e,
    id: prefix + e.id,
    group: 'team',
    source: `${who} · ${e.source}`,
    condition: e.condition && { ...e.condition, key: e.condition.key ? prefix + e.condition.key : undefined },
  }));
  t.custom.forEach((m, i) => {
    if (m.value) out.push({ id: `${prefix}custom.${i}`, group: 'team', source: `${who} · ${m.label || 'Custom'}`, text: m.label || 'Custom buff', mods: [{ key: m.key, value: m.value }] });
  });
  return out;
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
