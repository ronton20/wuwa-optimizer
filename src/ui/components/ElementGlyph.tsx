import type { Element } from '../../data/types';
import { ELEMENT_COLOR } from '../theme';

/** Small diamond glyph tinted with the element colour (stand-in until element icons are mirrored). */
export function ElementGlyph({ element, size = 14 }: { element: Element; size?: number }) {
  const c = ELEMENT_COLOR[element];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label={element} role="img">
      <path d="M8 1 L15 8 L8 15 L1 8 Z" fill="none" stroke={c} strokeWidth="1.4" />
      <path d="M8 4.5 L11.5 8 L8 11.5 L4.5 8 Z" fill={c} />
    </svg>
  );
}
