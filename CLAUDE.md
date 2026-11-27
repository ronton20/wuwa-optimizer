# WuWa Build Optimizer

Fan-made Wuthering Waves build calculator and rotation simulator (React 19 + Vite + TypeScript, Tailwind v4,
Motion, Zustand, Vitest, oxlint). Live at https://ronton20.github.io/wuwa-optimizer/. Pushing to `main` runs the
tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The owner pushes; commit only when asked.

## Commands

```bash
npm run dev          # http://localhost:5173/wuwa-optimizer/
npm test             # vitest (engine, state, ui, card import)
npx vitest run src/engine/__tests__/rotation.test.ts   # one file
npx tsc -b --noEmit  # typecheck
npm run lint         # oxlint: 10 warnings are pre-existing; don't add new ones
npm run data         # after a game patch: fetch the datamine into .cache/ (~130 MB) + rebuild the snapshot
npm run data:build   # rebuild src/data/wuwa-<version>.json from .cache/ only
npm run data:images  # mirror icons into public/img/ (gitignored; needed for icons locally)
npm run kit          # what's modelled for every Resonator; `npm run kit -- "Name"` dumps one kit from the data
```

## Rules that matter

- **WuwaBot cards show the player's UID.** They live in the gitignored `tests-support/cards/` and are never
  committed, attached to issues, or shown in public places. `tests-support/cards.expected.json` holds what each
  card should read as (no UID); the import tests skip themselves where the cards folder doesn't exist (CI).
- **Game data is generated, never hand-edited.** `src/data/wuwa-<version>.json` comes from
  `scripts/data/build.ts` (Arikatsu/WutheringWaves_Data in `.cache/wuwa-data`). Change the build script and
  rebuild. After a rebuild, check that only what you meant to change changed.
- **Every UI string goes in `src/strings/en.ts`.**
- **Design:** game-like, modern, minimal. Usability beats copying the game's menus.
- **Validate in the browser, always.** Any change that reaches the UI (screens, numbers shown, rotations) is
  checked with Playwright (the Playwright MCP tools when loaded, else the `check-ui` script) before it's done.
- **Modelling a Resonator:** skill `model-character` (kit, team buffs, machine, tests from the game text);
  action times: skill `model-character-timings` (recordings in gitignored `tests-support/recordings/<Name>/`).
- **Numbers from text, not memory.** Kit, weapon, set and echo values come from the game data (`v(i)` reads the
  i-th number of a weapon rank's own text). Anything that isn't in the data gets labelled on screen as an
  estimate or a placeholder, and says where it came from.
- Kits not yet checked against in-game numbers are listed in `UNVERIFIED` (`src/engine/effects/characters.ts`)
  and show a note in the Buffs tab; mechanics not modelled at all are in `NOT_MODELLED`.

## Architecture

```
scripts/data/        fetch.ts, build.ts (datamine → snapshot), textHits.ts (hits only the kit text states),
                     kit.ts (`npm run kit`), images.ts, roster.ts, echoRolls.ts
src/data/            types.ts, wuwa-<version>.json, current.ts
src/engine/          damage engine, pure TypeScript
  damage.ts          computeDamage(build, data, { only, disable, level, echo, noBreakdown })
  stats.ts           stat sheet with contributions by source
  effects/           characters.ts (KITS), team.ts (TEAM_KITS), weapons.ts (all 94), echoes.ts (sets + main echoes)
  negative.ts        Negative Status damage: level base × the game's per-stack multiplier × DEF × RES × Amplify
  mechanics.ts       which trigger each buff needs; the optimizer turns off buffs nobody in the team can trigger
  optimizer.ts       single-hit optimizer (weapon, sets, main stats) in a Web Worker
  rotation/          actions.ts (per-character state machines), sim.ts (rotation simulator),
                     timing.ts (action times, timed buffs), recordedTimes.ts (measured times per Resonator),
                     status.ts (Negative Statuses on the target: stacks, ticks, Glacio Bite, Snow Rust)
src/state/           buildStore.ts (Zustand, persisted: builds, saved, teams, rotations), share.ts
src/import/          readCard.ts: WuwaBot card → build (tesseract.js OCR + icon matching)
src/ui/              screens/ (CharacterSelect, BuildScreen, RotationScreen, TeamsSection), tabs/, components/
```

### Effects (buffs)

`Effect` (`src/engine/types.ts`): `condition` (toggle or stacks with key/max/default), `mode` (one choice of a
kit's modes, e.g. Lucilla's Glacio Chafe / Echo), `mods` (stat or damage changes; `fromStat`, `byStacks`),
`appliesTo` (rows, skill kinds, damage types, element, `statuses` for Negative Status DMG), `raisesMax`, team-only `onlyFor`. Teammate effects get
a `t{n}.` prefix on their ids and keys. Linked teammates follow the owner's own build of that character
(`linkTeam` attaches it on read, `strip` removes it before storing).

### Rotations (`src/engine/rotation/`)

- **Buttons:** every character has Basic, Heavy, Skill, Liberation, Echo, plus kit specials (Hiyuki's Iai).
  A press becomes what that button does in the game *right now* (state machine in `actions.ts`; `machineFor(id,
  data, sequence)`). The UI shows the press; the math uses the real row. "Every move" lists every damage row
  with its type ("Resonance Liberation - …").
- **Hand-made machines:** Hiyuki, Suisui, Lucilla (checked against the owner's in-game rotation; the test
  "the in-game Suisui > Lucilla > Hiyuki rotation…" replays it). Everyone else uses `genericMachine`.
- **Machines track:** forms/stances, resources (`res`), ground/air (`air`), chains (`next`), per-step choices
  (`choice` + `RotationStep.option`, e.g. Snowforged Blades used), sequence changes.
- **Simulator (`sim.ts`):** switching adds Outro + Intro only with full Concerto (or forced per step);
  Concerto/Energy from the data (`concerto`/`energy` per hit, "X Concerto Regen" rows, Resonance Cost) plus
  weapon passives that restore Concerto; timed buffs (`timing.ts`): Outros, and toggles whose trigger is a plain
  action and whose own text (effect, sequence, weapon, sonata, echo) gives a duration. Everything else follows
  its Buffs-tab toggle and is listed as "Other buffs counted".
- **Action times:** step's own time → `RECORDED_TIMES` (move, then kind) → the machine's `seconds` estimate →
  `DEFAULT_TIMES` (`actionTime` in `timing.ts`); the step panel says which one it used.
- **Negative Statuses (`status.ts`):** which rows inflict what is in `STATUS_ROWS`; each status's per-stack
  multipliers, period, duration and limit come from its base buff in `buff.json` (`data.negativeStatus`). Hits
  count for whoever applied the status. Glacio Chafe → Glacio Bite with Hiyuki in the team.
- **Text hits:** "dealing X DMG equal to N% of ATK" hits with no Skill Detail row are added by the build
  (`fromText`, `seq`); the Skills tab marks them.
- **Placeholders:** `DEFAULT_TIMES` (action times), `FROSTHEART_GAIN`, Lucilla's held Basic = 4s,
  `NEGATIVE_STATUS_FACTOR` (1: the community formula's 1.25078 is already in the game's tables; unconfirmed).
  Replace from recordings (skills `game-recording`, `model-character-timings`).

## Status and what's next

Done: 21 kits modelled (17 marked UNVERIFIED), all weapon passives / sets / main echoes, single-hit optimizer,
teams with linked builds, rotation screen with DPS, Concerto/Energy, timed buffs, buff lanes, main echo damage,
Negative Status damage for all six statuses + Glacio Bite (game tables), 33 text-only hits for every Resonator.

Waiting on the owner's Tower of Adversity recording of Suisui → Lucilla → Hiyuki (+ the floor's buff list):
real action times, where Suisui's last 2 Concerto come from (she reaches 98, the game says 100), Frostheart per
attack, and one Negative Status damage number (e.g. a Glacio Bite hit) to confirm `NEGATIVE_STATUS_FACTOR`.

The plan, in order:
1. Rotation accuracy: recorded timings, time the remaining toggle buffs (hit/debuff/stack triggers), confirm the
   Negative Status base, Havoc Bane's DEF cut on hits and the other stack-limit raises.
2. Rotation DPS as the single source of truth: show the main team's rotation DPS on each character and in saved
   build comparisons; hand-made machines for more characters (skill `add-rotation-machine`).
3. Optimizer v2: maximize rotation DPS; pick from the owner's echo pool + spares; main echo of any cost; builds
   under 12 cost (e.g. Cartethyia); 4/3/3/1/1 and 4/4/1/1/1 with a 1-piece set plus two 2-piece sets.
4. Substat playground: change substats, see rotation DPS live.
