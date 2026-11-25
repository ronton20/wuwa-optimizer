/**
 * Mirrors character, weapon, echo and sonata art into public/img/ and writes
 * src/data/images.json (key -> local path). The app only requests images listed in that
 * manifest, so a missing picture never causes a 404 — it just shows the placeholder.
 *
 *   npm run data:images        (also runs automatically on every deploy)
 *
 * Source: github.com/ryanbenson/wuthering-waves-assets (community repo, names files by
 * display name). Override with WUWA_IMG_BASE if it ever moves.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import data from '../../src/data/current.ts';

const BASE = process.env.WUWA_IMG_BASE ?? 'https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/master/images/';
const PUBLIC = resolve('public');
const MANIFEST = resolve('src/data/images.json');

// the source repo's two naming styles
const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');
const pascal = (s: string) =>
  (s.normalize('NFD').replace(/\p{M}/gu, '').replace(/'/g, '').match(/[a-zA-Z0-9]+/g) ?? [])
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('');
const names = (s: string) => [...new Set([pascal(s), sanitize(s)])];

interface Job { key: string; out: string; candidates: string[] }
const jobs: Job[] = [];
for (const c of data.characters)
  jobs.push({ key: `char:${c.id}`, out: `img/characters/${c.id}.png`, candidates: names(c.name).map((n) => `${n}.png`) });
for (const w of data.weapons)
  jobs.push({ key: `weapon:${w.id}`, out: `img/weapons/${w.id}.png`, candidates: names(w.name).map((n) => `weapons/${n}.png`) });
for (const e of data.echoes)
  jobs.push({ key: `echo:${e.id}`, out: `img/echoes/${e.id}.webp`, candidates: names(e.name).map((n) => `echoes/${n}.webp`) });
for (const s of data.sonatas)
  jobs.push({ key: `sonata:${s.id}`, out: `img/sonatas/${s.id}.webp`, candidates: names(s.name).map((n) => `echoes/sets/${n}.webp`) });

const manifest: Record<string, string> = {};
const missing: string[] = [];
let downloaded = 0;
const queue = [...jobs];

async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const file = resolve(PUBLIC, job.out);
    if (existsSync(file)) { manifest[job.key] = job.out; continue; }
    let found = false;
    for (const name of job.candidates) {
      try {
        const res = await fetch(BASE + name);
        if (!res.ok) continue;
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        manifest[job.key] = job.out;
        downloaded++; found = true; break;
      } catch { /* network error: try next name */ }
    }
    if (!found) missing.push(job.key);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + '\n');
console.log(`Images: ${Object.keys(manifest).length}/${jobs.length} available (${downloaded} downloaded now).`);
if (missing.length) console.log(`Not found in the source repo (${missing.length}): ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`);
