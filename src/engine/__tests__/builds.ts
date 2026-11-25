// The four builds from the screenshots in Pictures/wuwa_data/<character>/ (echo_1..5, weapon, S*, stats_1..4),
// plus the numbers the in-game "More Stats" screen shows for them.
import data from '../../data/current';
import type { StatKey } from '../../data/types';
import type { Build, EchoPiece } from '../types';

type S = [StatKey, number];
const echo = (name: string, set: string, main: S, subs: S[]): EchoPiece => {
  const e = data.echoes.find((x) => x.name === name);
  const s = data.sonatas.find((x) => x.name === set);
  if (!e) throw new Error(`echo not found: ${name}`);
  if (!s) throw new Error(`set not found: ${set}`);
  return { echoId: e.id, setId: s.id, main: { stat: main[0], value: main[1] }, subs: subs.map(([stat, value]) => ({ stat, value })) };
};
const char = (name: string) => data.characters.find((c) => c.name === name)!.id;
const weapon = (name: string) => data.weapons.find((w) => w.name === name)!.id;

export interface StatScreen {
  hp: [number, number]; atk: [number, number]; def: [number, number]; // [white, green]
  pct: Partial<Record<StatKey, number>>; // every non-zero % line
}

export interface GoldenBuild { name: string; build: Build; screen: StatScreen }

const WQS = 'Wishes of Quiet Snowfall', WP = 'Windward Pilgrimage', HOEP = "Heart of Evil's Purge", TSF = 'Thread of Severed Fate', MV = 'Midnight Veil';

export const BUILDS: GoldenBuild[] = [
  {
    name: 'Hiyuki',
    build: {
      characterId: char('Hiyuki'), sequence: 6, skillLevels: {}, conditions: {},
      weapon: { id: weapon('Frostburn'), rank: 5 },
      echoes: [
        echo('Reminiscence: Threnodian - Voidborne Construct', WQS, ['critDmg', 44], [['critRate', 8.7], ['energyRegen', 9.2], ['dmgLib', 9.4], ['dmgSkill', 7.9], ['critDmg', 15.0]]),
        echo('Glommoth', WQS, ['dmgGlacio', 30], [['critRate', 6.9], ['critDmg', 17.4], ['def', 60], ['energyRegen', 10.8], ['atkPct', 7.9]]),
        echo('Windlash Coleoid', WQS, ['dmgGlacio', 30], [['def', 50], ['critRate', 10.5], ['dmgHeavy', 6.4], ['atkPct', 9.4], ['critDmg', 17.4]]),
        echo('Tremor Warrior', WQS, ['atkPct', 18], [['energyRegen', 11.6], ['critDmg', 21.0], ['critRate', 6.3], ['hp', 390], ['dmgLib', 7.9]]),
        echo('Phantom: Iceglint Dancer', WQS, ['atkPct', 18], [['atk', 50], ['hpPct', 9.4], ['critDmg', 12.6], ['atkPct', 7.1], ['critRate', 8.7]]),
      ],
    },
    screen: {
      hp: [10300, 5917], atk: [1049, 1410], def: [1112, 110],
      pct: { critRate: 78.4, critDmg: 317.4, energyRegen: 161.6, dmgSkill: 7.9, dmgHeavy: 6.4, dmgLib: 29.3, dmgGlacio: 82.0 },
    },
  },
  {
    name: 'Cartethyia',
    build: {
      characterId: char('Cartethyia'), sequence: 6, skillLevels: {}, conditions: {},
      weapon: { id: weapon("Defier's Thorn"), rank: 1 },
      echoes: [
        echo('Reminiscence: Fleurdelys', WP, ['critRate', 22], [['critDmg', 18.6], ['critRate', 10.5], ['dmgLib', 8.6], ['hp', 430], ['hpPct', 8.6]]),
        echo('Nightmare: Kelpie', WP, ['critDmg', 44], [['critDmg', 19.8], ['dmgSkill', 9.4], ['critRate', 7.5], ['atkPct', 6.4], ['hpPct', 7.1]]),
        echo('Spectro Drake', WP, ['hpPct', 22.8], [['defPct', 11.8], ['critRate', 7.5], ['dmgSkill', 8.6], ['critDmg', 18.6], ['energyRegen', 7.6]]),
        echo('Fusion Drake', WP, ['hpPct', 22.8], [['critDmg', 21.0], ['def', 50], ['critRate', 7.5], ['atk', 40], ['hp', 510]]),
        echo('Glacio Drake', WP, ['hpPct', 22.8], [['defPct', 11.8], ['critRate', 8.7], ['critDmg', 13.8], ['atk', 50], ['dmgBasic', 7.9]]),
      ],
    },
    screen: {
      hp: [14800, 34461], atk: [724, 436], def: [611, 195],
      pct: { critRate: 76.7, critDmg: 285.8, energyRegen: 137.6, dmgSkill: 18.0, dmgBasic: 7.9, dmgLib: 8.6, dmgAero: 30.0 },
    },
  },
  {
    name: 'Chisa',
    build: {
      characterId: char('Chisa'), sequence: 0, skillLevels: {}, conditions: {},
      weapon: { id: weapon('Kumokiri'), rank: 1 },
      echoes: [
        echo('Reminiscence: Threnodian - Leviathan', TSF, ['critDmg', 44], [['defPct', 10.9], ['critDmg', 18.6], ['atk', 40], ['dmgLib', 10.1], ['energyRegen', 9.2]]),
        echo('Nightmare: Roseshroom', TSF, ['atkPct', 30], [['critDmg', 21.0], ['defPct', 10.9], ['dmgSkill', 7.9], ['critRate', 8.1], ['atkPct', 8.6]]),
        echo('Questless Knight', MV, ['dmgHavoc', 30], [['dmgHeavy', 9.4], ['atkPct', 7.9], ['critRate', 6.3], ['energyRegen', 9.2], ['critDmg', 13.8]]),
        echo('Nightmare: Dwarf Cassowary', TSF, ['atkPct', 18], [['atkPct', 6.4], ['energyRegen', 9.2], ['critRate', 7.5], ['critDmg', 13.8], ['hpPct', 8.6]]),
        echo('Phantom: Fae Ignis', MV, ['atkPct', 18], [['critRate', 6.3], ['dmgLib', 10.1], ['critDmg', 12.6], ['dmgBasic', 7.9], ['dmgHeavy', 9.4]]),
      ],
    },
    screen: {
      hp: [10775, 5485], atk: [937, 1447], def: [1136, 247],
      pct: { critRate: 77.2, critDmg: 273.8, energyRegen: 157.6, dmgSkill: 7.9, dmgBasic: 7.9, dmgHeavy: 18.8, dmgLib: 32.2, dmgHavoc: 52.0 },
    },
  },
  {
    name: 'Qingxiao',
    build: {
      characterId: char('Qingxiao'), sequence: 3, skillLevels: {}, conditions: {},
      weapon: { id: weapon('Glint of Clouds'), rank: 1 },
      echoes: [
        echo('Calamity Effigy', HOEP, ['critDmg', 44], [['critDmg', 13.8], ['dmgBasic', 8.6], ['defPct', 8.1], ['critRate', 8.1], ['hpPct', 6.4]]),
        echo('Fog Lionarch', HOEP, ['dmgAero', 30], [['dmgBasic', 10.1], ['critDmg', 18.6], ['critRate', 10.5], ['dmgSkill', 9.4], ['dmgHeavy', 9.4]]),
        echo('Forbidden Bastion', HOEP, ['atkPct', 30], [['hpPct', 7.9], ['dmgLib', 10.9], ['critDmg', 18.6], ['defPct', 11.8], ['critRate', 6.9]]),
        echo('Kernel Puppet: Anger', HOEP, ['atkPct', 18], [['critRate', 10.5], ['critDmg', 13.8], ['hp', 390], ['hpPct', 8.6], ['dmgLib', 6.4]]),
        echo('Kernel Puppet: Worry', HOEP, ['atkPct', 18], [['dmgHeavy', 8.6], ['critRate', 7.5], ['critDmg', 15.0], ['energyRegen', 6.8], ['dmgBasic', 7.1]]),
      ],
    },
    screen: {
      hp: [10300, 7305], atk: [962, 1215], def: [1112, 222],
      pct: { critRate: 100.5, critDmg: 289.8, energyRegen: 136.8, dmgSkill: 9.4, dmgBasic: 25.8, dmgHeavy: 18.0, dmgLib: 17.3, dmgAero: 50.0 },
    },
  },
];
