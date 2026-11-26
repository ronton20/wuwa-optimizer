import { useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import data from '../../data/current';
import { useBuild, useBuilds, useMyCharacters } from '../../state/buildStore';
import { useDamage } from '../useDamage';
import { ELEMENT_COLOR, img } from '../theme';
import { ElementGlyph } from '../components/ElementGlyph';
import { DamagePanel, DamageSheet, type CompareColumn } from './DamagePanel';
import { BuildsMenu, ShareButton, SharedBanner } from '../components/BuildsMenu';
import { ImportCard } from '../import/ImportCard';
import { computeDamage } from '../../engine';
import { OverviewTab } from '../tabs/OverviewTab';
import { WeaponTab } from '../tabs/WeaponTab';
import { SkillsTab } from '../tabs/SkillsTab';
import { SequencesTab } from '../tabs/SequencesTab';
import { BuffsTab } from '../tabs/BuffsTab';
import { EchoesTab } from '../tabs/EchoesTab';
import { TeamTab } from '../tabs/TeamTab';
import { EnemyTab, enemyOf } from '../tabs/EnemyTab';
import { OptimizeTab } from '../tabs/OptimizeTab';
import { ui } from '../../strings/en';

const TABS = ['overview', 'weapon', 'echoes', 'skills', 'sequences', 'team', 'buffs', 'enemy', 'optimize'] as const;
type Tab = (typeof TABS)[number];

export function BuildScreen({ characterId }: { characterId: number }) {
  const c = data.characters.find((x) => x.id === characterId)!;
  const build = useBuild(characterId);
  const result = useDamage(build);
  const { select, undo, redo, reset, past, future, saved, pinned, shared } = useBuilds();
  // rail: characters you've built, plus the one open now
  const mine = useMyCharacters();
  const rail = [...new Set([...mine, characterId])].map((id) => data.characters.find((x) => x.id === id)!).filter(Boolean);
  // compare: pinned saved builds of this character, baseline first
  const compare = useMemo<CompareColumn[]>(() => pinned
    .map((id) => saved.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s && s.build.characterId === characterId)
    .map((s) => ({ id: s.id, name: s.name, hits: computeDamage(s.build, data).hits })), [pinned, saved, characterId]);
  const [tab, setTab] = useState<Tab>('overview');
  const art = img(`charArt:${c.id}`) || img(`char:${c.id}`);
  const accent = ELEMENT_COLOR[c.element];

  return (
    <div style={{ '--accent': accent } as CSSProperties} className="relative">
      {/* element ambience */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-[5] transition-colors duration-700"
        style={{ background: `radial-gradient(ellipse at 35% 10%, color-mix(in oklab, ${accent} 18%, transparent), transparent 60%)` }} />

      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={() => select(null)} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-ink">← {ui.back}</button>
        <div className="flex items-center gap-2">
          <ElementGlyph element={c.element} size={18} />
          <h1 className="font-display text-2xl font-semibold tracking-wide">{c.name}</h1>
          <span className="text-gold">{'★'.repeat(c.rarity)}</span>
          <span className="ml-1 rounded-full border border-white/15 px-2 py-0.5 text-xs text-muted">S{build.sequence}</span>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <ImportCard compact />
          <BuildsMenu characterId={characterId} />
          <ShareButton characterId={characterId} />
          <IconBtn label={ui.undo} disabled={!past.length} onClick={undo}>↶</IconBtn>
          <IconBtn label={ui.redo} disabled={!future.length} onClick={redo}>↷</IconBtn>
          <IconBtn label={ui.reset} onClick={() => reset(characterId)}>⟲</IconBtn>
        </div>
      </div>

      {shared?.characterId === characterId && <SharedBanner />}

      <div className="grid gap-4 pb-36 lg:grid-cols-[64px_minmax(0,1fr)_380px] lg:pb-0">
        {/* character rail */}
        <nav aria-label="Resonators" className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {rail.map((x) => {
            const src = img(`char:${x.id}`);
            const active = x.id === c.id;
            return (
              <button key={x.id} onClick={() => select(x.id)} title={x.name} aria-current={active}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 transition ${active ? 'border-[var(--accent)] shadow-[0_0_18px_var(--accent)]' : 'border-white/10 opacity-70 hover:opacity-100'}`}>
                {src ? <img src={src} alt={x.name} className="h-full w-full object-cover" /> : <span className="font-display text-lg" style={{ color: ELEMENT_COLOR[x.element] }}>{x.name[0]}</span>}
              </button>
            );
          })}
          <button onClick={() => select(null)} title={ui.addResonator} aria-label={ui.addResonator}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-white/20 text-2xl text-muted transition hover:border-gold hover:text-gold">+</button>
        </nav>

        {/* workbench */}
        <section className="glass relative min-h-[640px] overflow-hidden rounded-2xl">
          <AnimatePresence mode="wait">
            {art && (
              <motion.img key={c.id} src={art} alt="" aria-hidden
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: tab === 'overview' ? 0.3 : 0.18, x: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                className="pointer-events-none absolute -right-6 top-0 hidden h-full max-h-[760px] w-auto object-contain object-top lg:block [mask-image:linear-gradient(to_left,black_55%,transparent),linear-gradient(to_bottom,black_75%,transparent)] [mask-composite:intersect]" />
            )}
          </AnimatePresence>

          {art && (
            <div className="relative h-48 overflow-hidden lg:hidden" aria-hidden>
              <img src={art} alt="" className="h-full w-full object-cover object-[50%_15%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]" />
            </div>
          )}

          <div role="tablist" aria-label="Build sections" className="relative z-10 hidden gap-1 overflow-x-auto overflow-y-hidden border-b border-white/10 px-3 pt-3 scroll-thin lg:flex">
            {TABS.map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`relative whitespace-nowrap px-4 py-2.5 font-display text-sm tracking-wider transition-colors ${tab === k ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {ui.tabs[k]}
                {tab === k && <motion.span layoutId="tab-underline" className="absolute inset-x-3 bottom-0 h-0.5 bg-[var(--accent)]" />}
              </button>
            ))}
          </div>

          <div className="relative z-10 p-4 sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                {tab === 'overview' && <OverviewTab characterId={characterId} stats={result.stats} />}
                {tab === 'weapon' && <WeaponTab characterId={characterId} />}
                {tab === 'skills' && <SkillsTab characterId={characterId} />}
                {tab === 'sequences' && <SequencesTab characterId={characterId} />}
                {tab === 'echoes' && <EchoesTab characterId={characterId} />}
                {tab === 'team' && <TeamTab characterId={characterId} />}
                {tab === 'buffs' && <BuffsTab characterId={characterId} />}
                {tab === 'enemy' && <EnemyTab characterId={characterId} />}
                {tab === 'optimize' && <OptimizeTab characterId={characterId} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        <DamagePanel hits={result.hits} enemy={enemyOf(build)} compare={compare} />
      </div>

      {/* phones: damage sheet + bottom tab bar */}
      <DamageSheet hits={result.hits} enemy={enemyOf(build)} compare={compare} />
      <nav role="tablist" aria-label="Build sections (mobile)"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(56px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] gap-1 overflow-x-auto overflow-y-hidden border-t border-white/10 bg-night-900/95 px-2 backdrop-blur-md scroll-thin lg:hidden">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`relative shrink-0 whitespace-nowrap px-3 font-display text-[13px] tracking-wide ${tab === k ? 'text-ink' : 'text-muted'}`}>
            {ui.tabs[k]}
            {tab === k && <motion.span layoutId="tab-underline-m" className="absolute inset-x-2 top-0 h-0.5 bg-[var(--accent)]" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className="h-9 w-9 rounded-full border border-white/15 text-lg leading-none hover:border-gold disabled:opacity-30">{children}</button>
  );
}
