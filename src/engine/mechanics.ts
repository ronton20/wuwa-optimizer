import type { Character, GameData } from '../data/types';
import type { Build, Effect } from './types';

/**
 * Things a buff's condition can depend on. A conditional buff ("Inflicting Havoc Bane: ATK +20%") is only
 * worth counting if someone in the team can actually trigger it.
 */
export const MECHANICS = [
  'Glacio Chafe', 'Havoc Bane', 'Aero Erosion', 'Spectro Frazzle', 'Fusion Burst', 'Electro Flare',
  'Tune Strain - Shifting', 'Tune Rupture - Shifting', 'Hack - Shifting', 'Unison', 'Shield', 'Healing',
] as const;
export type Mechanic = (typeof MECHANICS)[number];

const NEGATIVE: Mechanic[] = ['Glacio Chafe', 'Havoc Bane', 'Aero Erosion', 'Spectro Frazzle', 'Fusion Burst', 'Electro Flare'];

/** Which mechanics an effect's condition needs (none = always available). */
export function mechanicsOf(e: Effect): Mechanic[] {
  const label = `${e.condition?.label ?? ''}`;
  if (!label) return [];
  if (/Negative Status/i.test(label)) return NEGATIVE;
  const out = MECHANICS.filter((m) => {
    if (m === 'Unison') return /\bUnison\b(?! Boon)/.test(label);
    if (m === 'Shield') return /\bShield/.test(label);
    if (m === 'Healing') return /\bheal/i.test(label);
    return label.includes(m);
  });
  return out;
}

const plain = (s: string) => s.replace(/\[\/?c[^\]]*\]/g, '').replace(/\s+/g, ' ');
/** A sentence about teammates' actions ("When a Resonator in the team applies …") doesn't mean this Resonator can. */
const ABOUT_OTHERS = /Resonators? (?:in the team|on the field)|teammates?|other Resonators|any (?:nearby )?Resonator|Resonators? other than|Ceaseless Landscape/i;

/** Best guess, from the kit's own text, of what this Resonator triggers. The optimizer lets the player correct it. */
export function guessMechanics(c: Character): Mechanic[] {
  const sentences = c.skills.flatMap((s) => plain(s.description).split(/(?<=[.!])\s+|\n/));
  const has = (re: RegExp) => sentences.some((s) => re.test(s) && !ABOUT_OTHERS.test(s.split(re)[0] ?? ''));
  const out: Mechanic[] = [];
  for (const m of MECHANICS) {
    const esc = m.replace(/[-]/g, '\\-');
    const ok =
      m === 'Unison' ? has(/\b(?:gains?|grants?|obtains?)\b[^.]{0,30}\bUnison\b(?! Boon| Response)|\btriggers? Unison Response/)
      : m === 'Shield' ? has(/\bShield\b/)
      : m === 'Healing' ? has(/\b(?:heals?|restores? HP for|restore HP for)\b/i)
      : has(new RegExp(`\\b(?:inflicts?|inflicting|applies|apply|applying)\\b[^.]{0,80}${esc}|${esc}[^.]{0,20}\\bis inflicted`));
    if (ok) out.push(m);
  }
  return out;
}

/** What the on-field Resonator and teammates can trigger, by guess. */
export function teamMechanics(build: Build, data: GameData): Mechanic[] {
  const ids = [build.characterId, ...(build.team ?? []).map((t) => t?.characterId)].filter((x): x is number => x !== undefined);
  const set = new Set<Mechanic>();
  for (const id of ids) { const c = data.characters.find((x) => x.id === id); if (c) guessMechanics(c).forEach((m) => set.add(m)); }
  return MECHANICS.filter((m) => set.has(m));
}
