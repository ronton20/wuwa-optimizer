/** Minimal RGBA image + the few pixel operations the card reader needs (no DOM, so tests run in node). */
export interface Pixels { width: number; height: number; data: Uint8ClampedArray | Uint8Array }
export interface Rect { x: number; y: number; w: number; h: number }

/** A WuwaBot card: crops come back resized to the requested size (smooth scaling). */
export interface CardImage {
  width: number;
  height: number;
  /** `rect` is in 1920×1080 card coordinates; the adapter scales it to the real image. */
  crop(rect: Rect, outW: number, outH: number): Promise<Pixels>;
}

/** OCR one prepared image. `kind` picks the page-segmentation mode: one line, or a block of lines. */
export type Ocr = (px: Pixels, kind: 'line' | 'block') => Promise<string>;

/** Reference icon (echo head, sonata) as NxN pixels composited over `bg`, or null if not available. */
export type IconSource = (key: string, size: number, bg: [number, number, number]) => Promise<Pixels | null>;

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Light text on a dark card -> dark text on white, contrast stretched: what OCR reads best.
 *  `cut` (0..1): also drop everything darker than that share of the brightest pixel (removes thin background lines). */
export function forOcr(px: Pixels, cut = 0): Pixels {
  const out = new Uint8ClampedArray(px.data.length);
  let lo = 255, hi = 0;
  const L = new Float32Array(px.width * px.height);
  for (let i = 0; i < L.length; i++) {
    const v = lum(px.data[i * 4], px.data[i * 4 + 1], px.data[i * 4 + 2]);
    L[i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < L.length; i++) {
    const t = (L[i] - lo) / span;
    const v = cut && t < cut ? 255 : 255 - Math.round(t * 255);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
  }
  return { width: px.width, height: px.height, data: out };
}

/** Mean luminance and mean saturation of an area. */
export function stats(px: Pixels) {
  let l = 0, s = 0;
  const n = px.width * px.height;
  for (let i = 0; i < n; i++) {
    const r = px.data[i * 4], g = px.data[i * 4 + 1], b = px.data[i * 4 + 2];
    l += lum(r, g, b);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    s += mx ? (mx - mn) / mx : 0;
  }
  return { lum: l / n, sat: s / n };
}

/** Average colour of the most saturated pixels (an icon's colour, ignoring its white parts and the background). */
export function dominantHue(px: Pixels): number | null {
  let x = 0, y = 0, n = 0;
  for (let i = 0; i < px.width * px.height; i++) {
    const r = px.data[i * 4] / 255, g = px.data[i * 4 + 1] / 255, b = px.data[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 0.35 || (mx - mn) / mx < 0.35) continue;
    let h: number;
    if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
    const a = (h * 60 * Math.PI) / 180;
    x += Math.cos(a); y += Math.sin(a); n++;
  }
  if (n < 6) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Picture distance for icon matching: per-channel difference on a small grid, after removing each image's
 * own brightness/contrast (cards are JPEGs with a slightly different tone than the game textures). 0 = identical.
 */
export function iconDistance(a: Pixels, b: Pixels): number {
  const n = a.width * a.height;
  const norm = (p: Pixels) => {
    const v = new Float32Array(n * 3);
    let mean = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { v[i * 3 + c] = p.data[i * 4 + c]; mean += p.data[i * 4 + c]; }
    mean /= n * 3;
    let sd = 0;
    for (let i = 0; i < v.length; i++) sd += (v[i] - mean) ** 2;
    sd = Math.sqrt(sd / v.length) || 1;
    for (let i = 0; i < v.length; i++) v[i] = (v[i] - mean) / sd;
    return v;
  };
  const x = norm(a), y = norm(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d += Math.abs(x[i] - y[i]);
  return d / x.length;
}

/** The middle `frac` of an image (e.g. a set icon without its shared outer ring). */
export function center(px: Pixels, frac: number): Pixels {
  const w = Math.round(px.width * frac), h = Math.round(px.height * frac);
  const x0 = Math.floor((px.width - w) / 2), y0 = Math.floor((px.height - h) / 2);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++)
    out[(y * w + x) * 4 + c] = px.data[((y + y0) * px.width + x + x0) * 4 + c];
  return { width: w, height: h, data: out };
}
