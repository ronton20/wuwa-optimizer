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

**Ask for the inputs first.** Naming moves from the animation alone is unreliable (Basics especially). Each clip
needs the owner's press list (e.g. `basic ×4, skill, basic ×4, liberation, echo, [switch] …`) in its notes. Without
it, only switches, Skill/Liberation/Echo casts (cooldowns starting) and cinematics can be timed.

Tools in `scripts/` (run from `tests-support/recordings/`, output under `frames/`, gitignored):
- `extract.sh <video> <dir>`: 10 fps crops of the ToA timer, the party column and the E/Q/R buttons.
- `node analyze.mjs <dir>`: OCRs the timer and cooldowns, reads which party slot lacks its number badge (= on the
  field) → `<dir>/timeline.json`. ~3 min per minute of video.
- `node gaps.mjs <dir>`: cinematics (timer hidden ≥ 1 s) and the game time that passed across each one.
- `bar.sh <video> <start> <dur> <out.png>`: a 10 fps sheet of skill bar + timer (one cast = a cooldown appears).
Contact sheets of the action: ffmpeg `fps=4,scale=640:-2,drawtext=…,tile=3x4` (on Windows `drawtext` needs
`fontfile='C\:/Windows/Fonts/arial.ttf'`).

Gauges (not times, but read from the same clips):
- **Concerto = 100** when both off-field portraits (top right) get a white ring: crop the party column at 10 fps,
  `node glow.mjs <dir> > glow.txt`, then `node onsets.mjs glow.txt <timeline dir>` (needs ≥ 1 s of glow; shorter
  spikes are hit flashes). A Resonator who switches out right as they reach 100 shows no glow: their last move
  is where they hit it.
- **A ring gauge around a skill button** (Cartethyia's Conviction on Liberation): crop the button, fit the ring
  centre on a full frame, `node ring.mjs <dir> <cx> <cy> <r> <start> <fps>` prints the fill × 120.

**Use the ToA timer as the clock** (mm:ss:cc, top centre): it's game time, it shows edits (jumps), and it stops
during Liberation cinematics. Video time is only for finding frames.

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

## Measured so far (2026-11-27, owner's ToA clips of the Hiyuki and Cartethyia teams)

- ToA Liberation clock stop: 0.12–0.15 s left per cinematic (`FROZEN_LIBERATION_TIME` = 0.15).
- Switching in Hiyuki (Outro + Intro) hides the UI for 1.48–1.70 s (recorded as her Intro, 1.6 s).
- With the owner's press lists (`<clip>_rotation.txt`): Lucilla's held Basic 3.19 / 3.22 s; Hiyuki Intro → Inward
  Vision (Basic 3 + Frost Splinter) 4.2–4.5 s; Hiyuki Foreclaimed Basic ×5 4.2–4.3 s; Suisui Zephyr ×4 2.4–2.9 s,
  Awakening Spring 0.99 s, Drizzle ×4 + Echo 6.0 s. All in `recordedTimes.ts`.
- A cast shows on the skill bar as a ring around the button, then a cooldown number. Inputs that don't touch the bar
  (Basic, Heavy) can only be timed as a group between two casts; split a group by eye only with a note saying so.
- Cartethyia team timed from cartethyia/toa_1 (stretches between casts exact; splits inside them by default
  proportions, or by Conviction-ring steps for Fleurdelys). Replay vs clip: finisher at 30.76 s vs 30.84 s.
- A switch that doesn't hide the UI (no Outro/Intro cinematic) is read off the skill bar changing icons.
- Moves whose labels carry details ("Sawring - Eradication (40 Ring…)") can be recorded without the "(…)" part.
- `still.mjs <dir>` lists spans where the timer is visible but stopped (a clock stop without a cinematic).

## Grow this skill

When a kind of move needs a new rule to measure (e.g. moves that continue during a switch), add it to step 3.
- Hiyuki training-room clip (hiyuki/Hiyuki timings.mp4, 2026-11-28): no ToA timer or input display; clips cut in
  Clipchamp, found by the purple title cards (`signalstats` U>150 and V>140). Times are first frame → idle, so they
  are animation lengths, not cancel points. Frost Splinter ~2.1 s, Present Self Stage 3 ~1.4 s (the ToA
  Intro → Inward Vision stretch is ~0.8 s longer than the two together), Skill 1.7, Jade Cleave 1.1, Petalfall 0.9,
  Iai 1.0, Inward Vision 4.1, Blade Liberation 6.0, Bitterfrost 3.1.
