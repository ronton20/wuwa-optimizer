import type { Element, GameData, SkillKind, StatKey, StatValue } from '../data/types';
import type { Build, EchoPiece } from '../engine/types';
import { center, dominantHue, forOcr, iconDistance, stats, type CardImage, type IconSource, type Ocr, type Rect } from './pixels';

/**
 * Reads a WuwaBot build card (the 1920×1080 image the official Discord bot posts).
 * Text is OCR'd, then snapped to known names and roll values; echoes are recognised by their picture,
 * since the card never names them. Everything that couldn't be read with confidence becomes a warning.
 */

// ------------------------------------------------------------------ card layout (1920×1080)

const L = {
  header: { x: 66, y: 18, w: 660, h: 70 } as Rect,
  elementIcon: { x: 18, y: 28, w: 46, h: 46 } as Rect,
  /** sequence stars, centre squares */
  stars: [188, 264, 344, 422, 504, 582].map((cx) => ({ x: cx - 8, y: 567, w: 16, h: 16 })) as Rect[],
  /** order on the card: top, left, right, bottom-left, bottom-right */
  skills: [
    { kind: 'Normal', r: { x: 1050, y: 182, w: 120, h: 34 } },
    { kind: 'Skill', r: { x: 822, y: 338, w: 120, h: 34 } },
    { kind: 'Liberation', r: { x: 1250, y: 338, w: 120, h: 34 } },
    { kind: 'Intro', r: { x: 904, y: 584, w: 120, h: 34 } },
    { kind: 'Forte', r: { x: 1170, y: 584, w: 120, h: 34 } },
  ] as { kind: SkillKind; r: Rect }[],
  weaponName: { x: 1600, y: 450, w: 290, h: 36 } as Rect,
  /** echo panel i starts at x = 22 + i * 374.25 */
  panelX: (i: number) => Math.round(22 + i * 374.25),
  echo: {
    icon: (x: number): Rect => ({ x, y: 648, w: 188, h: 188 }),
    sonata: (x: number): Rect => ({ x: x + 247, y: 664, w: 46, h: 46 }),
    main: (x: number): Rect => ({ x: x + 190, y: 720, w: 165, h: 70 }),
    fixed: (x: number): Rect => ({ x: x + 16, y: 838, w: 342, h: 36 }),
    subs: (x: number): Rect => ({ x: x + 16, y: 874, w: 342, h: 186 }),
  },
};

// ------------------------------------------------------------------ text helpers

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%.]/g, '');

/** Levenshtein similarity 0..1 */
export function similarity(a: string, b: string) {
  a = norm(a); b = norm(b);
  if (!a.length || !b.length) return 0;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

function best<T>(text: string, items: T[], name: (t: T) => string): { item: T; score: number } | null {
  let top: { item: T; score: number } | null = null;
  for (const item of items) {
    const score = similarity(text, name(item));
    if (!top || score > top.score) top = { item, score };
  }
  return top;
}

/** Stat names as the card writes them. `pct` / `flat` = which StatKey a value with / without % means. */
const CARD_STATS: { label: string; pct?: StatKey; flat?: StatKey }[] = [
  { label: 'Crit. Rate', pct: 'critRate' }, { label: 'Crit. DMG', pct: 'critDmg' },
  { label: 'ATK', pct: 'atkPct', flat: 'atk' }, { label: 'HP', pct: 'hpPct', flat: 'hp' }, { label: 'DEF', pct: 'defPct', flat: 'def' },
  { label: 'Energy Regen', pct: 'energyRegen' }, { label: 'Healing Bonus', pct: 'healing' },
  { label: 'Basic Attack DMG Bonus', pct: 'dmgBasic' }, { label: 'Heavy Attack DMG Bonus', pct: 'dmgHeavy' },
  { label: 'Resonance Skill DMG Bonus', pct: 'dmgSkill' }, { label: 'Resonance Liberation DMG Bonus', pct: 'dmgLib' },
  { label: 'Glacio DMG Bonus', pct: 'dmgGlacio' }, { label: 'Fusion DMG Bonus', pct: 'dmgFusion' }, { label: 'Electro DMG Bonus', pct: 'dmgElectro' },
  { label: 'Aero DMG Bonus', pct: 'dmgAero' }, { label: 'Spectro DMG Bonus', pct: 'dmgSpectro' }, { label: 'Havoc DMG Bonus', pct: 'dmgHavoc' },
];

const VALUE = /(\d{1,4}(?:[.,]\d)?)\s*(%?)\s*[_\-—.,;:'"`|]*\s*$/;

/** "Resonance Liberation 9.4%" (+ continuation "DMG Bonus") -> { stat, value } */
function readStat(name: string, valueText: string): StatValue | null {
  const m = valueText.match(VALUE);
  if (!m) return null;
  const value = Number(m[1].replace(',', '.'));
  const isPct = m[2] === '%' || !Number.isInteger(value);
  const cands = CARD_STATS.filter((s) => (isPct ? s.pct : s.flat));
  const hit = best(name, cands, (s) => s.label);
  if (!hit || hit.score < 0.5) return null;
  return { stat: (isPct ? hit.item.pct : hit.item.flat)!, value };
}

/** Snap an OCR'd substat to the closest real roll value (cards round, OCR misreads a digit now and then). */
function snapRoll(s: StatValue, data: GameData): StatValue {
  const rolls = data.echoStats.subRolls[s.stat];
  if (!rolls) return s;
  const closest = rolls.reduce((a, v) => (Math.abs(v - s.value) < Math.abs(a - s.value) ? v : a), rolls[0]);
  return Math.abs(closest - s.value) <= Math.max(0.15, s.value * 0.02) ? { ...s, value: closest } : s;
}

// ------------------------------------------------------------------ result

export interface CardEcho {
  piece: EchoPiece | null; cost: number | null; confidence: number; alternatives: number[];
  /** picture distance of the pick and of the runner-up (diagnostics) */
  distance?: [number, number];
}
export interface CardResult {
  characterId: number | null;
  characterText: string;
  sequence: number;
  skillLevels: Partial<Record<SkillKind, number>>;
  weaponId: number | null;
  weaponText: string;
  echoes: CardEcho[];
  warnings: string[];
}

const ELEMENT_HUES: [Element, number][] = [['Glacio', 200], ['Fusion', 15], ['Electro', 275], ['Aero', 160], ['Spectro', 50], ['Havoc', 320]];

// ------------------------------------------------------------------ reader

export async function readCard(card: CardImage, data: GameData, ocr: Ocr, icons: IconSource, onStep?: (step: string) => void): Promise<CardResult> {
  const ratio = card.width / card.height;
  if (Math.abs(ratio - 16 / 9) > 0.04) throw new Error('not-a-card');
  const warnings: string[] = [];
  const text = async (r: Rect, kind: 'line' | 'block', scale = 2, cut = 0) => ocr(forOcr(await card.crop(r, r.w * scale, r.h * scale), cut), kind);

  // character: name on the header, element from the icon colour (tells the Rovers apart)
  onStep?.('character');
  const header = (await text(L.header, 'line')).replace(/LV\.?\s*\d+.*$/i, '').trim();
  const hue = dominantHue(await card.crop(L.elementIcon, 24, 24));
  const element = hue == null ? null : ELEMENT_HUES.reduce((a, e) => (Math.abs(((hue - e[1] + 540) % 360) - 180) < Math.abs(((hue - a[1] + 540) % 360) - 180) ? e : a))[0];
  let candidates = data.characters;
  if (/rover/i.test(header) && element) candidates = data.characters.filter((c) => /^Rover/.test(c.name) && c.element === element);
  const ch = [best(header, candidates, (c) => c.name), best(header, candidates, (c) => c.name.replace(/^Rover: \w+$/, 'Rover'))]
    .reduce((a, b) => (!a || (b && b.score > a.score) ? b : a));
  const character = ch && ch.score >= 0.55 ? ch.item : null;
  if (!character) warnings.push(`Couldn't recognise the Resonator ("${header}").`);

  // sequence: lit stars have a bright icon in the middle, locked ones are dark
  onStep?.('sequence');
  // locked ≈ 115, lit ≈ 190 mean brightness at the centre
  const lit = await Promise.all(L.stars.map(async (r) => stats(await card.crop(r, 16, 16)).lum));
  const sequence = lit.filter((v) => v > 150).length;

  // skill levels
  onStep?.('skills');
  const skillLevels: Partial<Record<SkillKind, number>> = {};
  for (const s of L.skills) {
    const m = (await text(s.r, 'line', 3, 0.55)).match(/(\d{1,2})\s*\/\s*1[0O]/);
    const lv = m ? Number(m[1]) : NaN;
    if (lv >= 1 && lv <= 10) skillLevels[s.kind] = lv;
    else warnings.push(`Couldn't read the ${s.kind} level, set to 10.`);
  }

  // weapon
  onStep?.('weapon');
  const weaponText = (await text(L.weaponName, 'line')).trim();
  const wList = character ? data.weapons.filter((w) => w.type === character.weaponType) : data.weapons;
  const wm = best(weaponText, wList, (w) => w.name);
  const weaponId = wm && wm.score >= 0.6 ? wm.item.id : null;
  if (!weaponId) warnings.push(`Couldn't recognise the weapon ("${weaponText}").`);

  // echoes
  const echoes: CardEcho[] = [];
  for (let i = 0; i < 5; i++) {
    onStep?.(`echo ${i + 1}`);
    echoes.push(await readEcho(card, i, data, text, icons, warnings));
  }

  return { characterId: character?.id ?? null, characterText: header, sequence, skillLevels, weaponId, weaponText, echoes, warnings };
}

async function readEcho(card: CardImage, i: number, data: GameData, text: (r: Rect, k: 'line' | 'block', s?: number) => Promise<string>, icons: IconSource, warnings: string[]): Promise<CardEcho> {
  const x = L.panelX(i);
  const slot = `Echo ${i + 1}`;

  // main stat + fixed stat -> cost (each cost has its own main values and fixed stat)
  const mainLines = (await text(L.echo.main(x), 'block')).split('\n').map((l) => l.trim()).filter(Boolean);
  const fixedText = (await text(L.echo.fixed(x), 'line')).trim();
  const fixed = readStat(fixedText.replace(/[\d.,%_\s-]+$/, ''), fixedText);
  const costFromFixed = fixed ? (['4', '3', '1'] as const).find((c) => {
    const f = data.echoStats.fixed[c];
    return f.stat === fixed.stat && Math.abs(f.value - fixed.value) < 1;
  }) : undefined;
  const mainName = mainLines.filter((l) => !VALUE.test(l)).join(' ');
  const mainValueLine = mainLines.find((l) => VALUE.test(l)) ?? '';
  const mainRaw = readStat(mainName, mainValueLine.replace(/^[^\d]*/, ''));
  let cost: number | null = costFromFixed ? Number(costFromFixed) : null;
  let main: StatValue | null = null;
  for (const c of (cost ? [String(cost)] : ['4', '3', '1']) as ('1' | '3' | '4')[]) {
    const m = mainRaw && data.echoStats.main[c].find((x) => x.stat === mainRaw.stat && Math.abs(x.value - mainRaw.value) <= 0.6);
    if (m) { main = m; cost = Number(c); break; }
  }
  if (!cost) { warnings.push(`${slot}: couldn't read its cost.`); return { piece: null, cost: null, confidence: 0, alternatives: [] }; }
  if (!main && cost) {
    // the stat name is enough when the value was misread: each cost has one value per main stat
    const byName = best(mainName, CARD_STATS.filter((x) => x.pct), (x) => x.label);
    const stat = byName && byName.score >= 0.6 ? byName.item.pct : undefined;
    main = (stat && data.echoStats.main[String(cost) as '1' | '3' | '4'].find((x) => x.stat === stat)) || null;
  }
  if (!main) { main = data.echoStats.main[String(cost) as '1' | '3' | '4'][0]; warnings.push(`${slot}: couldn't read the main stat ("${mainLines.join(' ')}"), please check it.`); }

  // substats: a line with a value starts a stat; lines without one continue the previous name ("DMG Bonus")
  const lines = (await text(L.echo.subs(x), 'block')).split('\n').map((l) => l.replace(/^[^A-Za-z]+/, '').trim()).filter(Boolean);
  const subs: StatValue[] = [];
  let pending: { name: string; value: string } | null = null;
  const flush = () => {
    if (!pending) return;
    const s = readStat(pending.name, pending.value);
    if (s && !subs.some((x) => x.stat === s.stat)) subs.push(snapRoll(s, data));
    pending = null;
  };
  for (const line of lines) {
    const m = line.match(VALUE);
    if (m && /\d/.test(m[1])) { flush(); pending = { name: line.slice(0, m.index).trim(), value: m[0] }; }
    else if (pending) pending.name += ' ' + line;
  }
  flush();
  if (subs.length < 5) warnings.push(`${slot}: read ${subs.length} of 5 substats, please check the missing ones.`);

  // which echo: compare the picture against every echo of that cost
  const bg: [number, number, number] = [30, 26, 40];
  const N = 24;
  // a few nearby framings: the card doesn't place every echo picture exactly the same way
  const base = L.echo.icon(x);
  const shots = await Promise.all([[0, 0, 1], [0, 8, 1], [0, -8, 1], [6, 6, 0.92], [-6, 0, 1.08], [0, 12, 0.9]].map(([dx, dy, k]) =>
    card.crop({ x: base.x + dx + (base.w * (1 - k)) / 2, y: base.y + dy + (base.h * (1 - k)) / 2, w: base.w * k, h: base.h * k }, N, N)));
  const scored: { id: number; d: number }[] = [];
  for (const e of data.echoes) {
    if (e.cost !== cost || !e.sets.length) continue;
    // the square head usually matches best, but a few echoes are framed more like the wide picture
    const refs = (await Promise.all([icons(`echoHead:${e.id}`, N, bg), icons(`echo:${e.id}`, N, bg)])).filter((r) => r != null);
    if (!refs.length) continue;
    scored.push({ id: e.id, d: Math.min(...refs.flatMap((ref) => shots.map((s) => iconDistance(s, ref)))) });
  }
  scored.sort((a, b) => a.d - b.d);
  const top = scored[0];
  if (!top) { warnings.push(`${slot}: no echo pictures to compare against.`); return { piece: null, cost, confidence: 0, alternatives: [] }; }
  // the runner-up that is a different echo (skins and duplicate entries share a picture)
  const baseName = (id: number) => data.echoes.find((e) => e.id === id)!.name.replace(/^Phantom:\s*/, '');
  const rival = scored.find((s) => baseName(s.id) !== baseName(top.id));
  const gap = rival ? rival.d - top.d : 1;
  // calibrated on 35 echoes from 7 cards: right picks sit at 0.09–0.24 with the next echo ≥ 0.05 further
  const confidence = Math.max(0, Math.min(1, (0.35 - top.d) / 0.15)) * Math.min(1, gap / 0.06);
  const echo = data.echoes.find((e) => e.id === top.id)!;
  if (confidence < 0.5) warnings.push(`${slot}: not sure which echo this is (picked ${echo.name}), please check it.`);

  // set: if the echo can drop in several sets, compare the round set icon
  let setId = echo.sets[0];
  if (echo.sets.length > 1) {
    // every set icon has the same coloured ring: compare only the symbol inside it
    const ring = center(await card.crop(L.echo.sonata(x), 32, 32), 0.6);
    let bestSet = { id: setId, d: Infinity };
    for (const id of echo.sets) {
      const ref = await icons(`sonata:${id}`, 32, bg);
      if (!ref) continue;
      const d = iconDistance(ring, center(ref, 0.6));
      if (d < bestSet.d) bestSet = { id, d };
    }
    setId = bestSet.id;
    if (!Number.isFinite(bestSet.d)) warnings.push(`${slot}: ${echo.name} has several sets; picked ${data.sonatas.find((s) => s.id === setId)?.name}, please check it.`);
  }

  return { piece: { echoId: echo.id, setId, main, subs: subs.slice(0, 5) }, cost, confidence, alternatives: scored.slice(1, 6).map((s) => s.id), distance: [top.d, rival?.d ?? 1] };
}

/** Turn a card result into a build, on top of what the character already has (rank, team, conditions…). */
export function cardToBuild(r: CardResult, base: Build): Build {
  const sameWeapon = r.weaponId != null && r.weaponId === base.weapon.id;
  return {
    ...base,
    characterId: r.characterId ?? base.characterId,
    sequence: r.sequence,
    skillLevels: { ...base.skillLevels, ...r.skillLevels },
    weapon: r.weaponId != null ? { id: r.weaponId, rank: sameWeapon ? base.weapon.rank : 1 } : base.weapon,
    echoes: r.echoes.map((e) => e.piece),
  };
}
