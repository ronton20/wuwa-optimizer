import type { GameData, NegativeStatus } from '../../data/types';
import { modeChoice } from '../effects';
import type { Build } from '../types';
import { STATUS_ROWS, type Move } from './actions';

/**
 * Negative Statuses on the target, and their damage (numbers: data.negativeStatus, from the game's buff data;
 * behaviour: the game's own explanations):
 * - Glacio Chafe: a hit each time it's inflicted (at the stacks it now has); at its limit the target freezes and the
 *   stacks clear. With Hiyuki in the team it's Glacio Bite instead: a hit per new stack at the multiplier of the
 *   target's stack LIMIT; no freeze; Inward Vision / Iai at 10+ consume 10 (Frostbind).
 * - Aero Erosion: a hit when first inflicted, then every 3s at its stacks while it lasts (14.8s from the last stack).
 * - Spectro Frazzle: a hit every 3s at its stacks, losing 1 stack per hit.
 * - Electro Flare: a hit every 5s at its stacks, losing half the stacks per hit. Stacks inflicted at the limit become
 *   Electro Rage, which raises the next hit (estimate: adds the multiplier of the Rage stacks).
 * - Fusion Burst: explodes when it reaches its limit (multiplier at the limit), clearing the stacks.
 * - Havoc Bane: no damage (−2% DEF per stack, not applied to hits yet).
 * The limit: default, +3 inside Suisui's Ceaseless Landscape (30s after her Liberation).
 * shortcut: other limit raises (Chisa's Outro, Cartethyia S2) aren't tracked here; add them when those kits are timed.
 *
 * Hiyuki's Snow Rust (one per Resonator that inflicts Glacio Chafe, +1 at S3, max 3) and her 2+ Snow Rust extra Glacio
 * Bite (fixed 102%, +488% at S3, while she's on the field; anyone's Glacio Chafe at S6), Lucilla's Film Roll, and the
 * Glacio Chafe / Bite Amplify from Snow Rust, S6 and Lucilla's Outro / S2 are tracked here too.
 */

export interface ChafeInfo {
  /** stacks inflicted by this move (Film Roll included) */
  inflicted: number;
  /** stacks on the target after the move */
  stacks: number;
  limit: number;
  frostbind: boolean;
  snowRust: number;
  /** extra Glacio Bite hits (Snow Rust 2+) */
  bites: number;
}

/** One Negative Status hit: who it counts for, and its multiplier (%) and extra Amplify before buffs. */
export interface StatusHit {
  status: NegativeStatus; by: number; pct: number; amplify: number;
  /** Hiyuki's extra Glacio Bite from Snow Rust (fixed multiplier) */
  snowRust?: true;
}

interface Ctx { t: number; char: number; onField: number; move: Move; events: { char: number; event: string; t: number }[] }
interface OnTarget { stacks: number; until: number; next: number; by: number; rage: number }

export const SNOW_RUST_BITE = 'Glacio Bite (Snow Rust)';

export function statusTracker(team: number[], builds: Record<number, Build | undefined>, data: GameData) {
  const S = data.negativeStatus.statuses;
  const name = (id: number) => data.characters.find((c) => c.id === id)?.name ?? '';
  const hiyuki = team.find((id) => name(id) === 'Hiyuki');
  const lucilla = team.find((id) => name(id) === 'Lucilla');
  const suisui = team.find((id) => name(id) === 'Suisui');
  const hSeq = (hiyuki !== undefined ? builds[hiyuki]?.sequence : 0) ?? 0;
  const lb = lucilla !== undefined ? builds[lucilla] : undefined;
  const lucillaChafeMode = !!lb && modeChoice('c.luc.mode', lb.conditions) === 0;

  const on = new Map<NegativeStatus, OnTarget>();
  const get = (s: NegativeStatus) => on.get(s) ?? { stacks: 0, until: -Infinity, next: Infinity, by: -1, rage: 0 };
  let film = { left: 0, until: -1 };
  const rusted = new Set<number>();
  const snowRust = () => (hiyuki === undefined ? 0 : Math.min(3, rusted.size + (hSeq >= 3 ? 1 : 0)));
  let events: Ctx['events'] = [];
  const last = (char: number | undefined, ev: string, t: number) => {
    if (char === undefined) return -Infinity;
    for (let i = events.length - 1; i >= 0; i--) if (events[i].char === char && events[i].event === ev && events[i].t <= t) return events[i].t;
    return -Infinity;
  };
  const limitOf = (s: NegativeStatus, t: number) => S[s].maxStacks + (t - last(suisui, 'liberation', t) < 30 ? 3 : 0);
  const pctAt = (s: NegativeStatus, n: number) => S[s].dmg[Math.max(0, Math.min(n, S[s].dmg.length) - 1)] ?? 0;
  // Glacio Chafe / Bite Amplify from Snow Rust, Hiyuki S6 and Lucilla (Glacio Chafe mode) Outro / S2
  const glacioAmp = (t: number) => {
    const sr = snowRust();
    return (sr >= 1 ? 30 : 0) + (sr >= 3 ? 30 : 0) + (hSeq >= 6 && sr >= 3 ? 25 : 0)
      + (lucillaChafeMode && t - last(lucilla, 'outro', t) < 30 ? 60 : 0)
      + (lucillaChafeMode && (lb?.sequence ?? 0) >= 2 && t - last(lucilla, 'liberation', t) < 34 ? 80 : 0);
  };
  const ampOf = (s: NegativeStatus, t: number) => (s === 'Glacio Chafe' || s === 'Glacio Bite' ? glacioAmp(t) : 0);

  /** Periodic hits due up to time t (each at its own tick time). */
  const advance = (t: number): StatusHit[] => {
    const out: StatusHit[] = [];
    for (const [s, x] of on) {
      const d = S[s];
      if (!d.period) { if (t > x.until) on.delete(s); continue; }
      while (x.stacks > 0 && x.next <= t) {
        if (s !== 'Spectro Frazzle' && x.next > x.until) { x.stacks = 0; break; }
        const rage = s === 'Electro Flare' && x.rage ? pctAt(s, x.rage) : 0;
        out.push({ status: s, by: x.by, pct: pctAt(s, x.stacks) + rage, amplify: ampOf(s, x.next) });
        x.rage = 0;
        if (s === 'Spectro Frazzle') x.stacks -= 1;
        if (s === 'Electro Flare') x.stacks = Math.floor(x.stacks / 2);
        x.next += d.period;
      }
      if (x.stacks <= 0) on.delete(s);
    }
    return out;
  };

  /** Inflict `n` stacks at time t; returns the hits that land right away. */
  const inflict = (s: NegativeStatus, n: number, by: number, t: number): StatusHit[] => {
    const d = S[s];
    const x = get(s);
    const limit = limitOf(s, t);
    const fresh = x.stacks === 0;
    const out: StatusHit[] = [];
    const before = x.stacks;
    if (s === 'Electro Flare' && before + n > limit) x.rage += before + n - limit;
    x.stacks = Math.min(limit, before + n);
    x.by = by;
    if (s !== 'Spectro Frazzle' || fresh) x.until = t + d.duration;
    if (fresh && d.period) x.next = d.tickOnApply ? t : t + d.period;
    on.set(s, x);
    if (s === 'Glacio Chafe') {
      out.push({ status: s, by, pct: pctAt(s, x.stacks), amplify: ampOf(s, t) });
      if (x.stacks >= limit) on.delete(s); // frozen: all stacks removed
    } else if (s === 'Glacio Bite') {
      for (let k = before; k < x.stacks; k++) out.push({ status: s, by, pct: pctAt(s, limit), amplify: ampOf(s, t) });
    } else if (s === 'Fusion Burst' && x.stacks >= limit) {
      out.push({ status: s, by, pct: pctAt(s, limit), amplify: 0 });
      on.delete(s);
    } else if (d.period && d.tickOnApply && fresh) {
      out.push(...advance(t));
    }
    return out;
  };

  const step = (ctx: Ctx): { hits: StatusHit[]; info?: ChafeInfo } => {
    events = ctx.events;
    const { move, char, t } = ctx;
    const hits = advance(t);
    const table = STATUS_ROWS[name(char)] ?? {};
    const glacio = hiyuki !== undefined ? 'Glacio Bite' : 'Glacio Chafe';
    // each inflicting row is one application
    const apps: { s: NegativeStatus; n: number; by: number }[] = [];
    const b = builds[char];
    for (const r of move.rows) {
      const i = table[`${r.skillKind}|${r.row}`] ?? table[r.row];
      if (!i || (i.mode && (!b || modeChoice(i.mode[0], b.conditions) !== i.mode[1]))) continue;
      const n = (i.fromSeq && (b?.sequence ?? 0) >= i.fromSeq[0] ? i.fromSeq[1] : i.stacks) * (r.times ?? 1);
      if (n > 0) apps.push({ s: i.status === 'Glacio Chafe' ? glacio : i.status, n, by: char });
    }
    if (move.chafe) apps.push({ s: glacio, n: move.chafe, by: char });
    // Lucilla in Glacio Chafe mode: Spotlight +1, each Oblivion 1; Film Roll: +2 when another Resonator inflicts
    if (char === lucilla && lucillaChafeMode && move.tags?.chafeMode) apps.push({ s: glacio, n: move.tags.chafeMode, by: char });
    if (char === lucilla && lucillaChafeMode && move.tags?.filmRoll) film = { left: move.tags.filmRoll, until: t + 30 };
    const chafeApps = () => apps.filter((a) => a.s === glacio);
    if (char !== lucilla && lucilla !== undefined && chafeApps().length && film.left > 0 && t <= film.until) { apps.push({ s: glacio, n: 2, by: lucilla }); film.left -= 1; }

    const inflicted = chafeApps().reduce((a, x) => a + x.n, 0);
    if (inflicted && hiyuki !== undefined) rusted.add(char);
    for (const a of apps) hits.push(...inflict(a.s, a.n, a.by, t));

    if (!inflicted && !move.frostbind) return { hits };
    const g = get(glacio);
    const frostbind = !!move.frostbind && hiyuki !== undefined && g.stacks >= 10;
    if (frostbind) { g.stacks -= 10; if (!g.stacks) on.delete(glacio); }

    // Snow Rust 2+: an extra Glacio Bite per Glacio Chafe application while Hiyuki is on the field (hers; anyone's at S6)
    const sr = snowRust();
    let bites = 0;
    if (hiyuki !== undefined && builds[hiyuki] && inflicted && sr >= 2 && ctx.onField === hiyuki && (char === hiyuki || hSeq >= 6)) {
      bites = chafeApps().length;
      const pct = 102 + (hSeq >= 3 ? 488 : 0);
      for (let k = 0; k < bites; k++) hits.push({ status: 'Glacio Bite', by: hiyuki, pct, amplify: glacioAmp(t), snowRust: true });
    }
    return { hits, info: { inflicted, stacks: get(glacio).stacks, limit: limitOf(glacio, t), frostbind, snowRust: sr, bites } };
  };

  return { step, advance };
}
