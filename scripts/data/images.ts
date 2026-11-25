/**
 * Mirrors game art into public/img/ and writes src/data/images.json (key -> local path).
 * The app only requests images listed in that manifest, so a missing picture never
 * causes a 404 — it just shows the placeholder.
 *
 *   npm run data:images          (runs automatically on every deploy)
 *   npm run data:images -- --fresh   re-download everything
 *
 * Sources, best first:
 *  1. api-v2.encore.moe — serves the original game textures by their in-game path
 *     (character art 696x960, weapon/echo art 732x392, head icons 256x256)
 *  2. github.com/ryanbenson/wuthering-waves-assets — 256px fallback by display name
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import data from '../../src/data/current.ts';

const ENCORE = 'https://api-v2.encore.moe';
const RES = `${ENCORE}/resource/Data`; // + /Game/Aki/UI/... + .webp
const COMMUNITY = 'https://raw.githubusercontent.com/ryanbenson/wuthering-waves-assets/master/images/';
const PUBLIC = resolve('public');
const MANIFEST = resolve('src/data/images.json');

if (process.argv.includes('--fresh')) rmSync(resolve(PUBLIC, 'img'), { recursive: true, force: true });

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');
const pascal = (s: string) =>
  (s.normalize('NFD').replace(/\p{M}/gu, '').replace(/'/g, '').match(/[a-zA-Z0-9]+/g) ?? [])
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('');
const names = (s: string) => [...new Set([pascal(s), sanitize(s)])];
const res = (gamePath?: string) => (gamePath ? [`${RES}${gamePath}.webp`] : []);

/** Encore's character endpoint has the exact (case-sensitive) texture names. */
async function encoreCharacter(id: number): Promise<Record<string, string>> {
  try {
    const r = await fetch(`${ENCORE}/api/en/character/${id}?v=Beta`);
    return r.ok ? await r.json() : {};
  } catch { return {}; }
}

interface Job { key: string; out: string; urls: string[] }
const jobs: Job[] = [];

for (const c of data.characters) {
  const e = await encoreCharacter(c.id);
  jobs.push({
    key: `charArt:${c.id}`, out: `img/characters/${c.id}-art.webp`,
    urls: [e.FormationRoleCard, ...res(c.images.stand)].filter(Boolean),
  });
  jobs.push({
    key: `char:${c.id}`, out: `img/characters/${c.id}.webp`,
    urls: [e.RoleHeadIconLarge, ...res(c.images.icon), ...names(c.name).map((n) => `${COMMUNITY}${n}.png`)].filter(Boolean),
  });
}
for (const w of data.weapons)
  jobs.push({ key: `weapon:${w.id}`, out: `img/weapons/${w.id}.webp`, urls: [...res(w.iconBig), ...res(w.icon), ...names(w.name).map((n) => `${COMMUNITY}weapons/${n}.png`)] });
for (const e of data.echoes)
  jobs.push({ key: `echo:${e.id}`, out: `img/echoes/${e.id}.webp`, urls: [...res(e.iconBig), ...res(e.icon), ...names(e.name).map((n) => `${COMMUNITY}echoes/${n}.webp`)] });
for (const s of data.sonatas)
  jobs.push({ key: `sonata:${s.id}`, out: `img/sonatas/${s.id}.webp`, urls: names(s.name).map((n) => `${COMMUNITY}echoes/sets/${n}.webp`) });

const manifest: Record<string, string> = {};
const missing: string[] = [];
const fromSource: Record<string, number> = {};
const queue = [...jobs];

async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const file = resolve(PUBLIC, job.out);
    if (existsSync(file)) { manifest[job.key] = job.out; continue; }
    let found = false;
    for (const url of job.urls) {
      try {
        const r = await fetch(url);
        if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image')) continue;
        mkdirSync(dirname(file), { recursive: true });
        // keep the file's real format even if the extension says .webp — browsers sniff it
        writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        manifest[job.key] = job.out;
        const host = new URL(url).host;
        fromSource[host] = (fromSource[host] ?? 0) + 1;
        found = true; break;
      } catch { /* network error: try next source */ }
    }
    if (!found) missing.push(job.key);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + '\n');
console.log(`Images: ${Object.keys(manifest).length}/${jobs.length} available. Downloaded now: ${JSON.stringify(fromSource)}`);
if (missing.length) console.log(`Not found anywhere (${missing.length}): ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`);
