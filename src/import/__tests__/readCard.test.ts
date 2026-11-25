import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import data from '../../data/current';
import { cardToBuild, readCard, similarity } from '../readCard';
import { defaultBuild } from '../../state/buildStore';
import expected from '../../../tests-support/cards.expected.json';
import { nodeCard, nodeIcons, nodeOcr } from '../../../tests-support/nodeCard';

// The WuwaBot cards checked by eye are kept out of the repo (they show the player's UID),
// so this suite only runs where tests-support/cards/ exists.
const CARDS = 'tests-support/cards';
const have = existsSync(`${CARDS}/hiyuki.jpeg`);
const skin = (n: string) => n.replace(/^Phantom:\s*/, '');

describe.skipIf(!have)('WuwaBot card import', async () => {
  const { ocr, stop } = have ? await nodeOcr() : { ocr: null!, stop: async () => {} };
  afterAll(stop);

  for (const [name, want] of Object.entries(expected)) {
    it(`reads ${name}'s card`, async () => {
      const r = await readCard(await nodeCard(`${CARDS}/${name}.jpeg`), data, ocr, nodeIcons);
      // echoes that look almost the same as another one (same model, different colour) may stay flagged
      const unsure: number[] = (want as { unsure?: number[] }).unsure ?? [];
      expect(r.warnings.filter((w) => !unsure.some((i) => w.startsWith(`Echo ${i + 1}:`)))).toEqual([]);
      expect(data.characters.find((c) => c.id === r.characterId)?.name).toBe(want.character);
      expect(r.sequence).toBe(want.sequence);
      expect(r.skillLevels).toEqual(want.skillLevels);
      expect(data.weapons.find((w) => w.id === r.weaponId)?.name).toBe(want.weapon);
      r.echoes.forEach((e, i) => {
        const w = want.echoes[i];
        expect(skin(data.echoes.find((x) => x.id === e.piece!.echoId)!.name)).toBe(skin(w.name));
        expect(data.sonatas.find((s) => s.id === e.piece!.setId)!.name).toBe(w.set);
        expect(`${e.piece!.main.stat} ${e.piece!.main.value}`).toBe(w.main);
        expect(e.piece!.subs.map((s) => `${s.stat} ${s.value}`)).toEqual(w.subs);
        if (!unsure.includes(i)) expect(e.confidence).toBeGreaterThan(0.6);
      });
    }, 60_000);
  }

  it('keeps the weapon rank when the card shows the same weapon, resets it otherwise', async () => {
    const r = await readCard(await nodeCard(`${CARDS}/hiyuki.jpeg`), data, ocr, nodeIcons);
    const base = defaultBuild(r.characterId!);
    expect(cardToBuild(r, { ...base, weapon: { id: r.weaponId!, rank: 5 } }).weapon.rank).toBe(5);
    expect(cardToBuild(r, { ...base, weapon: { id: 0, rank: 5 } }).weapon.rank).toBe(1);
  }, 60_000);
});

describe('fuzzy name matching', () => {
  it('tolerates OCR slips', () => {
    expect(similarity('Cartethvia', 'Cartethyia')).toBeGreaterThan(0.85);
    expect(similarity('Frostbum', 'Frostburn')).toBeGreaterThan(0.7); // importer accepts weapons from 0.6
    expect(similarity('Hiyuki', 'Lupa')).toBeLessThan(0.3);
  });
});
