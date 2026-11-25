import type { Weapon } from '../../data/types';
import type { Effect } from '../types';

/** Weapon passives scale linearly: R5 = 2 x R1 for every number in the passive. */
export const rankScale = (rank: number) => 1 + 0.25 * (rank - 1);

/**
 * Hand-written conditional parts of weapon passives (R1 values; scaled by rank).
 * The unconditional first sentence ("ATK is increased by 12%.") is parsed automatically below.
 */
const CONDITIONAL: Record<string, (s: number) => Effect[]> = {
  Frostburn: (s) => [{
    id: 'w.frostburn.chafe', group: 'weapon', source: 'Frostburn', text: 'After applying Glacio Chafe: Glacio DMG Amplified, Liberation ignores DEF',
    condition: { kind: 'toggle', label: 'Applied Glacio Chafe', default: true },
    mods: [{ key: 'amplify', value: 28 * s }],
    appliesTo: { element: 'Glacio' },
  }, {
    id: 'w.frostburn.lib', group: 'weapon', source: 'Frostburn', text: 'After applying Glacio Chafe: Resonance Liberation ignores DEF',
    condition: { kind: 'toggle', label: 'Applied Glacio Chafe', default: true, key: 'w.frostburn.chafe' },
    mods: [{ key: 'defIgnore', value: 10 * s }],
    appliesTo: { dmgTypes: ['Liberation'] },
  }],
  "Defier's Thorn": (s) => [{
    id: 'w.defier.def', group: 'weapon', source: "Defier's Thorn", text: '15s after Intro Skill or Basic Attack: ignore DEF',
    condition: { kind: 'toggle', label: 'After Intro / Basic Attack', default: true },
    mods: [{ key: 'defIgnore', value: 8 * s }],
  }, {
    id: 'w.defier.erosion', group: 'weapon', source: "Defier's Thorn", text: 'Target with Aero Erosion takes Amplified DMG',
    condition: { kind: 'toggle', label: 'Target has Aero Erosion', default: true },
    mods: [{ key: 'amplify', value: 20 * s }],
  }],
  Kumokiri: (s) => [{
    id: 'w.kumokiri.lib', group: 'weapon', source: 'Kumokiri', text: 'Intro Skill / Negative Status: Resonance Liberation DMG Bonus per stack',
    condition: { kind: 'stacks', label: 'Kumokiri stacks', max: 3, default: 3 },
    mods: [{ key: 'dmgLib', value: 8 * s }],
  }, {
    id: 'w.kumokiri.team', group: 'weapon', source: 'Kumokiri', text: 'At max stacks + team inflicts Negative Status: All-Attribute DMG Bonus',
    condition: { kind: 'toggle', label: 'Max stacks + Negative Status', default: true },
    mods: [{ key: 'dmgAll', value: 24 * s }],
  }],
  'Glint of Clouds': (s) => [{
    id: 'w.glint.aero', group: 'weapon', source: 'Glint of Clouds', text: 'Inflicting Tune Strain - Shifting: Aero DMG Bonus per stack',
    condition: { kind: 'stacks', label: 'Glint of Clouds stacks', max: 5, default: 5 },
    mods: [{ key: 'dmgAero', value: 11.2 * s }],
  }, {
    id: 'w.glint.def', group: 'weapon', source: 'Glint of Clouds', text: 'At 5 stacks: Aero DMG ignores DEF',
    condition: { kind: 'toggle', label: 'Glint of Clouds at 5 stacks', default: true },
    mods: [{ key: 'defIgnore', value: 10 }],
    appliesTo: { element: 'Aero' },
  }],
};

const STATIC_FIRST: [RegExp, Effect['mods'][number]['key']][] = [
  [/^ATK is increased by ([\d.]+)%/, 'atkPct'],
  [/^Max HP is increased by ([\d.]+)%/, 'hpPct'],
  [/^HP is increased by ([\d.]+)%/, 'hpPct'],
  [/^DEF is increased by ([\d.]+)%/, 'defPct'],
  [/^Crit\. Rate is increased by ([\d.]+)%/, 'critRate'],
  [/^Crit\. DMG is increased by ([\d.]+)%/, 'critDmg'],
  [/^Energy Regen is increased by ([\d.]+)%/, 'energyRegen'],
];

export function weaponEffects(w: Weapon, rank: number): Effect[] {
  const text = w.passive.descriptions[rank - 1] ?? w.passive.descriptions[0];
  const out: Effect[] = [];
  for (const [re, key] of STATIC_FIRST) {
    const m = text.match(re);
    if (m) {
      out.push({ id: `w.${w.id}.static`, group: 'weapon', source: `${w.name} R${rank}`, text: m[0], mods: [{ key, value: Number(m[1]) }] });
      break;
    }
  }
  const extra = CONDITIONAL[w.name]?.(rankScale(rank)) ?? [];
  return [...out, ...extra.map((e) => ({ ...e, source: `${e.source} R${rank}` }))];
}

export const HAS_WEAPON_DEFINITIONS = Object.keys(CONDITIONAL);
