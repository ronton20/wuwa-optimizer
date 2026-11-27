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

## Playwright MCP (preferred)

The project has the Playwright MCP server configured (`@playwright/mcp`). When its tools are loaded
(`browser_navigate`, `browser_evaluate`, `browser_snapshot`, `browser_take_screenshot`, `browser_click`,
`browser_console_messages`; use ToolSearch "playwright" if they're deferred):
1. `browser_navigate` to the page, then `browser_evaluate` to seed `localStorage['wuwa-optimizer:builds:v1']` with
   the state below and navigate again (a reload, so the app reads it).
2. `browser_snapshot` to read the page, `browser_click` to open tabs / steps, `browser_take_screenshot` to look.
3. `browser_console_messages` for errors.

If the MCP tools aren't in the session (background jobs may not load them), use the script below.

## Screenshot with a Playwright script

Playwright is not a project dependency. In a scratch folder (`$CLAUDE_JOB_DIR/tmp` in a background job):
`npm init -y && npm i playwright && npx playwright install chromium` (the browser download is shared, once per
machine), then `node shot.mjs` there. Rotations can be seeded too: add
`rotations: [{ id: 'r1', name: 'Check', teamId: 'team1', steps: [{ char: 1109, button: 'liberation' }], freezeLiberation: true }]`
to the state; steps in the strip are buttons with the move label as `aria-label`.

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
