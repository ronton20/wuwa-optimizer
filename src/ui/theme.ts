import type { Element } from '../data/types';

export const ELEMENT_COLOR: Record<Element, string> = {
  Glacio: 'var(--color-glacio)',
  Fusion: 'var(--color-fusion)',
  Electro: 'var(--color-electro)',
  Aero: 'var(--color-aero)',
  Spectro: 'var(--color-spectro)',
  Havoc: 'var(--color-havoc)',
  Physical: 'var(--color-physical)',
};

/**
 * Local path of a mirrored game image (see scripts/data/images.ts).
 * Game paths look like /Game/Aki/UI/UIResources/Common/Image/IconRoleHead256/T_IconRoleHead256_1_UI
 */
export function img(gamePath: string): string {
  if (!gamePath) return '';
  const file = gamePath.split('/').pop();
  return `${import.meta.env.BASE_URL}img/${file}.webp`;
}
