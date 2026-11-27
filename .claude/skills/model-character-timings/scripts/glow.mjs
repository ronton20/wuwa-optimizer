// node glow.mjs <dir>: per frame and party slot, % of angles with a near-white pixel at the glow ring's radius
import { createRequire } from 'node:module'; import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const sharp = createRequire('C:/Users/Ron/dev/Git/wuwa-optimizer/package.json')('sharp');
const dir = process.argv[2];
const ys = [0.14, 0.47, 0.80];
for (const f of readdirSync(dir).sort()) {
  const { data, info } = await sharp(join(dir, f)).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels, cx = 0.58 * W;
  const v = ys.map((fy) => {
    const cy = fy * H; let on = 0;
    for (let a = 0; a < 360; a += 4) {
      let hit = false;
      for (let r = 36; r <= 50 && !hit; r++) {
        const x = Math.round(cx + r * Math.sin(a * Math.PI / 180)), y = Math.round(cy - r * Math.cos(a * Math.PI / 180));
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * C, mn = Math.min(data[i], data[i + 1], data[i + 2]), mx = Math.max(data[i], data[i + 1], data[i + 2]);
        if (mn > 185 && mx - mn < 45) hit = true;
      }
      if (hit) on++;
    }
    return Math.round(on / 90 * 100);
  });
  console.log(((Number(f.slice(0, 5)) - 1) / 10).toFixed(1), v.join(' '));
}
