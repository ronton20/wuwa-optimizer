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

export const KITS: Record<string, KitEffect[]> = {
  Hiyuki: [
    { seq: 3, id: 'c.hiyuki.finesnow1', group: 'self', source: 'Inherent · Fine Snow', text: '1+ Snow Rust (auto at S3): Crit. DMG +40%', mods: [{ key: 'critDmg', value: 40 }] },
    { seq: 0, maxSeq: 2, id: 'c.hiyuki.finesnow1t', group: 'self', source: 'Inherent · Fine Snow', text: '1+ Snow Rust: Crit. DMG +40%',
      condition: { kind: 'toggle', label: 'Snow Rust ≥ 1', default: true }, mods: [{ key: 'critDmg', value: 40 }] },
    { seq: 6, id: 'c.hiyuki.s6cd', group: 'sequence', source: 'S6 · Into a Night Without End', text: '2+ Snow Rust: Crit. DMG +40%',
      condition: { kind: 'toggle', label: 'Snow Rust ≥ 2', default: true }, mods: [{ key: 'critDmg', value: 40 }] },
    { seq: 1, id: 'c.hiyuki.s1', group: 'sequence', source: 'S1 · Springless', text: 'Foreclaimed Self Basic / Heavy / Mid-air / Dodge multipliers +120%',
      mods: [{ key: 'multBonus', value: 120 }],
      appliesTo: { rows: /^(Basic Attack|Mid-air Attack) - Foreclaimed Self Stage \d DMG$|^(Heavy Attack|Dodge Counter) - Foreclaimed Self DMG$/ } },
    { seq: 2, id: 'c.hiyuki.s2', group: 'sequence', source: 'S2 · To Burn Cold in Silence', text: 'Basic Attack - Iai multiplier +125%',
      mods: [{ key: 'multBonus', value: 125 }], appliesTo: { rows: /^Basic Attack - Iai DMG$/ } },
    { seq: 3, id: 'c.hiyuki.s3', group: 'sequence', source: 'S3 · No Self, No Bound', text: 'Frost Splinter / Bitterfrost multipliers +160%',
      mods: [{ key: 'multBonus', value: 160 }], appliesTo: { rows: /^Heavy Attack - (Frost Splinter: Present Self|Bitterfrost: Foreclaimed Self) DMG$/ } },
    { seq: 4, team: true, id: 'c.hiyuki.s4', group: 'sequence', source: 'S4 · Like Reeds on Tides', text: 'After Resonance Skill: team DMG +20%',
      condition: { kind: 'toggle', label: 'After Resonance Skill', default: true }, mods: [{ key: 'dmgAll', value: 20 }] },
    { seq: 5, id: 'c.hiyuki.s5', group: 'sequence', source: 'S5 · Vessel of Thousand Wishes', text: 'Resonance Skill multipliers +80%',
      mods: [{ key: 'multBonus', value: 80 }], appliesTo: { skillKinds: ['Skill'] } },
    { seq: 6, id: 'c.hiyuki.s6', group: 'sequence', source: 'S6 · Into a Night Without End', text: 'Inward Vision / Blade Liberation Crit. DMG +500%',
      mods: [{ key: 'critDmg', value: 500 }], appliesTo: { rows: /^Foreclaiming: (Inward Vision|Blade Liberation)/ } },
  ],

  Cartethyia: [
    { seq: 0, id: 'c.carte.imprint', group: 'self', source: "Inherent · Wind's Indelible Imprint", text: 'Target takes more DMG per Aero Erosion stack',
      condition: { kind: 'stacks', label: 'Aero Erosion stacks', max: 6, default: 6 }, mods: [{ key: 'amplify', value: 0, byStacks: aeroErosionTaken }] },
    { seq: 1, id: 'c.carte.s1', group: 'sequence', source: 'S1 · Crown Destined by Fate', text: 'Fleurdelys Crit. DMG +25% per Conviction milestone',
      condition: { kind: 'stacks', label: 'Conviction milestones', max: 4, default: 4 }, mods: [{ key: 'critDmg', value: 25 }], appliesTo: { skillKinds: ['Forte'] } },
    { seq: 2, id: 'c.carte.s2', group: 'sequence', source: 'S2 · Blade Broken by Tempest', text: 'Basic / Heavy / Dodge multipliers +50%',
      mods: [{ key: 'multBonus', value: 50 }], appliesTo: { skillKinds: ['Normal'], rows: /^(Stage \d|Dodge Counter|Heavy Attack) DMG$/ } },
    { seq: 2, id: 'c.carte.s2b', group: 'sequence', source: 'S2 · Blade Broken by Tempest', text: 'Mid-air Attack multiplier +200%',
      mods: [{ key: 'multBonus', value: 200 }], appliesTo: { skillKinds: ['Normal'], rows: /^Mid-air Attack/ } },
    { seq: 2, id: 'c.carte.s2c', group: 'sequence', source: 'S2 · Blade Broken by Tempest', text: 'Intro Skill multiplier +50%',
      mods: [{ key: 'multBonus', value: 50 }], appliesTo: { skillKinds: ['Intro'] } },
    { seq: 3, id: 'c.carte.s3', group: 'sequence', source: 'S3 · Prisoner Hanged in the Tower', text: 'Blade of Howling Squall multiplier +100%',
      mods: [{ key: 'multBonus', value: 100 }], appliesTo: { rows: /^Blade of Howling Squall/ } },
    { seq: 4, team: true, id: 'c.carte.s4', group: 'sequence', source: 'S4 · Sacrifice Made for Salvation', text: 'After a Negative Status: team All-Attribute DMG +20%',
      condition: { kind: 'toggle', label: 'Team inflicted a Negative Status', default: true }, mods: [{ key: 'dmgAll', value: 20 }] },
    { seq: 6, id: 'c.carte.s6', group: 'sequence', source: "S6 · Freedom Found in Storm's Wake", text: 'Targets take 40% more DMG from Fleurdelys',
      mods: [{ key: 'amplify', value: 40 }], appliesTo: { skillKinds: ['Forte', 'Liberation'] } },
  ],

  Qingxiao: [
    { seq: 0, id: 'c.qing.mindlock', group: 'self', source: 'Inherent · To Know, To Banish', text: '2% more DMG per Mindlock stack (+5% each for the first 7)',
      condition: { kind: 'stacks', label: 'Mindlock stacks', max: 25, default: 15 }, mods: [{ key: 'amplify', value: 0, byStacks: mindlockBonus }],
      appliesTo: { rows: /^Heavy Attack - Stringblade DMG$|Ephemeral Transcendence/ } },
    { seq: 0, id: 'c.qing.mindlock.lib', group: 'self', source: 'Inherent · To Know, To Banish', text: 'Billows Beneath Heaven: 2% more DMG per Mindlock stack (+5% first 7)',
      condition: { kind: 'stacks', label: 'Mindlock stacks', max: 25, default: 15, key: 'c.qing.mindlock' }, mods: [{ key: 'amplify', value: 0, byStacks: mindlockBonus }],
      appliesTo: { skillKinds: ['Liberation'] } },
    { seq: 1, id: 'c.qing.s1', group: 'sequence', source: 'S1 · Like Clouds That Meet and Drift Apart', text: 'Crit. Rate +16%', mods: [{ key: 'critRate', value: 16 }] },
    { seq: 2, id: 'c.qing.s2', group: 'sequence', source: 'S2 · Like Petals That Fall Without a Sound', text: 'Heavy Attack - Stringblade multiplier +40%',
      mods: [{ key: 'multBonus', value: 40 }], appliesTo: { rows: /^Heavy Attack - Stringblade DMG$/ } },
    { seq: 3, id: 'c.qing.s3', group: 'sequence', source: 'S3 · Dreams Fade, Sword Abides', text: 'Billows Beneath Heaven Crit. DMG +100%',
      mods: [{ key: 'critDmg', value: 100 }], appliesTo: { skillKinds: ['Liberation'] } },
    { seq: 3, id: 'c.qing.s3b', group: 'sequence', source: 'S3 · World in Chorus', text: "Heaven's Reckoning multiplier +3% per stack",
      condition: { kind: 'stacks', label: 'World in Chorus stacks', max: 25, default: 15 }, mods: [{ key: 'multBonus', value: 3 }],
      appliesTo: { rows: /^Heaven's Reckoning/ } },
    { seq: 4, team: true, id: 'c.qing.s4', group: 'sequence', source: 'S4 · Wherever the Road Leads, Side by Side', text: 'After Tune Strain - Shifting: ATK +20%',
      condition: { kind: 'toggle', label: 'Inflicted Tune Strain - Shifting', default: true }, mods: [{ key: 'atkPct', value: 20 }] },
    { seq: 5, id: 'c.qing.s5', group: 'sequence', source: 'S5 · Cold Steel That Longs to Warm the Snow', text: 'Severing Note: Judgement multiplier +100%',
      mods: [{ key: 'multBonus', value: 100 }], appliesTo: { rows: /^Severing Note: Judgement/ } },
    { seq: 6, id: 'c.qing.s6', group: 'sequence', source: 'S6 · Cleanse This Tarnished Age', text: 'Stringblade / Heaven\'s Reckoning / Billows: targets take 40% more DMG',
      mods: [{ key: 'amplify', value: 40 }], appliesTo: { rows: /^Heavy Attack - Stringblade DMG$|^Heaven's Reckoning|^Skill DMG$/, skillKinds: ['Normal', 'Forte', 'Liberation'] } },
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
      mods: [{ key: 'multBonus', value: 120 }], appliesTo: { rows: /^Sawring|^Chainsaw Mode - Dodge Counter/ } },
    { seq: 5, id: 'c.chisa.s5', group: 'sequence', source: 'S5 · Thousands of Lights to Guide the Way Home', text: 'Moment of Nihility DMG Bonus +100%',
      mods: [{ key: 'dmgLib', value: 100 }], appliesTo: { skillKinds: ['Liberation'] } },
    { seq: 6, id: 'c.chisa.s6', group: 'sequence', source: 'S6 · Thus, Hope is Rekindled', text: 'Targets with Unseen Snare - Finality take 40% more DMG from Chisa',
      condition: { kind: 'toggle', label: 'Target has Unseen Snare', default: true }, mods: [{ key: 'amplify', value: 40 }] },
  ],
};

/** Shown in the UI so users know these parts of the kit aren't in the numbers yet. */
export const NOT_MODELLED: Record<string, string[]> = {
  Hiyuki: ['Glacio Bite DMG and its Amplify bonuses (Snow Rust 1–3, S6 3 stacks)', 'Outro: Glacio Amplify for teammates (Phase 3)'],
  Cartethyia: ['Aero Erosion DMG', 'Outro: Aero Amplify for teammates (Phase 3)'],
  Qingxiao: ['Juque Perdition (S1)', 'Outro: 800% ATK Aero hit'],
  Chisa: ['S1 fixed 61,803 Havoc DMG', 'S6 Negative Status Amplify', 'Sawring - Eradication Ring of Chainsaw bonus'],
};

export const characterEffects = (name: string, sequence: number): Effect[] =>
  (KITS[name] ?? []).filter((e) => sequence >= e.seq && (e.maxSeq === undefined || sequence <= e.maxSeq));
