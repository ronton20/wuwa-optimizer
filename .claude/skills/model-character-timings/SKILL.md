---
name: model-character-timings
description: Measure a Resonator's action times (seconds per move) from the owner's gameplay recordings in tests-support/recordings/<Name>/ and put them in src/engine/rotation/recordedTimes.ts; with no recording, keep the defaults and say so. Use when the owner says "time <name>", adds recordings, or asks why a rotation's time/DPS looks off.
---

# Time a Resonator's moves

Input: a Resonator name. Output: `RECORDED_TIMES["<Name>"]` in `src/engine/rotation/recordedTimes.ts`, or a
clear "no recording, defaults used". The engine's lookup (`actionTime` in `timing.ts`) is:
step's own time → recorded move → recorded kind → the machine's `seconds` estimate → `DEFAULT_TIMES`. The
rotation screen shows which one a step used ("measured from a recording", "estimate", "placeholder").

## 1. Find the recordings

```bash
ls "tests-support/recordings/<Name>/"     # gitignored; may show the UID, never commit or share it
npm run kit -- "<Name>"                   # the moves (row labels) to time
```

The folder may also hold a `notes.md` from the owner (what's in each clip, sequence, weapon, floor). Read it.

**No folder or no video:** don't invent numbers. Leave `RECORDED_TIMES` alone, list which moves are on
defaults or machine estimates (`DEFAULT_TIMES`, any `seconds:` in that Resonator's machine), and tell the owner
what to record (below). Done.

## 2. Extract frames

Use the `game-recording` skill for ffmpeg (overview at 2 fps, then 30 fps windows around each move). Frame N at
F fps = start + (N-1)/F s.

## 3. Measure

A move's time = **from its input to the earliest frame the next input comes out** (the animation cancel point
the player uses), not the end of the animation. Read it off:
- the skill button greying out / its cooldown starting (Skill, Liberation, Echo);
- the character's pose / the first damage number of the next move (Basic, Heavy);
- for a chain the player holds (held Basic, charged Heavy): first input to the next separate input.

Measure each move at least twice (different clips or repeats) and take the median; if they differ by more than
0.1 s say so. Liberations: record the real animation time; the Tower's clock stop is handled by
`freezeLiberation`. Intro: from the switch press to the first input of the incoming Resonator.

## 4. Write them

```ts
export const RECORDED_TIMES: Record<string, RecordedTimes> = {
  Hiyuki: {
    source: 'tests-support/recordings/Hiyuki/toa-12.mp4, 2026-11-27',
    kinds: { basic: 0.55, intro: 1.4 },
    moves: { 'Heavy Attack - Bitterfrost: Foreclaimed Self': 1.15, 'Resonance Liberation - Foreclaiming: Inward Vision': 2.6 },
  },
};
```

Move labels are exactly what the rotation screen shows (the machine's move label; several rows join with
" + "). `kinds` covers the rest of that kind. If a machine has a `seconds:` estimate for a move you measured,
remove the estimate's comment calling it a placeholder (the recorded time wins anyway).

## 5. Check

```bash
npx vitest run src/engine && npx tsc -b --noEmit
```
`timing.test.ts` fails on a label that isn't one of the Resonator's moves. Then open the rotation screen
(Playwright MCP, or the `check-ui` script): the step times show "measured from a recording", and the total time
of the owner's rotation is close to the recording's (say how close).

## What to ask the owner to record

One clip per Resonator in a training room, 60 fps, no other Resonator switching in, each of: Basic string ×2,
Heavy, every enhanced Heavy/Basic, Skill (each variant), Liberation, Echo, Intro (switch in), plus their real
rotation once. A `notes.md` with sequence, weapon and what each clip shows.

## Grow this skill

When a kind of move needs a new rule to measure (e.g. moves that continue during a switch), add it to step 3.
