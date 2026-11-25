// Ground truth read from in-game screenshots (game version 3.8, Nov 2026).
// Every number here was typed from a screenshot in Pictures/wuwa_data/<character>/.

export interface GoldenCharacter {
  name: string;
  weapon: string;
  /** "More Stats" white numbers: character base + weapon base, Lv 90 */
  base: { hp: number; atk: number; def: number };
  /** Skill Detail rows at Lv 10, exactly as shown in game (without the " HP" suffix) */
  skillRows: Record<string, string>;
}

export const GOLDEN: GoldenCharacter[] = [
  {
    name: 'Hiyuki',
    weapon: 'Frostburn',
    base: { hp: 10300, atk: 1049, def: 1112 },
    skillRows: {
      'Basic Attack - Present Self Stage 1 DMG': '37.72%+37.72%',
      'Basic Attack - Present Self Stage 2 DMG': '90.25%',
      'Basic Attack - Present Self Stage 3 DMG': '4.92%*5+98.37%',
      'Heavy Attack - Frost Splinter: Present Self DMG': '79.31%*2+158.61%',
      'Mid-air Attack - Present Self DMG': '128.18%',
      'Dodge Counter - Present Self DMG': '173.75%',
      'Basic Attack - Foreclaimed Self Stage 1 DMG': '49.27%',
      'Basic Attack - Foreclaimed Self Stage 2 DMG': '40.02%+40.02%',
      'Basic Attack - Foreclaimed Self Stage 3 DMG': '25.16%*4+67.08%',
      'Basic Attack - Foreclaimed Self Stage 5 DMG': '12.17%+109.47%',
      'Heavy Attack - Foreclaimed Self DMG': '107.16%',
      'Heavy Attack - Bitterfrost: Foreclaimed Self DMG': '15.41%*8+493.05%',
      'Mid-air Attack - Foreclaimed Self Stage 1 DMG': '28.83%+28.83%+38.43%',
      'Mid-air Plunging Attack - Foreclaimed Self DMG': '111.60%',
      'Dodge Counter - Foreclaimed Self DMG': '81.77%+81.77%',
      'Foreclaiming: Inward Vision DMG': '397.62%',
      'Foreclaiming: Blade Liberation Base DMG': '198.81%+795.24%',
    },
  },
  {
    name: 'Cartethyia',
    weapon: "Defier's Thorn",
    base: { hp: 14800, atk: 724, def: 611 },
    skillRows: {
      'Stage 1 DMG': '4.78%',
      'Stage 2 DMG': '3.94%+3.94%+5.25%',
      'Stage 3 DMG': '4.28%+4.28%+4.28%+4.28%',
      'Stage 4 DMG': '2.52%*3+7.54%',
      'Dodge Counter DMG': '6.85%+6.85%+6.85%+6.85%',
      'Heavy Attack DMG': '2.08%*3+6.24%',
      'Mid-air Attack': '5.65%',
      'Blade of Howling Squall DMG': '13.12%*7',
    },
  },
  {
    name: 'Chisa',
    weapon: 'Kumokiri',
    base: { hp: 10775, atk: 937, def: 1136 },
    skillRows: { 'Skill DMG': '954.29%' },
  },
  {
    name: 'Qingxiao',
    weapon: 'Glint of Clouds',
    base: { hp: 10300, atk: 962, def: 1112 },
    skillRows: {
      'Basic Attack - Stringblade Stage 1 DMG': '30.13%*2',
      'Basic Attack - Stringblade Stage 2 DMG': '37.09%*2',
      'Basic Attack - Stringblade Stage 3 DMG': '24.36%*4',
      'Basic Attack - Stringblade Stage 4 DMG': '86.73%+5.43%*4',
      'Heavy Attack - Stringblade DMG': '14.62%*3+21.92%*6+263.03%',
      'Mid-air Attack - Stringblade Stage 1 DMG': '7.24%*5+54.28%',
      'Mid-air Attack - Stringblade Stage 2 DMG': '44.89%+22.45%*2',
      'Mid-air Attack - Stringblade Stage 3 DMG': '11.14%*5+83.51%',
      'Skill DMG': '33.41%*10+1336.01%',
    },
  },
];

/** Weapon screen values (Lv 90). */
export const GOLDEN_WEAPONS: Record<string, { atk: number; substat: string }> = {
  "Defier's Thorn": { atk: 412, substat: 'hpPct 72.2' },
  Kumokiri: { atk: 500, substat: 'critRate 36.0' },
  'Glint of Clouds': { atk: 500, substat: 'critRate 36.0' },
};
