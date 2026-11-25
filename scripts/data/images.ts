/**
 * Mirrors the game art the snapshot references (character icons, weapon icons, echo icons,
 * sonata icons, skill icons) into public/img/<file>.webp, so the live site never hot-links.
 *
 *   npm run data:images
 *
 * The game files only hold image *paths*; the pictures come from a community asset CDN.
 * Set WUWA_IMG_BASE to try another CDN. Missing images are skipped — the UI falls back
 * to element-coloured placeholders, so a failed download never breaks the site.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import data from '../../src/data/current.ts';

const BASES = (process.env.WUWA_IMG_BASE ?? 'https://api.hakush.in/ww/UI/').split(',');
const OUT = resolve('public/img');
mkdirSync(OUT, { recursive: true });

const paths = new Set<string>();
for (const c of data.characters) {
  Object.values(c.images).forEach((p) => paths.add(p));
  c.skills.forEach((s) => paths.add(s.icon));
  c.sequences.forEach((s) => paths.add(s.icon));
}
data.weapons.forEach((w) => paths.add(w.icon));
data.echoes.forEach((e) => paths.add(e.icon));
data.sonatas.forEach((s) => paths.add(s.icon));
paths.delete('');

// /Game/Aki/UI/UIResources/Common/Image/X/T_Y  ->  UIResources/Common/Image/X/T_Y.webp
const remote = (gamePath: string) => gamePath.replace(/^\/Game\/Aki\/UI\//i, '').replace(/^\//, '') + '.webp';

let ok = 0, skipped = 0;
const failed: string[] = [];
const queue = [...paths];

async function worker() {
  for (let p = queue.shift(); p; p = queue.shift()) {
    const file = resolve(OUT, `${p.split('/').pop()}.webp`);
    if (existsSync(file)) { skipped++; continue; }
    let done = false;
    for (const base of BASES) {
      try {
        const res = await fetch(base + remote(p));
        if (!res.ok) continue;
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        ok++; done = true; break;
      } catch { /* try next base */ }
    }
    if (!done) failed.push(p);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
console.log(`Images: ${ok} downloaded, ${skipped} already present, ${failed.length} not found.`);
if (failed.length) console.log(`First missing: ${failed.slice(0, 5).join(', ')}`);
