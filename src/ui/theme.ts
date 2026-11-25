import type { Element } from '../data/types';
import manifest from '../data/images.json';

export const ELEMENT_COLOR: Record<Element, string> = {
  Glacio: 'var(--color-glacio)',
  Fusion: 'var(--color-fusion)',
  Electro: 'var(--color-electro)',
  Aero: 'var(--color-aero)',
  Spectro: 'var(--color-spectro)',
  Havoc: 'var(--color-havoc)',
  Physical: 'var(--color-physical)',
};

export type ImageKey = `char:${number}` | `charArt:${number}` | `weapon:${number}` | `echo:${number}` | `sonata:${number}`;

/**
 * URL of a mirrored image, or '' when it was never downloaded (see scripts/data/images.ts).
 * Only images listed in src/data/images.json are ever requested, so there are no 404s.
 */
export function img(key: ImageKey): string {
  const path = (manifest as Record<string, string>)[key];
  return path ? `${import.meta.env.BASE_URL}${path}` : '';
}
