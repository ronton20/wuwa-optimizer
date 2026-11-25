// Turns an effect's mods into plain, exact numbers for the Buffs tab ("+20% DMG Amplified · Liberation only").
import type { ModKey, Effect, HitFilter } from '../engine/types';
import { SKILL_LABEL, STAT_LABEL } from '../strings/en';

const MOD_LABEL: Partial<Record<ModKey, string>> = {
  amplify: 'DMG Amplified', multBonus: 'DMG Multiplier', resShred: 'RES ignored', defIgnore: 'DEF ignored',
};
const FLAT = new Set<ModKey>(['atk', 'hp', 'def']);

const num = (v: number) => (Math.round(v * 100) / 100).toString();
export const modLabel = (k: ModKey) => MOD_LABEL[k] ?? STAT_LABEL[k as keyof typeof STAT_LABEL] ?? k;
export const modValueText = (k: ModKey, v: number) => (FLAT.has(k) ? `+${num(v)}` : `+${num(v)}%`);

/** "Glacio DMG only", "Resonance Liberation only", "selected hits only" … */
export function scopeText(f?: HitFilter): string {
  if (!f) return '';
  const parts: string[] = [];
  if (f.element) parts.push(`${f.element} DMG`);
  if (f.dmgTypes) parts.push(f.dmgTypes.map((t) => `${t} DMG`).join(' / '));
  if (f.skillKinds && !f.rows) parts.push(f.skillKinds.map((k) => SKILL_LABEL[k]).join(' / '));
  if (f.rows) parts.push(f.label ?? 'specific hits');
  return parts.length ? `${parts.join(', ')} only` : '';
}

export interface ValueLine { text: string; scope: string }

/**
 * Exact value lines for one effect at its current level.
 * `level` = current stacks (or 1 when a toggle is on, 0 when off — then the "if on" value is shown).
 */
export function valueLines(e: Effect, level: number): ValueLine[] {
  const scope = scopeText(e.appliesTo);
  const stacks = e.condition?.kind === 'stacks';
  return e.mods.map((m) => {
    const label = modLabel(m.key);
    if (m.byStacks) {
      const now = m.byStacks[Math.min(level, m.byStacks.length - 1)];
      const max = Math.max(...m.byStacks);
      return { text: `${modValueText(m.key, now)} ${label} at ${level} stacks (max ${modValueText(m.key, max)})`, scope };
    }
    if (stacks) return { text: `${modValueText(m.key, m.value)} ${label} per stack → ${modValueText(m.key, m.value * level)} at ${level}`, scope };
    return { text: `${modValueText(m.key, m.value)} ${label}`, scope };
  });
}

export function raiseText(e: Effect, limitLabel: string): string | null {
  const r = e.raisesMax;
  if (!r) return null;
  return r.to !== undefined ? `${limitLabel} limit → ${r.to}` : `${limitLabel} limit +${r.by}${r.exclusive ? ' (doesn’t stack with similar effects)' : ''}`;
}
