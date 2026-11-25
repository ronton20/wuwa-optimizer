import { useMemo } from 'react';
import type { HitResult } from '../../engine';
import type { SkillKind, SkillRow } from '../../data/types';
import { AnimatedNumber, Toggle } from '../components/kit';
import { useSettings } from '../../state/settings';
import { ELEMENT_COLOR } from '../theme';
import { SKILL_LABEL, ui } from '../../strings/en';

const ORDER: SkillKind[] = ['Normal', 'Skill', 'Forte', 'Liberation', 'Intro', 'Outro'];

/** One line per in-game Skill Detail row: all its hits summed, like the game's "37.72%+37.72%". */
export interface RowTotal { kind: SkillKind; row: SkillRow; level: number; avg: number; crit: number; nonCrit: number; hits: HitResult[] }

export function rowTotals(hits: HitResult[]): RowTotal[] {
  const map = new Map<SkillRow, RowTotal>();
  for (const h of hits) {
    const t = map.get(h.row) ?? { kind: h.skill.kind, row: h.row, level: h.level, avg: 0, crit: 0, nonCrit: 0, hits: [] };
    t.avg += h.avg * h.count; t.crit += h.crit * h.count; t.nonCrit += h.nonCrit * h.count; t.hits.push(h);
    map.set(h.row, t);
  }
  return [...map.values()];
}

/** Row label without the trailing " DMG"; generic labels ("Skill DMG") get their skill's name instead. */
export const rowName = (r: RowTotal) => (/^Skill DMG$/.test(r.row.label) ? r.hits[0].skill.name : r.row.label.replace(/ DMG$/, ''));

/** Right-hand panel: strongest row, then every row grouped by skill. Updates live. */
export function DamagePanel({ hits, enemy }: { hits: HitResult[]; enemy: { level: number } }) {
  const { focus, setFocus } = useSettings();
  const rows = useMemo(() => rowTotals(hits), [hits]);
  const top = useMemo(() => rows.reduce((a, r) => (r[focus] > a[focus] ? r : a), rows[0]), [rows, focus]);
  const groups = useMemo(() => ORDER.map((k) => ({ kind: k, rows: rows.filter((r) => r.kind === k) })).filter((g) => g.rows.length), [rows]);
  if (!top) return null;

  return (
    <aside className="glass flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl lg:sticky lg:top-4">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">{ui.topHit}</div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted" title={ui.showAverage}>
            {ui.average}
            <Toggle on={focus === 'avg'} onChange={(v) => setFocus(v ? 'avg' : 'crit')} label={ui.showAverage} />
          </label>
        </div>
        <div className="mt-1 text-sm text-ink/90">{rowName(top)}</div>
        <div className="mt-2 font-display text-4xl font-semibold text-gold-soft">
          <AnimatedNumber value={top[focus]} />
        </div>
        <div className="mt-1 flex gap-4 text-xs text-muted">
          {focus === 'avg'
            ? <span>{ui.crit} <AnimatedNumber value={top.crit} className="text-ink" /></span>
            : <span>{ui.average} <AnimatedNumber value={top.avg} className="text-ink" /></span>}
          <span>{ui.nonCrit} <AnimatedNumber value={top.nonCrit} className="text-ink" /></span>
        </div>
        <div className="mt-2 text-[11px] text-muted">{focus === 'avg' ? ui.average : ui.critHit} · {ui.enemy(enemy.level)}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scroll-thin">
        {groups.map((g) => (
          <section key={g.kind} className="mb-3">
            <h4 className="px-2 py-1.5 font-display text-xs uppercase tracking-[0.16em] text-muted">{SKILL_LABEL[g.kind]}</h4>
            <ul>
              {g.rows.map((r, i) => (
                <li key={i} className="rounded-lg px-2 py-2 hover:bg-white/5">
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 text-sm leading-snug">
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: ELEMENT_COLOR[r.hits[0].term.element] }} />
                      {rowName(r)}
                    </span>
                    <span className="font-display text-gold"><AnimatedNumber value={r[focus]} /></span>
                  </div>
                  <div className="mt-0.5 flex justify-between gap-3 pl-3 text-[11px] text-muted">
                    <span className="tabular truncate">{r.row.values[r.level - 1]}</span>
                    <span className="tabular whitespace-nowrap">{focus === 'avg' ? ui.crit : ui.avg} {Math.floor(focus === 'avg' ? r.crit : r.avg).toLocaleString()} · {Math.floor(r.nonCrit).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
