import type { Character, Sonata, StatKey } from '../../data/types';
import type { Effect } from '../types';

/** Sonata set effects. 2-piece stat bonuses come straight from the game data; conditional ones are written here. */
const tog = (label: string, def = true, key?: string): Effect['condition'] => ({ kind: 'toggle', label, default: def, key });
const stk = (label: string, max: number, def: number | 'max' = 'max'): Effect['condition'] => ({ kind: 'stacks', label, max, default: def });
type SetDef = Omit<Effect, 'group' | 'source'>;

/**
 * Sonata set effects. 2-piece stat bonuses come straight from the game data; everything conditional is written here.
 * Buffs that only reach the NEXT Resonator (Outro sets) live in team.ts (TEAM_SETS).
 */
const SET_CONDITIONAL: Record<string, Record<number, SetDef[]>> = {
  'Freezing Frost': { 5: [{ id: 's.frost.5', text: 'Basic / Heavy Attack: Glacio DMG +10% per stack', condition: stk('Freezing Frost stacks', 3), mods: [{ key: 'dmgGlacio', value: 10 }] }] },
  'Molten Rift': { 5: [{ id: 's.molten.5', text: 'After Resonance Skill: Fusion DMG +30%', condition: tog('After Resonance Skill'), mods: [{ key: 'dmgFusion', value: 30 }] }] },
  'Void Thunder': { 5: [{ id: 's.void.5', text: 'Heavy Attack / Resonance Skill: Electro DMG +15% per stack', condition: stk('Void Thunder stacks', 2), mods: [{ key: 'dmgElectro', value: 15 }] }] },
  'Sierra Gale': { 5: [{ id: 's.sierra.5', text: 'After Intro Skill: Aero DMG +30%', condition: tog('After Intro Skill'), mods: [{ key: 'dmgAero', value: 30 }] }] },
  'Celestial Light': { 5: [{ id: 's.celestial.5', text: 'After Intro Skill: Spectro DMG +30%', condition: tog('After Intro Skill'), mods: [{ key: 'dmgSpectro', value: 30 }] }] },
  'Havoc Eclipse': { 5: [{ id: 's.eclipse.5', text: 'Basic / Heavy Attack: Havoc DMG +7.5% per stack', condition: stk('Havoc Eclipse stacks', 4), mods: [{ key: 'dmgHavoc', value: 7.5 }] }] },
  'Rejuvenating Glow': { 5: [{ id: 's.rejuv.5', text: 'Healing allies: team ATK +15%', condition: tog('Healed an ally'), mods: [{ key: 'atkPct', value: 15 }] }] },
  'Lingering Tunes': { 5: [
    { id: 's.tunes.5', text: 'On field: ATK +5% every 1.5s (max 4)', condition: stk('Lingering Tunes stacks', 4), mods: [{ key: 'atkPct', value: 5 }] },
    { id: 's.tunes.5.outro', text: 'Outro Skill DMG +60%', mods: [{ key: 'dmgAll', value: 60 }], appliesTo: { dmgTypes: ['Outro'] } },
  ] },
  'Frosty Resolve': { 5: [
    { id: 's.frosty.5', text: 'After Resonance Skill: Glacio DMG +22.5%', condition: tog('After Resonance Skill'), mods: [{ key: 'dmgGlacio', value: 22.5 }] },
    { id: 's.frosty.5.lib', text: 'Each Resonance Liberation: Resonance Skill DMG +18% (max 2)', condition: stk('Frosty Resolve stacks', 2), mods: [{ key: 'dmgSkill', value: 18 }] },
  ] },
  'Eternal Radiance': { 5: [
    { id: 's.radiance.5', text: 'Inflicting Spectro Frazzle: Crit. Rate +20%', condition: tog('Inflicted Spectro Frazzle'), mods: [{ key: 'critRate', value: 20 }] },
    { id: 's.radiance.5.ten', text: 'Hitting targets with 10 Spectro Frazzle: Spectro DMG +15%', condition: tog('Target has 10 Spectro Frazzle'), mods: [{ key: 'dmgSpectro', value: 15 }] },
  ] },
  'Empyrean Anthem': { 5: [{ id: 's.anthem.5', text: 'Coordinated Attack crit: active Resonator ATK +20%', condition: tog('Coordinated Attack crit', false), mods: [{ key: 'atkPct', value: 20 }] }] },
  'Tidebreaking Courage': { 5: [
    { id: 's.tide.5', text: 'ATK +15%', mods: [{ key: 'atkPct', value: 15 }] },
    { id: 's.tide.5.er', text: 'Energy Regen at 250% or more: All-Attribute DMG +30%',
      mods: [{ key: 'dmgAll', value: 0, fromStat: { stat: 'energyRegen', over: 249.99, per: 3000, max: 30 } }], appliesTo: { rows: /./, label: 'all hits, from 250% Energy Regen' } },
  ] },
  'Gusts of Welkin': { 5: [{ id: 's.welkin.5', text: 'Inflicting Aero Erosion: Aero DMG +30% (15% team + 15% self)', condition: tog('Inflicted Aero Erosion'), mods: [{ key: 'dmgAero', value: 30 }] }] },
  'Windward Pilgrimage': { 5: [{ id: 's.windward.5', text: 'Hitting a target with Aero Erosion: Crit. Rate +10%, Aero DMG +30%', condition: tog('Target has Aero Erosion'), mods: [{ key: 'critRate', value: 10 }, { key: 'dmgAero', value: 30 }] }] },
  'Flaming Clawprint': { 5: [{ id: 's.clawprint.5', text: 'After Resonance Liberation: Fusion DMG +15%, Resonance Liberation DMG +20%', condition: tog('After Resonance Liberation'), mods: [{ key: 'dmgFusion', value: 15 }, { key: 'dmgLib', value: 20 }] }] },
  'Dream of the Lost': { 3: [{ id: 's.dream.3', text: 'At 0 Resonance Energy: Crit. Rate +20%, Echo Skill DMG +35%', condition: tog('Holding 0 Resonance Energy'), mods: [{ key: 'critRate', value: 20 }, { key: 'dmgEcho', value: 35 }] }] },
  'Crown of Valor': { 3: [{ id: 's.crown.3', text: 'Each Shield gained: ATK +6%, Crit. DMG +4% (max 5)', condition: stk('Crown of Valor stacks', 5, 0), mods: [{ key: 'atkPct', value: 6 }, { key: 'critDmg', value: 4 }] }] },
  'Law of Harmony': { 3: [
    { id: 's.harmony.3', text: 'After Echo Skill: Heavy Attack DMG +30%', condition: tog('After Echo Skill'), mods: [{ key: 'dmgHeavy', value: 30 }] },
    { id: 's.harmony.3.echo', text: 'Each different Echo Skill: team Echo Skill DMG +4% (max 4)', condition: stk('Law of Harmony stacks', 4), mods: [{ key: 'dmgEcho', value: 4 }] },
  ] },
  "Flamewing's Shadow": { 3: [
    { id: 's.flamewing.3.heavy', text: 'After Echo Skill DMG: Heavy Attack Crit. Rate +20%', condition: tog('After Echo Skill DMG'), mods: [{ key: 'critRate', value: 20 }], appliesTo: { dmgTypes: ['Heavy'] } },
    { id: 's.flamewing.3.echo', text: 'After Heavy Attack DMG: Echo Skill Crit. Rate +20%', condition: tog('After Heavy Attack DMG'), mods: [{ key: 'critRate', value: 20 }], appliesTo: { dmgTypes: ['Echo'] } },
    { id: 's.flamewing.3.both', text: 'Both active: Fusion DMG +16%', condition: tog('Both Flamewing effects active'), mods: [{ key: 'dmgFusion', value: 16 }] },
  ] },
  'Thread of Severed Fate': { 3: [{ id: 's.thread.3', text: 'Inflicting Havoc Bane: ATK +20%, Liberation DMG +30%', condition: tog('Inflicted Havoc Bane'), mods: [{ key: 'atkPct', value: 20 }, { key: 'dmgLib', value: 30 }] }] },
  'Halo of Starry Radiance': { 5: [{ id: 's.halo.5', text: 'Healing: team ATK +0.2% per 1% Off-Tune Buildup Rate (20% at 100%, max 25%)', condition: tog('Healed a Resonator'), mods: [{ key: 'atkPct', value: 20 }] }] },
  'Rite of Gilded Revelation': { 5: [
    { id: 's.rite.5', text: 'Basic Attack DMG: Spectro DMG +10% per stack', condition: stk('Rite of Gilded Revelation stacks', 3), mods: [{ key: 'dmgSpectro', value: 10 }] },
    { id: 's.rite.5.lib', text: 'At 3 stacks, after Resonance Liberation: Basic Attack DMG +40%', condition: tog('Liberation at 3 stacks'), mods: [{ key: 'dmgBasic', value: 40 }] },
  ] },
  'Trailblazing Star': { 5: [{ id: 's.trail.5', text: 'Inflicting Fusion Burst / Tune Rupture - Shifting: Crit. Rate +20%, Fusion DMG +20%', condition: tog('Inflicted Fusion Burst or Tune Rupture - Shifting'), mods: [{ key: 'critRate', value: 20 }, { key: 'dmgFusion', value: 20 }] }] },
  'Chromatic Foam': { 5: [{ id: 's.foam.5', text: 'Inflicting Fusion Burst: Fusion DMG +10%', condition: tog('Inflicted Fusion Burst'), mods: [{ key: 'dmgFusion', value: 10 }] }] },
  'Sound of True Name': { 5: [{ id: 's.truename.5', text: 'After Echo Skill DMG: Echo Skill Crit. Rate +20%, Aero DMG +15%', condition: tog('After Echo Skill DMG'), mods: [{ key: 'dmgAero', value: 15 }] },
    { id: 's.truename.5.cr', text: 'After Echo Skill DMG: Echo Skill Crit. Rate +20%', condition: tog('After Echo Skill DMG', true, 's.truename.5'), mods: [{ key: 'critRate', value: 20 }], appliesTo: { dmgTypes: ['Echo'] } }] },
  'Wishes of Quiet Snowfall': { 5: [
    { id: 's.wqs.5', text: 'Inflicting Glacio Chafe: Glacio DMG +10%', condition: tog('Inflicted Glacio Chafe'), mods: [{ key: 'dmgGlacio', value: 10 }] },
    { id: 's.wqs.5.cr', text: 'Snowfall consumed by Liberation DMG: Crit. Rate +25%', condition: tog('Snowfall → Crit. Rate', false), mods: [{ key: 'critRate', value: 25 }] },
  ] },
  'Shadow of Shattered Dreams': { 1: [{ id: 's.shadow.1', text: 'Inflicting Hack - Shifting: Basic and Heavy Attack DMG +35%', condition: tog('Inflicted Hack - Shifting'), mods: [{ key: 'dmgBasic', value: 35 }, { key: 'dmgHeavy', value: 35 }] }] },
  'Song of Feathered Trace': { 5: [
    { id: 's.feather.5.x', text: "Inflicting Havoc Bane (Xuanling's Feather): Crit. Rate +20%, Heavy Attack DMG +35%", condition: tog("Xuanling's Feather (Havoc Bane)", false), mods: [{ key: 'critRate', value: 20 }, { key: 'dmgHeavy', value: 35 }] },
    { id: 's.feather.5.c', text: "Inflicting Glacio Chafe (Chongming's Feather): team ATK, 0.1% per 1% Energy Regen (max 25% at 250%)", condition: tog("Chongming's Feather (Glacio Chafe)"), mods: [{ key: 'atkPct', value: 25 }] },
  ] },
  "Heart of Evil's Purge": { 5: [{ id: 's.hoep.5', text: 'Inflicting Tune Strain - Shifting: Crit. DMG +20%, Aero DMG +30%', condition: tog('Inflicted Tune Strain - Shifting'), mods: [{ key: 'critDmg', value: 20 }, { key: 'dmgAero', value: 30 }] }] },
  'Lamp of Nether Road': { 5: [
    { id: 's.lamp.5', text: 'Each Shield gained: Crit. Rate +5% (max 4)', condition: stk('Lamp of Nether Road stacks', 4, 0), mods: [{ key: 'critRate', value: 5 }] },
    { id: 's.lamp.5.max', text: 'At max stacks: Fusion DMG +15%', condition: tog('Lamp of Nether Road at 4 stacks', false), mods: [{ key: 'dmgFusion', value: 15 }] },
  ] },
  'Heart of Sworn Vigil': { 5: [{ id: 's.vigil.5', text: 'Electro Flare / Unison: Crit. Rate +15%, Electro DMG +22.5%', condition: tog('Inflicted Electro Flare or gained Unison'), mods: [{ key: 'critRate', value: 15 }, { key: 'dmgElectro', value: 22.5 }] }] },
  'Flash of Electric Reflection': { 5: [{ id: 's.flash.5', text: 'Inflicting Electro Flare: Electro DMG +10%', condition: tog('Inflicted Electro Flare'), mods: [{ key: 'dmgElectro', value: 10 }] }] },
  'Flower of Tinged Yearning': { 5: [
    { id: 's.flower.5', text: 'Healing: team ATK +10%', condition: tog('Healed a Resonator'), mods: [{ key: 'atkPct', value: 10 }] },
    { id: 's.flower.5.unison', text: 'While active, gaining Unison: ATK +15% more', condition: tog('Gained Unison', false), mods: [{ key: 'atkPct', value: 15 }] },
  ] },
  // Outro-only (buff the next Resonator; see team.ts): Moonlit Clouds, Midnight Veil, Pact of Neonlight Leap. Tune Break Boost: Reel of Spliced Memories.
};

/** Sets whose 3/5-piece effect can't help the wielder's own damage (Outro buffs, Tune Break Boost). */
export const SET_NO_SELF_EFFECT = ['Moonlit Clouds', 'Midnight Veil', 'Pact of Neonlight Leap', 'Reel of Spliced Memories'];

/** Every set with its bonus written out. */
export const HAS_SET_DEFINITIONS = Object.keys(SET_CONDITIONAL);

export function sonataEffects(counts: Map<Sonata, number>): Effect[] {
  const out: Effect[] = [];
  for (const [set, n] of counts) {
    for (const piece of set.effects) {
      if (n < piece.pieces) continue;
      if (piece.stats.length)
        out.push({ id: `s.${set.id}.${piece.pieces}`, group: 'echo', source: `${set.name} ${piece.pieces}pc`, text: piece.stats.map((s) => `${s.stat} +${s.value}`).join(', '), mods: piece.stats.map((s) => ({ key: s.stat, value: s.value })) });
      out.push(...(SET_CONDITIONAL[set.name]?.[piece.pieces] ?? []).map((e) => ({ ...e, group: 'echo' as const, source: `${set.name} ${piece.pieces}pc` })));
    }
  }
  return out;
}

/** Main-slot echo passives. `pair` = the common "gains 12% X DMG Bonus and 12% Y DMG Bonus" wording. */
type MainDef = (c: Character) => Effect[];
const main = (id: string, name: string, text: string, mods: Effect['mods'], condition?: Effect['condition']): Effect =>
  ({ id: `e.${id}`, group: 'echo', source: `Main echo · ${name}`, text, mods, condition });
const pair = (id: string, name: string, a: StatKey, av: number, b: StatKey, bv: number): MainDef => () =>
  [main(id, name, `${STAT_NAME[a]} +${av}%, ${STAT_NAME[b]} +${bv}%`, [{ key: a, value: av }, { key: b, value: bv }])];
const afterSkill = (id: string, name: string, a: StatKey, av: number, b: StatKey, bv: number, label = 'After its Echo Skill'): MainDef => () =>
  [main(id, name, `${label}: ${STAT_NAME[a]} +${av}%, ${STAT_NAME[b]} +${bv}%`, [{ key: a, value: av }, { key: b, value: bv }], { kind: 'toggle', label, default: true })];
const STAT_NAME: Partial<Record<StatKey, string>> = {
  dmgGlacio: 'Glacio DMG', dmgFusion: 'Fusion DMG', dmgElectro: 'Electro DMG', dmgAero: 'Aero DMG', dmgSpectro: 'Spectro DMG', dmgHavoc: 'Havoc DMG',
  dmgBasic: 'Basic Attack DMG', dmgHeavy: 'Heavy Attack DMG', dmgSkill: 'Resonance Skill DMG', dmgLib: 'Resonance Liberation DMG', dmgEcho: 'Echo Skill DMG',
  atkPct: 'ATK', energyRegen: 'Energy Regen',
};

const MAIN_ECHO: Record<string, MainDef> = {
  // passive while in the main slot
  'Dragon of Dirge': pair('dirge', 'Dragon of Dirge', 'dmgFusion', 12, 'dmgBasic', 12),
  'Lady of the Sea': pair('lady', 'Lady of the Sea', 'dmgAero', 12, 'dmgLib', 12),
  'Lioness of Glory': pair('lioness', 'Lioness of Glory', 'dmgFusion', 12, 'dmgLib', 12),
  Lorelei: pair('lorelei', 'Lorelei', 'dmgHavoc', 12, 'dmgBasic', 12),
  'Myriad Snare: Rustfire Chassis': pair('rustfire', 'Rustfire Chassis', 'dmgFusion', 12, 'dmgHeavy', 12),
  'Nameless Explorer': pair('nameless', 'Nameless Explorer', 'dmgAero', 12, 'dmgEcho', 20),
  'Nightmare: Crownless': pair('ncrownless', 'Nightmare: Crownless', 'dmgHavoc', 12, 'dmgBasic', 12),
  'Nightmare Crownless': pair('ncrownless', 'Nightmare: Crownless', 'dmgHavoc', 12, 'dmgBasic', 12),
  'Nightmare: Feilian Beringal': pair('nfeilian', 'Nightmare: Feilian Beringal', 'dmgAero', 12, 'dmgHeavy', 12),
  'Nightmare: Hecate': pair('nhecate', 'Nightmare: Hecate', 'dmgHavoc', 12, 'dmgEcho', 20),
  'Nightmare: Impermanence Heron': pair('nheron', 'Nightmare: Impermanence Heron', 'dmgHavoc', 12, 'dmgHeavy', 12),
  'Nightmare: Inferno Rider': pair('ninferno', 'Nightmare: Inferno Rider', 'dmgFusion', 12, 'dmgSkill', 12),
  'Nightmare Inferno Rider': pair('ninferno', 'Nightmare: Inferno Rider', 'dmgFusion', 12, 'dmgSkill', 12),
  'Nightmare: Kelpie': pair('nkelpie', 'Nightmare: Kelpie', 'dmgGlacio', 12, 'dmgAero', 12),
  'Nightmare: Tempest Mephis': pair('ntempest', 'Nightmare: Tempest Mephis', 'dmgElectro', 12, 'dmgSkill', 12),
  'Nightmare: Thundering Mephis': pair('nthundering', 'Nightmare: Thundering Mephis', 'dmgElectro', 12, 'dmgLib', 12),
  'Sentry Construct': pair('sentry', 'Sentry Construct', 'dmgGlacio', 12, 'dmgSkill', 12),
  'The False Sovereign': pair('sovereign', 'The False Sovereign', 'dmgElectro', 12, 'dmgHeavy', 12),
  'Reminiscence: Fenrico': pair('fenrico', 'Fenrico', 'dmgAero', 12, 'dmgHeavy', 12),
  'Reminiscence: Threnodian - Voidborne Construct': pair('voidborne', 'Voidborne Construct', 'dmgGlacio', 12, 'dmgLib', 12),
  'Reminiscence: Threnodian - Leviathan': pair('leviathan', 'Leviathan', 'dmgHavoc', 12, 'dmgLib', 12),
  'Thousand-Puppet Pavilion': pair('pavilion', 'Thousand-Puppet Pavilion', 'dmgHavoc', 12, 'dmgHeavy', 12),
  'Nightmare: Lampylumen Myriad': () => [main('nlampy', 'Nightmare: Lampylumen Myriad', 'Glacio DMG +12%', [{ key: 'dmgGlacio', value: 12 }])],
  'Nightmare: Mourning Aix': () => [main('naix', 'Nightmare: Mourning Aix', 'Spectro DMG +12%', [{ key: 'dmgSpectro', value: 12 }])],
  'Reactor Husk': () => [main('husk', 'Reactor Husk', 'Energy Regen +10%', [{ key: 'energyRegen', value: 10 }])],
  Sigillum: (c) => (c.name === 'Aemeath' ? [main('sigillum', 'Sigillum', 'Aemeath: Resonance Liberation DMG +25%', [{ key: 'dmgLib', value: 25 }])] : []),
  'Reminiscence: Fleurdelys': (c) => [main('fleurdelys', 'Fleurdelys', 'Aero DMG +10% (+10% more for Aero Rover or Cartethyia)',
    [{ key: 'dmgAero', value: c.name === 'Cartethyia' || (/Rover/.test(c.name) && c.element === 'Aero') ? 20 : 10 }])],
  'Calamity Effigy': () => [
    main('calamity', 'Calamity Effigy', 'Aero DMG +10%', [{ key: 'dmgAero', value: 10 }]),
    main('calamity.shift', 'Calamity Effigy', 'Inflicting Tune Strain - Shifting: Aero DMG +10%', [{ key: 'dmgAero', value: 10 }], { kind: 'toggle', label: 'Inflicted Tune Strain - Shifting', default: true }),
  ],
  'Reminiscence: Suhsin the Inevitable': () => [
    main('suhsin', 'Suhsin the Inevitable', 'Electro DMG +10%', [{ key: 'dmgElectro', value: 10 }]),
    main('suhsin.flare', 'Suhsin the Inevitable', 'Electro Flare / Unison: Electro DMG +10% more', [{ key: 'dmgElectro', value: 10 }], { kind: 'toggle', label: 'Inflicted Electro Flare or gained Unison', default: true }),
  ],
  'Reminiscence - Nightmare: Adam Smasher': (c) => (/^(Lucy|Rebecca)/.test(c.name) ? [main('smasher', 'Adam Smasher', 'Lucy / Rebecca: Crit. Rate +15%', [{ key: 'critRate', value: 15 }])] : []),

  // buffs after using its Echo Skill
  Crownless: afterSkill('crownless', 'Crownless', 'dmgHavoc', 12, 'dmgSkill', 12),
  'Feilian Beringal': afterSkill('feilian', 'Feilian Beringal', 'dmgAero', 12, 'dmgHeavy', 12),
  'Inferno Rider': afterSkill('inferno', 'Inferno Rider', 'dmgFusion', 12, 'dmgBasic', 12),
  'Mourning Aix': afterSkill('aix', 'Mourning Aix', 'dmgSpectro', 12, 'dmgLib', 12),
  'Thundering Mephis': afterSkill('thundering', 'Thundering Mephis', 'dmgElectro', 12, 'dmgLib', 12),
  'Tempest Mephis': afterSkill('tempest', 'Tempest Mephis', 'dmgElectro', 12, 'dmgHeavy', 12),
  'Lampylumen Myriad': () => [main('lampy', 'Lampylumen Myriad', 'Each shock: Glacio DMG +4%, Resonance Skill DMG +4% (max 3)', [{ key: 'dmgGlacio', value: 4 }, { key: 'dmgSkill', value: 4 }], { kind: 'stacks', label: 'Lampylumen Myriad stacks', max: 3, default: 'max' })],
  'Mech Abomination': () => [main('mech', 'Mech Abomination', 'After its Echo Skill: ATK +12%', [{ key: 'atkPct', value: 12 }], { kind: 'toggle', label: 'After its Echo Skill', default: true })],
  Jué: () => [main('jue', 'Jué', 'Blessing of Time: Resonance Skill DMG +16%', [{ key: 'dmgSkill', value: 16 }], { kind: 'toggle', label: 'After its Echo Skill', default: true })],
  'Fallacy of No Return': () => [main('fallacy', 'Fallacy of No Return', 'After its Echo Skill: Energy Regen +10%, team ATK +10%', [{ key: 'energyRegen', value: 10 }, { key: 'atkPct', value: 10 }], { kind: 'toggle', label: 'After its Echo Skill', default: true })],
  'Bell-Borne Geochelone': () => [main('bellborne', 'Bell-Borne Geochelone', 'Bell-Borne Shield: team DMG +10%', [{ key: 'dmgAll', value: 10 }], { kind: 'toggle', label: 'Bell-Borne Shield up', default: true })],
  // Buff only the next Resonator (team.ts): Impermanence Heron, Hyvatia, Reminiscence: Denia.
  // Coordinated Attack DMG isn't tracked per hit yet: Hecate, Nightmare: Lampylumen Myriad (its Glacio part is above).
};

/** 4-cost echoes with nothing for their own wielder (team-only or not tracked yet). */
export const MAIN_ECHO_NO_SELF = ['Impermanence Heron', 'Hyvatia', 'Reminiscence: Denia', 'Hecate', 'Dreamless'];
export const HAS_MAIN_ECHO_DEFINITIONS = Object.keys(MAIN_ECHO);

export function mainEchoEffects(echoName: string, c: Character): Effect[] {
  // skins ("Phantom: …") work like the echo they're a skin of
  return MAIN_ECHO[echoName.replace(/^Phantom:\s*/, '')]?.(c) ?? [];
}
