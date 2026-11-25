import type { SkillKind } from '../../data/types';
import type { Effect } from '../types';

/**
 * Resonator kit effects: inherent skills, forte passives and sequences (S1..S6).
 * `seq` = sequence node that unlocks the effect (0 = always available).
 * Effects with `team: true` are what this character gives to others when slotted as a teammate (Phase 3).
 *
 * Effects that only touch special damage types not modelled yet (Glacio Bite, Aero Erosion DMG,
 * Juque Perdition, Core of Collapse…) are left out for now and listed in NOT_MODELLED.
 */
export interface KitEffect extends Effect { seq: number; maxSeq?: number; team?: boolean }

const mindlockBonus = Array.from({ length: 26 }, (_, n) => 2 * n + 5 * Math.min(n, 7));
const aeroErosionTaken = [0, 30, 30, 30, 40, 50, 60];
// Blade of Howling Squall Amplifies its own DMG by 20% per Aero Erosion stack, up to 5. At S6 it keeps the stacks
// and still gets the full bonus (confirmed in game).
const bladeAmplify = [0, 20, 40, 60, 80, 100];


// Resonance Modes: one picker per Resonator, stored in build.conditions under the key (0 = first option)
const mode = (key: string, label: string, options: string[]) => (is: number) => ({ key, label, options, is });
const hsinMode = mode('c.hsin.mode', 'Resonance Mode', ['Electro Flare', 'Unison']);
export const HSIN_FLARE = hsinMode(0), HSIN_UNI = hsinMode(1);
const lucMode = mode('c.luc.mode', 'Resonance Mode', ['Glacio Chafe', 'Echo']);
export const LUC_CHAFE = lucMode(0), LUC_ECHO = lucMode(1);
const suoMode = mode('c.suo.seal', 'Outro set-up', ['Aligned Seals (buff the next Resonator)', 'Seal Master (Suoming stays on field)']);
export const SUO_ALIGNED = suoMode(0), SUO_MASTER = suoMode(1);

const SUISUI_BURST = { rows: /^(Awakening Spring|Skill) DMG$/, skillKinds: ['Skill', 'Intro'] as SkillKind[], label: 'Awakening Spring and Intro Skill - Tinkling Jade' };
const CIA_DOWNBEAT = { rows: /^Quadruple Downbeat DMG$/, label: 'Heavy Attack - Quadruple Downbeat' };

export const KITS: Record<string, KitEffect[]> = {
  Hiyuki: [
    { seq: 3, id: 'c.hiyuki.finesnow1', group: 'self', source: 'Inherent · Fine Snow', text: '1+ Snow Rust (auto at S3): Crit. DMG +40%', mods: [{ key: 'critDmg', value: 40 }] },
    { seq: 0, maxSeq: 2, id: 'c.hiyuki.finesnow1t', group: 'self', source: 'Inherent · Fine Snow', text: '1+ Snow Rust: Crit. DMG +40%',
      condition: { kind: 'toggle', label: 'Snow Rust ≥ 1', default: true }, mods: [{ key: 'critDmg', value: 40 }] },
    { seq: 6, id: 'c.hiyuki.s6cd', group: 'sequence', source: 'S6 · Into a Night Without End', text: '2+ Snow Rust: Crit. DMG +40%',
      condition: { kind: 'toggle', label: 'Snow Rust ≥ 2', default: true }, mods: [{ key: 'critDmg', value: 40 }] },
    { seq: 1, id: 'c.hiyuki.s1', group: 'sequence', source: 'S1 · Springless', text: 'Foreclaimed Self Basic / Heavy / Mid-air / Dodge multipliers +120%',
      mods: [{ key: 'multBonus', value: 120 }],
      appliesTo: { rows: /^(Basic Attack|Mid-air Attack) - Foreclaimed Self Stage \d DMG$|^(Heavy Attack|Dodge Counter) - Foreclaimed Self DMG$/, label: 'Foreclaimed Self Basic / Heavy / Mid-air / Dodge Counter' } },
    { seq: 2, id: 'c.hiyuki.s2', group: 'sequence', source: 'S2 · To Burn Cold in Silence', text: 'Basic Attack - Iai multiplier +125%',
      mods: [{ key: 'multBonus', value: 125 }], appliesTo: { rows: /^Basic Attack - Iai DMG$/, label: 'Basic Attack - Iai' } },
    { seq: 3, id: 'c.hiyuki.s3', group: 'sequence', source: 'S3 · No Self, No Bound', text: 'Frost Splinter / Bitterfrost multipliers +160%',
      mods: [{ key: 'multBonus', value: 160 }], appliesTo: { rows: /^Heavy Attack - (Frost Splinter: Present Self|Bitterfrost: Foreclaimed Self) DMG$/, label: 'Frost Splinter and Bitterfrost' } },
    { seq: 4, team: true, id: 'c.hiyuki.s4', group: 'sequence', source: 'S4 · Like Reeds on Tides', text: 'After Resonance Skill: team DMG +20%',
      condition: { kind: 'toggle', label: 'After Resonance Skill', default: true }, mods: [{ key: 'dmgAll', value: 20 }] },
    { seq: 5, id: 'c.hiyuki.s5', group: 'sequence', source: 'S5 · Vessel of Thousand Wishes', text: 'Resonance Skill multipliers +80%',
      mods: [{ key: 'multBonus', value: 80 }], appliesTo: { skillKinds: ['Skill'] } },
    { seq: 6, id: 'c.hiyuki.s6', group: 'sequence', source: 'S6 · Into a Night Without End', text: 'Inward Vision / Blade Liberation Crit. DMG +500%',
      mods: [{ key: 'critDmg', value: 500 }], appliesTo: { rows: /^Foreclaiming: (Inward Vision|Blade Liberation)/, label: 'Inward Vision and Blade Liberation' } },
  ],

  Cartethyia: [
    { seq: 0, id: 'c.carte.imprint', group: 'self', source: "Inherent · Wind's Indelible Imprint", text: 'Target takes 30% more DMG at 1–3 Aero Erosion stacks, +10% per stack from 4 to 6',
      condition: { kind: 'stacks', label: 'Aero Erosion stacks', max: 6, default: 'max' }, mods: [{ key: 'amplify', value: 0, byStacks: aeroErosionTaken }] },
    { seq: 0, id: 'c.carte.blade', group: 'self', source: 'Liberation · Blade of Howling Squall', text: 'Blade of Howling Squall: +20% Amplified DMG per Aero Erosion stack on the target (max 5)',
      condition: { kind: 'stacks', label: 'Aero Erosion stacks', max: 6, default: 'max', key: 'c.carte.imprint' },
      mods: [{ key: 'amplify', value: 0, byStacks: bladeAmplify }], appliesTo: { rows: /^Blade of Howling Squall/, label: 'Blade of Howling Squall' } },
    { seq: 1, id: 'c.carte.s1', group: 'sequence', source: 'S1 · Crown Destined by Fate', text: 'Fleurdelys Crit. DMG +25% per Conviction milestone',
      condition: { kind: 'stacks', label: 'Conviction milestones', max: 4, default: 'max' }, mods: [{ key: 'critDmg', value: 25 }], appliesTo: { skillKinds: ['Forte'] } },
    { seq: 2, id: 'c.carte.s2max', group: 'sequence', source: 'S2 · Blade Broken by Tempest', text: 'Affects nearby targets',
      condition: { kind: 'toggle', label: 'After A Knight\'s Heartfelt Prayers', default: true }, mods: [],
      raisesMax: { key: 'c.carte.imprint', by: 3, exclusive: 'negativeStatusMax' } },
    { seq: 2, id: 'c.carte.s2', group: 'sequence', source: 'S2 · Blade Broken by Tempest', text: 'Basic / Heavy / Dodge multipliers +50%',
      mods: [{ key: 'multBonus', value: 50 }], appliesTo: { skillKinds: ['Normal'], rows: /^(Stage \d|Dodge Counter|Heavy Attack) DMG$/, label: 'Cartethyia\'s Basic / Heavy / Dodge Counter' } },
    { seq: 2, id: 'c.carte.s2b', group: 'sequence', source: 'S2 · Blade Broken by Tempest', text: 'Mid-air Attack multiplier +200%',
      mods: [{ key: 'multBonus', value: 200 }], appliesTo: { skillKinds: ['Normal'], rows: /^Mid-air Attack/, label: 'Cartethyia\'s Mid-air Attack' } },
    { seq: 2, id: 'c.carte.s2c', group: 'sequence', source: 'S2 · Blade Broken by Tempest', text: 'Intro Skill multiplier +50%',
      mods: [{ key: 'multBonus', value: 50 }], appliesTo: { skillKinds: ['Intro'] } },
    { seq: 3, id: 'c.carte.s3', group: 'sequence', source: 'S3 · Prisoner Hanged in the Tower', text: 'Blade of Howling Squall multiplier +100%',
      mods: [{ key: 'multBonus', value: 100 }], appliesTo: { rows: /^Blade of Howling Squall/, label: 'Blade of Howling Squall' } },
    { seq: 4, team: true, id: 'c.carte.s4', group: 'sequence', source: 'S4 · Sacrifice Made for Salvation', text: 'After a Negative Status: team All-Attribute DMG +20%',
      condition: { kind: 'toggle', label: 'Team inflicted a Negative Status', default: true }, mods: [{ key: 'dmgAll', value: 20 }] },
    { seq: 6, id: 'c.carte.s6', group: 'sequence', source: "S6 · Freedom Found in Storm's Wake", text: 'Targets take 40% more DMG from Fleurdelys',
      mods: [{ key: 'amplify', value: 40 }], appliesTo: { skillKinds: ['Forte', 'Liberation'] } },
  ],

  Qingxiao: [
    { seq: 0, id: 'c.qing.mindlock', group: 'self', source: 'Inherent · To Know, To Banish', text: '2% more DMG per Mindlock stack (+5% each for the first 7)',
      condition: { kind: 'stacks', label: 'Mindlock stacks', max: 15, default: 'max' }, mods: [{ key: 'amplify', value: 0, byStacks: mindlockBonus }],
      appliesTo: { rows: /^Heavy Attack - Stringblade DMG$|Ephemeral Transcendence/, label: 'Heavy Attack - Stringblade and Ephemeral Transcendence hits' } },
    { seq: 0, id: 'c.qing.mindlock.lib', group: 'self', source: 'Inherent · To Know, To Banish', text: 'Billows Beneath Heaven: 2% more DMG per Mindlock stack (+5% first 7)',
      condition: { kind: 'stacks', label: 'Mindlock stacks', max: 15, default: 'max', key: 'c.qing.mindlock' }, mods: [{ key: 'amplify', value: 0, byStacks: mindlockBonus }],
      appliesTo: { skillKinds: ['Liberation'] } },
    { seq: 1, id: 'c.qing.s1', group: 'sequence', source: 'S1 · Like Clouds That Meet and Drift Apart', text: 'Crit. Rate +16%', mods: [{ key: 'critRate', value: 16 }] },
    { seq: 2, id: 'c.qing.s2max', group: 'sequence', source: 'S2 · Like Petals That Fall Without a Sound', text: 'Mindlock stack limit 15 → 25',
      mods: [], raisesMax: { key: 'c.qing.mindlock', to: 25 } },
    { seq: 2, id: 'c.qing.s2', group: 'sequence', source: 'S2 · Like Petals That Fall Without a Sound', text: 'Heavy Attack - Stringblade multiplier +40%',
      mods: [{ key: 'multBonus', value: 40 }], appliesTo: { rows: /^Heavy Attack - Stringblade DMG$/, label: 'Heavy Attack - Stringblade' } },
    { seq: 3, id: 'c.qing.s3', group: 'sequence', source: 'S3 · Dreams Fade, Sword Abides', text: 'Billows Beneath Heaven Crit. DMG +100%',
      mods: [{ key: 'critDmg', value: 100 }], appliesTo: { skillKinds: ['Liberation'] } },
    { seq: 3, id: 'c.qing.s3b', group: 'sequence', source: 'S3 · World in Chorus', text: "Heaven's Reckoning multiplier +3% per stack",
      condition: { kind: 'stacks', label: 'World in Chorus stacks', max: 25, default: 'max' }, mods: [{ key: 'multBonus', value: 3 }],
      appliesTo: { rows: /^Heaven's Reckoning/, label: 'Heaven\'s Reckoning' } },
    { seq: 4, team: true, id: 'c.qing.s4', group: 'sequence', source: 'S4 · Wherever the Road Leads, Side by Side', text: 'After Tune Strain - Shifting: ATK +20%',
      condition: { kind: 'toggle', label: 'Inflicted Tune Strain - Shifting', default: true }, mods: [{ key: 'atkPct', value: 20 }] },
    { seq: 5, id: 'c.qing.s5', group: 'sequence', source: 'S5 · Cold Steel That Longs to Warm the Snow', text: 'Severing Note: Judgement multiplier +100%',
      mods: [{ key: 'multBonus', value: 100 }], appliesTo: { rows: /^Severing Note: Judgement/, label: 'Severing Note: Judgement' } },
    { seq: 6, id: 'c.qing.s6', group: 'sequence', source: 'S6 · Cleanse This Tarnished Age', text: 'Stringblade / Heaven\'s Reckoning / Billows: targets take 40% more DMG',
      mods: [{ key: 'amplify', value: 40 }], appliesTo: { rows: /^Heavy Attack - Stringblade DMG$|^Heaven's Reckoning|^Skill DMG$/, skillKinds: ['Normal', 'Forte', 'Liberation'], label: 'Stringblade, Heaven\'s Reckoning and Billows Beneath Heaven' } },
  ],

  Chisa: [
    { seq: 0, id: 'c.chisa.thread', group: 'self', source: 'Forte · Thread of Bane', text: 'Targets with Unseen Snare: ignore 18% DEF',
      condition: { kind: 'toggle', label: 'Target has Unseen Snare', default: true }, mods: [{ key: 'defIgnore', value: 18 }] },
    { seq: 0, id: 'c.chisa.allends', group: 'self', source: 'Inherent · All Ends Here', text: 'After Intro / Liberation: Havoc DMG +20%',
      condition: { kind: 'toggle', label: 'After Intro / Liberation', default: true }, mods: [{ key: 'dmgHavoc', value: 20 }] },
    { seq: 1, id: 'c.chisa.s1', group: 'sequence', source: 'S1 · Wandering Through the Desolate Corridors', text: 'Inflicting Unseen Snare: ATK +30%',
      condition: { kind: 'toggle', label: 'Inflicted Unseen Snare', default: true }, mods: [{ key: 'atkPct', value: 30 }] },
    { seq: 2, id: 'c.chisa.s2', group: 'sequence', source: 'S2 · Into the Web of Endless Bonds', text: 'Ignore 10% Havoc RES', mods: [{ key: 'resShred', value: 10 }], appliesTo: { element: 'Havoc' } },
    { seq: 2, team: true, id: 'c.chisa.s2b', group: 'sequence', source: 'S2 · Into the Web of Endless Bonds', text: 'Thread of Bane: All-Attribute DMG +50%',
      condition: { kind: 'toggle', label: 'Has Thread of Bane', default: true }, mods: [{ key: 'dmgAll', value: 50 }] },
    { seq: 3, id: 'c.chisa.s3', group: 'sequence', source: 'S3 · Across the Confusion of the Long Night', text: 'Sawring - Blitz / Chainsaw Dodge Counter / Eradication multipliers +120%',
      mods: [{ key: 'multBonus', value: 120 }], appliesTo: { rows: /^Sawring|^Chainsaw Mode - Dodge Counter/, label: 'Sawring - Blitz and Chainsaw Dodge Counter' } },
    { seq: 5, id: 'c.chisa.s5', group: 'sequence', source: 'S5 · Thousands of Lights to Guide the Way Home', text: 'Moment of Nihility DMG Bonus +100%',
      mods: [{ key: 'dmgLib', value: 100 }], appliesTo: { skillKinds: ['Liberation'] } },
    { seq: 6, id: 'c.chisa.s6', group: 'sequence', source: 'S6 · Thus, Hope is Rekindled', text: 'Targets with Unseen Snare - Finality take 40% more DMG from Chisa',
      condition: { kind: 'toggle', label: 'Target has Unseen Snare', default: true }, mods: [{ key: 'amplify', value: 40 }] },
  ],

  // ---------------------------------------------------------------- modelled from the game text, not yet checked in game
  Hsin: [
    { seq: 0, id: 'c.hsin.tides.flare', group: 'self', mode: HSIN_FLARE, source: 'Inherent · Tides of Succession', text: 'Each Resonator that inflicts Electro Flare: Electro DMG +25% (max 2)',
      condition: { kind: 'stacks', label: 'Resonators that inflicted Electro Flare', max: 2, default: 'max' }, mods: [{ key: 'dmgElectro', value: 25 }] },
    { seq: 0, id: 'c.hsin.tides.rover', group: 'self', mode: HSIN_FLARE, source: 'Inherent · Tides of Succession', text: 'Rover: Electro in the team casts Intro Skill - Thunderous Fury: Electro DMG +20%',
      condition: { kind: 'toggle', label: 'Rover: Electro cast Thunderous Fury', default: false }, mods: [{ key: 'dmgElectro', value: 20 }] },
    { seq: 0, id: 'c.hsin.tides.uni', group: 'self', mode: HSIN_UNI, source: 'Inherent · Tides of Succession', text: 'After Intro Skill - Manifold Unison: ATK +50%',
      condition: { kind: 'toggle', label: 'After Manifold Unison Intro', default: true }, mods: [{ key: 'atkPct', value: 50 }] },
    { seq: 0, id: 'c.hsin.boon', group: 'self', mode: HSIN_UNI, source: 'Resonance Mode - Unison · Unison Boon', text: 'Each Unison Boon stack: +3% total DMG',
      condition: { kind: 'stacks', label: 'Unison Boon stacks', max: 2, default: 'max' }, mods: [{ key: 'amplify', value: 3 }] },
    { seq: 0, id: 'c.hsin.joys', group: 'self', mode: HSIN_UNI, source: 'Inherent · Gleaning Simple Joys', text: 'Unison Boon limit +1', mods: [], raisesMax: { key: 'c.hsin.boon', by: 1 } },
    { seq: 1, id: 'c.hsin.s1', group: 'sequence', mode: HSIN_UNI, source: 'S1 · A Boat to Cross the Rising Tide', text: 'Manifold Unison Intro multipliers +15%',
      mods: [{ key: 'multBonus', value: 15 }], appliesTo: { rows: /Manifold Unison DMG$/, label: 'Intro Skill - Manifold Unison' } },
    { seq: 1, id: 'c.hsin.s1boon', group: 'sequence', mode: HSIN_UNI, source: 'S1 · A Boat to Cross the Rising Tide', text: 'Manifold Unison Intro multipliers +10% per Unison Boon (max 4)',
      condition: { kind: 'stacks', label: 'Unison Boon stacks', max: 2, default: 'max', key: 'c.hsin.boon' }, mods: [{ key: 'multBonus', value: 10 }],
      appliesTo: { rows: /Manifold Unison DMG$/, label: 'Intro Skill - Manifold Unison' } },
    { seq: 2, id: 'c.hsin.s2', group: 'sequence', source: 'S2 · To Wake Is to Wonder What I Am', text: 'Realm Wanderer / Protector and Beholding / Stilling All Horizons multipliers +60%',
      mods: [{ key: 'multBonus', value: 60 }], appliesTo: { rows: /^Heavy Attack - (Answering Form: Realm (Wanderer|Protector)|Illumining Form: (Beholding|Stilling) All Horizons) DMG$/, label: 'Forte Heavy Attacks' } },
    { seq: 3, id: 'c.hsin.s3', group: 'sequence', source: 'S3 · A Dream of Return Among the Hills', text: 'Pillars Across Heaven multiplier +70%',
      mods: [{ key: 'multBonus', value: 70 }], appliesTo: { rows: /^Pillars Across Heaven DMG$/, label: 'Pillars Across Heaven' } },
    { seq: 3, id: 'c.hsin.s3uni', group: 'sequence', mode: HSIN_UNI, source: 'S3 · A Dream of Return Among the Hills', text: 'Pillars Across Heaven Crit. DMG +20%',
      mods: [{ key: 'critDmg', value: 20 }], appliesTo: { rows: /^Pillars Across Heaven DMG$/, label: 'Pillars Across Heaven' } },
    { seq: 3, id: 'c.hsin.s3boon', group: 'sequence', mode: HSIN_UNI, source: 'S3 · A Dream of Return Among the Hills', text: 'Pillars Across Heaven Crit. DMG +15% per Unison Boon (max 4)',
      condition: { kind: 'stacks', label: 'Unison Boon stacks', max: 2, default: 'max', key: 'c.hsin.boon' }, mods: [{ key: 'critDmg', value: 15 }],
      appliesTo: { rows: /^Pillars Across Heaven DMG$/, label: 'Pillars Across Heaven' } },
    { seq: 4, team: true, id: 'c.hsin.s4', group: 'sequence', source: 'S4 · A River of Lanterns, a River of Wishes', text: 'Team inflicts Electro Flare / gains Unison: team All-Attribute DMG +20%',
      condition: { kind: 'toggle', label: 'Electro Flare inflicted or Unison gained', default: true }, mods: [{ key: 'dmgAll', value: 20 }] },
    { seq: 6, id: 'c.hsin.s6', group: 'sequence', source: 'S6 · The Moon Owes Its Light to the Living', text: 'Targets take 40% more Resonance Skill DMG from Hsin; it ignores 20% DEF',
      mods: [{ key: 'amplify', value: 40 }, { key: 'defIgnore', value: 20 }], appliesTo: { dmgTypes: ['Skill'] } },
    { seq: 6, id: 'c.hsin.s6uni', group: 'sequence', mode: HSIN_UNI, source: 'S6 · The Moon Owes Its Light to the Living', text: 'Unison Boon limit +1', mods: [], raisesMax: { key: 'c.hsin.boon', by: 1 } },
  ],

  Suisui: [
    { seq: 0, id: 'c.sui.sky', group: 'self', source: 'Inherent · Sky Over Water', text: 'Awakening Spring / Tinkling Jade: Crit. Rate +80%, Glacio DMG +240% (once every 25s)',
      condition: { kind: 'toggle', label: 'Sky Over Water ready', default: true }, mods: [{ key: 'critRate', value: 80 }, { key: 'dmgGlacio', value: 240 }], appliesTo: SUISUI_BURST },
    { seq: 2, id: 'c.sui.s2', group: 'sequence', source: 'S2 · Clouds Pour Like Molten Gold', text: 'After a Negative Status inside Ceaseless Landscape: Crit. DMG +50%',
      condition: { kind: 'toggle', label: 'Inflicted a Negative Status in Ceaseless Landscape', default: true }, mods: [{ key: 'critDmg', value: 50 }] },
    { seq: 5, id: 'c.sui.s5', group: 'sequence', source: 'S5 · I Long To Ride The Eastern Wind', text: 'Drizzle Stance Basic / Heavy Attack multipliers +100%',
      mods: [{ key: 'multBonus', value: 100 }], appliesTo: { rows: /^(Basic Attack - Drizzle Stance Stage \d DMG|Heavy Attack - Drizzle Stance)$/, label: 'Drizzle Stance Basic and Heavy Attacks' } },
    { seq: 6, id: 'c.sui.s6', group: 'sequence', source: 'S6 · Staying True To This Splendid Realm', text: 'Awakening Spring / Tinkling Jade Crit. DMG +500%',
      mods: [{ key: 'critDmg', value: 500 }], appliesTo: SUISUI_BURST },
  ],

  Lucilla: [
    { seq: 0, id: 'c.luc.clear', group: 'self', mode: LUC_CHAFE, source: 'Liberation · Clear As Day', text: 'After Clear As Day: Basic Attack DMG +30%',
      condition: { kind: 'toggle', label: 'After Clear As Day', default: true }, mods: [{ key: 'dmgBasic', value: 30 }] },
    { seq: 0, id: 'c.luc.clear.echo', group: 'self', mode: LUC_ECHO, source: 'Liberation · Clear As Day', text: 'After Clear As Day: Echo Skill DMG +30%',
      condition: { kind: 'toggle', label: 'After Clear As Day', default: true, key: 'c.luc.clear' }, mods: [{ key: 'dmgEcho', value: 30 }] },
    { seq: 0, id: 'c.luc.slow', group: 'self', mode: LUC_CHAFE, source: 'Inherent · Slow Motion', text: 'After Spotlight: Glacio RES of nearby targets −8%',
      condition: { kind: 'toggle', label: 'After Spotlight', default: true }, mods: [{ key: 'resShred', value: 8 }], appliesTo: { element: 'Glacio' } },
    { seq: 0, team: true, id: 'c.luc.slow.echo', group: 'self', mode: LUC_ECHO, source: 'Inherent · Slow Motion', text: 'After Spotlight: team Echo Skill DMG +25%',
      condition: { kind: 'toggle', label: 'After Spotlight', default: true, key: 'c.luc.slow' }, mods: [{ key: 'dmgEcho', value: 25 }] },
    { seq: 1, id: 'c.luc.s1', group: 'sequence', source: 'S1 · Distant Noon', text: 'After Spotlight: Crit. Rate +20%',
      condition: { kind: 'toggle', label: 'After Spotlight', default: true, key: 'c.luc.slow' }, mods: [{ key: 'critRate', value: 20 }] },
    { seq: 2, team: true, id: 'c.luc.s2', group: 'sequence', mode: LUC_ECHO, source: 'S2 · Slumbering Moonlight', text: 'During Reminiscence (and 30s after): team Echo Skill DMG +40%',
      condition: { kind: 'toggle', label: 'Reminiscence active', default: true }, mods: [{ key: 'dmgEcho', value: 40 }] },
    { seq: 3, id: 'c.luc.s3', group: 'sequence', source: 'S3 · Days Fade Unheard', text: 'Letting It Go multiplier +100%',
      mods: [{ key: 'multBonus', value: 100 }], appliesTo: { rows: /^Letting It Go DMG$/, label: 'Letting It Go' } },
    { seq: 4, id: 'c.luc.s4', group: 'sequence', source: 'S4 · The Past Fades Into Silence', text: 'Each Oblivion: ATK +10% (max 3)',
      condition: { kind: 'stacks', label: 'Oblivion stacks', max: 3, default: 'max' }, mods: [{ key: 'atkPct', value: 10 }] },
    { seq: 5, id: 'c.luc.s5', group: 'sequence', source: 'S5 · Time is Like a Stream', text: 'Oblivion multiplier +50%',
      mods: [{ key: 'multBonus', value: 50 }], appliesTo: { rows: /^Oblivion DMG$/, label: 'Oblivion' } },
    { seq: 6, id: 'c.luc.s6', group: 'sequence', source: 'S6 · Gazing In the Mist of Time', text: 'Each Remembrance stack: Letting It Go deals 200% more DMG (max 3)',
      condition: { kind: 'stacks', label: 'Remembrance stacks', max: 3, default: 'max' }, mods: [{ key: 'amplify', value: 200 }], appliesTo: { rows: /^Letting It Go DMG$/, label: 'Letting It Go' } },
  ],

  Ciaccona: [
    { seq: 0, team: true, id: 'c.cia.solo', group: 'self', source: 'Basic Attack · Solo Concert', text: 'During Solo Concert: team Aero DMG +24%',
      condition: { kind: 'toggle', label: 'Solo Concert active', default: true }, mods: [{ key: 'dmgAero', value: 24 }] },
    { seq: 0, id: 'c.cia.rinascita', group: 'self', source: 'Inherent · Winds of Rinascita', text: 'Quadruple Downbeat DMG +30%',
      mods: [{ key: 'dmgAll', value: 30 }], appliesTo: CIA_DOWNBEAT },
    { seq: 1, id: 'c.cia.s1', group: 'sequence', source: 'S1 · Where Wind Sings', text: 'After a Basic Attack: ATK +35%',
      condition: { kind: 'toggle', label: 'After a Basic Attack', default: true }, mods: [{ key: 'atkPct', value: 35 }] },
    { seq: 2, team: true, id: 'c.cia.s2', group: 'sequence', source: 'S2 · Song of the Four Seasons', text: "During Singer's Triple Cadenza: team Aero DMG +40%",
      condition: { kind: 'toggle', label: "During Singer's Triple Cadenza", default: true }, mods: [{ key: 'dmgAero', value: 40 }] },
    { seq: 4, id: 'c.cia.s4', group: 'sequence', source: 'S4 · Toccata and Fugue', text: 'Quadruple Downbeat ignores 45% DEF',
      mods: [{ key: 'defIgnore', value: 45 }], appliesTo: CIA_DOWNBEAT },
    { seq: 4, id: 'c.cia.s4lib', group: 'sequence', source: 'S4 · Toccata and Fugue', text: 'Resonance Liberation DMG ignores 45% DEF',
      mods: [{ key: 'defIgnore', value: 45 }], appliesTo: { dmgTypes: ['Liberation'] } },
    { seq: 5, id: 'c.cia.s5', group: 'sequence', source: 'S5 · Eternal Idyll to Lasting Summer', text: 'Resonance Liberation DMG +40%', mods: [{ key: 'dmgLib', value: 40 }] },
  ],

  'Rover: Electro': [
    { seq: 0, team: true, id: 'c.rove.overshock', group: 'self', source: 'Forte · Overshock', text: 'Overshock (tapped): team ATK +10%',
      condition: { kind: 'toggle', label: 'Tapped Overshock', default: true }, mods: [{ key: 'atkPct', value: 10 }] },
    { seq: 0, id: 'c.rove.regression', group: 'self', source: 'Inherent · Regression', text: 'Overshock (held): Resonance Skill DMG +20%',
      condition: { kind: 'toggle', label: 'Held Overshock (Apex Resonance)', default: true }, mods: [{ key: 'dmgSkill', value: 20 }] },
    { seq: 3, id: 'c.rove.s3', group: 'sequence', source: 'S3 · Alchemy of Wonders', text: 'Overshock multiplier +20%',
      mods: [{ key: 'multBonus', value: 20 }], appliesTo: { rows: /^Overshock DMG$/, label: 'Overshock' } },
    { seq: 4, id: 'c.rove.s4', group: 'sequence', source: 'S4 · Earthquaking Rumble', text: 'Ultimate Tactics multiplier +20%',
      mods: [{ key: 'multBonus', value: 20 }], appliesTo: { skillKinds: ['Liberation'] } },
    { seq: 5, id: 'c.rove.s5', group: 'sequence', source: 'S5 · Principle of Change', text: 'In Apex Resonance: Crit. DMG +20%',
      condition: { kind: 'toggle', label: 'Held Overshock (Apex Resonance)', default: true, key: 'c.rove.regression' }, mods: [{ key: 'critDmg', value: 20 }] },
    { seq: 6, id: 'c.rove.s6', group: 'sequence', source: "S6 · Mind's Depths in a Casket", text: 'Thrum of All Sounds / Thunder Bane multipliers +20%',
      mods: [{ key: 'multBonus', value: 20 }], appliesTo: { rows: /^(Thrum of All Sounds|Thunder Bane)/, label: 'Thrum of All Sounds and Thunder Bane' } },
  ],

  Lily: [
    { seq: 0, id: 'c.lily.er', group: 'self', source: 'Forte · Eternal Bloom / Fairytale\'s Finale', text: 'Crit. Rate and Crit. DMG from Energy Regen over 100%',
      mods: [{ key: 'critRate', value: 0, fromStat: { stat: 'energyRegen', over: 100, per: 0.5, max: 80 } }, { key: 'critDmg', value: 0, fromStat: { stat: 'energyRegen', over: 100, per: 1, max: 160 } }],
      appliesTo: { rows: /^(Intro Skill - Eternal Bloom|Heavy Attack - (Fairytale's Finale|Phantasm's End)) DMG$/, label: "Eternal Bloom, Fairytale's Finale and Phantasm's End" } },
    { seq: 6, id: 'c.lily.s6', group: 'sequence', source: 'S6 · May My Reverie Never End', text: "Fairytale's Finale / Phantasm's End Spectro DMG +100%",
      mods: [{ key: 'dmgSpectro', value: 100 }], appliesTo: { rows: /^Heavy Attack - (Fairytale's Finale|Phantasm's End) DMG$/, label: "Fairytale's Finale and Phantasm's End" } },
    { seq: 6, id: 'c.lily.s6b', group: 'sequence', source: 'S6 · May My Reverie Never End', text: 'Eternal Bloom Spectro DMG +700%',
      mods: [{ key: 'dmgSpectro', value: 700 }], appliesTo: { rows: /^Intro Skill - Eternal Bloom DMG$/, label: 'Intro Skill - Eternal Bloom' } },
  ],

  Suoming: [
    { seq: 0, id: 'c.suo.rain', group: 'self', source: 'Inherent · Rain-Soaked Covenant', text: 'After an Intro Skill: Electro DMG +50%',
      condition: { kind: 'toggle', label: 'After Intro Skill', default: true }, mods: [{ key: 'dmgElectro', value: 50 }] },
    { seq: 0, id: 'c.suo.seal', group: 'self', mode: SUO_MASTER, source: 'Inherent · Sunken Seal, Forged Lock', text: 'Seal Master: Unfurled Canopy / Whirling Thunder Basic multipliers +100%',
      mods: [{ key: 'multBonus', value: 100 }], appliesTo: { rows: /^Basic Attack - Unfurled Canopy( Stage \d|: Whirling Thunder Stage \d) DMG$/, label: 'Unfurled Canopy and Whirling Thunder Basic Attacks' } },
    { seq: 0, id: 'c.suo.sealcd', group: 'self', mode: SUO_MASTER, source: 'Inherent · Sunken Seal, Forged Lock', text: 'Seal Master: Crit. DMG +100%', mods: [{ key: 'critDmg', value: 100 }] },
    { seq: 0, id: 'c.suo.boon', group: 'self', source: 'Forte · Unison Boon', text: 'Each Unison Boon stack: +3% total DMG',
      condition: { kind: 'stacks', label: 'Unison Boon stacks', max: 2, default: 'max' }, mods: [{ key: 'amplify', value: 3 }] },
    { seq: 1, id: 'c.suo.s1', group: 'sequence', source: 'S1 · Into the Blight Rain', text: 'Intro Skill multipliers +60%', mods: [{ key: 'multBonus', value: 60 }], appliesTo: { skillKinds: ['Intro'] } },
    { seq: 2, id: 'c.suo.s2', group: 'sequence', source: 'S2 · Breaking Thunder, Slaying Evil', text: 'Crit. DMG +40%', mods: [{ key: 'critDmg', value: 40 }] },
    { seq: 3, id: 'c.suo.s3', group: 'sequence', source: 'S3 · Lone Canopy, Solitary Road', text: 'After Resonance Liberation: Basic Attack DMG Amplified by 30%',
      condition: { kind: 'toggle', label: 'After Resonance Liberation', default: true }, mods: [{ key: 'amplify', value: 30 }], appliesTo: { dmgTypes: ['Basic'] } },
    { seq: 4, id: 'c.suo.s4', group: 'sequence', source: 'S4 · Covenant Borne Upon the Heart', text: 'ATK +20%', mods: [{ key: 'atkPct', value: 20 }] },
    { seq: 5, id: 'c.suo.s5', group: 'sequence', source: 'S5 · Seal Deep, Never Forgotten', text: 'Miasma Lock multiplier +40%',
      mods: [{ key: 'multBonus', value: 40 }], appliesTo: { rows: /Umbral Canopy: Miasma Lock DMG$/, label: 'Umbral Canopy: Miasma Lock' } },
    { seq: 6, id: 'c.suo.s6boon', group: 'sequence', source: 'S6 · Nine Shadows at Her Side', text: 'Unison Boon +50% stronger (+1.5% per stack), limit 4',
      condition: { kind: 'stacks', label: 'Unison Boon stacks', max: 2, default: 'max', key: 'c.suo.boon' }, mods: [{ key: 'amplify', value: 1.5 }], raisesMax: { key: 'c.suo.boon', to: 4 } },
    { seq: 6, id: 'c.suo.s6', group: 'sequence', source: 'S6 · Nine Shadows at Her Side', text: 'Engraved Heart multiplier +50%',
      mods: [{ key: 'multBonus', value: 50 }], appliesTo: { rows: /^Basic Attack - Umbral Canopy: Engraved Heart/, label: 'Engraved Heart' } },
    { seq: 6, id: 'c.suo.s6cd', group: 'sequence', mode: SUO_MASTER, source: 'S6 · Nine Shadows at Her Side', text: 'Seal Master: Crit. DMG +200% more', mods: [{ key: 'critDmg', value: 200 }] },
  ],
};

/** Shown in the UI so users know these parts of the kit aren't in the numbers yet. */
export const NOT_MODELLED: Record<string, string[]> = {
  Hiyuki: ['Glacio Bite DMG and its Amplify bonuses (Snow Rust 1–3, S6 3 stacks)', 'Outro: Glacio Amplify for teammates (Phase 3)'],
  Cartethyia: ['Aero Erosion DMG', 'Outro: Aero Amplify for teammates (Phase 3)'],
  Qingxiao: ['Juque Perdition (S1)', 'Outro: 800% ATK Aero hit'],
  Chisa: ['S1 fixed 61,803 Havoc DMG', 'S6 Negative Status Amplify', 'Sawring - Eradication Ring of Chainsaw bonus'],
  Hsin: ['Electro Flare DMG: Thunderglow / Fleeting Thunder, S1 Heart of Thunder, S3 extra Electro Flare hit, S6 Electro Flare crits', 'Unison Boon from Hsin for teammates'],
  Suisui: ['Healing (Enrichment, Spring\'s Birth, Plume Step)'],
  Lucilla: ['Glacio Chafe DMG and its Amplify (Outro, S2)', 'Film Roll extra Glacio Chafe', 'Her own hits in Resonance Mode - Echo count as Echo Skill DMG in game; here they stay Basic Attack DMG'],
  Ciaccona: ['Aero Erosion DMG and the Outro\'s Aero Erosion Amplify', 'S6 Solo Concert hit (220% ATK)'],
  'Rover: Electro': ['Electro Flare DMG (Overshock 10 stacks, S2 5 stacks)'],
  Lily: ['Healing and shields', 'Dream Aroma / Silvered Dream (buffs for teammates — see the Team tab)'],
  Suoming: ['Unison Boon for teammates beyond Suoming herself', 'Aligned Seals / S2 Outro buffs (see the Team tab)'],
};

/** Kits written from the game text only — not yet compared with in-game stat screens. */
export const UNVERIFIED = new Set(['Hsin', 'Suisui', 'Lucilla', 'Ciaccona', 'Rover: Electro', 'Lily', 'Suoming']);

export const characterEffects = (name: string, sequence: number): Effect[] =>
  (KITS[name] ?? []).filter((e) => sequence >= e.seq && (e.maxSeq === undefined || sequence <= e.maxSeq));
