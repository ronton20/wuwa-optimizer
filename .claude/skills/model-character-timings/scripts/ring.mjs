// node ring.mjs <dir> <cx> <cy> <radius> <startSec> <fps>: fraction of the ring that is green, per frame
import { createRequire } from 'node:module'; import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const sharp = createRequire('C:/Users/Ron/dev/Git/wuwa-optimizer/package.json')('sharp');
const [dir, cx, cy, rad, start, fps] = [process.argv[2], ...process.argv.slice(3).map(Number)];
for (const f of readdirSync(dir).filter((x) => /^\d+\.png$/.test(x)).sort()) {
  const { data, info } = await sharp(join(dir, f)).raw().toBuffer({ resolveWithObject: true });
  let on = 0;
  for (let a = 0; a < 360; a++) {
    let hit = false;
    for (let dr = -3; dr <= 3 && !hit; dr++) {
      const x = Math.round(cx + (rad + dr) * Math.sin((a * Math.PI) / 180)), y = Math.round(cy - (rad + dr) * Math.cos((a * Math.PI) / 180));
      if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue;
      const i = (y * info.width + x) * info.channels; const [r, g] = [data[i], data[i + 1]];
      if (g > 170 && g > r + 70) hit = true;
    }
    if (hit) on++;
  }
  console.log((start + (Number(f.slice(0, 5)) - 1) / fps).toFixed(1), (on / 360 * 120).toFixed(0));
}
