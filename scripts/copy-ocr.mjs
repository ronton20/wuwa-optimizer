// Copies the OCR engine (tesseract.js) into public/ocr/ so card imports work offline and never call a CDN.
// Runs before `npm run dev` and `npm run build`; public/ocr/ is git-ignored.
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('public/ocr');
mkdirSync(out, { recursive: true });
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // LSTM-only engine builds (with and without SIMD); the worker picks one
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  // English, "best_int" quality (2.9 MB gzipped)
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];
for (const [from, to] of files) copyFileSync(resolve(from), resolve(out, to));
console.log(`OCR files copied to public/ocr (${files.length})`);
