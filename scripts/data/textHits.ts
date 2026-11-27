/**
 * Hits the kit text gives as a number but the game data has no Skill Detail row for ("Deal 1 additional strike …,
 * dealing Glacio DMG equal to 1032.18% of Carlotta's ATK", Outro Skills, sequence summons). Each becomes a row
 * marked `fromText` (and `seq` when a sequence unlocks it), so damage, rotations and the optimizer see them.
 */
import type { Character, DmgType, Element, Scaling, SkillKind, SkillRow } from '../../src/data/types.ts';

const plain = (s: string) => s.replace(/\[\/?c[^\]]*\]/g, '').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ');
const sentences = (s: string) => plain(s).split(/(?<=[.!?])\s+(?=[A-Z-])|\n+/).map((x) => x.trim()).filter(Boolean);

const HIT = /(?:\b(\d+|two|three|four|five) (?:additional )?instances? of )?\b(Glacio|Fusion|Electro|Aero|Spectro|Havoc|Physical) DMG,? (?:with each instance )?(?:equal to|of) (\d+(?:\.\d+)?)% of (?:[\w:' ]+?'s |his |her |their )?(Max HP|HP|ATK|DEF)\b/;
const CONSIDERED = /considered (?:as )?(Basic Attack|Heavy Attack|Resonance Skill|Resonance Liberation|Echo Skill|Intro Skill|Outro Skill) DMG/;
const TYPE: Record<string, DmgType> = {
  'Basic Attack': 'Basic', 'Heavy Attack': 'Heavy', 'Resonance Skill': 'Skill', 'Resonance Liberation': 'Liberation',
  'Echo Skill': 'Echo', 'Intro Skill': 'Intro', 'Outro Skill': 'Outro',
};
const HOME: Record<DmgType, SkillKind> = { Basic: 'Normal', Heavy: 'Normal', Skill: 'Skill', Liberation: 'Liberation', Intro: 'Intro', Outro: 'Outro', Echo: 'Forte', Other: 'Forte' };
const WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };
const SCALING: Record<string, Scaling> = { ATK: 'atk', HP: 'hp', 'Max HP': 'hp', DEF: 'def' };

/** Hits in one text. `kind`: the skill the text belongs to (undefined for a sequence). */
export function hitsInText(text: string, kind?: SkillKind) {
  const out: { pct: number; count: number; element: Element; scaling: Scaling; dmgType: DmgType }[] = [];
  for (const s of sentences(text)) {
    const m = s.match(HIT);
    if (!m) continue;
    // "every 2s for 6s" = 3 hits
    const dot = s.match(/every (\d+(?:\.\d+)?)s for (\d+(?:\.\d+)?)s/);
    const count = m[1] ? WORDS[m[1]] ?? Number(m[1]) : dot ? Math.floor(Number(dot[2]) / Number(dot[1])) : 1;
    const considered = s.match(CONSIDERED)?.[1];
    const dmgType: DmgType = considered ? TYPE[considered] : kind === 'Outro' || /\bOutro Skill\b/.test(s) ? 'Outro' : 'Other';
    out.push({ pct: Number(m[3]), count, element: m[2] as Element, scaling: SCALING[m[4]], dmgType });
  }
  return out;
}

/** Adds the text-only hits to a Resonator's skills (in place). Returns the labels added. */
export function addTextHits(c: Character): string[] {
  const known = new Set(c.skills.flatMap((s) => s.rows.flatMap((r) => (r.hits ?? []).map((h) => h.pct.at(-1)))));
  const added: string[] = [];
  const sources: { text: string; name: string; kind?: SkillKind; seq?: number }[] = [
    ...c.skills.map((s) => ({ text: s.description, name: s.name, kind: s.kind })),
    ...c.sequences.map((q, i) => ({ text: q.description, name: `S${i + 1} · ${q.name.replace(/\s+/g, ' ').trim()}`, seq: i + 1 })),
  ];
  for (const src of sources) {
    // a hit the data already has as a row (same multiplier) is skipped
    const fresh = hitsInText(src.text, src.kind).filter((h) => !known.has(h.pct) && known.add(h.pct));
    fresh.forEach((h, i, all) => {
      const home = (src.kind && src.kind !== 'Inherent' ? c.skills.find((s) => s.kind === src.kind) : undefined) ?? c.skills.find((s) => s.kind === HOME[h.dmgType]) ?? c.skills.find((s) => s.kind === 'Forte');
      if (!home) return;
      const label = `${src.name}${all.length > 1 ? ` (${i + 1})` : ''} DMG`;
      const value = `${h.pct}%${h.count > 1 ? `*${h.count}` : ''}`;
      const row: SkillRow = {
        label, values: Array(10).fill(value), fromText: true, ...(src.seq ? { seq: src.seq } : {}),
        hits: [{ pct: Array(10).fill(h.pct), count: h.count, element: h.element, scaling: h.scaling, dmgType: h.dmgType, damageIds: [] }],
      };
      home.rows.push(row);
      added.push(`${c.name}: ${label} = ${value} ${h.scaling.toUpperCase()} ${h.element} ${h.dmgType} → ${home.kind}`);
    });
  }
  return added;
}
