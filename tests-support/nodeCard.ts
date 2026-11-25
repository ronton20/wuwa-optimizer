// Node adapters for the card reader (tests only): sharp for pixels, tesseract.js for OCR.
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorker, type Worker } from 'tesseract.js';
import type { CardImage, IconSource, Ocr, Pixels, Rect } from '../src/import/pixels';
import images from '../src/data/images.json';

export async function nodeCard(file: string): Promise<CardImage> {
  const meta = await sharp(file).metadata();
  const W = meta.width!, H = meta.height!;
  const sx = W / 1920, sy = H / 1080;
  return {
    width: W, height: H,
    async crop(r: Rect, outW: number, outH: number): Promise<Pixels> {
      const left = Math.max(0, Math.round(r.x * sx)), top = Math.max(0, Math.round(r.y * sy));
      const width = Math.min(W - left, Math.round(r.w * sx)), height = Math.min(H - top, Math.round(r.h * sy));
      const { data, info } = await sharp(file).extract({ left, top, width, height }).resize(outW, outH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data: new Uint8Array(data) };
    },
  };
}

let worker: Worker | null = null;
export async function nodeOcr(): Promise<{ ocr: Ocr; stop: () => Promise<void> }> {
  worker ??= await createWorker('eng', 1, { langPath: resolve('node_modules/@tesseract.js-data/eng/4.0.0_best_int'), gzip: true, cachePath: resolve('node_modules/.cache/tess') });
  const w = worker;
  return {
    ocr: async (px, kind) => {
      await w.setParameters({ tessedit_pageseg_mode: (kind === 'line' ? '7' : '6') as never, preserve_interword_spaces: '1', user_defined_dpi: '150' });
      const png = await sharp(Buffer.from(px.data), { raw: { width: px.width, height: px.height, channels: 4 } }).png().toBuffer();
      return (await w.recognize(png)).data.text;
    },
    stop: async () => { await w.terminate(); worker = null; },
  };
}

/** Reference icons from public/img (what the deployed site serves). */
export const nodeIcons: IconSource = async (key, size, bg) => {
  const path = (images as Record<string, string>)[key];
  const file = path && resolve('public', path);
  if (!file || !existsSync(file)) return null;
  const { data, info } = await sharp(file).resize(size, size, { fit: 'fill' }).flatten({ background: { r: bg[0], g: bg[1], b: bg[2] } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
};
