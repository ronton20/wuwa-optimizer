// Browser adapters for the card reader: canvas for pixels, a lazily loaded tesseract.js worker for OCR,
// and the site's own mirrored icons for echo/set recognition. Nothing leaves the device.
import data from '../data/current';
import { img, type ImageKey } from '../ui/theme';
import type { CardImage, IconSource, Ocr, Pixels, Rect } from './pixels';
import { readCard, type CardResult } from './readCard';

const BASE = import.meta.env.BASE_URL;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

export async function cardFromFile(file: Blob): Promise<CardImage> {
  const bmp = await createImageBitmap(file);
  const sx = bmp.width / 1920, sy = bmp.height / 1080;
  return {
    width: bmp.width,
    height: bmp.height,
    async crop(r: Rect, outW: number, outH: number): Promise<Pixels> {
      const { ctx } = canvas(Math.round(outW), Math.round(outH));
      ctx.drawImage(bmp, r.x * sx, r.y * sy, r.w * sx, r.h * sy, 0, 0, Math.round(outW), Math.round(outH));
      return ctx.getImageData(0, 0, Math.round(outW), Math.round(outH));
    },
  };
}

type TessWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let worker: Promise<TessWorker> | null = null;

/** Starts loading the OCR engine (≈7 MB the first time, then cached for offline use). */
export function warmUpOcr() {
  worker ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker('eng', 1, { workerPath: `${BASE}ocr/worker.min.js`, corePath: `${BASE}ocr/`, langPath: `${BASE}ocr`, gzip: true }));
  return worker;
}

const browserOcr: Ocr = async (px, kind) => {
  const w = await warmUpOcr();
  await w.setParameters({ tessedit_pageseg_mode: (kind === 'line' ? '7' : '6') as never, preserve_interword_spaces: '1', user_defined_dpi: '150' });
  const { c, ctx } = canvas(px.width, px.height);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  return (await w.recognize(c)).data.text;
};

const iconCache = new Map<string, Promise<HTMLImageElement | null>>();
const loadImage = (url: string) => {
  let p = iconCache.get(url);
  if (!p) {
    p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
    iconCache.set(url, p);
  }
  return p;
};

const browserIcons: IconSource = async (key, size, bg) => {
  const url = img(key as ImageKey);
  if (!url) return null;
  const image = await loadImage(url);
  if (!image) return null;
  const { ctx } = canvas(size, size);
  ctx.fillStyle = `rgb(${bg.join(',')})`;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
};

export async function readCardFile(file: Blob, onStep?: (s: string) => void): Promise<CardResult> {
  return readCard(await cardFromFile(file), data, browserOcr, browserIcons, onStep);
}
