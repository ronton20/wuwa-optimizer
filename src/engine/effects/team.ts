import type { Effect } from '../types';
import { DEN_BURST, DEN_STRAIN, HSIN_FLARE, HSIN_UNI, LUC_CHAFE, LUC_ECHO, SUO_ALIGNED } from './characters';
import { rankScale } from './weapons';

/**
 * What a character gives the on-field Resonator when slotted as a TEAMMATE.
 * (Team-wide sequence effects marked `team: true` in characters.ts are added on top.)
 * `seq` = sequence needed. Ids are prefixed per slot when collected, so two slots never share a toggle.
 */
/** `onlyFor`: the buff only reaches this on-field Resonator (e.g. Hsin's bonus for Rover: Electro). */
export interface TeamEffect extends Effect { seq: number; onlyFor?: string }

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
  Ciaccona: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Windcalling Tune', text: 'Aero Erosion DMG Amplified (30s)',
      condition: { kind: 'toggle', label: 'Ciaccona Outro', default: true }, mods: [{ key: 'amplify', value: 100 }], appliesTo: { statuses: ['Aero Erosion'] } },
  ],
  Lucilla: [
    { seq: 0, id: 'inherent', group: 'team', mode: LUC_CHAFE, source: 'Inherent · Slow Motion', text: 'After Spotlight: Glacio RES of nearby targets reduced',
      condition: { kind: 'toggle', label: 'After Lucilla\'s Spotlight', default: true }, mods: [{ key: 'resShred', value: 8 }], appliesTo: { element: 'Glacio' } },
    { seq: 0, id: 'outro.echo', group: 'team', mode: LUC_ECHO, source: 'Outro · Montage', text: 'Incoming Resonator: Echo Skill DMG Amplified',
      condition: { kind: 'toggle', label: 'Lucilla Outro (Echo mode)', default: true }, mods: [{ key: 'amplify', value: 50 }], appliesTo: { dmgTypes: ['Echo'] } },
    { seq: 0, id: 'zoom', group: 'team', mode: LUC_ECHO, source: 'Forte · Zoom', text: 'Each Zoom stack: active Resonator\'s Echo Skill Crit. DMG +10% (up to 4 with Remembrance)',
      condition: { kind: 'stacks', label: 'Zoom stacks', max: 4, default: 'max' }, mods: [{ key: 'critDmg', value: 10 }], appliesTo: { dmgTypes: ['Echo'] } },
  ],
  Suisui: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Rippling Waters', text: 'All DMG Amplified for the team',
      condition: { kind: 'toggle', label: 'Suisui Outro', default: true }, mods: [{ key: 'amplify', value: 25 }] },
    { seq: 0, id: 'outro.shadows', group: 'team', source: 'Outro · Rippling Waters', text: '400+ Floral Epistle: Reflecting Shadows — more DMG (0.2% per 1% of Suisui\'s Energy Regen over 200%, max 12%)',
      condition: { kind: 'toggle', label: 'Reflecting Shadows (400+ Floral Epistle)', default: true }, mods: [{ key: 'amplify', value: 12 }] },
    { seq: 2, id: 's2', group: 'team', source: 'S2', text: 'After a Negative Status inside Ceaseless Landscape: Crit. DMG',
      condition: { kind: 'toggle', label: 'Inflicted a Negative Status (Suisui S2)', default: true }, mods: [{ key: 'critDmg', value: 50 }] },
    { seq: 0, id: 'landscape', group: 'team', source: 'Liberation · Ceaseless Landscape', text: 'Negative Status stack limit on targets',
      condition: { kind: 'toggle', label: 'Ceaseless Landscape active', default: true }, mods: [],
      raisesMax: { key: 'c.carte.imprint', by: 3, exclusive: 'negativeStatusMax' } },
    { seq: 0, id: 'landscape.havoc', group: 'team', source: 'Liberation · Ceaseless Landscape', text: 'After consuming Havoc Bane: Havoc DMG ignores DEF and Havoc RES',
      condition: { kind: 'toggle', label: 'Consumed Havoc Bane in Ceaseless Landscape', default: false }, mods: [{ key: 'defIgnore', value: 6 }, { key: 'resShred', value: 12 }], appliesTo: { element: 'Havoc' } },
    { seq: 0, id: 'outro.mist', group: 'team', source: 'Outro · Rippling Waters', text: '600 Floral Epistle: Undulating Mist ATK (max at Suisui Energy Regen ≥ 260%)',
      condition: { kind: 'toggle', label: 'Undulating Mist (600 Floral Epistle)', default: false }, mods: [{ key: 'atkPct', value: 50 }] },
  ],
  Hsin: [
    { seq: 0, id: 'outro.flare', group: 'team', mode: HSIN_FLARE, source: 'Outro · Herself a Thousand Lanterns', text: 'Electro DMG Amplified for the team',
      condition: { kind: 'toggle', label: 'Hsin Outro (Nightglow)', default: true }, mods: [{ key: 'amplify', value: 20 }], appliesTo: { element: 'Electro' } },
    { seq: 0, id: 'outro.uni', group: 'team', mode: HSIN_UNI, source: 'Outro · Herself a Thousand Lanterns', text: 'Shared Light: all DMG Amplified',
      condition: { kind: 'toggle', label: 'Shared Light (gained Unison)', default: true }, mods: [{ key: 'amplify', value: 20 }] },
    { seq: 0, onlyFor: 'Rover: Electro', id: 'rover', group: 'team', mode: HSIN_FLARE, source: 'Inherent · Tides of Succession', text: 'Rover: Electro casts Thunderous Fury with Hsin in the team: Electro DMG',
      condition: { kind: 'toggle', label: 'Cast Thunderous Fury (Hsin in team)', default: true }, mods: [{ key: 'dmgElectro', value: 20 }] },
  ],
  'Rover: Electro': [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Rumbling Thunders', text: 'Electro Core: after inflicting a Negative Status, all DMG Amplified',
      condition: { kind: 'toggle', label: 'Inflicted a Negative Status with Electro Core', default: true }, mods: [{ key: 'amplify', value: 25 }] },
  ],
  Lily: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Blooming Fragrance', text: 'All DMG Amplified for the team',
      condition: { kind: 'toggle', label: 'Lily Outro', default: true }, mods: [{ key: 'amplify', value: 25 }] },
    { seq: 0, id: 'aroma', group: 'team', source: 'Liberation · Dream Aroma', text: 'Each Dream Aroma stack: ATK (max per stack at Lily Energy Regen ≥ 260%)',
      condition: { kind: 'stacks', label: 'Dream Aroma stacks', max: 4, default: 'max' }, mods: [{ key: 'atkPct', value: 7 }] },
    { seq: 2, id: 'aroma.s2', group: 'team', source: 'S2 · Listen, a Requiem from the Dream Cradle', text: 'Each Dream Aroma stack: Crit. Rate and Crit. DMG',
      condition: { kind: 'stacks', label: 'Dream Aroma stacks', max: 4, default: 'max', key: 'aroma' }, mods: [{ key: 'critRate', value: 2 }, { key: 'critDmg', value: 6 }] },
    { seq: 0, id: 'silvered', group: 'team', source: 'Forte · Silvered Dream', text: 'Echo Skill Crit. Rate / Crit. DMG (max at Lily Energy Regen ≥ 260%)',
      condition: { kind: 'toggle', label: 'Silvered Dream', default: true }, mods: [{ key: 'critRate', value: 10 }, { key: 'critDmg', value: 20 }], appliesTo: { dmgTypes: ['Echo'] } },
  ],
  Suoming: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Canopy Rumble', text: 'Incoming Resonator: Electro DMG Amplified',
      condition: { kind: 'toggle', label: 'Suoming Outro', default: true }, mods: [{ key: 'amplify', value: 20 }], appliesTo: { element: 'Electro' } },
    { seq: 0, id: 'outro.boon', group: 'team', source: 'Outro · Canopy Rumble', text: 'With Unison Boon: Resonance Skill DMG Amplified',
      condition: { kind: 'toggle', label: 'Incoming Resonator has Unison Boon', default: false }, mods: [{ key: 'amplify', value: 25 }], appliesTo: { dmgTypes: ['Skill'] } },
    { seq: 0, id: 'aligned', group: 'team', mode: SUO_ALIGNED, source: 'Inherent · Sunken Seal, Forged Lock', text: 'Aligned Seals Outro: Electro DMG (30%, up to 40% with Unison Boon)',
      condition: { kind: 'toggle', label: 'Aligned Seals Outro', default: true }, mods: [{ key: 'dmgElectro', value: 30 }] },
    { seq: 2, id: 's2', group: 'team', source: 'S2 · Breaking Thunder, Slaying Evil', text: 'Outro: incoming Resonator Crit. DMG (10%, more with Unison Boon)',
      condition: { kind: 'toggle', label: 'Suoming Outro', default: true, key: 'outro' }, mods: [{ key: 'critDmg', value: 10 }] },
  ],
  Aemeath: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Silent Protection', text: 'All DMG Amplified for the team (except Aemeath)',
      condition: { kind: 'toggle', label: 'Aemeath Outro', default: true }, mods: [{ key: 'amplify', value: 10 }] },
    { seq: 0, id: 'outro.more', group: 'team', source: 'Outro · Silent Protection', text: 'Inflicts Fusion Burst / Tune Rupture - Shifting (matching her mode): Amplify raised to 20%',
      condition: { kind: 'toggle', label: 'Inflicts Fusion Burst / Tune Rupture - Shifting', default: true }, mods: [{ key: 'amplify', value: 10 }] },
  ],
  Denia: [
    { seq: 0, id: 'outro.burst', group: 'team', mode: DEN_BURST, source: 'Outro · Unfinished Lies', text: 'Fusion Burst DMG Amplified (30s)',
      condition: { kind: 'toggle', label: 'Denia Outro (Fusion Burst mode)', default: true }, mods: [{ key: 'amplify', value: 60 }], appliesTo: { statuses: ['Fusion Burst'] } },
    { seq: 0, id: 'outro', group: 'team', mode: DEN_STRAIN, source: 'Outro · Unfinished Lies', text: 'Incoming Resonator: all DMG Amplified',
      condition: { kind: 'toggle', label: 'Denia Outro (Tune Strain mode)', default: true }, mods: [{ key: 'amplify', value: 15 }] },
    { seq: 0, id: 'outro.strain', group: 'team', mode: DEN_STRAIN, source: 'Outro · Unfinished Lies', text: 'After inflicting Tune Strain - Shifting: Amplify raised to 40%',
      condition: { kind: 'toggle', label: 'Inflicted Tune Strain - Shifting', default: true }, mods: [{ key: 'amplify', value: 25 }] },
  ],
  Lynae: [
    { seq: 0, id: 'outro', group: 'team', source: "Outro · Let's Hit the Road!", text: 'Incoming Resonator: all DMG Amplified, Resonance Liberation DMG Amplified',
      condition: { kind: 'toggle', label: 'Lynae Outro', default: true }, mods: [{ key: 'amplify', value: 15 }] },
    { seq: 0, id: 'outro.lib', group: 'team', source: "Outro · Let's Hit the Road!", text: 'Incoming Resonator: Resonance Liberation DMG Amplified',
      condition: { kind: 'toggle', label: 'Lynae Outro', default: true, key: 'outro' }, mods: [{ key: 'amplify', value: 25 }], appliesTo: { dmgTypes: ['Liberation'] } },
    { seq: 2, id: 's2', group: 'team', source: 'S2', text: 'Outro: incoming Resonator all DMG Amplified',
      condition: { kind: 'toggle', label: 'Lynae Outro', default: true, key: 'outro' }, mods: [{ key: 'amplify', value: 25 }] },
  ],
  Mornye: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Recursion', text: 'All DMG Amplified for the team',
      condition: { kind: 'toggle', label: 'Mornye Outro', default: true }, mods: [{ key: 'amplify', value: 25 }] },
    { seq: 2, id: 's2', group: 'team', source: 'S2', text: 'Against Interfered Marker: Crit. DMG (max at Mornye Energy Regen ≥ 260%)',
      condition: { kind: 'toggle', label: 'Target has Interfered Marker', default: true }, mods: [{ key: 'critDmg', value: 32 }] },
  ],
  Shorekeeper: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Binary Butterfly', text: 'All DMG Amplified for nearby Resonators',
      condition: { kind: 'toggle', label: 'Shorekeeper Outro', default: true }, mods: [{ key: 'amplify', value: 15 }] },
    { seq: 0, id: 'inner', group: 'team', source: 'Liberation · Inner Stellarealm', text: 'Crit. Rate (max at Shorekeeper Energy Regen ≥ 250%)',
      condition: { kind: 'toggle', label: 'Inner Stellarealm (or Supernal)', default: true }, mods: [{ key: 'critRate', value: 12.5 }] },
    { seq: 0, id: 'supernal', group: 'team', source: 'Liberation · Supernal Stellarealm', text: 'Crit. DMG (max at Shorekeeper Energy Regen ≥ 250%)',
      condition: { kind: 'toggle', label: 'Supernal Stellarealm', default: true }, mods: [{ key: 'critDmg', value: 25 }] },
  ],
  Zhezhi: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Carve and Draw', text: 'Incoming Resonator: Glacio DMG Amplified',
      condition: { kind: 'toggle', label: 'Zhezhi Outro', default: true }, mods: [{ key: 'amplify', value: 20 }], appliesTo: { element: 'Glacio' } },
    { seq: 0, id: 'outro.skill', group: 'team', source: 'Outro · Carve and Draw', text: 'Incoming Resonator: Resonance Skill DMG Amplified',
      condition: { kind: 'toggle', label: 'Zhezhi Outro', default: true, key: 'outro' }, mods: [{ key: 'amplify', value: 25 }], appliesTo: { dmgTypes: ['Skill'] } },
  ],
  Lupa: [
    { seq: 0, id: 'outro', group: 'team', source: 'Outro · Stand by Me, Warrior', text: 'Incoming Resonator: Fusion DMG Amplified',
      condition: { kind: 'toggle', label: 'Lupa Outro', default: true }, mods: [{ key: 'amplify', value: 20 }], appliesTo: { element: 'Fusion' } },
    { seq: 0, id: 'outro.basic', group: 'team', source: 'Outro · Stand by Me, Warrior', text: 'Incoming Resonator: Basic Attack DMG Amplified',
      condition: { kind: 'toggle', label: 'Lupa Outro', default: true, key: 'outro' }, mods: [{ key: 'amplify', value: 25 }], appliesTo: { dmgTypes: ['Basic'] } },
  ],
};

/** Parts of a teammate's kit that are known but not modelled (shown in the Team tab). */
export const TEAM_NOT_MODELLED: Record<string, string[]> = {
  Suoming: ['Unison Boon (only for Resonators that can trigger Unison Response)'],
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
