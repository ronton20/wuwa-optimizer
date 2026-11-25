// Every user-facing string lives here so more languages can be added later.
export const en = {
  appName: 'WuWa Build Optimizer',
  tagline: 'Min-max your Resonators. Every number, colour-coded.',
  chooseResonator: 'Choose a Resonator',
  comingSoon: 'Build calculator arrives in the next update',
  weaponType: 'Weapon',
  element: 'Element',
  baseStats: 'Lv 90 base',
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  scalesOn: 'Scales on',
  damageRows: 'damage hits',
  dataVersion: (v: string, d: string) => `Game data ${v} · built ${d}`,
  disclaimer: 'Fan-made tool, not affiliated with Kuro Games. Game data and art belong to Kuro Games.',
  discord: 'Discord: ronton20',
  coffee: 'Buy me a coffee',
};
export type Strings = typeof en;
export const t = en;
