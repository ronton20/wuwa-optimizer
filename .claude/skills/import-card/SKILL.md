---
name: import-card
description: Add a WuwaBot build card as an import test case, or fix the card reader (src/import/readCard.ts) when a card reads wrong. Use when the owner adds cards to tests-support/cards/ or reports a misread import.
---

# WuwaBot cards

**Privacy first: cards show the player's UID.** They stay in `tests-support/cards/` (gitignored). Never commit
them, copy them anywhere public, or paste the UID. `tests-support/cards.expected.json` holds only what the card
should read as.

## Add a card

1. The owner puts `tests-support/cards/<name>.jpeg` (lowercase character name).
2. Look at the card image and write its entry in `tests-support/cards.expected.json`, same shape as the others:
   `character`, `sequence`, `skillLevels`, `weapon`, and 5 `echoes` with `name`, `set`, `main` ("stat value")
   and 5 `subs`. Stat keys are the engine's (`critRate`, `critDmg`, `atkPct`, `dmgGlacio`, `energyRegen`,
   `dmgLib`…). Read every number off the image; don't guess.
3. Echoes that look almost identical to another one (same model, different colour) may be listed in
   `"unsure": [index…]`.
4. `npx vitest run src/import` — the suite runs only where the cards folder exists.

## Fix a misread

Find which field is wrong from the test output, then look at the card and at how `readCard.ts` reads that
field (OCR regions, the name/stat fallbacks, icon matching by head + full picture, set symbol scoring by centre
+ full-icon distance). Fix the reader, not the expected file, unless the expected file was wrong. All cards
must stay green.

If the character is new, model their kit too (effects in `src/engine/effects/characters.ts`, mark it in
`UNVERIFIED` until checked against in-game numbers).
