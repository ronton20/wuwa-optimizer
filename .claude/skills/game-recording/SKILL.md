---
name: game-recording
description: Get action timings, resource gains and damage numbers from a gameplay video or screenshots (ffmpeg frames → read them), and compare them with the rotation simulator. Use when the owner gives a recording or in-game screenshots.
---

# Read a gameplay recording

Claude can't play a video; extract frames with ffmpeg and read them as images.

## Setup

- ffmpeg on PATH (`winget install ffmpeg`).
- Recordings and frames stay in `tests-support/recordings/<Name>/` (gitignored). They may show the UID too.

## Extract

```bash
# overview: 2 frames/s with the time in the name
ffmpeg -i tests-support/recordings/run.mp4 -vf "fps=2,scale=960:-1" tests-support/recordings/frames/%05d.png
# a short window at full rate for timing (start 12.0s, 3s long, 30 fps)
ffmpeg -ss 12 -t 3 -i tests-support/recordings/run.mp4 -vf "fps=30,scale=960:-1" tests-support/recordings/win/%04d.png
# crop a gauge or the damage-number area to read it more reliably
ffmpeg -ss 12 -t 3 -i run.mp4 -vf "fps=30,crop=400:120:760:900" crop/%04d.png
```

Frame N at F fps = time (N-1)/F from the start time. Skim the overview first to find each action, then
extract short full-rate windows around them.

## What to get, and where it goes

- **Action times:** follow the `model-character-timings` skill (they go in `src/engine/rotation/recordedTimes.ts`).
- **Concerto / Frostheart / other gauges** after each move: compare with the simulator (run the same rotation,
  as in the "in-game … rotation" test) and fix `actions.ts` / the data build where they differ.
  `FROSTHEART_SKILL` (Jade Cleave / Petalfall) is the one Frostheart estimate left; per-hit gains are game data.
- **Damage numbers:** compare with the simulator's per-move damage using the same builds and enemy. ToA floors
  have buffs; get the floor's buff text (screenshot) and account for it. Negative Status hits don't crit and repeat
  the same number, so they're the easiest to match (Hiyuki's Snow Rust Glacio Bite confirmed
  `NEGATIVE_STATUS_FACTOR` = 1). The owner's exported builds live in `tests-support/imports/` (gitignored).

Report what was measured, the frame/time it came from, and what changed in the code. Delete extracted frames
when done.
