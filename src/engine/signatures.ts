import type { GameData, Weapon } from '../data/types';

/** Each Resonator's signature weapon (not in the game data, so kept by hand). */
export const SIGNATURE: Record<string, string> = {
  Hiyuki: 'Frostburn',
  Cartethyia: "Defier's Thorn",
  Chisa: 'Kumokiri',
  Qingxiao: 'Glint of Clouds',
  Lucilla: 'Freeze Frame',
  Suisui: "Firstlight's Herald",
};

export const signatureOf = (characterName: string, data: GameData): Weapon | undefined =>
  data.weapons.find((w) => w.name === SIGNATURE[characterName]);
