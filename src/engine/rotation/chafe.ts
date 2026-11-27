import type { GameData } from '../../data/types';
import { DEFAULT_ENEMY, defMultiplier, resMultiplier } from '../enemy';
import { modeChoice } from '../effects';
import type { Build } from '../types';
import { CHAFE_ROWS, type Move } from './actions';

/**
 * Glacio Chafe on the target, and Hiyuki's Glacio Bite.
 *
 * Tracked: stacks each move inflicts (kit texts), the stack limit (10, +3 in Suisui's Ceaseless Landscape),
 * Frostbind (Inward Vision / Iai at 10+ consume 10), Hiyuki's Snow Rust (one per Resonator that inflicts Glacio
 * Chafe, +1 at S3, max 3) and Lucilla's Film Roll (4 after Clear As Day in Glacio Chafe mode: when another
 * Resonator inflicts, Lucilla adds 2).
 *
 * Damage, an estimate: Snow Rust 2+ makes each Glacio Chafe Hiyuki inflicts while on the field (anyone's, at S6)
 * deal an extra Glacio Bite hit with a fixed multiplier (102%, 590% at S3; the 102 is in the game's buff data).
 * Negative Status damage uses the community-measured base (level multiplier 3674 at Lv. 90 × 1.25078), the
 * target's DEF and RES, and only Glacio Chafe / Bite amplifications (no ATK, Crit or DMG Bonus).
 * Glacio Bite's own hit per new stack isn't counted: its per-stack values aren't published.
 */

/** Negative Status base at Lv. 90 (community-measured; the game computes it in code). */
export const NEGATIVE_STATUS_BASE = 3674 * 1.25078;
export const BITE_ROW = 'Glacio Bite (Snow Rust)';

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

interface Ctx { t: number; char: number; onField: number; move: Move; events: { char: number; event: string; t: number }[] }

export function chafeTracker(team: number[], builds: Record<number, Build | undefined>, data: GameData) {
  const name = (id: number) => data.characters.find((c) => c.id === id)?.name ?? '';
  const hiyuki = team.find((id) => name(id) === 'Hiyuki');
  const lucilla = team.find((id) => name(id) === 'Lucilla');
  const suisui = team.find((id) => name(id) === 'Suisui');
  const hb = hiyuki !== undefined ? builds[hiyuki] : undefined;
  const hSeq = hb?.sequence ?? 0;
  const lb = lucilla !== undefined ? builds[lucilla] : undefined;
  const lucillaChafeMode = !!lb && modeChoice('c.luc.mode', lb.conditions) === 0;

  let stacks = 0;
  let film = { left: 0, until: -1 };
  const rusted = new Set<number>();
  const snowRust = () => (hiyuki === undefined ? 0 : Math.min(3, rusted.size + (hSeq >= 3 ? 1 : 0)));
  const last = (evs: Ctx['events'], char: number | undefined, ev: string, t: number) => {
    if (char === undefined) return -Infinity;
    for (let i = evs.length - 1; i >= 0; i--) if (evs[i].char === char && evs[i].event === ev && evs[i].t <= t) return evs[i].t;
    return -Infinity;
  };

  return (x: Ctx): { info: ChafeInfo; bite: number } | undefined => {
    const { move, char, t } = x;
    const table = CHAFE_ROWS[name(char)] ?? {};
    let sources = move.rows.filter((r) => table[r.row]).length + (move.chafe ? 1 : 0);
    let inflicted = move.rows.reduce((s, r) => s + (table[r.row] ?? 0), 0) + (move.chafe ?? 0);
    // Lucilla in Glacio Chafe mode: Spotlight +1, each Oblivion 1
    if (char === lucilla && lucillaChafeMode && move.tags?.chafeMode) { inflicted += move.tags.chafeMode; sources += 1; }
    if (char === lucilla && lucillaChafeMode && move.tags?.filmRoll) film = { left: move.tags.filmRoll, until: t + 30 };
    if (char !== lucilla && inflicted > 0 && film.left > 0 && t <= film.until) { inflicted += 2; sources += 1; film.left -= 1; }
    const fb = !!move.frostbind;
    if (!inflicted && !fb) return undefined;

    if (inflicted && hiyuki !== undefined) rusted.add(char);
    const landscape = t - last(x.events, suisui, 'liberation', t) < 30;
    const limit = 10 + (landscape ? 3 : 0);
    stacks = Math.min(limit, stacks + inflicted);
    const frostbind = fb && hiyuki !== undefined && stacks >= 10;
    if (frostbind) stacks -= 10;

    // Snow Rust 2+: extra Glacio Bite per Glacio Chafe inflicted while Hiyuki is on the field (hers; anyone's at S6)
    const sr = snowRust();
    let bite = 0, bites = 0;
    if (hb && inflicted && sr >= 2 && x.onField === hiyuki && (char === hiyuki || hSeq >= 6)) {
      bites = sources;
      const amp = (sr >= 1 ? 30 : 0) + (sr >= 3 ? 30 : 0) + (hSeq >= 6 && sr >= 3 ? 25 : 0)
        + (lucillaChafeMode && t - last(x.events, lucilla, 'outro', t) < 30 ? 60 : 0)
        + (lucillaChafeMode && (lb?.sequence ?? 0) >= 2 && t - last(x.events, lucilla, 'liberation', t) < 34 ? 80 : 0);
      const enemy = hb.enemy ?? DEFAULT_ENEMY;
      const mult = (102 + (hSeq >= 3 ? 488 : 0)) / 100;
      bite = bites * NEGATIVE_STATUS_BASE * mult * (1 + amp / 100) * defMultiplier(enemy.level, 0) * resMultiplier(enemy.res.Glacio);
    }
    return { info: { inflicted, stacks, limit, frostbind, snowRust: sr, bites }, bite };
  };
}
