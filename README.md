# WuWa Build Optimizer

A fan-made Wuthering Waves build calculator: pick a Resonator, set skills, sequences, weapon and echoes, and see every skill's damage with each source colour-coded.

Live: https://ronton20.github.io/wuwa-optimizer/

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173/wuwa-optimizer/
npm test           # checks the game data against in-game screenshots
```

## Game data

The snapshot in `src/data/wuwa-<version>.json` is generated from the community datamine
[Arikatsu/WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data) and committed,
so the site never depends on a third-party server.

After a game patch:

```bash
npm run data       # fetch the latest tables (~130 MB, into .cache/) + rebuild the snapshot
npm test           # must stay green
```

- Add characters in `scripts/data/roster.ts`.
- `npm run data:images` mirrors icons into `public/img/` (also runs automatically on deploy).

## Layout

```
scripts/data/      fetch.ts, build.ts, images.ts, roster.ts, echoRolls.ts
src/data/          types.ts, wuwa-<version>.json, current.ts
src/engine/        damage engine (pure TypeScript) + tests
src/ui/            components and screens
src/strings/en.ts  every UI string
```

## Deploying

Pushing to `main` builds, tests and deploys to GitHub Pages
(repo Settings → Pages → Source: **GitHub Actions**).

---

Fan-made, not affiliated with Kuro Games. Game data and art belong to Kuro Games.
Questions: Discord **ronton20** · [Buy me a coffee](https://buymeacoffee.com/ronton20)
