// usage: node analyze.mjs <cropdir> (from extract.sh)  -> <cropdir>/timeline.json  (10 fps: video t, game timer, active slot, E/Q/R cooldown text)
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const req = createRequire('C:/Users/Ron/dev/Git/wuwa-optimizer/package.json');
const sharp = req('sharp');
const { createWorker } = req('tesseract.js');
const dir = process.argv[2];
const root = 'C:/Users/Ron/dev/Git/wuwa-optimizer';
const worker = await createWorker('eng', 1, { langPath: resolve(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'), gzip: true, cachePath: resolve(root, 'node_modules/.cache/tess') });
await worker.setParameters({ tessedit_pageseg_mode: '7' });
const ocr = async (file, white, invert) => {
  await worker.setParameters({ tessedit_char_whitelist: white });
  let img = sharp(file).normalise();
  if (invert) img = img.negate();
  const { data } = await worker.recognize(await img.threshold(150).png().toBuffer());
  return data.text.trim();
};
// badge (number square) top-left of each party slot: bright = that slot is NOT on the field
const badge = async (file) => {
  const m = await sharp(file).metadata();
  const out = [];
  for (const [y0, y1] of [[0.05, 0.11], [0.385, 0.44], [0.715, 0.775]]) {
    const w = Math.round(m.width * 0.14), h = Math.round(m.height * (y1 - y0));
    const buf = await sharp(file).extract({ left: Math.round(m.width * 0.06), top: Math.round(m.height * y0), width: w, height: h }).greyscale().raw().toBuffer();
    let s = 0; for (const v of buf) s += v;
    out.push(Math.round(s / buf.length));
  }
  return out;
};
const frames = readdirSync(join(dir, 'timer')).sort();
const rows = [];
for (const f of frames) {
  const i = Number(f.slice(0, 5)) - 1;
  const timer = await ocr(join(dir, 'timer', f), '0123456789:', true);
  const b = await badge(join(dir, 'party', f));
  const cd = {};
  for (const k of ['e', 'q', 'r']) cd[k] = await ocr(join(dir, k, f), '0123456789.', true);
  rows.push({ t: +(i / 10).toFixed(1), timer, badge: b, ...cd });
}
writeFileSync(join(dir, 'timeline.json'), JSON.stringify(rows));
await worker.terminate();
console.log(rows.length, 'frames');
