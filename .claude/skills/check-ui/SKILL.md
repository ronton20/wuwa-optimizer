---
name: check-ui
description: Check a UI change visually — build, serve, seed the saved state, screenshot with Playwright, and look at the result before calling it done. Use after any change to screens, tabs or components.
---

# Check the UI by looking at it

Tests don't show layout bugs. After a UI change, look at the actual page.

## Serve

`npm run dev` (http://localhost:5173/wuwa-optimizer/) is enough to look at. For a production-like check:
`npm run build && npx vite preview` (http://localhost:4173/wuwa-optimizer/).

Icons come from `public/img/` (gitignored); run `npm run data:images` once if they're missing.

## Screenshot with Playwright

Install once: `npm i -D playwright` (or use it via `npx`) and `npx playwright install chromium`.

Seed the saved state **before the app loads** (an init script), otherwise the app's own persist writes over it:

```js
// shot.mjs: node shot.mjs
import { chromium } from 'playwright';
const state = { state: { builds: {}, saved: [], pinned: [], teams: [{ id: 'team1', name: 'Frost', members: [1108, 1109, 1110] }], mainTeam: 'team1', rotations: [] }, version: 0 };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await p.addInitScript((s) => { if (!sessionStorage.seeded) { localStorage.setItem('wuwa-optimizer:builds:v1', s); sessionStorage.seeded = 1; } }, JSON.stringify(state));
await p.goto('http://localhost:5173/wuwa-optimizer/#/t/team1');   // #/c/<characterId> for a build screen
await p.waitForTimeout(1500);
await p.screenshot({ path: 'shot.png', fullPage: true });
await b.close();
```

Useful: the build screen's back button is labelled "All Resonators"; the card import input is
`input[type=file][accept="image/*"]`, then the dialog's "Import build" button. Character ids: Hiyuki 1108,
Lucilla 1109, Suisui 1110 (others in `src/data/wuwa-*.json`).

Real saved data: the owner can use "Export my data" in the footer and give you the file to seed from.

## Look

Read the screenshot. Check: nothing overlaps or overflows, text is readable, the change is visible and does what
was asked, no page errors. Delete the scratch screenshot and script afterwards.
