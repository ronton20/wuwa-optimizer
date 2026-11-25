import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import data from '../../data/current';
import type { StatKey } from '../../data/types';
import type { Stats } from '../../engine';
import { useBuild } from '../../state/buildStore';
import { AnimatedNumber, SectionTitle, pct } from '../components/kit';
import { echoImg, img } from '../theme';
import { rollColor, rollTitle } from '../rollQuality';
import { STAT_LABEL, ui } from '../../strings/en';

const PCT_LINES: StatKey[] = [
  'critRate', 'critDmg', 'energyRegen', 'healing', 'dmgBasic', 'dmgHeavy', 'dmgSkill', 'dmgLib', 'dmgIntro', 'dmgEcho', 'dmgAll',
  'dmgGlacio', 'dmgFusion', 'dmgElectro', 'dmgAero', 'dmgSpectro', 'dmgHavoc', 'dmgPhysical',
];
const FLAT = new Set<StatKey>(['atk', 'hp', 'def']);
const fmt = (s: StatKey, v: number) => (FLAT.has(s) ? `${Math.round(v)}` : `${+v.toFixed(1)}%`);

/** Stats that feed the same final number share a family: ATK% and flat ATK both make up ATK. */
type Family = StatKey;
const familyOf = (s: StatKey): Family => (s === 'atkPct' ? 'atk' : s === 'hpPct' ? 'hp' : s === 'defPct' ? 'def' : s);

/** Character sheet: stats like the in-game screen, weapon, and every echo with all its stats (like WuwaFlex).
 *  Hovering any stat lights up every place it comes from and shows the final value. */
export function OverviewTab({ characterId, stats }: { characterId: number; stats: Stats }) {
  const build = useBuild(characterId);
  const c = data.characters.find((x) => x.id === characterId)!;
  const w = data.weapons.find((x) => x.id === build.weapon.id);
  // hover follows the mouse exactly; clicking a stat keeps it (so its sources box can be scrolled)
  const [hover, setHover] = useState<Family | null>(null);
  const [pinned, setPinned] = useState<Family | null>(null);
  const active = hover ?? pinned;
  const lines = PCT_LINES.filter((k) => ['critRate', 'critDmg', 'energyRegen'].includes(k) || stats.sheet[k] > 0);
  const cost = build.echoes.reduce((a, p) => a + (p ? data.echoes.find((e) => e.id === p.echoId)?.cost ?? 0 : 0), 0);

  /** props that make any element a hover/tap target for a stat */
  const target = (s: StatKey) => {
    const f = familyOf(s);
    return {
      onMouseEnter: () => setHover(f),
      onMouseLeave: () => setHover(null),
      onClick: () => setPinned((p) => (p === f ? null : f)),
      'data-on': active === f ? '' : undefined,
      className: `cursor-default transition-colors ${active === f ? 'bg-[color-mix(in_oklab,var(--accent)_28%,transparent)] text-ink' : active ? 'opacity-55' : ''}`,
    };
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div>
          <SectionTitle>{ui.baseStats}</SectionTitle>
          <ul className="space-y-1">
            {(['hp', 'atk', 'def'] as const).map((k) => {
              const t = target(k);
              return (
                <li key={k} {...t} className={`flex items-baseline justify-between rounded-lg bg-black/25 px-3 py-2 ${t.className}`}>
                  <span className="text-muted">{STAT_LABEL[k]}</span>
                  <span className="font-display text-lg">
                    <AnimatedNumber value={stats.base[k]} />
                    <span className="ml-1.5 text-aero">+<AnimatedNumber value={stats.bonus[k]} /></span>
                  </span>
                </li>
              );
            })}
            {lines.map((k) => {
              const t = target(k);
              return (
                <li key={k} {...t} className={`flex items-baseline justify-between rounded-lg px-3 py-1.5 ${t.className}`}>
                  <span className="text-muted">{STAT_LABEL[k]}</span>
                  <AnimatedNumber value={stats.sheet[k]} format={pct} className="font-display" />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <SectionTitle>{ui.tabs.weapon}</SectionTitle>
            {w && (
              <div className="flex items-center gap-3 rounded-xl bg-black/25 p-3">
                {img(`weapon:${w.id}`) && <img src={img(`weapon:${w.id}`)} alt="" className="h-12 w-20 object-contain" />}
                <div className="min-w-0">
                  <div className="font-display">{w.name} <span className="text-gold">R{build.weapon.rank}</span></div>
                  <div className="text-xs text-muted">
                    ATK {Math.floor(w.baseAtk)} · <span {...target(w.substat.stat)} className={`rounded px-1 ${target(w.substat.stat).className}`}>{STAT_LABEL[w.substat.stat]} {fmt(w.substat.stat, w.substat.value)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* fills the column down to the bottom of the stats list and scrolls after that, so it never makes the page longer */}
          <div className="relative min-h-56 flex-1">
            <SourcesBox family={active} stats={stats} pinned={!!pinned && !hover} onClear={() => setPinned(null)} />
          </div>
        </div>
      </div>

      <div>
        <SectionTitle right={<span className="text-xs text-muted">{ui.cost} {cost}/12</span>}>{ui.echoes}</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => build.echoes[i] ?? null).map((p, i) => {
            if (!p) return <li key={i} className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-muted">{ui.emptySlot}</li>;
            const e = data.echoes.find((x) => x.id === p.echoId);
            const fixed = e && data.echoStats.fixed[String(e.cost) as '1' | '3' | '4'];
            const set = data.sonatas.find((s) => s.id === p.setId);
            return (
              <li key={i} className={`overflow-hidden rounded-xl border bg-black/30 ${i === 0 ? 'border-gold/50' : 'border-white/10'}`}>
                <div className="flex items-start gap-2 p-2">
                  {echoImg(p.echoId) ? <img src={echoImg(p.echoId)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-white/5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-end gap-1.5">
                      {set && img(`sonata:${set.id}`) && <img src={img(`sonata:${set.id}`)} alt={set.name} title={set.name} className="h-5 w-5" />}
                      <span className="rounded border border-gold/40 px-1 text-[11px] font-semibold text-gold">{e?.cost}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-right text-[11px] leading-tight text-muted" title={e?.name}>{e?.name}</div>
                  </div>
                </div>
                <div {...target(p.main.stat)} className={`mx-1 flex items-baseline justify-between gap-2 rounded px-2 py-0.5 ${target(p.main.stat).className}`}>
                  <span className="truncate text-xs text-gold-soft/85">{STAT_LABEL[p.main.stat]}</span>
                  <span className="font-display text-lg text-gold-soft">{fmt(p.main.stat, p.main.value)}</span>
                </div>
                <ul className="mt-1 border-t border-white/10 px-1 py-1 text-xs">
                  {fixed && (
                    <li {...target(fixed.stat)} className={`flex justify-between rounded px-2 py-0.5 ${target(fixed.stat).className}`}>
                      <span className="text-ink/90">{STAT_LABEL[fixed.stat]}</span><span className="tabular">{fmt(fixed.stat, fixed.value)}</span>
                    </li>
                  )}
                  {p.subs.map((s) => (
                    <li key={s.stat} {...target(s.stat)} className={`flex justify-between gap-2 rounded px-2 py-0.5 ${target(s.stat).className}`}>
                      <span className="truncate text-ink/75">{STAT_LABEL[s.stat]}</span>
                      <span className="tabular font-semibold" style={{ color: rollColor(s.stat, s.value) }} title={rollTitle(s.stat, s.value)}>{fmt(s.stat, s.value)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-muted">{c.name} · Lv 90 · {ui.overviewHint}</p>
    </div>
  );
}

/** Final value of the hovered stat and every source that adds to it. */
function SourcesBox({ family, stats, pinned, onClear }: { family: Family | null; stats: Stats; pinned: boolean; onClear: () => void }) {
  const isFlat = family === 'atk' || family === 'hp' || family === 'def';
  const keys: StatKey[] = !family ? [] : isFlat ? [family, `${family}Pct` as StatKey] : [family];
  const rows = stats.contributions.filter((x) => keys.includes(x.stat));
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/25 p-3 scroll-thin">
      <AnimatePresence mode="wait">
        {!family ? (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-muted">{ui.hoverStatHint}</motion.p>
        ) : (
          <motion.div key={family} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-display text-sm">{STAT_LABEL[family]}</span>
              <span className="font-display text-2xl text-gold-soft tabular">
                {isFlat ? Math.floor(stats.total[family as 'atk']).toLocaleString() : pct(stats.sheet[family])}
              </span>
            </div>
            <ul className="space-y-0.5 text-xs">
              {isFlat && (
                <li className="flex justify-between gap-2"><span className="text-muted">{ui.baseValue}</span><span className="tabular">{Math.floor(stats.base[family as 'atk']).toLocaleString()}</span></li>
              )}
              {rows.map((x, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-muted">{x.source}</span>
                  <span className="tabular">+{fmt(x.stat, x.value)}{isFlat && x.stat !== family ? ` ${family.toUpperCase()}` : ''}</span>
                </li>
              ))}
            </ul>
            {pinned && <button onClick={onClear} className="mt-2 text-[11px] text-muted hover:text-ink">{ui.unpinStat}</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
