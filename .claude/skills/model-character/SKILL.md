---
name: model-character
description: Model a Resonator completely from the game data — damage rows, kit buffs (inherents, forte, sequences), what they give teammates, their rotation state machine, Concerto/Energy, Negative Status — so they work in the calculator, rotations and optimizer. Use when the owner says "model <name>", "add <name>", or a Resonator shows up with no kit. Timings are a separate skill (model-character-timings).
---

# Model a Resonator

Input: a Resonator name. Output: that Resonator is fully usable: damage, Buffs tab, Team tab, rotation buttons,
Concerto/Energy, optimizer triggers, with tests. Everything comes from the game text and numbers. Never from
memory, wikis or "what the character usually does". Action times are not part of this skill.

## 0. See where they stand

```bash
npm run kit                 # coverage table: kit / team / machine / status rows / timings / verified
npm run kit -- "<Name>"     # every skill text, row, hit term (element, type, Concerto, Energy), sequence, node
```

Save the dump to `$CLAUDE_JOB_DIR/tmp` (or a scratch file) and work from it. Read **all** of it before writing
code: skill descriptions, every row label, all 6 sequences, both inherents (tree 4, 5), Forte, Intro, Outro.

## 1. Check the data first

The snapshot is generated, never edited by hand (`scripts/data/build.ts` makes it). In the dump, look for:
- `UNMATCHED damage id` on a hit term: no Concerto/Energy for it. Fix the matching in `build.ts`, run
  `npm run data:build`, and check with `git diff --stat src/data` that only what you meant to change changed.
- Wrong element / dmgType / scaling on a term (e.g. a Forte hit that the text calls Resonance Liberation DMG,
  or an HP-scaling hit that reads ATK): fix in `build.ts` the same way.
- Rows the kit text mentions that have no row: the build adds the ones written as "… DMG equal to X% of ATK/HP/DEF"
  (`fromText`, with `seq` for a sequence's hit). The build prints them; anything phrased differently (fixed
  numbers, "DMG Multiplier increased to …") goes in NOT_MODELLED, or extend `textHits.ts` if the phrasing repeats.

## 2. Write the inventory (before code)

Go sentence by sentence through every skill, inherent and sequence and sort each effect into one bucket. Keep
this list; it becomes the test plan and the NOT_MODELLED entries.

| What the text says | Where it goes |
| --- | --- |
| stat or DMG Bonus up (ATK%, Crit, Element DMG, Basic DMG…) | `KITS` effect, `mods` with a StatKey |
| "DMG Amplified" / "takes X% more DMG" / "DMG Deepen" | `amplify` |
| "multiplier increased by X%" | `multBonus` (with `appliesTo.rows`) |
| "ignores X% DEF" / "RES reduced" / "ignores X% RES" | `defIgnore` / `resShred` |
| buff only for some hits | `appliesTo`: `rows` (regex on exact row labels), `skillKinds`, `dmgTypes`, `element` |
| conditional ("After casting…", "When X is inflicted…") | `condition` toggle; label in the game's words so `timing.ts` and `mechanics.ts` can read it |
| per stack | `condition` stacks + `byStacks` if not linear; shared counter = shared `key` |
| raises a limit (S2 "stack limit +3") | `raisesMax` |
| scales off another stat ("0.5% Crit per 1% ER over 100%") | `fromStat` |
| Resonance Mode / stance picker | `mode(...)` helper (see `HSIN_FLARE`) |
| buffs the team / next Resonator / Outro | `TEAM_KITS` (`src/engine/effects/team.ts`), or `team: true` on a sequence effect |
| buff only for one teammate | `onlyFor` |
| a move changes what a button does, resources, stances | rotation machine (step 5) |
| a move inflicts N stacks of a Negative Status | `STATUS_ROWS` in `rotation/actions.ts` (sequence / mode aware) |
| "X DMG is Amplified" for a Negative Status | effect with `appliesTo: { statuses: [...] }` (counts only on that status's hits) |
| a hit stated only in the text ("dealing … equal to X% of ATK") | nothing: `scripts/data/textHits.ts` adds it as a row at `npm run data:build`; check it in the build output |
| something the engine can't express | `NOT_MODELLED` / `TEAM_NOT_MODELLED`, in plain words |

Rules:
- `seq` = the sequence that unlocks it (0 = base kit); `maxSeq` when a later sequence replaces it.
- Ids: `c.<short>.<what>`; team kit ids are short (`outro`, `s2`): they get a slot prefix when collected.
- `source`: "Inherent · <name>", "Forte · <name>", "S3 · <name>", "Outro · <name>": the exact in-game names.
- Numbers come from the text at max level. When a value is only in a skill row (e.g. "Outro ATK Bonus"), read
  that row. Anything you had to estimate gets "(estimate: <why>)" in its `text` so it shows on screen.
- Defaults: a buff the Resonator gets in its normal rotation defaults on; a buff that needs a teammate or an
  unusual setup defaults off.
- Element / Negative Status mechanics the kit inflicts must read right in `guessMechanics` (the dump prints it).
  If the guess is wrong, fix the regex in `src/engine/mechanics.ts`, not the kit.

## 3. Write the kit

`src/engine/effects/characters.ts`: add the `KITS` entry (keep the order of the inventory), add the name to
`UNVERIFIED`, and add `NOT_MODELLED` lines. `src/engine/effects/team.ts`: `TEAM_KITS` (and `TEAM_NOT_MODELLED`).
Copy the shape of a close existing kit (supports: Shorekeeper, Lily; Negative Status: Cartethyia, Chisa; stance
characters: Hiyuki, Galbrena).

## 4. Concerto, Energy and the kit's own gauges

Each hit's gain on the Resonator's own gauge (Frostheart, Ring of Chainsaw, …) is in the data: `HitTerm.special`
(damage.json SpecialEnergy1..5; the dump prints them per term). Find which slot is which gauge by matching the kit
text, then read it with `gaugeOf(c, kind, row, slot)`. Only gains the text gives per cast ("restores 200 Dedication",
"+40 Ring of Chainsaw") or that the data lacks (Cartethyia's Conviction) are typed in, as a named constant saying so.


The sim takes Concerto/Energy per hit from the data, "X Concerto Regen" rows and "Resonance Cost". After the
machine is in, run a full rotation (step 6) and check the Resonator reaches 100 Concerto and enough Energy
for their Liberation in a normal rotation. A gap usually means a row the text gives Concerto to (Forte
specials, Intro), which goes in the move's `concerto` with a comment quoting the text.

## 5. The rotation machine

Use the `add-rotation-machine` skill. Hand-make a machine when the text has any of: stances/forms,
resources that unlock moves, chains ("chains into Stage 3"), moves that only work after another, enhanced
Heavy/Skill, air moves. The `genericMachine` is only right for a plain 5-button kit. Every damage row in the
dump must be reachable from some button sequence, or be listed in "Every move" on purpose (dodge counters,
rarely-used variants).

## 6. Test

Add to `src/engine/__tests__/kits.test.ts` (kit) and `rotation.test.ts` (machine):
- each effect: the zone it touches changes by the text's number on the hits it should, and not on others
  (pattern: Hsin / Ciaccona tests: `hit(build, row).zones.<zone>`);
- each mode / stack / raisesMax / sequence that changes something;
- the machine through a realistic rotation: rows, resources, warnings at each point;
- a full-rotation Concerto / Energy check.
The existing tests also check: every `rows` regex matches a real row, team kits name real Resonators, the
default build gives finite damage.

```bash
npx vitest run src/engine && npx tsc -b --noEmit && npm run lint   # lint: no new warnings (11 pre-existing)
npm run kit -- "<Name>"                                          # no "NO ROW MATCH", coverage filled in
```

## 7. Look at it (Playwright)

Validate in the browser with the Playwright MCP tools (`browser_navigate`, `browser_snapshot`,
`browser_take_screenshot`) if they are loaded; otherwise the script in the `check-ui` skill. Check the
Resonator's build screen (Buffs tab lists every effect with the right toggles, Skills tab rows), a team with
them (Team tab, their buffs reaching the on-field Resonator), and the rotation screen (buttons do what the
text says, gauges, Concerto reaches 100, no unexpected warnings). Fix and recheck until it reads right.

## 8. Report and grow this skill

Tell the owner: what's modelled, the NOT_MODELLED list, anything estimated, and what to check in game to take
them off `UNVERIFIED` (a few in-game damage numbers or the Concerto at a point of the rotation).

If the kit needed something the engine can't do, add it to Gaps below (and fix it if it's small and general).

## Gaps the engine has (update as they're fixed)

- Negative Status damage is simulated in rotations only (`rotation/status.ts`, numbers from the game's buff data,
  `engine/negative.ts`). Havoc Bane's DEF −2%/stack is a Chisa kit stack effect (`c.chisa.bane`; other appliers should share its key). Not yet: stack-limit raises other than Suisui's
  Landscape, moves that fill stacks to the limit or trigger a status hit directly (Hsin, Cartethyia S2), the
  base factor is unconfirmed (`NEGATIVE_STATUS_FACTOR`).
- Tune Rupture / Tune Strain / Tune Break damage and Tune Break Boost: not modelled.
- Fixed-number hits ("61,803 Havoc DMG") and multiplier formulas in text ("42% × stacks × …"): no row type yet.
- Healing and shields: not computed.
- Echo-type conversion ("counts as Echo Skill DMG"): not modelled per move.
- Timed states inside a machine (Cartethyia's 12s Manifest, Chisa's Chainsaw Fever) aren't timed; the machine assumes
  the player stays inside them.
- Moves without a damage row of their own: give the move `named: "<skill name>"` so its "<name> Concerto Regen" /
  "<name> Resonance Cost" rows apply (A Knight's Heartfelt Prayers). Air moves: the shared `JUMP` button.
