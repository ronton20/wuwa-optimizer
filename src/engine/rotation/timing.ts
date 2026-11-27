import type { Character, GameData } from '../../data/types';
import type { Effect } from '../types';
import type { GameEvent, TimingKind } from './actions';

/**
 * Default action times in seconds, by kind of action. Placeholders until clip / recording timings land;
 * every rotation step can override its own time.
 */
export const DEFAULT_TIMES: Record<TimingKind, number> = {
  basic: 0.6, heavy: 1.2, skill: 1.0, liberation: 2.0, echo: 0.8, intro: 1.2, outro: 0, forte: 1.0, dodge: 0.5, air: 0.9,
};

/** Tower of Adversity stops the clock during Resonance Liberation animations; this is what's left. */
export const FROZEN_LIBERATION_TIME = 0.3;

export interface TimedRule {
  /** events that start (or refresh) the buff ("After Intro or Liberation": either) */
  on: GameEvent[];
  /** whose event: the effect's owner (the build's Resonator, or the teammate it comes from) */
  seconds: number;
  /** Outro buffs that only reach the Resonator switched in, and end when they leave */
  incomingOnly?: boolean;
  /** only when the starting event carried at least this much of a tag (Suisui's 400+ / 600 Floral Epistle Outro) */
  needs?: { tag: string; min: number };
}

const plain = (s: string) => s.replace(/\[\/?c[^\]]*\]/g, '').replace(/\s+/g, ' ');
const secondsIn = (s: string) => { const m = plain(s).match(/\bfor (\d+(?:\.\d+)?)s\b/); return m ? Number(m[1]) : undefined; };

/** Which events in a condition's own words start it ("After Intro or Liberation" → intro, liberation). */
function eventsOf(label: string): GameEvent[] {
  const found: [number, GameEvent][] = [];
  const add = (re: RegExp, ev: GameEvent) => { const m = label.match(re); if (m?.index !== undefined) found.push([m.index, ev]); };
  add(/\bOutro\b/i, 'outro'); add(/\bIntro\b/i, 'intro'); add(/\bLiberation\b/i, 'liberation'); add(/Resonance Skill|(?<!Intro |Echo |Outro )\bSkill\b/, 'skill');
  add(/Echo Skill/i, 'echo'); add(/Heavy Attack|\bHeavy\b/, 'heavy'); add(/Basic Attack|\bBasic\b/, 'basic');
  return [...new Set(found.sort((x, y) => x[0] - y[0]).map(([, e]) => e))];
}

/**
 * How long a buff lasts, if the engine can tell. Outro buffs from teammates: from the Outro skill's own text
 * ("for 20s", default 14s). Other toggles starting with a plain action ("After casting Resonance Liberation")
 * that also say how long they last. Anything else stays a toggle.
 */
/** The game text an effect comes from: its weapon passive, sonata piece or main echo skill. */
function sourceText(e: Effect, data?: GameData): string {
  if (!data) return '';
  const src = e.source.replace(/^Teammate \d \([^)]+\) · /, '');
  const w = src.match(/^(.*) R(\d)$/);
  if (w) return data.weapons.find((x) => x.name === w[1])?.passive?.descriptions?.[Number(w[2]) - 1] ?? '';
  const set = src.match(/^(.*) (\d)pc$/);
  if (set) return data.sonatas.find((x) => x.name === set[1])?.effects.find((p) => p.pieces === Number(set[2]))?.description ?? '';
  const echo = src.match(/^Main echo · (.*)$/);
  if (echo) return data.echoes.find((x) => x.name === echo[1])?.skill?.description ?? '';
  return '';
}

const PHRASE: Record<GameEvent, RegExp> = {
  liberation: /Resonance Liberation/i, skill: /Resonance Skill/i, intro: /Intro Skill/i, outro: /Outro Skill/i,
  echo: /Echo Skill/i, heavy: /Heavy Attack/i, basic: /Basic Attack|Normal Attack/i, forte: /Forte/i,
};

/** Seconds from the sentence of a text that talks about the event ("…after casting Resonance Liberation … for 15s"). */
function secondsFor(text: string, on: GameEvent[]) {
  const sentences = plain(text).split(/(?<=\.)\s/).filter((x) => secondsIn(x) !== undefined);
  const hit = sentences.find((x) => on.some((ev) => PHRASE[ev].test(x))) ?? (sentences.length === 1 ? sentences[0] : undefined);
  return hit ? secondsIn(hit) : undefined;
}

export function timedRule(e: Effect, owner: Character | undefined, data?: GameData): TimedRule | undefined {
  if (!e.condition || e.condition.kind !== 'toggle') return undefined;
  const fromTeammate = /^t\d\./.test(e.id);
  const outroText = owner?.skills.find((s) => s.kind === 'Outro')?.description ?? '';
  if (fromTeammate && (/\bOutro\b/.test(e.source) || /\bOutro\b/i.test(e.condition.label))) {
    // Most Outro buffs (supports especially) run their full time whoever is on the field; ones for "the incoming
    // Resonator" end when that Resonator leaves. The duration comes from the sentence about that buff.
    const text = plain(outroText);
    const incomingOnly = /incoming Resonator/i.test(e.text) || /incoming Resonator/i.test(e.condition.label);
    const sentence = incomingOnly ? text.split(/(?<=\.)\s/).find((x) => /incoming Resonator/i.test(x) && secondsIn(x)) : undefined;
    const need = `${e.condition.label} ${e.text}`.match(/(\d+)\+? Floral Epistle/);
    return { on: ['outro'], seconds: secondsIn(e.text) ?? secondsIn(sentence ?? text) ?? 14, incomingOnly, ...(need ? { needs: { tag: 'Floral Epistle', min: Number(need[1]) } } : {}) };
  }
  const on = eventsOf(e.condition.label);
  // a sequence buff's duration is in the sequence's own text ("for 30s")
  const sq = e.source.replace(/^Teammate \d \([^)]+\) · /, '').match(/^S(\d) ·/);
  if (!on.length) return undefined;
  // the duration: the effect's own text, its sequence's text, or its weapon / sonata / echo text
  const seconds = secondsIn(e.text) ?? (sq ? secondsIn(owner?.sequences?.[Number(sq[1]) - 1]?.description ?? '') : undefined) ?? secondsFor(sourceText(e, data), on);
  if (on && seconds) return { on, seconds };
  return undefined;
}

export function characterOf(data: GameData, id: number) { return data.characters.find((c) => c.id === id); }

/**
 * Concerto a weapon's passive restores on an action ("When Resonance Skill is cast, restores 16 Concerto Energy",
 * "Casting Resonance Liberation restores 8 points of Concerto Energy, triggered once every 20s").
 */
export function weaponConcerto(weapon: { id: number; rank: number } | undefined, data: GameData): { on: GameEvent; amount: number; cooldown: number }[] {
  const w = weapon && data.weapons.find((x) => x.id === weapon.id);
  const text = plain(w?.passive?.descriptions?.[weapon!.rank - 1] ?? '');
  const out: { on: GameEvent; amount: number; cooldown: number }[] = [];
  for (const sentence of text.split(/(?<=\.)\s/)) {
    const amount = sentence.match(/restores? (\d+) (?:points of )?Concerto Energy/i)?.[1];
    if (!amount) continue;
    const on: GameEvent | undefined = /Resonance Liberation/i.test(sentence) ? 'liberation' : /Resonance Skill/i.test(sentence) ? 'skill' : /Intro Skill/i.test(sentence) ? 'intro' : undefined;
    if (!on) continue;
    out.push({ on, amount: Number(amount), cooldown: Number(sentence.match(/once every (\d+(?:\.\d+)?)s/)?.[1] ?? 0) });
  }
  return out;
}
