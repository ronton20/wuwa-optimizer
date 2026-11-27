import type { Weapon } from '../../data/types';
import type { Effect } from '../types';

/** Old linear rule (R5 = 2 × R1). Still used for teammates' weapon buffs in team.ts. */
export const rankScale = (rank: number) => 1 + 0.25 * (rank - 1);

/** `v(i)`: the i-th number in the passive text at the weapon's rank, so every rank uses the game's exact values. */
type V = (i: number) => number;
type Def = Omit<Effect, 'group' | 'source'> & { source?: string };

const tog = (label: string, def = true, key?: string): Effect['condition'] => ({ kind: 'toggle', label, default: def, key });
const stk = (label: string, max: number, def: number | 'max' = 'max', key?: string): Effect['condition'] => ({ kind: 'stacks', label, max, default: def, key });

// shared 4★ passives
const rhetoric = (id: string) => (v: V): Def[] => [{ id, text: 'Hitting targets with a Negative Status: ATK per stack', condition: stk('Rhetoric stacks', v(3)), mods: [{ key: 'atkPct', value: v(0) }] }];
const gaze = (id: string) => (v: V): Def[] => [{ id, text: 'After Resonance Skill: ATK', condition: tog('After Resonance Skill'), mods: [{ key: 'atkPct', value: v(1) }] }];
const tideLib = (id: string) => (v: V): Def[] => [{ id, text: 'After Resonance Liberation: ATK and Resonance Liberation DMG', condition: tog('After Resonance Liberation'), mods: [{ key: 'atkPct', value: v(0) }, { key: 'dmgLib', value: v(1) }] }];
const ceaseless: (v: V) => Def[] = () => []; // Concerto Energy only

/**
 * Everything after the first sentence (which is parsed automatically below).
 * "X DMG Bonus" → bonus stat, "X DMG Amplification" → amplify, "X DMG is increased" → bonus.
 */
const PASSIVES: Record<string, (v: V) => Def[]> = {
  // ---------------------------------------------------------------- Broadblade
  'Ages of Harvest': (v) => [
    { id: 'w.ages.intro', text: 'After Intro Skill: Resonance Skill DMG', condition: tog('Ageless Marking (after Intro)'), mods: [{ key: 'dmgSkill', value: v(1) }] },
    { id: 'w.ages.skill', text: 'After Resonance Skill: Resonance Skill DMG', condition: tog('Ethereal Endowment (after Skill)'), mods: [{ key: 'dmgSkill', value: v(3) }] },
  ],
  Kumokiri: (v) => [
    { id: 'w.kumokiri.lib', text: 'Intro Skill / Negative Status: Resonance Liberation DMG Bonus per stack', condition: stk('Kumokiri stacks', v(2)), mods: [{ key: 'dmgLib', value: v(1) }] },
    { id: 'w.kumokiri.team', text: 'At max stacks + team inflicts Negative Status: All-Attribute DMG Bonus', condition: tog('Max stacks + Negative Status'), mods: [{ key: 'dmgAll', value: v(4) }] },
  ],
  'Lustrous Razor': (v) => [{ id: 'w.lustrous', text: 'Each Resonance Skill: Resonance Liberation DMG', condition: stk('Lustrous Razor stacks', v(2)), mods: [{ key: 'dmgLib', value: v(1) }] }],
  'Radiance Cleaver': (v) => [{ id: 'w.radiance', text: 'Hitting Tune Strain - Interfered targets: Resonance Liberation DMG', condition: tog('Target has Tune Strain - Interfered'), mods: [{ key: 'dmgLib', value: v(1) }] }],
  'Starfield Calibrator': (v) => [{ id: 'w.starfield.self', text: 'Wielder heals: team Crit. DMG', condition: tog('Healed the team'), mods: [{ key: 'critDmg', value: v(4) }] }],
  'Thousandfold Deliverance': (v) => [
    { id: 'w.thousand.order', text: "Nature's Order: Crit. DMG per stack", condition: stk("Nature's Order stacks", v(4)), mods: [{ key: 'critDmg', value: v(6) }] },
    { id: 'w.thousand.heavy', text: "6 stacks of Nature's Order: Heavy Attack Crit. Rate", condition: tog("Nature's Order at 6 stacks"), mods: [{ key: 'critRate', value: v(9) }], appliesTo: { dmgTypes: ['Heavy'] } },
    { id: 'w.thousand.def', text: 'Cradle of Life consumed: Heavy Attack ignores DEF', condition: tog('Consumed 2 Cradle of Life'), mods: [{ key: 'defIgnore', value: v(13) }], appliesTo: { dmgTypes: ['Heavy'] } },
  ],
  'Thunderflare Dominion': (v) => [
    { id: 'w.thunderflare.heavy', text: 'After Intro / Resonance Skill: Heavy Attack DMG', condition: tog('After Intro or Resonance Skill'), mods: [{ key: 'dmgHeavy', value: v(1) }] },
    { id: 'w.thunderflare.def', text: 'Each Shield gained: Heavy Attack ignores DEF', condition: stk('Shield stacks', v(5), 0), mods: [{ key: 'defIgnore', value: v(3) }], appliesTo: { dmgTypes: ['Heavy'] } },
  ],
  'Verdant Summit': (v) => [{ id: 'w.verdant', text: 'Each Intro / Liberation: Heavy Attack DMG', condition: stk('Verdant Summit stacks', v(2)), mods: [{ key: 'dmgHeavy', value: v(1) }] }],
  'Wildfire Mark': (v) => [
    { id: 'w.wildfire.lib', text: 'After Intro / Liberation: Resonance Liberation DMG', condition: tog('After Intro or Liberation'), mods: [{ key: 'dmgLib', value: v(1) }] },
    { id: 'w.wildfire.team', text: 'Heavy Attack extends it: team Fusion DMG', condition: tog('Extended with a Heavy Attack'), mods: [{ key: 'dmgFusion', value: v(5) }] },
  ],
  'Aureate Zenith': (v) => [{ id: 'w.aureate', text: 'After Resonance Liberation: ATK and Heavy Attack DMG', condition: tog('After Resonance Liberation'), mods: [{ key: 'atkPct', value: v(0) }, { key: 'dmgHeavy', value: v(1) }] }],
  Autumntrace: (v) => [{ id: 'w.autumn', text: 'Basic / Heavy Attack hits: ATK per stack', condition: stk('Autumntrace stacks', v(1)), mods: [{ key: 'atkPct', value: v(0) }] }],
  'Broadblade#41': (v) => [{ id: 'w.bb41', text: 'HP above 80%: ATK', condition: tog('HP above 80%'), mods: [{ key: 'atkPct', value: v(1) }] }],
  'Dauntless Evernight': (v) => [{ id: 'w.dauntless', text: 'After Intro Skill: ATK and DEF', condition: tog('After Intro Skill'), mods: [{ key: 'atkPct', value: v(0) }, { key: 'defPct', value: v(1) }] }],
  Discord: ceaseless,
  'Helios Cleaver': (v) => [{ id: 'w.helios', text: 'After Resonance Skill: ATK per stack', condition: stk('Helios Cleaver stacks', v(3)), mods: [{ key: 'atkPct', value: v(1) }] }],
  'Meditations on Mercy': rhetoric('w.mercy'),
  'Waning Redshift': gaze('w.redshift'),

  // ---------------------------------------------------------------- Gauntlets
  'Abyss Surges': (v) => [
    { id: 'w.abyss.basic', text: 'Resonance Skill hits: Basic Attack DMG', condition: tog('Resonance Skill hit'), mods: [{ key: 'dmgBasic', value: v(1) }] },
    { id: 'w.abyss.skill', text: 'Basic Attack hits: Resonance Skill DMG', condition: tog('Basic Attack hit'), mods: [{ key: 'dmgSkill', value: v(3) }] },
  ],
  'Blazing Justice': (v) => [{ id: 'w.justice', text: 'After Basic Attack: ignore DEF', condition: tog('After Basic Attack'), mods: [{ key: 'defIgnore', value: v(1) }] }],
  "Daybreaker's Spine": (v) => [
    { id: 'w.daybreaker.spectro', text: 'After Basic Attack DMG: Spectro DMG', condition: tog('After Basic Attack DMG'), mods: [{ key: 'dmgSpectro', value: v(1) }] },
    { id: 'w.daybreaker.shift', text: 'After Tune Strain - Shifting: Basic Attack DMG Amplified and ignores DEF', condition: tog('Inflicted Tune Strain - Shifting'), mods: [{ key: 'amplify', value: v(3) }, { key: 'defIgnore', value: v(4) }], appliesTo: { dmgTypes: ['Basic'] } },
  ],
  "Moongazer's Sigil": (v) => [
    { id: 'w.moongazer.lib', text: 'After Intro / Liberation: Resonance Liberation DMG', condition: tog('After Intro or Liberation'), mods: [{ key: 'dmgLib', value: v(1) }] },
    { id: 'w.moongazer.def', text: 'Each Shield (max on Intro): Liberation ignores DEF', condition: stk('Shield stacks', v(5)), mods: [{ key: 'defIgnore', value: v(3) }], appliesTo: { dmgTypes: ['Liberation'] } },
  ],
  'Pulsation Bracer': (v) => [{ id: 'w.pulsation', text: 'Hitting Tune Strain - Interfered targets: Basic Attack DMG per stack', condition: stk('Pulsation Bracer stacks', v(3)), mods: [{ key: 'dmgBasic', value: v(1) }] }],
  'Solsworn Ciphers': (v) => [
    { id: 'w.solsworn.amp', text: 'After Intro / Echo Skill: Echo Skill DMG Amplified', condition: tog('After Intro or Echo Skill'), mods: [{ key: 'amplify', value: v(1) }], appliesTo: { dmgTypes: ['Echo'] } },
    { id: 'w.solsworn.def', text: 'After Echo Skill DMG: Aero DMG ignores DEF', condition: tog('After Echo Skill DMG'), mods: [{ key: 'defIgnore', value: v(3) }], appliesTo: { element: 'Aero' } },
  ],
  Tragicomedy: (v) => [{ id: 'w.tragicomedy', text: 'After Basic Attack / Intro: Heavy Attack DMG', condition: tog('After Basic Attack or Intro'), mods: [{ key: 'dmgHeavy', value: v(1) }] }],
  "Verity's Handle": (v) => [{ id: 'w.verity', text: 'After Resonance Liberation: Resonance Liberation DMG', condition: tog('After Resonance Liberation'), mods: [{ key: 'dmgLib', value: v(1) }] }],
  'Aether Strike': tideLib('w.aether'),
  'Amity Accord': (v) => [{ id: 'w.amity', text: 'After Intro Skill: Resonance Liberation DMG', condition: tog('After Intro Skill'), mods: [{ key: 'dmgLib', value: v(0) }] }],
  'Celestial Spiral': gaze('w.spiral'),
  'Gauntlets#21D': (v) => [
    { id: 'w.g21d.atk', text: 'After a dash or dodge: ATK', condition: tog('After a dash or dodge'), mods: [{ key: 'atkPct', value: v(0) }] },
    { id: 'w.g21d.dodge', text: 'Dodge Counter DMG', condition: tog('After a dash or dodge', true, 'w.g21d.atk'), mods: [{ key: 'dmgAll', value: v(1) }], appliesTo: { rows: /Dodge Counter/, label: 'Dodge Counters' } },
  ],
  'Hollow Mirage': (v) => [{ id: 'w.hollow', text: 'Iron Armor: ATK and DEF per stack', condition: stk('Iron Armor stacks', v(2)), mods: [{ key: 'atkPct', value: v(1) }, { key: 'defPct', value: v(1) }] }],
  'Legend of Drunken Hero': rhetoric('w.drunken'),
  Marcato: ceaseless,
  Stonard: (v) => [{ id: 'w.stonard', text: 'After Resonance Skill: Resonance Liberation DMG', condition: tog('After Resonance Skill'), mods: [{ key: 'dmgLib', value: v(0) }] }],

  // ---------------------------------------------------------------- Pistols
  Lullaby: (v) => [
    { id: 'w.lullaby.atk', text: 'Soothed Soul + Unison: ATK', condition: tog('Soothed Soul + Unison', false), mods: [{ key: 'atkPct', value: v(4) }] },
    { id: 'w.lullaby.echo', text: 'Heavy Attack healing: Echo Skill DMG', condition: tog('Healed with a Heavy Attack'), mods: [{ key: 'dmgEcho', value: v(6) }] },
  ],
  'Lux & Umbra': (v) => [
    { id: 'w.lux.heavy', text: 'After Echo Skill DMG: Heavy Attack DMG Amplified', condition: tog('After Echo Skill DMG'), mods: [{ key: 'amplify', value: v(1) }], appliesTo: { dmgTypes: ['Heavy'] } },
    { id: 'w.lux.echo', text: 'After Heavy Attack DMG: Echo Skill DMG Amplified', condition: tog('After Heavy Attack DMG'), mods: [{ key: 'amplify', value: v(3) }], appliesTo: { dmgTypes: ['Echo'] } },
    { id: 'w.lux.def', text: 'Both active: ignore DEF', condition: tog('Both Lux & Umbra effects active'), mods: [{ key: 'defIgnore', value: v(6) }] },
  ],
  'Phasic Homogenizer': (v) => [{ id: 'w.phasic', text: 'After a team Tune Break: All-Attribute DMG', condition: tog('Team cast a Tune Break'), mods: [{ key: 'dmgAll', value: v(1) }] }],
  'Skull Thrasher': (v) => [
    { id: 'w.skull.intro', text: 'After Intro Skill: Basic Attack DMG', condition: tog('After Intro Skill'), mods: [{ key: 'dmgBasic', value: v(1) }] },
    { id: 'w.skull.hack', text: 'Inflicting Hack - Shifting: Basic Attack DMG and team ATK', condition: tog('Inflicted Hack - Shifting'), mods: [{ key: 'dmgBasic', value: v(3) }, { key: 'atkPct', value: v(5) }] },
  ],
  'Spectral Trigger': (v) => [
    { id: 'w.spectral.spectro', text: 'Each Resonance Skill: Spectro DMG', condition: stk('Spectral Trigger stacks', v(3)), mods: [{ key: 'dmgSpectro', value: v(1) }] },
    { id: 'w.spectral.hack', text: 'Inflicting Hack - Shifting: Heavy Attack DMG Amplified and ignores DEF', condition: tog('Inflicted Hack - Shifting'), mods: [{ key: 'amplify', value: v(4) }, { key: 'defIgnore', value: v(6) }], appliesTo: { dmgTypes: ['Heavy'] } },
  ],
  'Spectrum Blaster': (v) => [
    { id: 'w.spectrum.basic', text: 'After Intro / Basic Attack DMG: Basic Attack DMG', condition: tog('After Intro or Basic Attack DMG'), mods: [{ key: 'dmgBasic', value: v(1) }] },
    { id: 'w.spectrum.team', text: 'Tune Rupture / Strain - Shifting during Basic Attacks: team deals more DMG per stack', condition: stk('Spectrum Blaster stacks', v(5)), mods: [{ key: 'amplify', value: v(3) }] },
  ],
  'Static Mist': () => [], // buffs the next Resonator (team.ts)
  'The Last Dance': (v) => [{ id: 'w.lastdance', text: 'After Intro / Liberation: Resonance Skill DMG', condition: tog('After Intro or Liberation'), mods: [{ key: 'dmgSkill', value: v(1) }] }],
  'Woodland Aria': (v) => [
    { id: 'w.woodland.aero', text: 'Inflicting Aero Erosion: Aero DMG', condition: tog('Inflicted Aero Erosion'), mods: [{ key: 'dmgAero', value: v(1) }] },
    { id: 'w.woodland.res', text: 'Targets with Aero Erosion: Aero RES reduced', condition: tog('Target has Aero Erosion'), mods: [{ key: 'resShred', value: v(3) }], appliesTo: { element: 'Aero' } },
  ],
  Cadenza: ceaseless,
  Novaburst: (v) => [{ id: 'w.novaburst', text: 'Dashes / dodges: ATK per stack', condition: stk('Novaburst stacks', v(1)), mods: [{ key: 'atkPct', value: v(0) }] }],
  'Pistols#26': (v) => [{ id: 'w.p26', text: 'Not taking damage: ATK per stack', condition: stk('Pistols#26 stacks', v(2)), mods: [{ key: 'atkPct', value: v(0) }] }],
  'Relativistic Jet': gaze('w.jet'),
  'Romance in Farewell': rhetoric('w.romance'),
  'Solar Flame': (v) => [{ id: 'w.solar', text: 'Basic / Heavy Attack hits: ATK and Heavy Attack DMG per stack', condition: stk('Solar Flame stacks', v(3)), mods: [{ key: 'atkPct', value: v(0) }, { key: 'dmgHeavy', value: v(1) }] }],
  Thunderbolt: (v) => [{ id: 'w.thunderbolt', text: 'Basic / Heavy Attack hits: Resonance Skill DMG per stack', condition: stk('Thunderbolt stacks', v(1)), mods: [{ key: 'dmgSkill', value: v(0) }] }],
  'Undying Flame': (v) => [{ id: 'w.undying', text: 'After Intro Skill: Resonance Skill DMG', condition: tog('After Intro Skill'), mods: [{ key: 'dmgSkill', value: v(0) }] }],

  // ---------------------------------------------------------------- Rectifier
  'Blooming Jadehaven': (v) => [{ id: 'w.jadehaven', text: 'After Electro Flare / Unison Response: Resonance Skill DMG Amplified, ignores Electro RES',
    condition: tog('Inflicted Electro Flare or triggered Unison Response'), mods: [{ key: 'amplify', value: v(1) }, { key: 'resShred', value: v(2) }], appliesTo: { dmgTypes: ['Skill'] } },
  { id: 'w.jadehaven.flare', text: 'Wielder on the field: Electro Flare DMG taken Amplified', condition: tog('Wielder is the active Resonator'), mods: [{ key: 'amplify', value: v(3) }], appliesTo: { statuses: ['Electro Flare'] } }],
  'Boson Astrolabe': (v) => [{ id: 'w.boson', text: 'After a team Tune Break: ATK and Basic Attack DMG', condition: tog('Team cast a Tune Break'), mods: [{ key: 'atkPct', value: v(1) }, { key: 'dmgBasic', value: v(2) }] }],
  'Cosmic Ripples': (v) => [{ id: 'w.cosmic', text: 'Basic Attack hits: Basic Attack DMG per stack', condition: stk('Cosmic Ripples stacks', v(2)), mods: [{ key: 'dmgBasic', value: v(1) }] }],
  "Firstlight's Herald": (v) => [{ id: 'w.firstlight.self', text: 'Snow Taint + Ripples: team ATK', condition: tog('Snow Taint + Ripples'), mods: [{ key: 'atkPct', value: v(6) }] }],
  'Forged Dwarf Star': (v) => [
    { id: 'w.dwarf.lib', text: 'After Fusion Burst / Tune Strain - Shifting: Resonance Liberation DMG', condition: tog('Inflicted Fusion Burst or Tune Strain - Shifting'), mods: [{ key: 'dmgLib', value: v(1) }] },
    { id: 'w.dwarf.atk', text: 'While it lasts, team inflicts them: team ATK', condition: tog('Inflicted Fusion Burst or Tune Strain - Shifting', true, 'w.dwarf.lib'), mods: [{ key: 'atkPct', value: v(3) }] },
  ],
  'Freeze Frame': (v) => [{ id: 'w.freeze', text: 'After Glacio Chafe: Glacio DMG and team ATK', condition: tog('Inflicted Glacio Chafe'), mods: [{ key: 'dmgGlacio', value: v(1) }, { key: 'atkPct', value: v(3) }] }],
  'Lethean Elegy': (v) => [{ id: 'w.lethean', text: 'After Echo Skill DMG: Resonance Skill DMG, Echo Skill DMG Amplified, ignore DEF', condition: tog('After Echo Skill DMG'),
    mods: [{ key: 'dmgSkill', value: v(2) }, { key: 'defIgnore', value: v(4) }] },
  { id: 'w.lethean.amp', text: 'After Echo Skill DMG: Echo Skill DMG Amplified', condition: tog('After Echo Skill DMG', true, 'w.lethean'), mods: [{ key: 'amplify', value: v(3) }], appliesTo: { dmgTypes: ['Echo'] } }],
  'Luminous Hymn': (v) => [{ id: 'w.hymn', text: 'Hitting Spectro Frazzle targets: Basic and Heavy Attack DMG per stack', condition: stk('Luminous Hymn stacks', v(3)), mods: [{ key: 'dmgBasic', value: v(1) }, { key: 'dmgHeavy', value: v(2) }] }],
  'Rime-Draped Sprouts': (v) => [{ id: 'w.rime', text: 'Each Resonance Skill on field: Basic Attack DMG per stack', condition: stk('Rime-Draped Sprouts stacks', v(2)), mods: [{ key: 'dmgBasic', value: v(1) }] }],
  'Stellar Symphony': (v) => [{ id: 'w.stellar', text: 'Healing Resonance Skill: team ATK', condition: tog('Cast a healing Resonance Skill'), mods: [{ key: 'atkPct', value: v(4) }] }],
  Stringmaster: (v) => [
    { id: 'w.string.atk', text: 'Resonance Skill DMG: ATK per stack', condition: stk('Stringmaster stacks', v(2)), mods: [{ key: 'atkPct', value: v(1) }] },
    { id: 'w.string.off', text: 'Off field: ATK', condition: tog('Wielder off the field', false), mods: [{ key: 'atkPct', value: v(4) }] },
  ],
  'Whispers of Sirens': (v) => [
    { id: 'w.sirens.basic', text: '1+ Gentle Dream: Basic Attack DMG', condition: tog('Gentle Dream ≥ 1'), mods: [{ key: 'dmgBasic', value: v(8) }] },
    { id: 'w.sirens.res', text: '2 Gentle Dream: ignore Havoc RES', condition: tog('Gentle Dream = 2'), mods: [{ key: 'resShred', value: v(10) }], appliesTo: { element: 'Havoc' } },
  ],
  Augment: (v) => [{ id: 'w.augment', text: 'After Resonance Liberation: ATK', condition: tog('After Resonance Liberation'), mods: [{ key: 'atkPct', value: v(0) }] }],
  'Call of the Abyss': (v) => [{ id: 'w.abyss', text: 'After Resonance Liberation: Healing Bonus', condition: tog('After Resonance Liberation'), mods: [{ key: 'healing', value: v(0) }] }],
  'Comet Flare': (v) => [{ id: 'w.comet', text: 'Basic / Heavy Attack hits: Healing Bonus per stack', condition: stk('Comet Flare stacks', v(1)), mods: [{ key: 'healing', value: v(0) }] }],
  'Fusion Accretion': gaze('w.accretion'),
  'Jinzhou Keeper': (v) => [{ id: 'w.jinzhou', text: 'After Intro Skill: ATK and HP', condition: tog('After Intro Skill'), mods: [{ key: 'atkPct', value: v(0) }, { key: 'hpPct', value: v(1) }] }],
  "Ocean's Gift": (v) => [{ id: 'w.ocean', text: 'Hitting Spectro Frazzle targets: Spectro DMG per stack', condition: stk("Ocean's Gift stacks", v(3)), mods: [{ key: 'dmgSpectro', value: v(0) }] }],
  'Radiant Dawn': (v) => [{ id: 'w.dawn', text: 'After Resonance Skill: ATK and Basic Attack DMG', condition: tog('After Resonance Skill'), mods: [{ key: 'atkPct', value: v(0) }, { key: 'dmgBasic', value: v(1) }] }],
  'Rectifier#25': (v) => [{ id: 'w.r25', text: 'Resonance Skill above 60% HP: ATK', condition: tog('HP above 60%'), mods: [{ key: 'atkPct', value: v(5) }] }],
  Variation: ceaseless,
  'Waltz in Masquerade': rhetoric('w.waltz'),

  // ---------------------------------------------------------------- Sword
  'Azure Oath': (v) => [{ id: 'w.azure', text: 'After Havoc Bane: Heavy Attack DMG Amplified and ignores DEF', condition: tog('Inflicted Havoc Bane'), mods: [{ key: 'amplify', value: v(1) }, { key: 'defIgnore', value: v(2) }], appliesTo: { dmgTypes: ['Heavy'] } }],
  'Blazing Brilliance': (v) => [{ id: 'w.brilliance', text: 'Searing Feather: Resonance Skill DMG per stack', condition: stk('Searing Feather stacks', v(5)), mods: [{ key: 'dmgSkill', value: v(4) }] }],
  "Bloodpact's Pledge": (v) => [
    { id: 'w.bloodpact.heal', text: 'After healing: Resonance Skill DMG', condition: tog('Provided healing'), mods: [{ key: 'dmgSkill', value: v(0) }] },
    { id: 'w.bloodpact.aero', text: 'Rover: Aero casts Unbound Flow: Aero DMG Amplified', condition: tog('Rover: Aero cast Unbound Flow', false), mods: [{ key: 'amplify', value: v(2) }], appliesTo: { element: 'Aero' } },
  ],
  "Defier's Thorn": (v) => [
    { id: 'w.defier.def', text: 'For 15s after Intro Skill or Basic Attack: ignores part of the target\'s DEF', condition: tog('After Intro / Basic Attack'), mods: [{ key: 'defIgnore', value: v(2) }] },
    { id: 'w.defier.erosion', text: 'Targets with Aero Erosion take Amplified DMG', condition: tog('Target has Aero Erosion'), mods: [{ key: 'amplify', value: v(4) }] },
  ],
  'Emerald Sentence': (v) => [
    { id: 'w.sentence.heavy', text: 'Bamboo Cleaver: Heavy Attack DMG per stack', condition: stk('Bamboo Cleaver stacks', v(4)), mods: [{ key: 'dmgHeavy', value: v(3) }] },
    { id: 'w.sentence.echo', text: 'After Intro Skill: team Echo Skill DMG', condition: tog('After Intro Skill'), mods: [{ key: 'dmgEcho', value: v(7) }] },
  ],
  'Emerald of Genesis': (v) => [{ id: 'w.genesis', text: 'Each Resonance Skill: ATK', condition: stk('Emerald of Genesis stacks', v(2)), mods: [{ key: 'atkPct', value: v(1) }] }],
  'Everbright Polestar': (v) => [{ id: 'w.polestar', text: 'After Tune Rupture - Shifting / Fusion Burst: Liberation ignores DEF and Fusion RES',
    condition: tog('Inflicted Tune Rupture - Shifting or Fusion Burst'), mods: [{ key: 'defIgnore', value: v(1) }, { key: 'resShred', value: v(2) }], appliesTo: { dmgTypes: ['Liberation'], element: 'Fusion' } }],
  Frostburn: (v) => [
    { id: 'w.frostburn.chafe', text: 'After applying Glacio Chafe: Glacio DMG is Amplified', condition: tog('Applied Glacio Chafe'), mods: [{ key: 'amplify', value: v(1) }], appliesTo: { element: 'Glacio' } },
    { id: 'w.frostburn.status', text: 'Wielder on the field: Glacio Chafe DMG Amplified', condition: tog('Wielder is the active Resonator'), mods: [{ key: 'amplify', value: v(3) }], appliesTo: { statuses: ['Glacio Chafe'] } },
    { id: 'w.frostburn.lib', text: "After applying Glacio Chafe: Resonance Liberation DMG ignores part of the target's DEF", condition: tog('Applied Glacio Chafe', true, 'w.frostburn.chafe'), mods: [{ key: 'defIgnore', value: v(2) }], appliesTo: { dmgTypes: ['Liberation'] } },
  ],
  'Glint of Clouds': (v) => [
    { id: 'w.glint.aero', text: 'Inflicting Tune Strain - Shifting: Aero DMG Bonus per stack', condition: stk('Glint of Clouds stacks', v(3)), mods: [{ key: 'dmgAero', value: v(1) }] },
    { id: 'w.glint.def', text: "At 5 stacks: Aero DMG ignores part of the target's DEF", condition: tog('Glint of Clouds at 5 stacks'), mods: [{ key: 'defIgnore', value: v(6) }], appliesTo: { element: 'Aero' } },
  ],
  'Laser Shearer': (v) => [{ id: 'w.laser', text: 'Hitting Tune Strain - Interfered targets: Resonance Skill DMG', condition: tog('Target has Tune Strain - Interfered'), mods: [{ key: 'dmgSkill', value: v(1) }] }],
  'Red Spring': (v) => [
    { id: 'w.redspring.stack', text: 'Basic Attack DMG: Basic Attack DMG per stack', condition: stk('Red Spring stacks', v(3)), mods: [{ key: 'dmgBasic', value: v(1) }] },
    { id: 'w.redspring.concerto', text: 'Concerto Energy consumed: Basic Attack DMG', condition: tog('Consumed Concerto Energy'), mods: [{ key: 'dmgBasic', value: v(4) }] },
  ],
  'Unflickering Valor': (v) => [
    { id: 'w.valor.lib', text: 'After Resonance Liberation: Basic Attack DMG', condition: tog('After Resonance Liberation'), mods: [{ key: 'dmgBasic', value: v(1) }] },
    { id: 'w.valor.basic', text: 'After Basic Attack DMG: Basic Attack DMG', condition: tog('After Basic Attack DMG'), mods: [{ key: 'dmgBasic', value: v(3) }] },
  ],
  'Unspoken Rue': (v) => [
    { id: 'w.rue.unison', text: 'Gaining Unison: Electro DMG', condition: tog('Gained Unison'), mods: [{ key: 'dmgElectro', value: v(1) }] },
    { id: 'w.rue.binding', text: 'Binding Mind: team Electro DMG', condition: tog('Binding Mind'), mods: [{ key: 'dmgElectro', value: v(3) }] },
    { id: 'w.rue.yearning', text: 'Yearning Mind (replaces Binding Mind): Electro DMG', condition: tog('Yearning Mind', false), mods: [{ key: 'dmgElectro', value: v(6) }] },
  ],
  'Commando of Conviction': (v) => [{ id: 'w.commando', text: 'After Intro Skill: ATK', condition: tog('After Intro Skill'), mods: [{ key: 'atkPct', value: v(0) }] }],
  'Endless Collapse': gaze('w.collapse'),
  'Fables of Wisdom': rhetoric('w.fables'),
  'Feather Edge': tideLib('w.feather'),
  Lumingloss: (v) => [{ id: 'w.lumingloss', text: 'After Resonance Skill: Basic and Heavy Attack DMG', condition: tog('After Resonance Skill'), mods: [{ key: 'dmgBasic', value: v(0) }, { key: 'dmgHeavy', value: v(0) }] }],
  'Lunar Cutter': (v) => [{ id: 'w.lunar', text: 'Oath: ATK per stack', condition: stk('Oath stacks', v(2)), mods: [{ key: 'atkPct', value: v(1) }] }],
  Overture: ceaseless,
  'Somnoire Anchor': (v) => [
    { id: 'w.somnoire.atk', text: 'Hiss: ATK per stack', condition: stk('Hiss stacks', v(5)), mods: [{ key: 'atkPct', value: v(3) }] },
    { id: 'w.somnoire.cr', text: '10 Hiss: Crit. Rate', condition: tog('Hiss at 10 stacks'), mods: [{ key: 'critRate', value: v(7) }] },
  ],
  'Sword#18': (v) => [{ id: 'w.s18', text: 'HP below 40%: Heavy Attack DMG', condition: tog('HP below 40%', false), mods: [{ key: 'dmgHeavy', value: v(1) }] }],
};

/** Unconditional first sentence ("ATK is increased by 12%."). */
const STATIC_FIRST: [RegExp, Effect['mods'][number]['key']][] = [
  [/^(?:ATK is increased by|ATK increased by|Increases? ATK by) ([\d.]+)%/, 'atkPct'],
  [/^(?:Max HP is increased by|HP is increased by|Increases Max HP by|Increase HP by) ([\d.]+)%/, 'hpPct'],
  [/^(?:DEF is increased by|Increases DEF by) ([\d.]+)%/, 'defPct'],
  [/^(?:Crit\. Rate is increased by|Increase Crit\. Rate by) ([\d.]+)%/, 'critRate'],
  [/^Crit\. DMG is increased by ([\d.]+)%/, 'critDmg'],
  [/^(?:Energy Regen is increased by|Increases Energy Regen by) ([\d.]+)%/, 'energyRegen'],
  // "Attribute DMG Bonus" = every element, i.e. all of this Resonator's damage
  [/^(?:Grants|Gain) ([\d.]+)% (?:All-)?Attribute DMG Bonus/, 'dmgAll'],
  [/^Increases (?:All-)?Attribute DMG Bonus by ([\d.]+)%/, 'dmgAll'],
];

const NUM = /\d+(?:\.\d+)?/g;
const plain = (s: string) => s.replace(/\[\/?c[^\]]*\]/g, '');

export function weaponEffects(w: Weapon, rank: number): Effect[] {
  const text = plain(w.passive.descriptions[rank - 1] ?? w.passive.descriptions[0]);
  const source = `${w.name} R${rank}`;
  const out: Effect[] = [];
  for (const [re, key] of STATIC_FIRST) {
    const m = text.match(re);
    if (m) {
      out.push({ id: `w.${w.id}.static`, group: 'weapon', source, text: m[0], mods: [{ key, value: Number(m[1]) }] });
      break;
    }
  }
  const nums = (text.match(NUM) ?? []).map(Number);
  const v: V = (i) => nums[i] ?? 0;
  for (const d of PASSIVES[w.name]?.(v) ?? []) out.push({ ...d, group: 'weapon', source: d.source ? `${d.source} R${rank}` : source });
  return out;
}

/** Weapons whose whole passive is written out (the rest only get the first sentence). */
export const HAS_WEAPON_DEFINITIONS = Object.keys(PASSIVES);
