import type { Character, GameData, Skill, SkillKind } from '../../data/types';
import { computeDamage, ECHO_ROW, echoSkill, matches, type HitContext } from '../damage';
import { collectEffects, inMode, resolveEffects } from '../effects';
import type { ActiveEffect, Build, Effect } from '../types';
import { machineFor, skillOfRow, type GameEvent, type Machine, type MachineState, type Move, type RowRef } from './actions';
import { BITE_ROW, chafeTracker, type ChafeInfo } from './chafe';
import { characterOf, DEFAULT_TIMES, FROZEN_LIBERATION_TIME, timedRule, weaponConcerto, type TimedRule } from './timing';

/** One press in the rotation. Switching to another Resonator happens before their first press. */
export interface RotationStep {
  char: number;
  button: string;
  /** seconds this press takes (overrides the default for its kind of action) */
  seconds?: number;
  /**
   * how this Resonator comes in when it's a switch. auto (default): Outro + Intro when the one leaving has full
   * Concerto, a plain switch otherwise. intro / quick force one or the other.
   */
  swap?: 'auto' | 'intro' | 'quick';
  /** pick for the move's choice (Spotlight / Compensate, Snowforged Blades used…) */
  option?: number;
}

export interface Rotation {
  id: string;
  name: string;
  teamId: string;
  steps: RotationStep[];
  /** Tower of Adversity: the clock stops during Liberation animations */
  freezeLiberation?: boolean;
  /** start with full Concerto (default: empty) */
  fullConcerto?: boolean;
  /** start with empty Resonance Energy (default: full) */
  emptyEnergy?: boolean;
}

export interface SimHit { row: RowRef; value: number }

/** One performed move (a press, or the Outro / Intro of a switch). */
export interface SimMove {
  /** index in rotation.steps */
  step: number;
  char: number;
  move: Move;
  /** 'swap' = Outro / Intro of a switch */
  via: 'press' | 'swap';
  t: number;
  seconds: number;
  damage: number;
  hits: SimHit[];
  /** timed buffs that were up when this move hit (short source names) */
  buffs: string[];
  /** every other buff that counted for this move (always on, or on by its toggle in the Buffs tab) */
  always: string[];
  /** this character's Concerto and Resonance Energy after the move */
  concerto: number;
  energy: number;
  maxEnergy: number;
  warn: string[];
  /** Glacio Chafe this move inflicted, and Hiyuki's Glacio Bite */
  chafe?: ChafeInfo;
}

export interface BuffLane {
  key: string;
  owner: number;
  label: string;
  rule: TimedRule;
  intervals: [number, number][];
}

export interface SimResult {
  moves: SimMove[];
  total: number;
  time: number;
  dps: number;
  byChar: Record<number, number>;
  lanes: BuffLane[];
  /** each Resonator's state after each step (what the buttons do next) */
  states: Map<number, MachineState>[];
  /** how each switch happened, by step index */
  swaps: Record<number, 'intro' | 'quick'>;
}

interface Event { char: number; event: GameEvent; t: number; incoming?: number; leftAt?: number; tags?: Record<string, number> }

/** "Outro · Rippling Waters — Reflecting Shadows (400+ Floral Epistle)" */
const short = (e: Effect) => `${e.source.replace(/^Teammate \d \([^)]+\) · /, '')}${e.condition?.label ? ` — ${e.condition.label}` : ''}`;
const ownerOf = (e: Effect, build: Build) => {
  const m = e.id.match(/^t(\d)\./);
  return m ? build.team?.[Number(m[1]) - 1]?.characterId ?? -1 : build.characterId;
};
const num = (v: string | undefined) => (v ? Number.parseFloat(v) || 0 : 0);
const nameOf = (row: string) => row.replace(/ DMG$/, '');

/** Concerto, Resonance Energy (before Energy Regen) and Resonance Cost of a move, from the game data. */
export function moveResources(c: Character, move: Move, extra: Skill[] = []) {
  let concerto = 0, energy = 0;
  const skills = [...c.skills, ...extra];
  const rowsOfKind = (kind: SkillKind) => skills.filter((s) => s.kind === kind).flatMap((s) => s.rows);
  const find = (kind: SkillKind, label: string) => rowsOfKind(kind).find((r) => r.label === label);
  /** "Foreclaiming: Blade Liberation Resonance Cost" belongs to "Foreclaiming: Blade Liberation Base DMG" */
  const own = (kind: SkillKind, row: string, what: string) =>
    rowsOfKind(kind).find((r) => r.label.endsWith(` ${what}`) && nameOf(row).startsWith(r.label.slice(0, -what.length - 1)));
  for (const ref of move.rows) {
    const row = rowsOfKind(ref.skillKind).find((r) => r.label === ref.row);
    // a move's own "X Concerto Regen" row wins over the per-hit values
    const named = own(ref.skillKind, ref.row, 'Concerto Regen');
    const times = ref.times ?? 1;
    concerto += times * (named ? num(named.values.at(-1)) : (row?.hits ?? []).reduce((s, h) => s + (h.concerto ?? 0) * h.count, 0));
    energy += times * (row?.hits ?? []).reduce((s, h) => s + (h.energy ?? 0) * h.count, 0);
  }
  concerto += move.concerto ?? 0;
  let cost = 0;
  if (move.cast) {
    concerto += num(find(move.kind, 'Concerto Regen')?.values.at(-1));
    if (move.kind === 'Liberation') {
      // named costs ("Blade Liberation Resonance Cost") mean the other Liberation moves are free (Inward Vision)
      const hasNamed = rowsOfKind('Liberation').some((r) => / Resonance Cost$/.test(r.label));
      const mine = move.rows[0] && own('Liberation', move.rows[0].row, 'Resonance Cost');
      cost = mine ? num(mine.values.at(-1)) : hasNamed ? 0 : num(find('Liberation', 'Resonance Cost')?.values.at(-1));
    }
  }
  return { concerto, energy, cost };
}

/** The most Resonance Energy a Resonator holds: their (largest) Liberation cost. */
export function maxEnergyOf(c: Character) {
  return Math.max(0, ...c.skills.filter((s) => s.kind === 'Liberation').flatMap((s) => s.rows).filter((r) => /Resonance Cost$/.test(r.label)).map((r) => num(r.values.at(-1))));
}

/** Walk a rotation: resolve presses, switches, Concerto, Energy and timed buffs, and sum the damage. */
export function simulate(rotation: Pick<Rotation, 'steps' | 'freezeLiberation' | 'fullConcerto' | 'emptyEnergy'>, builds: Record<number, Build | undefined>, data: GameData): SimResult {
  const machine = (id: number): Machine => machineFor(id, data, builds[id]?.sequence ?? 0);
  const states = new Map<number, MachineState>();
  const state = (id: number) => states.get(id) ?? machine(id).initial();

  const rules = new Map<number, Map<string, { rule: TimedRule; owner: number; effect: Effect }>>();
  const rulesFor = (b: Build) => {
    if (!rules.has(b.characterId)) {
      const m = new Map<string, { rule: TimedRule; owner: number; effect: Effect }>();
      // only the Resonance Mode the build has picked (Lucilla: Glacio Chafe or Echo)
      for (const e of collectEffects(b, data).filter((x) => inMode(x, b.conditions))) {
        const owner = ownerOf(e, b);
        const rule = timedRule(e, characterOf(data, owner), data);
        if (rule) m.set(e.id, { rule, owner, effect: e });
      }
      rules.set(b.characterId, m);
    }
    return rules.get(b.characterId)!;
  };

  const events: Event[] = [];
  const isUp = (rule: TimedRule, owner: number, char: number, t: number) => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.char !== owner || !rule.on.includes(ev.event) || ev.t > t) continue;
      if (t - ev.t >= rule.seconds) return false;
      if (rule.needs && (ev.tags?.[rule.needs.tag] ?? 0) < rule.needs.min) return false;
      if (rule.incomingOnly) return ev.incoming === char && (ev.leftAt === undefined || ev.leftAt > t);
      return true;
    }
    return false;
  };

  const cache = new Map<string, number>();
  const rowDamage = (b: Build, ref: RowRef, up: Set<string>, levels?: Record<string, number>) => {
    const key = `${b.characterId}|${ref.skillKind}|${ref.row}|${ref.bonus?.times ?? 0}|${ref.times ?? 1}|${[...up].sort().join(',')}|${JSON.stringify(levels ?? {})}`;
    if (!cache.has(key)) {
      const r = rulesFor(b);
      // stacks the move sets itself (only for effects that are on), then timed buffs
      const level = (a: ActiveEffect) => (levels && a.effect.id in levels && a.level > 0 ? levels[a.effect.id] : r.has(a.effect.id) ? (up.has(a.effect.id) ? a.level : 0) : undefined);
      const { hits } = computeDamage(b, data, { noBreakdown: true, only: { skillKind: ref.skillKind, row: ref.row }, level, echo: ref.skillKind === 'Echo' });
      let value = hits.reduce((s, h) => s + h.avg * h.count, 0);
      if (ref.bonus && hits.length) {
        // extra multiplier on the same hit: scale by (row % + bonus % × times) / row %
        const lv = hits[0].level;
        const base = hits.reduce((s, h) => s + h.term.pct[lv - 1] * h.count, 0);
        const bonusRow = hits[0].skill.rows.find((x) => x.label === ref.bonus!.row);
        const extra = num(bonusRow?.values[lv - 1]) * ref.bonus.times;
        if (base > 0) value *= (base + extra) / base;
      }
      cache.set(key, value * (ref.times ?? 1));
    }
    return cache.get(key)!;
  };
  // which buffs count for a move: on (level > 0 after timing) and reaching at least one of its hits
  const usedCache = new Map<string, string[]>();
  const used = (b: Build, move: Move, up: Set<string>) => {
    const key = `${b.characterId}|${move.rows.map((r) => `${r.skillKind}:${r.row}`).join(';')}|${[...up].sort().join(',')}`;
    if (!usedCache.has(key)) {
      const c = characterOf(data, b.characterId)!;
      const echo = echoSkill(b, data);
      const rowOf = (ref: RowRef) => (ref.skillKind === 'Echo' ? echo?.rows[0] : skillOfRow(c, ref)?.rows.find((r) => r.label === ref.row));
      const ctx: HitContext[] = move.rows.flatMap((ref) => (rowOf(ref)?.hits ?? [])
        .map((h) => ({ skillKind: ref.skillKind, row: ref.row, element: h.element, dmgType: h.dmgType })));
      const r = rulesFor(b);
      const names = resolveEffects(collectEffects(b, data), b.conditions)
        .filter((a) => !r.has(a.effect.id) && a.level > 0)
        .filter((a) => !a.effect.appliesTo || ctx.some((h) => matches(a.effect.appliesTo, h)))
        .map((a) => short(a.effect));
      usedCache.set(key, [...new Set(names)]);
    }
    return usedCache.get(key)!;
  };
  const erOf = new Map<number, number>();
  const er = (b: Build) => {
    if (!erOf.has(b.characterId)) erOf.set(b.characterId, computeDamage(b, data, { noBreakdown: true, only: { skillKind: 'Outro', row: '' } }).stats.sheet.energyRegen / 100 || 1);
    return erOf.get(b.characterId)!;
  };

  // Concerto and Energy per Resonator
  const concerto = new Map<number, number>();
  const energy = new Map<number, number>();
  const maxE = (id: number) => maxEnergyOf(characterOf(data, id)!);
  const conc = (id: number) => concerto.get(id) ?? (rotation.fullConcerto ? 100 : 0);
  const ener = (id: number) => energy.get(id) ?? (rotation.emptyEnergy ? 0 : maxE(id));

  const chafe = chafeTracker(Object.keys(builds).map(Number), builds, data);
  const hiyukiId = data.characters.find((c) => c.name === 'Hiyuki')?.id;
  const weaponCd = new Map<string, number>();
  const moves: SimMove[] = [];
  const snapshots: Map<number, MachineState>[] = [];
  const swaps: Record<number, 'intro' | 'quick'> = {};
  let t = 0;
  let onField: number | undefined;
  const byChar: Record<number, number> = {};

  const perform = (step: number, char: number, pressed: Move, via: SimMove['via'], seconds: number, warn: string[] = []) => {
    const b = builds[char];
    // the Echo button hits with the build's main echo
    const echo = b && pressed.timing === 'echo' && !pressed.rows.length ? echoSkill(b, data) : undefined;
    const move: Move = echo ? { ...pressed, rows: [{ skillKind: 'Echo', row: ECHO_ROW }], label: `Echo Skill - ${echo.name}` } : pressed;
    const c = characterOf(data, char)!;
    const hits: SimHit[] = [];
    const buffs: string[] = [];
    let always: string[] = [];
    if (b) {
      const r = rulesFor(b);
      const up = new Set([...r].filter(([, x]) => isUp(x.rule, x.owner, char, t)).map(([id]) => id));
      for (const id of up) buffs.push(short(r.get(id)!.effect));
      for (const row of move.rows) hits.push({ row, value: rowDamage(b, row, up, move.levels) });
      if (move.rows.length) always = used(b, move, up);
    } else warn.push(`${c.name} has no build yet`);
    if (move.warn) warn.push(move.warn);
    const res = moveResources(c, move, echo ? [echo] : []);
    let e = ener(char);
    if (res.cost) {
      if (e + 1e-6 < res.cost) warn.push(`Not enough Resonance Energy (${Math.floor(e)} / ${res.cost})`);
      e = Math.max(0, e - res.cost);
    }
    e = Math.min(maxE(char) || Infinity, e + res.energy * (b ? er(b) : 1));
    energy.set(char, e);
    // weapon passives that restore Concerto on an action (Variation: Resonance Skill +16 at R5)
    let fromWeapon = 0;
    if (b && move.kind !== 'Outro') {
      weaponConcerto(b.weapon, data).forEach((w, k) => {
        const key = `${char}|${k}`;
        if (!move.events.includes(w.on) || t - (weaponCd.get(key) ?? -Infinity) < w.cooldown) return;
        weaponCd.set(key, t);
        fromWeapon += w.amount;
      });
    }
    concerto.set(char, move.kind === 'Outro' ? 0 : Math.min(100, conc(char) + res.concerto + fromWeapon));
    const own = hits.reduce((s, h) => s + h.value, 0);
    byChar[char] = (byChar[char] ?? 0) + own;
    // Glacio Chafe on the target; Hiyuki's extra Glacio Bite counts as her damage
    const ch = chafe({ t, char, onField: char, move, events });
    if (ch?.bite) {
      hits.push({ row: { skillKind: 'Forte', row: BITE_ROW }, value: ch.bite });
      if (hiyukiId !== undefined) byChar[hiyukiId] = (byChar[hiyukiId] ?? 0) + ch.bite;
    }
    const damage = own + (ch?.bite ?? 0);
    moves.push({ step, char, move, via, t, seconds, damage, hits, buffs: [...new Set(buffs)], always, concerto: conc(char), energy: e, maxEnergy: maxE(char), warn, ...(ch ? { chafe: ch.info } : {}) });
    for (const ev of move.events) if (ev !== 'outro') events.push({ char, event: ev, t, tags: move.tags });
    t += seconds;
  };
  const timeOf = (move: Move, override?: number) =>
    override ?? move.seconds ?? (move.timing === 'liberation' && rotation.freezeLiberation ? FROZEN_LIBERATION_TIME : DEFAULT_TIMES[move.timing]);

  rotation.steps.forEach((s, i) => {
    if (onField !== undefined && onField !== s.char) {
      const out = onField;
      for (const ev of events) if (ev.incoming === out && ev.leftAt === undefined) ev.leftAt = t;
      states.set(out, machine(out).swappedOut(state(out)));
      const full = conc(out) >= 100 - 1e-6;
      const mode = s.swap === 'intro' || s.swap === 'quick' ? s.swap : full ? 'intro' : 'quick';
      swaps[i] = mode;
      if (mode === 'intro') {
        const warn = full ? [] : [`${characterOf(data, out)!.name}'s Concerto isn't full (${Math.floor(conc(out))}/100)`];
        const o = machine(out).press(state(out), 'outro');
        states.set(out, o.state);
        events.push({ char: out, event: 'outro', t, incoming: s.char, tags: o.move.tags });
        perform(i, out, o.move, 'swap', 0, warn);
        const intro = machine(s.char).press(state(s.char), 'intro');
        states.set(s.char, intro.state);
        perform(i, s.char, intro.move, 'swap', timeOf(intro.move));
      }
    }
    onField = s.char;
    const { move, state: next } = machine(s.char).press(state(s.char), s.button, s.option);
    states.set(s.char, next);
    perform(i, s.char, move, 'press', timeOf(move, s.seconds));
    snapshots.push(new Map(states));
  });

  // buff lanes: when each timed buff was up (one per buff; the same buff seen from several builds shares it)
  const lanes = new Map<string, BuffLane>();
  for (const [char, m] of rules) {
    for (const { rule, owner, effect } of m.values()) {
      const key = `${owner}|${short(effect)}`;
      const lane = lanes.get(key) ?? { key, owner, label: short(effect), rule, intervals: [] };
      for (const ev of events) {
        if (ev.char !== owner || !rule.on.includes(ev.event)) continue;
        if (rule.incomingOnly && ev.incoming !== char) continue;
        if (rule.needs && (ev.tags?.[rule.needs.tag] ?? 0) < rule.needs.min) continue;
        const end = Math.min(ev.t + rule.seconds, rule.incomingOnly && ev.leftAt !== undefined ? ev.leftAt : Infinity, Math.max(t, ev.t));
        if (end > ev.t) lane.intervals.push([ev.t, end]);
      }
      lanes.set(key, lane);
    }
  }
  for (const l of lanes.values()) l.intervals = merge(l.intervals);

  const total = moves.reduce((s, m) => s + m.damage, 0);
  return { moves, total, time: t, dps: t > 0 ? total / t : 0, byChar, lanes: [...lanes.values()].filter((l) => l.intervals.length), states: snapshots, swaps };
}

function merge(list: [number, number][]): [number, number][] {
  const s = [...list].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
