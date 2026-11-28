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

interface Job { key: string; out: string; urls: string[]; refresh?: boolean }
const jobs: Job[] = [];

/**
 * Encore's character entry is only used when it names the same texture as the game data (it fixes letter case,
 * e.g. FeiXue vs Feixue). For brand-new characters it can point at someone else's art (Lily got Ciaccona's),
 * so the game-data path always comes first and a mismatching Encore path is ignored.
 */
const sameTexture = (url: string | undefined, gamePath?: string) =>
  !!url && !!gamePath && url.split('/').pop()!.replace(/\.webp$/i, '').toLowerCase() === gamePath.split('/').pop()!.split('.')[0].toLowerCase();

for (const c of data.characters) {
  const e = await encoreCharacter(c.id);
  const art = sameTexture(e.FormationRoleCard, c.images.stand) ? [e.FormationRoleCard] : [];
  const head = sameTexture(e.RoleHeadIconLarge, c.images.icon) ? [e.RoleHeadIconLarge] : [];
  // character pictures are re-checked on every run, so a wrong file saved earlier gets replaced
  jobs.push({ key: `charArt:${c.id}`, out: `img/characters/${c.id}-art.webp`, refresh: true, urls: [...res(c.images.stand), ...art] });
  jobs.push({
    key: `char:${c.id}`, out: `img/characters/${c.id}.webp`, refresh: true,
    urls: [...res(c.images.icon), ...head, ...names(c.name).map((n) => `${COMMUNITY}${n}.png`)],
  });
}
for (const w of data.weapons)
  jobs.push({ key: `weapon:${w.id}`, out: `img/weapons/${w.id}.webp`, urls: [...res(w.iconBig), ...res(w.icon), ...names(w.name).map((n) => `${COMMUNITY}weapons/${n}.png`)] });
for (const e of data.echoes)
  jobs.push({ key: `echo:${e.id}`, out: `img/echoes/${e.id}.webp`, urls: [...res(e.iconBig), ...res(e.icon), ...names(e.name).map((n) => `${COMMUNITY}echoes/${n}.webp`)] });
for (const s of data.sonatas)
  jobs.push({ key: `sonata:${s.id}`, out: `img/sonatas/${s.id}.webp`, urls: [...res(s.icon), ...names(s.name).map((n) => `${COMMUNITY}echoes/sets/${n}.webp`)] });

// square 256px echo heads: what WuwaBot cards show, used to recognise echoes when importing a card
for (const e of data.echoes)
  jobs.push({ key: `echoHead:${e.id}`, out: `img/echoheads/${e.id}.webp`, urls: res(e.icon) });

// skill tree: skill icons, sequence icons, stat-node icons (shared between characters, keyed by file name)
const fileName = (p: string) => p.split('/').pop()!.split('.')[0];
const nodeIcons = new Set<string>();
for (const c of data.characters) {
  for (const sk of c.skills) if (sk.icon) jobs.push({ key: `skill:${sk.id}`, out: `img/skills/${sk.id}.webp`, urls: res(sk.icon) });
  for (const q of c.sequences) if (q.icon) jobs.push({ key: `seq:${c.id}-${q.index}`, out: `img/sequences/${c.id}-${q.index}.webp`, urls: res(q.icon) });
  for (const n of c.statNodes) if (n.icon && !nodeIcons.has(n.icon)) {
    nodeIcons.add(n.icon);
    jobs.push({ key: `node:${fileName(n.icon)}`, out: `img/nodes/${fileName(n.icon)}.webp`, urls: res(n.icon) });
  }
}

// in-combat button icons (SP_Icon<Name>A1 = Hiyuki's Iai…): not listed in the game data, but they sit next to the skill-tree
// icons in the character's own folder. Machines pick them per move (Move.icon). shortcut: names are probed, so the
// misses are asked again on every run; list the real ones per character if that gets slow.
for (const c of data.characters) {
  const own = c.skills.map((sk) => sk.icon?.match(/^(.*\/SkillIcon(\w+)\/SP_Icon\2)[A-Z0-9]+$/)).find(Boolean);
  if (!own) continue;
  for (const l of 'ABCE') for (const n of [1, 2, 3])
    jobs.push({ key: `hud:${c.id}:${l}${n}`, out: `img/hud/${c.id}-${l}${n}.webp`, urls: res(`${own[1]}${l}${n}`) });
}

const manifest: Record<string, string> = {};
const missing: string[] = [];
const fromSource: Record<string, number> = {};
const queue = [...jobs];

async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const file = resolve(PUBLIC, job.out);
    if (existsSync(file) && !job.refresh) { manifest[job.key] = job.out; continue; }
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
    if (!found && existsSync(file)) manifest[job.key] = job.out; // offline: keep what we have
    else if (!found) missing.push(job.key);
  }
}

await Promise.all(Array.from({ length: 12 }, worker));
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + '\n');
console.log(`Images: ${Object.keys(manifest).length}/${jobs.length} available. Downloaded now: ${JSON.stringify(fromSource)}`);
if (missing.length) console.log(`Not found anywhere (${missing.length}): ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`);
