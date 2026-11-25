import type { Effect } from '../types';
import { rankScale } from './weapons';

/**
 * What a character gives the on-field Resonator when slotted as a TEAMMATE.
 * (Team-wide sequence effects marked `team: true` in characters.ts are added on top.)
 * `seq` = sequence needed. Ids are prefixed per slot when collected, so two slots never share a toggle.
 */
export interface TeamEffect extends Effect { seq: number }

export const TEAM_KITS: Record<string, TeamEffect[]> = {
  Hiyuki: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Snowlight Blessing', text: 'Glacio DMG Amplified against targets with Glacio Chafe',
      condition: { kind: 'toggle', label: 'Target has Glacio Chafe', default: true }, mods: [{ key: 'amplify', value: 20 }], appliesTo: { element: 'Glacio' } },
  ],
  Cartethyia: [
    { seq: 0, id: 'outro', group: 'team', source: "Outro · Wind's Divine Blessing", text: 'Aero DMG Amplified against targets with a Negative Status',
      condition: { kind: 'toggle', label: 'Target has a Negative Status', default: true }, mods: [{ key: 'amplify', value: 17.5 }], appliesTo: { element: 'Aero' } },
  ],
  Chisa: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Unraveling - Law Zero', text: 'Resonant Thread of Closure: Negative Status stack limit on targets',
      condition: { kind: 'toggle', label: 'Resonant Thread of Closure', default: true }, mods: [],
      // every Negative Status stack condition the engine knows about
      raisesMax: { key: 'c.carte.imprint', by: 3, exclusive: 'negativeStatusMax' } },
  ],
  Qingxiao: [],
  Lucilla: [
    { seq: 0, id: 'inherent', group: 'team', source: 'Inherent · Slow Motion', text: 'Resonance Mode - Glacio Chafe: Glacio RES of nearby targets reduced',
      condition: { kind: 'toggle', label: 'Lucilla in Glacio Chafe mode', default: true }, mods: [{ key: 'resShred', value: 8 }], appliesTo: { element: 'Glacio' } },
  ],
  Suisui: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Rippling Waters', text: 'All DMG Amplified for the team',
      condition: { kind: 'toggle', label: 'Suisui Outro', default: true }, mods: [{ key: 'amplify', value: 25 }] },
    { seq: 0, id: 'outro.shadows', group: 'team', source: 'Outro · Rippling Waters', text: '400+ Floral Epistle: Reflecting Shadows — more DMG (0.2% per 1% of Suisui\'s Energy Regen over 200%, max 12%)',
      condition: { kind: 'toggle', label: 'Reflecting Shadows (400+ Floral Epistle)', default: true }, mods: [{ key: 'amplify', value: 12 }] },
    { seq: 2, id: 's2', group: 'team', source: 'S2', text: 'After a Negative Status inside Ceaseless Landscape: Crit. DMG',
      condition: { kind: 'toggle', label: 'Inflicted a Negative Status (Suisui S2)', default: true }, mods: [{ key: 'critDmg', value: 50 }] },
  ],
};

/** Parts of a teammate's kit that are known but not modelled (shown in the Team tab). */
export const TEAM_NOT_MODELLED: Record<string, string[]> = {
  Lucilla: ['Outro / S2: Glacio Chafe DMG Amplify (Glacio Chafe DMG not modelled)', 'Resonance Mode - Echo buffs'],
  Qingxiao: ['Outro: 800% ATK Aero hit (her own damage)'],
};

// ---------------------------------------------------------------- teammate gear
const tog = (label: string) => ({ kind: 'toggle' as const, label, default: true });

/** Teammate weapons with a buff that reaches the on-field Resonator (R1 values, scaled by rank). */
export const TEAM_WEAPONS: Record<string, (rank: number) => Effect[]> = {
  'Freeze Frame': (r) => [{ id: 'w.freezeframe', group: 'team', source: `Freeze Frame R${r}`, text: 'After the wielder inflicts Glacio Chafe: all Resonators in the team gain ATK', condition: tog('Freeze Frame: inflicted Glacio Chafe'), mods: [{ key: 'atkPct', value: 24 * rankScale(r) }] }],
  "Firstlight's Herald": (r) => [{ id: 'w.firstlight', group: 'team', source: `Firstlight's Herald R${r}`, text: 'With Snow Taint and Ripples: ATK of all nearby Resonators in the team', condition: tog('Snow Taint + Ripples active'), mods: [{ key: 'atkPct', value: 20 * rankScale(r) }] }],
  'Forged Dwarf Star': (r) => [{ id: 'w.dwarfstar', group: 'team', source: `Forged Dwarf Star R${r}`, text: 'Team inflicts Fusion Burst / Tune Strain - Shifting: ATK', condition: tog('Forged Dwarf Star buff active'), mods: [{ key: 'atkPct', value: 24 * rankScale(r) }] }],
  Kumokiri: (r) => [{ id: 'w.kumokiri', group: 'team', source: `Kumokiri R${r}`, text: 'At max stacks, Resonators in the team that inflict Negative Statuses gain All-Attribute DMG Bonus', condition: tog('Kumokiri at max stacks'), mods: [{ key: 'dmgAll', value: 24 * rankScale(r) }] }],
  'Starfield Calibrator': (r) => [{ id: 'w.starfield', group: 'team', source: `Starfield Calibrator R${r}`, text: 'Wielder heals: Crit. DMG of all nearby Resonators in the team', condition: tog('Starfield Calibrator buff active'), mods: [{ key: 'critDmg', value: 20 * rankScale(r) }] }],
  'Static Mist': (r) => [{ id: 'w.staticmist', group: 'team', source: `Static Mist R${r}`, text: "After the wielder's Outro: incoming Resonator's ATK", condition: tog('Static Mist buff active'), mods: [{ key: 'atkPct', value: 10 * rankScale(r) }] }],
  'Skull Thrasher': (r) => [{ id: 'w.skull', group: 'team', source: `Skull Thrasher R${r}`, text: 'Inflicting Hack - Shifting: ATK of Resonators in the team', condition: tog('Skull Thrasher buff active'), mods: [{ key: 'atkPct', value: 24 * rankScale(r) }] }],
  Lullaby: (r) => [{ id: 'w.lullaby', group: 'team', source: `Lullaby R${r}`, text: 'Soothed Soul + Unison: ATK', condition: tog('Lullaby buff active'), mods: [{ key: 'atkPct', value: 16 * rankScale(r) }] }],
  'Spectrum Blaster': (r) => [{ id: 'w.spectrum', group: 'team', source: `Spectrum Blaster R${r}`, text: 'Tune Rupture / Strain - Shifting during Basic Attacks: all DMG dealt by Resonators in the team (8% per stack, 3 stacks)', condition: { kind: 'stacks', label: 'Spectrum Blaster stacks', max: 3, default: 'max' }, mods: [{ key: 'amplify', value: 8 * rankScale(r) }] }],
  'Unspoken Rue': (r) => [{ id: 'w.rue', group: 'team', source: `Unspoken Rue R${r}`, text: 'Binding Mind: Electro DMG Bonus for all Resonators in the team', condition: tog('Binding Mind active'), mods: [{ key: 'dmgElectro', value: 24 * rankScale(r) }] }],
  'Wildfire Mark': (r) => [{ id: 'w.wildfire', group: 'team', source: `Wildfire Mark R${r}`, text: 'Extended by a Heavy Attack: Fusion DMG Bonus for all Resonators in the team', condition: tog('Wildfire Mark buff active'), mods: [{ key: 'dmgFusion', value: 24 * rankScale(r) }] }],
  "Bloodpact's Pledge": (r) => [{ id: 'w.bloodpact', group: 'team', source: `Bloodpact's Pledge R${r}`, text: 'Rover: Aero casts Unbound Flow: Aero DMG of nearby Resonators Amplified', condition: tog('Wielded by Rover: Aero'), mods: [{ key: 'amplify', value: 10 * rankScale(r) }], appliesTo: { element: 'Aero' } }],
};

/** Main echoes whose skill buffs the next / whole team. Keyed by name ("Phantom: " variants share the entry). */
export const TEAM_ECHOES: Record<string, Effect[]> = {
  Glommoth: [{ id: 'e.glommoth', group: 'team', source: 'Glommoth', text: 'Outro after Echo Skill: incoming Resonator Glacio DMG', condition: tog('Glommoth buff active'), mods: [{ key: 'dmgGlacio', value: 12 }] }],
  'Reminiscence: Denia': [{ id: 'e.denia', group: 'team', source: 'Denia', text: 'Outro after Echo Skill: incoming Resonator Fusion DMG', condition: tog('Denia buff active'), mods: [{ key: 'dmgFusion', value: 12 }] }],
  Soulfrayer: [{ id: 'e.soulfrayer', group: 'team', source: 'Soulfrayer', text: 'Outro after Echo Skill: incoming Resonator Electro DMG', condition: tog('Soulfrayer buff active'), mods: [{ key: 'dmgElectro', value: 12 }] }],
  'Voidwing Moth': [{ id: 'e.moth', group: 'team', source: 'Voidwing Moth', text: 'Outro after Echo Skill: incoming Resonator ATK', condition: tog('Voidwing Moth buff active'), mods: [{ key: 'atkPct', value: 12 }] }],
  Hyvatia: [{ id: 'e.hyvatia', group: 'team', source: 'Hyvatia', text: 'Outro after Echo Skill: All-Attribute DMG Bonus for the next Resonator using Intro Skill', condition: tog('Hyvatia buff active'), mods: [{ key: 'dmgAll', value: 10 }] }],
  'Impermanence Heron': [{ id: 'e.heron', group: 'team', source: 'Impermanence Heron', text: 'Outro after Echo Skill: next Resonator deals more DMG', condition: tog('Heron buff active'), mods: [{ key: 'dmgAll', value: 12 }] }],
  'Fallacy of No Return': [{ id: 'e.fallacy', group: 'team', source: 'Fallacy of No Return', text: 'Echo Skill: ATK of all team members', condition: tog('Fallacy buff active'), mods: [{ key: 'atkPct', value: 10 }] }],
  'Bell-Borne Geochelone': [{ id: 'e.geochelone', group: 'team', source: 'Bell-Borne Geochelone', text: 'Bell-Borne Shield: DMG Boost for the current team members', condition: tog('Bell-Borne Shield active'), mods: [{ key: 'dmgAll', value: 10 }] }],
};

/** Sets whose effect reaches the on-field Resonator. */
export const TEAM_SETS: Record<string, Effect[]> = {
  'Wishes of Quiet Snowfall': [{ id: 's.wqs', group: 'team', source: 'Wishes of Quiet Snowfall 5pc', text: 'Outro removes Snowfall: incoming Resonator Glacio DMG', condition: tog('Snowfall Outro buff active'), mods: [{ key: 'dmgGlacio', value: 25 }] }],
  'Moonlit Clouds': [{ id: 's.moonlit', group: 'team', source: 'Moonlit Clouds 5pc', text: 'Outro: next Resonator ATK', condition: tog('Moonlit Clouds buff active'), mods: [{ key: 'atkPct', value: 22.5 }] }],
  'Midnight Veil': [{ id: 's.mv', group: 'team', source: 'Midnight Veil 5pc', text: 'Outro: incoming Resonator Havoc DMG', condition: tog('Midnight Veil buff active'), mods: [{ key: 'dmgHavoc', value: 15 }] }],
  'Gusts of Welkin': [{ id: 's.welkin', group: 'team', source: 'Gusts of Welkin 5pc', text: 'Inflicting Aero Erosion: team Aero DMG', condition: tog('Gusts of Welkin buff active'), mods: [{ key: 'dmgAero', value: 15 }] }],
  'Flaming Clawprint': [{ id: 's.clawprint', group: 'team', source: 'Flaming Clawprint 5pc', text: 'Liberation: team Fusion DMG', condition: tog('Flaming Clawprint buff active'), mods: [{ key: 'dmgFusion', value: 15 }] }],
  'Law of Harmony': [{ id: 's.harmony', group: 'team', source: 'Law of Harmony 3pc', text: 'Echo Skill: Echo Skill DMG Bonus for all Resonators in the team (4% per stack)', condition: { kind: 'stacks', label: 'Law of Harmony stacks', max: 4, default: 'max' }, mods: [{ key: 'dmgEcho', value: 4 }] }],
  'Chromatic Foam': [{ id: 's.foam', group: 'team', source: 'Chromatic Foam 5pc', text: 'Outro: incoming Resonator Fusion DMG', condition: tog('Chromatic Foam buff active'), mods: [{ key: 'dmgFusion', value: 25 }] }],
  'Flash of Electric Reflection': [{ id: 's.flash', group: 'team', source: 'Flash of Electric Reflection 5pc', text: 'Outro: incoming Resonator Electro DMG', condition: tog('Electric Reflection buff active'), mods: [{ key: 'dmgElectro', value: 25 }] }],
  'Pact of Neonlight Leap': [{ id: 's.pact', group: 'team', source: 'Pact of Neonlight Leap 5pc', text: 'Outro: incoming Resonator ATK (+15%, up to +15% more from Tune Break Boost)', condition: tog('Neonlight Leap buff active'), mods: [{ key: 'atkPct', value: 30 }] }],
  'Halo of Starry Radiance': [{ id: 's.halo', group: 'team', source: 'Halo of Starry Radiance 5pc', text: 'Healing: team ATK (up to 25% from Off-Tune Buildup Rate)', condition: tog('Starry Radiance buff active'), mods: [{ key: 'atkPct', value: 25 }] }],
  'Song of Feathered Trace': [{ id: 's.feather', group: 'team', source: 'Song of Feathered Trace 5pc', text: "Chongming's Feather: team ATK (up to 25% from Energy Regen)", condition: tog("Chongming's Feather active"), mods: [{ key: 'atkPct', value: 25 }] }],
  'Flower of Tinged Yearning': [{ id: 's.flower', group: 'team', source: 'Flower of Tinged Yearning 5pc', text: 'Healing: team ATK +10% (+15% more with Unison)', condition: tog('Tinged Yearning buff active'), mods: [{ key: 'atkPct', value: 10 }] }],
  'Empyrean Anthem': [{ id: 's.anthem', group: 'team', source: 'Empyrean Anthem 5pc', text: 'Coordinated Attack crit: active Resonator ATK', condition: tog('Empyrean Anthem buff active'), mods: [{ key: 'atkPct', value: 20 }] }],
};

/** "Phantom: Glommoth" → "Glommoth" */
export const echoBaseName = (name: string) => name.replace(/^Phantom:\s*/, '');
