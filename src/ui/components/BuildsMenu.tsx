import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MAX_PINNED, useBuild, useBuilds, useSavedFor } from '../../state/buildStore';
import { rotationDps, rotationFor } from '../../state/rotationDps';
import { shareUrl } from '../../state/share';
import { ui } from '../../strings/en';

/** "Builds" popover: save the current build under a name, load / echoes-only / compare / rename / delete saved ones. */
export function BuildsMenu({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const saved = useSavedFor(characterId);
  const { saveAs, loadSaved, togglePin, renameSaved, deleteSaved, pinned, teams, mainTeam, rotations, builds } = useBuilds();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pinnedHere = pinned.filter((p) => saved.some((s) => s.id === p));
  // each saved build in this Resonator's team rotation, next to the current build (only while the menu is open)
  const dps = useMemo(() => {
    const found = open ? rotationFor(characterId, { teams, mainTeam, rotations }) : undefined;
    if (!found) return undefined;
    return {
      live: rotationDps(found.team, found.rotation, builds).dps,
      of: Object.fromEntries(saved.map((s) => [s.id, rotationDps(found.team, found.rotation, builds, s.build).dps])),
    };
  }, [open, characterId, teams, mainTeam, rotations, builds, saved]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  const save = () => { saveAs(name || `Build ${saved.length + 1}`, build); setName(''); };
  const btn = 'rounded-full border border-white/15 px-2.5 py-1 text-xs hover:border-gold disabled:opacity-30';

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition ${open ? 'border-[var(--accent)]' : 'border-white/15 hover:border-gold'}`}>
        {ui.builds}
        {saved.length > 0 && <span className="rounded-full bg-white/10 px-1.5 text-[11px] tabular">{saved.length}</span>}
        {pinnedHere.length > 0 && <span className="text-[11px] text-[var(--accent)]">◆{pinnedHere.length}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] rounded-xl border border-white/15 bg-night-900/95 p-3 shadow-2xl backdrop-blur-md">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-muted">{ui.saveAs}</div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ui.savePlaceholder} maxLength={40}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]" />
              <button type="submit" className="rounded-lg bg-[color-mix(in_oklab,var(--accent)_30%,transparent)] px-3 text-sm hover:bg-[color-mix(in_oklab,var(--accent)_45%,transparent)]">{ui.save}</button>
            </form>

            <div className="my-3 h-px bg-white/10" />
            {saved.length === 0 ? <p className="text-xs text-muted">{ui.noSaved}</p> : (
              <>
                <p className="mb-2 text-[11px] text-muted">{ui.pinHint(MAX_PINNED)}</p>
                {dps && <p className="mb-2 text-[11px] text-muted">{ui.savedDpsHint(Math.round(dps.live).toLocaleString())}</p>}
                <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1 scroll-thin">
                  {saved.map((s) => {
                    const pin = pinned.indexOf(s.id);
                    return (
                      <li key={s.id} className={`rounded-lg border p-2 ${pin >= 0 ? 'border-[var(--accent)]/60 bg-white/5' : 'border-white/10'}`}>
                        <div className="mb-1.5 flex items-center gap-2">
                          {editing === s.id ? (
                            <input autoFocus defaultValue={s.name} maxLength={40} onBlur={(e) => { renameSaved(s.id, e.target.value); setEditing(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-2 py-0.5 text-sm" />
                          ) : (
                            <button className="min-w-0 flex-1 truncate text-left text-sm" title={ui.rename} onClick={() => setEditing(s.id)}>
                              {pin === 0 && <span className="text-[var(--accent)]">◆ </span>}{s.name}
                            </button>
                          )}
                          <span className="shrink-0 text-[10px] text-muted">S{s.build.sequence} · {new Date(s.savedAt).toLocaleDateString()}</span>
                        </div>
                        {dps && <SavedDps dps={dps.of[s.id]} live={dps.live} />}
                        <div className="flex flex-wrap gap-1.5">
                          <button className={btn} onClick={() => loadSaved(s.id, 'all')}>{ui.load}</button>
                          <button className={btn} onClick={() => loadSaved(s.id, 'echoes')}>{ui.echoesOnly}</button>
                          <button className={`${btn} ${pin >= 0 ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`} onClick={() => togglePin(s.id)} aria-pressed={pin >= 0}>
                            {pin >= 0 ? `◆ ${ui.unpin}` : ui.pin}
                          </button>
                          <button className={`${btn} ml-auto text-muted hover:!border-[#ff6b8b] hover:text-[#ff6b8b]`} onClick={() => { if (confirm(`${ui.delete} "${s.name}"?`)) deleteSaved(s.id); }}>{ui.delete}</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A saved build's rotation DPS and how it compares with the current build. */
function SavedDps({ dps, live }: { dps: number; live: number }) {
  const d = live ? (dps / live - 1) * 100 : 0;
  return (
    <div className="mb-1.5 flex items-baseline gap-2 text-xs">
      <span className="tabular text-gold-soft">{Math.round(dps).toLocaleString()}</span>
      <span className="text-[10px] text-muted">{ui.dps}</span>
      <span className={`tabular text-[11px] ${Math.abs(d) < 0.05 ? 'text-muted' : d > 0 ? 'text-aero' : 'text-[#ff6b8b]'}`}>
        {Math.abs(d) < 0.05 ? '±0%' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`}
      </span>
    </div>
  );
}

/** Copies a link to the current build; shows a short confirmation (or the link itself if copying is blocked). */
export function ShareButton({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const [msg, setMsg] = useState<{ text: string; link?: string } | null>(null);
  useEffect(() => {
    if (!msg || msg.link) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const share = async () => {
    const link = shareUrl(build);
    try {
      await navigator.clipboard.writeText(link);
      setMsg({ text: ui.shareCopied });
    } catch {
      setMsg({ text: ui.shareFailed, link });
    }
  };
  return (
    <div className="relative">
      <button onClick={share} className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-sm hover:border-gold">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 9.5l3-3M7 4.5l1.3-1.3a2.5 2.5 0 013.5 3.5L10.5 8M9 11.5l-1.3 1.3a2.5 2.5 0 01-3.5-3.5L5.5 8" /></svg>
        {ui.share}
      </button>
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status"
            className="absolute right-0 top-11 z-50 w-[min(92vw,340px)] rounded-xl border border-white/15 bg-night-900/95 p-3 text-xs shadow-2xl backdrop-blur-md">
            {msg.text}
            {msg.link && (
              <>
                <input readOnly value={msg.link} onFocus={(e) => e.target.select()} className="mt-2 w-full rounded border border-white/15 bg-black/30 px-2 py-1" />
                <button onClick={() => setMsg(null)} className="mt-2 text-muted hover:text-ink">OK</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Banner while a build from a share link is open. */
export function SharedBanner() {
  const { shared, keepShared, discardShared } = useBuilds();
  if (!shared) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--accent)]/50 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm text-ink">{ui.sharedTitle}</div>
        <div className="text-xs text-muted">{ui.sharedText}</div>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <button onClick={() => keepShared('replace')} className="rounded-full bg-[color-mix(in_oklab,var(--accent)_35%,transparent)] px-3 py-1.5 hover:bg-[color-mix(in_oklab,var(--accent)_50%,transparent)]">{ui.keepReplace}</button>
        <button onClick={() => keepShared('copy', ui.sharedTitle)} className="rounded-full border border-white/20 px-3 py-1.5 hover:border-gold">{ui.keepCopy}</button>
        <button onClick={discardShared} className="rounded-full px-3 py-1.5 text-muted hover:text-ink">{ui.discard}</button>
      </div>
    </motion.div>
  );
}
