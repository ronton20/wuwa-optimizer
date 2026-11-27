// node still.mjs <cropdir>: spans where the timer is visible but doesn't move (clock stopped with the UI up)
import { readFileSync } from 'node:fs';
const tl = JSON.parse(readFileSync(process.argv[2] + '/timeline.json'));
const sec = (s) => { const m = s.replace(/\s/g, '').match(/(\d)(\d):?(\d\d):?(\d\d)$/); return m ? Number(m[1] + m[2]) * 60 + Number(m[3]) + Number(m[4]) / 100 : undefined; };
const pts = tl.map((r) => ({ t: r.t, g: sec(r.timer) })).filter((p) => p.g !== undefined && p.g <= 300);
let i = 0;
while (i < pts.length) {
  let j = i;
  while (j + 1 < pts.length && Math.abs(pts[j + 1].g - pts[i].g) < 0.02) j++;
  const same = pts.slice(i, j + 1).length;
  if (pts[j].t - pts[i].t >= 0.4 && same >= 3) console.log(`video ${pts[i].t.toFixed(1)}→${pts[j].t.toFixed(1)} (${(pts[j].t - pts[i].t).toFixed(1)}s) timer stays ${pts[i].g.toFixed(2)} (${same} reads)`);
  i = j + 1;
}
