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

/** Breakdown bar colours, one per source of damage. */
export const GROUP_COLOR: Record<string, string> = {
  base: '#5d6a86', weapon: '#e9c77b', echo: '#4fb3ff', sequence: '#c38bff', self: '#ff9d6b', team: '#5fe3b8', enemy: '#ff6b8b',
};

export type ImageKey = `char:${number}` | `charArt:${number}` | `weapon:${number}` | `echo:${number}` | `echoHead:${number}` | `sonata:${number}`
  | `skill:${number}` | `seq:${number}-${number}` | `node:${string}` | `hud:${number}:${string}`;

/**
 * URL of a mirrored image, or '' when it was never downloaded (see scripts/data/images.ts).
 * Only images listed in src/data/images.json are ever requested, so there are no 404s.
 */
export function img(key: ImageKey): string {
  const path = (manifest as Record<string, string>)[key];
  return path ? `${import.meta.env.BASE_URL}${path}` : '';
}

/** Square echo picture: the 256px head (what the game and WuwaBot show), falling back to the wide art. */
export const echoImg = (id: number) => img(`echoHead:${id}`) || img(`echo:${id}`);
