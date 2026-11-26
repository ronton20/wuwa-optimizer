import type { GameData, SkillKind, StatKey } from '../data/types';
import { computeDamage } from './damage';
import { mainEchoEffects } from './effects/echoes';
import { collectEffects, resolveEffects } from './effects';
import { mechanicsOf, type Mechanic } from './mechanics';
import type { Build, EchoPiece, Effect } from './types';

/**
 * Build optimizer: for one damage row, tries weapons, sets, the main echo and every main-stat combination,
 * keeping the player's substats on their slots and everything else (team, buffs, enemy) as set.
 *
 * Layout is always 4-3-3-1-1. Sets are either one 5-piece set, or a 3-piece set (main echo + both 3-costs)
 * with a 2-piece set on the 1-costs.
 */

export interface OptimizeTarget { skillKind: SkillKind; row: string }
export interface OptimizeOptions {
  target: OptimizeTarget;
  metric: 'crit' | 'avg';
  /** which weapons to try */
  weapons: 'all' | 'five' | 'mine';
  /** rank assumed for weapons other than the equipped one (the equipped one keeps its rank) */
  otherRank: number;
  /** which sets to try */
  sets: 'all' | 'mine';
  /** what the team can trigger; conditional buffs needing anything else count as off */
  can: Mechanic[];
  /** finalists that get the full main-stat search */
  finalists?: number;
}

/** Main stat per slot, in slot order (cost 4, 3, 3, 1, 1). */
export type Mains = [StatKey, StatKey, StatKey, StatKey, StatKey];

export interface Candidate {
  weapon: { id: number; rank: number };
  /** set on the 3 big slots (main + both 3-costs) and on the 2 small slots; equal for a 5-piece set */
  sets: [number, number];
  mainEchoId: number;
  mains: Mains;
  value: number;
  /** other 2-piece sets for the small slots that give the same result */
  alsoSets?: number[];
  /** other main echoes that give the same result */
  alsoEchoes?: number[];
  /** conditions of weapon / echo / set buffs this result counts on */
  relies?: string[];
}

export interface OptimizeResult { current: number; best: Candidate[]; evaluated: number }

const COSTS = [4, 3, 3, 1, 1] as const;

/** Damage of the target row for a build (summed over its hits). */
export function rowValue(build: Build, data: GameData, target: OptimizeTarget, metric: 'crit' | 'avg', disable?: (e: Effect) => boolean): number {
  const { hits } = computeDamage(build, data, { noBreakdown: true, only: target, disable });
  return hits.reduce((a, h) => a + (metric === 'crit' ? h.crit : h.avg) * h.count, 0);
}

/** Main-stat choices worth trying for each cost (healing and off-element damage never help damage). */
function mainChoices(data: GameData, element: string): Record<4 | 3 | 1, StatKey[]> {
  const ok = (s: StatKey) => s !== 'healing' && (!s.startsWith('dmg') || s === `dmg${element}`);
  return {
    4: data.echoStats.main['4'].map((m) => m.stat).filter(ok),
    3: data.echoStats.main['3'].map((m) => m.stat).filter(ok),
    1: data.echoStats.main['1'].map((m) => m.stat).filter(ok),
  };
}

/** Every main-stat combination; the two 3-costs (and the two 1-costs) are interchangeable, so only unordered pairs. */
function allMains(choices: Record<4 | 3 | 1, StatKey[]>): Mains[] {
  const pairs = (xs: StatKey[]) => xs.flatMap((a, i) => xs.slice(i).map((b) => [a, b] as const));
  const out: Mains[] = [];
  for (const a of choices[4]) for (const [b, c] of pairs(choices[3])) for (const [d, e] of pairs(choices[1])) out.push([a, b, c, d, e]);
  return out;
}

const echoName = (data: GameData, id: number) => data.echoes.find((e) => e.id === id)!.name.replace(/^Phantom:\s*/, '');

/** Same echo under another id or spelling ("Nightmare Crownless" / "Nightmare: Crownless", skins): one set piece in game. */
const sameEcho = (name: string) => name.replace(/^Phantom:\s*/, '').replace(/:/g, '').toLowerCase();

/** Echoes of a cost in a set, one per distinct echo, the player's own first so applying keeps them where possible. */
function echoesOf(data: GameData, setId: number, cost: number, prefer: number[]): number[] {
  const all = data.echoes.filter((e) => e.cost === cost && e.sets.includes(setId) && !/^Phantom/.test(e.name));
  const ordered = [...all.filter((e) => prefer.includes(e.id)), ...all.filter((e) => !prefer.includes(e.id))];
  const seen = new Set<string>();
  return ordered.filter((e) => { const k = sameEcho(e.name); if (seen.has(k)) return false; seen.add(k); return true; }).map((e) => e.id);
}

/** Builds the 5 echo pieces for a candidate, keeping each slot's substats. */
export function piecesFor(build: Build, data: GameData, c: Omit<Candidate, 'value'>): (EchoPiece | null)[] {
  const own = build.echoes.map((p) => p?.echoId ?? 0);
  const nameOf = (id: number) => sameEcho(data.echoes.find((e) => e.id === id)!.name);
  const used = new Set<string>([nameOf(c.mainEchoId)]);
  return COSTS.map((cost, slot) => {
    const setId = slot < 3 ? c.sets[0] : c.sets[1];
    let echoId = c.mainEchoId;
    if (slot > 0) {
      const options = echoesOf(data, setId, cost, own);
      echoId = options.find((id) => !used.has(nameOf(id))) ?? options[0];
      used.add(nameOf(echoId));
    }
    const main = data.echoStats.main[String(cost) as '1' | '3' | '4'].find((m) => m.stat === c.mains[slot])!;
    return { echoId, setId, main: { stat: main.stat, value: main.value }, subs: build.echoes[slot]?.subs ?? [] };
  });
}

export function applyCandidate(build: Build, data: GameData, c: Omit<Candidate, 'value'>): Build {
  return { ...build, weapon: c.weapon, echoes: piecesFor(build, data, c) };
}

/** Set layouts to try: every 5-piece set, and every 3-piece set with each 2-piece set. */
function layouts(data: GameData, opts: OptimizeOptions, build: Build): [number, number][] {
  const pieces = (id: number) => data.sonatas.find((s) => s.id === id)!.effects.map((e) => e.pieces);
  const five = data.sonatas.filter((s) => pieces(s.id).includes(5)).map((s) => s.id);
  const three = data.sonatas.filter((s) => pieces(s.id).includes(3)).map((s) => s.id);
  if (opts.sets === 'mine') {
    const ids = build.echoes.map((p) => p?.setId).filter((x): x is number => x !== undefined);
    const top = [...new Set(ids)].sort((a, b) => ids.filter((x) => x === b).length - ids.filter((x) => x === a).length);
    const main = top[0];
    if (main === undefined) return five.map((s) => [s, s]);
    return three.includes(main) ? five.filter((s) => s !== main).map((s) => [main, s] as [number, number]) : [[main, main]];
  }
  return [...five.map((s) => [s, s] as [number, number]), ...three.flatMap((t) => five.map((s) => [t, s] as [number, number]))];
}

/** Main echoes to try for a set: one per distinct passive (echoes without one are interchangeable). */
function mainEchoes(data: GameData, setId: number, characterId: number, own?: number): number[] {
  const c = data.characters.find((x) => x.id === characterId)!;
  const list = echoesOf(data, setId, 4, own ? [own] : []);
  const seen = new Set<string>();
  return list.filter((id) => {
    const key = JSON.stringify(mainEchoEffects(echoName(data, id), c).map((e) => [e.mods, e.appliesTo?.dmgTypes, e.condition?.label]));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function weaponsToTry(data: GameData, build: Build, opts: OptimizeOptions): { id: number; rank: number }[] {
  const c = data.characters.find((x) => x.id === build.characterId)!;
  if (opts.weapons === 'mine') return [build.weapon];
  const list = data.weapons.filter((w) => w.type === c.weaponType && (opts.weapons === 'all' ? w.rarity >= 4 : w.rarity === 5));
  // weapons whose passive can't touch damage (Concerto Energy only) still differ by base ATK + substat, so they stay in
  return list.map((w) => (w.id === build.weapon.id ? build.weapon : { id: w.id, rank: opts.otherRank }));
}

/**
 * Runs the search. `onProgress(done, total)` is called now and then (the worker forwards it to the UI).
 * Returns the best candidates, best first, with no two sharing weapon + sets + main echo.
 */
export function optimize(build: Build, data: GameData, opts: OptimizeOptions, onProgress?: (done: number, total: number) => void): OptimizeResult {
  const c = data.characters.find((x) => x.id === build.characterId)!;
  const can = new Set(opts.can);
  const disable = (e: Effect) => { const m = mechanicsOf(e); return m.length > 0 && !m.some((x) => can.has(x)); };
  const value = (b: Build) => rowValue(b, data, opts.target, opts.metric, disable);
  const choices = mainChoices(data, c.element);
  const mainsList = allMains(choices);
  let evaluated = 0;
  const score = (cand: Omit<Candidate, 'value'>): Candidate => { evaluated++; return { ...cand, value: value(applyCandidate(build, data, cand)) }; };

  const current = value(build);
  const ownMain = build.echoes[0]?.echoId;
  const ownSets = layouts(data, { ...opts, sets: 'mine' }, build)[0] ?? [build.echoes[0]?.setId ?? 0, build.echoes[0]?.setId ?? 0];
  const weapons = weaponsToTry(data, build, opts);
  const sets = layouts(data, opts, build);
  const finalists = opts.finalists ?? 12;
  const total = mainsList.length + weapons.length * sets.reduce((a, s) => a + mainEchoes(data, s[0], c.id, ownMain).length, 0) + finalists * mainsList.length;
  let tick = 0;
  const progress = () => { if (onProgress && ++tick % 25 === 0) onProgress(evaluated, total); };

  // 1. best mains for the current weapon / sets / main echo
  const start = { weapon: build.weapon, sets: ownSets as [number, number], mainEchoId: ownMain ?? mainEchoes(data, ownSets[0], c.id)[0] };
  let seedMains = mainsList[0];
  let seedBest = -1;
  for (const m of mainsList) { const r = score({ ...start, mains: m }); progress(); if (r.value > seedBest) { seedBest = r.value; seedMains = m; } }

  // 2. every weapon × set layout × main echo with those mains
  const coarse: Candidate[] = [];
  for (const weapon of weapons) {
    for (const s of sets) {
      for (const mainEchoId of mainEchoes(data, s[0], c.id, ownMain)) { coarse.push(score({ weapon, sets: s, mainEchoId, mains: seedMains })); progress(); }
    }
  }
  coarse.sort((a, b) => b.value - a.value);

  // 3. full main-stat search for the finalists
  const best: Candidate[] = [];
  for (const f of coarse.slice(0, finalists)) {
    let top: Candidate = f;
    for (const m of mainsList) { const r = score({ ...f, mains: m }); progress(); if (r.value > top.value) top = r; }
    best.push(top);
  }
  best.sort((a, b) => b.value - a.value);

  // results that only differ by an equivalent 2-piece set are one result
  const merged: Candidate[] = [];
  const same = (a: Candidate, b: Candidate) => a.weapon.id === b.weapon.id && a.mains.join() === b.mains.join() && Math.abs(a.value - b.value) <= a.value * 1e-6;
  for (const b of best) {
    const twinSet = merged.find((m) => same(m, b) && m.mainEchoId === b.mainEchoId && m.sets[0] === b.sets[0] && m.sets[0] !== m.sets[1]);
    const twinEcho = merged.find((m) => same(m, b) && m.sets.join() === b.sets.join());
    if (twinSet) (twinSet.alsoSets ??= []).push(b.sets[1]);
    else if (twinEcho) (twinEcho.alsoEchoes ??= []).push(b.mainEchoId);
    else merged.push({ ...b });
  }
  // what each result counts on (weapon / echo / set conditions that are on)
  for (const m of merged) {
    const b = applyCandidate(build, data, m);
    const active = resolveEffects(collectEffects(b, data), b.conditions).filter((a) => a.level > 0 && !disable(a.effect)
      && (a.effect.group === 'weapon' || a.effect.group === 'echo') && a.effect.condition);
    m.relies = [...new Set(active.map((a) => a.effect.condition!.label))];
  }
  onProgress?.(total, total);
  return { current, best: merged, evaluated };
}
