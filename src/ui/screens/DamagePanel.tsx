import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { HitResult } from '../../engine';
import type { SkillKind, SkillRow } from '../../data/types';
import { AnimatedNumber, Toggle } from '../components/kit';
import { useSettings } from '../../state/settings';
import { ELEMENT_COLOR, GROUP_COLOR } from '../theme';
import { SKILL_LABEL, ui } from '../../strings/en';

const ORDER: SkillKind[] = ['Normal', 'Skill', 'Forte', 'Liberation', 'Intro', 'Outro'];
const SOURCE_ORDER = ['base', 'weapon', 'echo', 'sequence', 'self', 'team', 'enemy'];
type Focus = 'crit' | 'avg';

/** One line per in-game Skill Detail row: all its hits summed, like the game's "37.72%+37.72%". */
export interface RowTotal {
  kind: SkillKind; row: SkillRow; level: number; avg: number; crit: number; nonCrit: number; hits: HitResult[];
  /** average damage by source; adds up to `avg` */
  sources: Record<string, number>;
}

export function rowTotals(hits: HitResult[]): RowTotal[] {
  const map = new Map<string, RowTotal>();
  for (const h of hits) {
    const t = map.get(h.row.label) ?? { kind: h.skill.kind, row: h.row, level: h.level, avg: 0, crit: 0, nonCrit: 0, hits: [], sources: {} };
    t.avg += h.avg * h.count; t.crit += h.crit * h.count; t.nonCrit += h.nonCrit * h.count; t.hits.push(h);
    for (const s of h.segments) t.sources[s.group] = (t.sources[s.group] ?? 0) + s.value * h.count;
    map.set(h.row.label, t);
  }
  return [...map.values()];
}

/** Row label without the trailing " DMG"; generic labels ("Skill DMG") get their skill's name instead. */
export const rowName = (r: RowTotal) => (/^Skill DMG$/.test(r.row.label) ? r.hits[0].skill.name : r.row.label.replace(/ DMG$/, ''));
const fmt = (n: number) => Math.floor(n).toLocaleString();
const strongest = (rows: RowTotal[], focus: Focus) => rows.reduce((a, r) => (r[focus] > a[focus] ? r : a), rows[0]);

export interface CompareColumn { id: string; name: string; hits: HitResult[] }

interface Props {
  hits: HitResult[];
  enemy: { level: number };
  /** pinned saved builds (first = baseline); the live build is added as the last column */
  compare?: CompareColumn[];
}

/** Everything the damage panel/sheet shows, computed once. */
function useDamageView({ hits, compare = [] }: Props) {
  const { focus } = useSettings();
  const rows = useMemo(() => rowTotals(hits), [hits]);
  const columns = useMemo(
    () => compare.map((c) => ({ ...c, rows: new Map(rowTotals(c.hits).map((r) => [r.row.label, r])) })),
    [compare],
  );
  const top = useMemo(() => strongest(rows, focus), [rows, focus]);
  const groups = useMemo(() => ORDER.map((k) => ({ kind: k, rows: rows.filter((r) => r.kind === k) })).filter((g) => g.rows.length), [rows]);
  return { focus, rows, columns, top, groups };
}
type View = ReturnType<typeof useDamageView>;

// ------------------------------------------------------------------ pieces

function Delta({ now, base }: { now: number; base?: number }) {
  if (!base) return null;
  const d = (now / base - 1) * 100;
  if (Math.abs(d) < 0.05) return <span className="tabular text-[11px] text-muted">±0%</span>;
  return <span className={`tabular text-[11px] ${d > 0 ? 'text-aero' : 'text-[#ff6b8b]'}`}>{d > 0 ? '+' : '−'}{Math.abs(d).toFixed(1)}%</span>;
}

function Headline({ v, enemy, compact }: { v: View; enemy: Props['enemy']; compact?: boolean }) {
  const { focus, top, columns } = v;
  const { setFocus } = useSettings();
  const baseline = columns[0]?.rows.get(top.row.label);
  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">{compact ? (focus === 'avg' ? ui.average : ui.critHit) : ui.topHit}</div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted" title={ui.showAverage}>
          {ui.average}
          <Toggle on={focus === 'avg'} onChange={(on) => setFocus(on ? 'avg' : 'crit')} label={ui.showAverage} />
        </label>
      </div>
      {!compact && <>
        <div className="mt-1 text-sm text-ink/90">{rowName(top)}</div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-4xl font-semibold text-gold-soft"><AnimatedNumber value={top[focus]} /></span>
          {baseline && <span className="flex flex-col leading-tight"><Delta now={top[focus]} base={baseline[focus]} /><span className="text-[10px] text-muted">{ui.vs(columns[0].name)}</span></span>}
        </div>
      </>}
      <div className="mt-1 flex gap-4 text-xs text-muted">
        {focus === 'avg'
          ? <span>{ui.crit} <AnimatedNumber value={top.crit} className="text-ink" /></span>
          : <span>{ui.average} <AnimatedNumber value={top.avg} className="text-ink" /></span>}
        <span>{ui.nonCrit} <AnimatedNumber value={top.nonCrit} className="text-ink" /></span>
      </div>
      <div className="mt-2 text-[11px] text-muted">{focus === 'avg' ? ui.average : ui.critHit} · {ui.enemy(enemy.level)}</div>
    </div>
  );
}

/** Stacked bar of where a row's damage comes from. */
function SourceBar({ r }: { r: RowTotal }) {
  const total = Object.values(r.sources).reduce((a, v) => a + v, 0) || 1;
  return (
    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/5" aria-hidden>
      {SOURCE_ORDER.filter((g) => r.sources[g] > 0).map((g) => (
        <motion.span key={g} initial={false} animate={{ width: `${(r.sources[g] / total) * 100}%` }} transition={{ duration: 0.35 }}
          style={{ background: GROUP_COLOR[g] }} className="h-full" />
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-2 text-[10px] text-muted">
      {SOURCE_ORDER.map((g) => (
        <span key={g} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: GROUP_COLOR[g] }} />{ui.group[g]}</span>
      ))}
    </div>
  );
}

/** Expanded row: where the damage comes from, then each hit with its multiplier and count. */
function RowDetail({ r, focus }: { r: RowTotal; focus: Focus }) {
  const scale = r.avg ? r[focus] / r.avg : 0; // sources are computed on average damage
  const total = Object.values(r.sources).reduce((a, v) => a + v, 0) || 1;
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
      <div className="mt-2 grid gap-3 rounded-lg bg-black/30 p-3 text-[11px]">
        <div>
          <div className="mb-1 uppercase tracking-widest text-muted">{ui.sources}</div>
          <ul className="space-y-0.5">
            {SOURCE_ORDER.filter((g) => r.sources[g] > 0).map((g) => (
              <li key={g} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm" style={{ background: GROUP_COLOR[g] }} />
                <span className="flex-1">{ui.group[g]}</span>
                <span className="tabular text-muted">{((r.sources[g] / total) * 100).toFixed(1)}%</span>
                <span className="tabular w-20 text-right">{fmt(r.sources[g] * scale)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 uppercase tracking-widest text-muted">{ui.hits}</div>
          <ul className="space-y-0.5">
            {r.hits.map((h, i) => {
              const one = h[focus];
              const pct = h.term.pct[h.level - 1];
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ELEMENT_COLOR[h.term.element] }} />
                  <span className="tabular flex-1 text-muted">
                    {pct.toFixed(2)}%{h.count > 1 && <> × {h.count} = {(pct * h.count).toFixed(2)}%</>}
                  </span>
                  <span className="tabular">{fmt(one)}{h.count > 1 && <span className="text-muted"> × {h.count} = </span>}{h.count > 1 && fmt(one * h.count)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

function Rows({ v }: { v: View }) {
  const { groups, focus, columns } = v;
  const [open, setOpen] = useState<string | null>(null);
  const comparing = columns.length > 0;
  const COL = 'w-[88px] shrink-0 text-right';
  return (
    <div>
      {comparing ? (
        <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-2 border-b border-white/10 bg-night-900 px-5 pb-2 pt-2.5 text-[11px] text-muted">
          <div className="mb-1 text-[10px] uppercase tracking-widest">{ui.comparing(columns.length)}</div>
          <div className="flex justify-end gap-2">
            {columns.map((c, i) => <span key={c.id} className={`${COL} truncate`} title={c.name}>{i === 0 ? '◆ ' : ''}{c.name}</span>)}
            <span className={`${COL} font-semibold text-[var(--accent)]`}>{ui.now}</span>
          </div>
        </div>
      ) : <Legend />}
      {groups.map((g) => (
        <section key={g.kind} className="mb-3">
          <h4 className="px-2 py-1.5 font-display text-xs uppercase tracking-[0.16em] text-muted">{SKILL_LABEL[g.kind]}</h4>
          <ul>
            {g.rows.map((r) => {
              const key = r.row.label;
              const isOpen = open === key;
              const base = columns[0]?.rows.get(key);
              return (
                <li key={key} className={`rounded-lg px-2 py-2 transition ${isOpen ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                  <button className="block w-full text-left" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}>
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 text-sm leading-snug">
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: ELEMENT_COLOR[r.hits[0].term.element] }} />
                        {rowName(r)}
                      </span>
                      {!comparing && <span className="font-display text-gold"><AnimatedNumber value={r[focus]} /></span>}
                    </div>
                    {comparing && (
                      <div className="mt-1 flex justify-end gap-2">
                        {columns.map((c, i) => {
                          const cr = c.rows.get(key);
                          return (
                            <span key={c.id} className={`${COL} flex flex-col items-end leading-tight`}>
                              <span className="tabular text-sm text-ink/75">{cr ? fmt(cr[focus]) : '—'}</span>
                              {i > 0 && cr && <Delta now={cr[focus]} base={base?.[focus]} />}
                            </span>
                          );
                        })}
                        <span className={`${COL} flex flex-col items-end leading-tight`}>
                          <span className="font-display text-gold"><AnimatedNumber value={r[focus]} /></span>
                          <Delta now={r[focus]} base={base?.[focus]} />
                        </span>
                      </div>
                    )}
                    {comparing ? null : (
                      <>
                        <div className="mt-0.5 flex justify-between gap-3 pl-3 text-[11px] text-muted">
                          <span className="tabular truncate">{r.row.values[r.level - 1]}</span>
                          <span className="tabular whitespace-nowrap">{focus === 'avg' ? ui.crit : ui.avg} {fmt(focus === 'avg' ? r.crit : r.avg)} · {fmt(r.nonCrit)}</span>
                        </div>
                        <div className="pl-3"><SourceBar r={r} /></div>
                      </>
                    )}
                  </button>
                  <AnimatePresence>{isOpen && <RowDetail r={r} focus={focus} />}</AnimatePresence>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ desktop panel + phone sheet

/** Right-hand panel on desktop: strongest row, then every row grouped by skill. Updates live. */
export function DamagePanel(props: Props) {
  const v = useDamageView(props);
  if (!v.top) return null;
  return (
    <aside className="glass hidden max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl lg:sticky lg:top-4 lg:flex">
      <div className="border-b border-white/10"><Headline v={v} enemy={props.enemy} /></div>
      <div className="flex-1 overflow-y-auto p-3 scroll-thin"><Rows v={v} /></div>
    </aside>
  );
}

/** Phone: the strongest hit stays pinned above the tab bar; tap to pull the full list up. */
export function DamageSheet(props: Props) {
  const v = useDamageView(props);
  const [open, setOpen] = useState(false);
  if (!v.top) return null;
  return (
    <>
      <AnimatePresence>
        {open && <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
      </AnimatePresence>
      <div className="fixed inset-x-2 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-night-900/95 shadow-2xl backdrop-blur-md lg:hidden"
        style={{ maxHeight: open ? 'calc(100dvh - 120px)' : undefined }}>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={ui.topHit} className="relative flex w-full items-center gap-3 px-4 pb-2.5 pt-3.5 text-left">
          <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-muted">{ui.topHit} · {v.focus === 'avg' ? ui.average : ui.critHit}</span>
            <span className="block truncate text-xs text-ink/80">{rowName(v.top)}</span>
          </span>
          <span className="font-display text-2xl font-semibold text-gold-soft"><AnimatedNumber value={v.top[v.focus]} /></span>
          <svg viewBox="0 0 12 12" className={`h-3 w-3 text-muted transition ${open ? '' : 'rotate-180'}`}><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="body" initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
              className="flex-1 overflow-y-auto border-t border-white/10 scroll-thin">
              <Headline v={v} enemy={props.enemy} compact />
              <div className="p-3 pt-0"><Rows v={v} /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
