---
name: add-rotation-machine
description: Model a Resonator's rotation state machine (what each button does in the game at each point, resources, stances, chains, sequences) in src/engine/rotation/actions.ts. Use when adding or fixing a character's rotation behaviour.
---

# Add or fix a character's rotation machine

Part of `model-character` (its step 5). Action times are not set here: see `model-character-timings`.

A machine turns button presses into the moves the game performs. Every character has the same buttons
(`basic`, `heavy`, `skill`, `liberation`, `echo`) plus kit specials (Hiyuki's `iai`). Read `hiyukiMachine`,
`suisuiMachine` and `lucillaMachine` in `src/engine/rotation/actions.ts` first; copy their shape.

## 1. Read the kit, don't guess

```bash
npm run kit -- "NAME"   # every skill text, row label, hit term, sequence
```

Note, from the text: forms/stances and how they're entered and left; resources (gain per move, cost, max);
chains ("chains into Basic Stage 3" → `next: 2`, zero-based); what launches into the air and what lands;
Intro/Outro behaviour; which sequences change moves or resources (vs only stats, which the effects already
cover). Row labels must match the data exactly (some have typos, e.g. Suisui's "Zephyr StanceStage 2").

If the owner gave in-game numbers (resources at each point of their rotation), those win over the text; put
the checked values in a test.

## 2. Write the machine

- `R(s)` = resources with defaults; `keep(patch, res)` = next state (moves land unless `air: true`).
- Return `{ move, state }`. Build moves with `mk(c, kind, rows, timing, events, extra)`.
- `extra`: `warn` (missing resource; the move still counts), `cast` (its skill's Concerto Regen / Resonance
  Cost rows apply), `concerto` (Concerto the text gives that the data lacks), `choice` (a per-step pick;
  read it from `option`), `tags` (numbers buffs depend on, e.g. Suisui's Floral Epistle), `levels` (stacks
  this move sets for its own hits), `seconds` (when it isn't one ordinary action), `chafe` / `frostbind`.
- Multi-hit moves: several `RowRef`s, `times` for repeats, `bonus` for an extra multiplier row.
- Sequences: the factory gets `sequence`; e.g. Hiyuki S2 starts with 3 Snowforged Blade.
- `swappedOut`: what resets when the character leaves. `gauges`: resources shown on the buttons.
- Register in `MACHINES`. Rows that inflict a Negative Status go in `STATUS_ROWS` (status, stacks, `fromSeq`, `mode`).

## 3. Test

Add to `src/engine/__tests__/rotation.test.ts`: press each button through a realistic rotation and assert the
row, resources and warnings at every point the owner (or the text) gives. Include each sequence that changes
something. Then `npx vitest run src/engine/__tests__/rotation.test.ts` and `npx tsc -b --noEmit`.

## 4. Look at it

Open the team's rotation screen (skill `check-ui`): the button previews, gauges and warnings should read right.
