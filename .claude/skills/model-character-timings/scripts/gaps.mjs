// node gaps.mjs <cropdir>: cinematics (timer hidden ≥ 1 s) and how much game time passed across them
import { readFileSync } from 'node:fs';
const tl = JSON.parse(readFileSync(process.argv[2] + '/timeline.json'));
const sec = (s) => { const m = s.replace(/\s/g, '').match(/(\d)(\d):?(\d\d):?(\d\d)$/); return m ? Number(m[1] + m[2]) * 60 + Number(m[3]) + Number(m[4]) / 100 : undefined; };
// valid reads: remaining time that agrees with its neighbours (falls ~1 s per video second)
const pts = tl.map((r) => ({ t: r.t, g: sec(r.timer) })).filter((p) => p.g !== undefined && p.g <= 300);
const ok = pts.filter((p) => {
  const near = pts.filter((q) => q !== p && Math.abs(q.t - p.t) <= 1.5);
  return near.filter((q) => Math.abs((p.g - q.g) + (p.t - q.t)) < 0.25).length >= 2;
});
for (let i = 1; i < ok.length; i++) {
  const a = ok[i - 1], b = ok[i], video = b.t - a.t;
  if (video >= 1.0) console.log(`video ${a.t.toFixed(1)}→${b.t.toFixed(1)} (${video.toFixed(1)}s), timer ${a.g.toFixed(2)}→${b.g.toFixed(2)}: ${(a.g - b.g).toFixed(2)}s of game time`);
}
console.log(`valid timer reads ${ok.length}/${tl.length}; fight ${ok[0]?.g.toFixed(2)} → ${ok.at(-1)?.g.toFixed(2)}`);
