// node onsets.mjs <glow.txt> <timeline dir>: when the two off-field portraits start glowing (= active Resonator at 100 Concerto)
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => l.split(' ').map(Number));
const tl = JSON.parse(readFileSync(process.argv[3] + '/timeline.json'));
const sec = (s) => { const m = s.replace(/\s/g, '').match(/(\d)(\d):?(\d\d):?(\d\d)$/); return m ? Number(m[1] + m[2]) * 60 + Number(m[3]) + Number(m[4]) / 100 : undefined; };
const pts = tl.map((r) => ({ t: r.t, g: sec(r.timer) })).filter((p) => p.g !== undefined && p.g <= 300);
const game = (t) => { const near = pts.filter((p) => Math.abs(p.t - t) < 1.2).map((p) => p.g + (p.t - t)); near.sort((a, b) => a - b); return near.length ? near[Math.floor(near.length / 2)] : undefined; };
const base = [1, 2, 3].map((k) => { const v = rows.map((r) => r[k]).filter((x) => x > 5).sort((a, b) => a - b); return v[Math.floor(v.length * 0.3)]; });
const glow = (r) => [1, 2, 3].filter((k) => r[k] > base[k - 1] + 15);
let prev = '';
for (let i = 0; i < rows.length; i++) {
  const g = glow(rows[i]); const key = g.length === 2 ? g.join('') : '';
  // need 1 s in a row to count
  const stable = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every((d) => rows[i + d] && (glow(rows[i + d]).length === 2 ? glow(rows[i + d]).join('') : '') === key);
  if (stable && key !== prev) { const t = rows[i][0]; const gt = game(t); if (key) console.log(`video ${t.toFixed(1)}  timer ${gt ? (300 - gt).toFixed(2) + 's into the fight' : '?'}  glowing slots ${key} → slot ${[1, 2, 3].find((k) => !g.includes(k))} at 100 Concerto`); prev = key; }
}
console.log('baseline', base.join(' '));
