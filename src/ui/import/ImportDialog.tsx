import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import data from '../../data/current';
import type { SkillKind, StatKey } from '../../data/types';
import { cardToBuild, type CardResult } from '../../import/readCard';
import { defaultBuild, useBuilds } from '../../state/buildStore';
import { IconSelect } from '../components/IconSelect';
import { ELEMENT_COLOR, echoImg, img } from '../theme';
import { rollColor, rollTitle } from '../rollQuality';
import { SKILL_LABEL, STAT_LABEL, ui } from '../../strings/en';

const FLAT = new Set<StatKey>(['atk', 'hp', 'def']);
const fmt = (s: StatKey, v: number) => (FLAT.has(s) ? `${v}` : `${v}%`);
const SKILL_ORDER: SkillKind[] = ['Normal', 'Skill', 'Forte', 'Liberation', 'Intro'];

/** Preview of what was read from a card; lets the user fix anything uncertain before it becomes their build. */
export function ImportDialog({ result, imageUrl, onClose }: { result: CardResult; imageUrl: string; onClose: () => void }) {
  const { builds, update, saveAs, select } = useBuilds();
  const [r, setR] = useState(result);
  const [rank, setRank] = useState(1);
  const [keepCopy, setKeepCopy] = useState(true);
  const [showCard, setShowCard] = useState(false);
  const c = data.characters.find((x) => x.id === r.characterId);
  const existing = c ? builds[c.id] : undefined;
  const weapon = data.weapons.find((w) => w.id === r.weaponId);

  // rank: the card doesn't show it, so start from the rank this weapon already has in the user's build
  useEffect(() => {
    setRank(existing && existing.weapon.id === r.weaponId ? existing.weapon.rank : 1);
  }, [existing, r.weaponId]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const charOptions = useMemo(() => [...data.characters].sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => ({ value: String(x.id), label: x.name, icon: img(`char:${x.id}`) })), []);
  const weaponOptions = useMemo(() => data.weapons.filter((w) => !c || w.type === c.weaponType)
    .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
    .map((w) => ({ value: String(w.id), label: w.name, icon: img(`weapon:${w.id}`) })), [c]);

  const apply = () => {
    if (!c) return;
    if (existing && keepCopy) saveAs(`${ui.beforeImport} ${new Date().toLocaleDateString()}`, existing);
    update(c.id, (b) => {
      const next = cardToBuild(r, b ?? defaultBuild(c.id));
      return { ...next, weapon: { ...next.weapon, rank } };
    });
    select(c.id);
    onClose();
  };
  const setEcho = (i: number, echoId: number) => setR((cur) => ({
    ...cur,
    echoes: cur.echoes.map((e, k) => {
      if (k !== i || !e.piece) return e;
      const echo = data.echoes.find((x) => x.id === echoId)!;
      return { ...e, confidence: 1, piece: { ...e.piece, echoId, setId: echo.sets.includes(e.piece.setId) ? e.piece.setId : echo.sets[0] } };
    }),
  }));

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div role="dialog" aria-modal aria-label={ui.importPreview} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="glass max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-t-2xl border border-white/15 p-5 scroll-thin sm:rounded-2xl sm:p-6"
        style={c ? ({ '--accent': ELEMENT_COLOR[c.element] } as React.CSSProperties) : undefined}>
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl tracking-wide">{ui.importPreview}</h2>
            <p className="text-xs text-muted">{ui.importPreviewHint}</p>
          </div>
          <button onClick={() => setShowCard((v) => !v)} className="rounded-full border border-white/15 px-3 py-1 text-xs hover:border-gold">{showCard ? ui.hideCard : ui.showCard}</button>
          <button onClick={onClose} aria-label={ui.cancel} className="h-8 w-8 rounded-full border border-white/15 hover:border-gold">✕</button>
        </div>
        {showCard && <img src={imageUrl} alt="" className="mb-4 w-full rounded-lg" />}

        {r.warnings.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-lg border border-[#f0c75e]/40 bg-[#f0c75e]/10 px-4 py-3 text-xs">
            {r.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
          </ul>
        )}

        {/* character, sequence, weapon */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex items-center gap-3 rounded-xl bg-black/25 p-3">
            {c && img(`char:${c.id}`) && <img src={img(`char:${c.id}`)} alt="" className="h-14 w-14 rounded-full border-2 border-[var(--accent)] object-cover" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <IconSelect ariaLabel={ui.resonator} iconShape="round" value={c ? String(c.id) : ''} placeholder={ui.pickResonator} options={charOptions}
                onChange={(v) => setR({ ...r, characterId: Number(v) })} />
              <div className="flex items-center gap-2 text-xs text-muted">
                {ui.sequence}
                <select value={r.sequence} onChange={(e) => setR({ ...r, sequence: Number(e.target.value) })} className="rounded border border-white/15 bg-night-900 px-1.5 py-0.5 text-ink">
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>S{n}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 rounded-xl bg-black/25 p-3">
            <div className="flex gap-2">
              <IconSelect ariaLabel={ui.weapon} iconShape="wide" className="flex-1" value={weapon ? String(weapon.id) : ''} placeholder={ui.pickWeapon} options={weaponOptions}
                onChange={(v) => setR({ ...r, weaponId: Number(v) })} />
              <select value={rank} onChange={(e) => setRank(Number(e.target.value))} aria-label={ui.rank} className="rounded-lg border border-[#f0c75e]/60 bg-night-900 px-2">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>R{n}</option>)}
              </select>
            </div>
            <p className="text-[11px] text-[#f0c75e]">{ui.rankNotOnCard}</p>
          </div>
        </div>

        {/* skill levels */}
        <div className="mt-3 flex flex-wrap gap-2">
          {SKILL_ORDER.map((k) => (
            <label key={k} className="flex items-center gap-2 rounded-full bg-black/25 py-1 pl-3 pr-1 text-xs">
              <span className="text-muted">{SKILL_LABEL[k]}</span>
              <select value={r.skillLevels[k] ?? 10} onChange={(e) => setR({ ...r, skillLevels: { ...r.skillLevels, [k]: Number(e.target.value) } })}
                className="rounded-full border border-white/15 bg-night-900 px-1.5 py-0.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Lv {n}</option>)}
              </select>
            </label>
          ))}
        </div>

        {/* echoes */}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {r.echoes.map((e, i) => {
            if (!e.piece) return <li key={i} className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-muted">{ui.echoUnread(i + 1)}</li>;
            const p = e.piece;
            const echo = data.echoes.find((x) => x.id === p.echoId)!;
            const unsure = e.confidence < 0.6;
            const options = [p.echoId, ...e.alternatives].map((id) => {
              const x = data.echoes.find((y) => y.id === id)!;
              return { value: String(id), label: x.name, icon: echoImg(id) };
            });
            return (
              <li key={i} className={`rounded-xl border p-3 ${unsure ? 'border-[#f0c75e]/60 bg-[#f0c75e]/5' : 'border-white/10 bg-black/25'}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted">{i === 0 ? ui.mainEcho : `${ui.echo} ${i + 1}`}</span>
                  <span className="ml-auto rounded bg-black/40 px-1.5 text-[11px] font-semibold text-gold">{echo.cost}</span>
                </div>
                <IconSelect ariaLabel={`${ui.echo} ${i + 1}`} className="w-full" value={String(p.echoId)} options={options} onChange={(v) => setEcho(i, Number(v))} searchable={false} />
                {unsure && <p className="mt-1 text-[11px] text-[#f0c75e]">{ui.echoUnsure}</p>}
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                  {img(`sonata:${p.setId}`) && <img src={img(`sonata:${p.setId}`)} alt="" className="h-4 w-4" />}
                  <span className="truncate">{data.sonatas.find((s) => s.id === p.setId)?.name}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm text-gold-soft"><span>{STAT_LABEL[p.main.stat]}</span><span className="tabular">{fmt(p.main.stat, p.main.value)}</span></div>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {p.subs.map((s) => (
                    <li key={s.stat} className="flex justify-between gap-2">
                      <span className="truncate text-ink/80">{STAT_LABEL[s.stat]}</span>
                      <span className="tabular font-semibold" style={{ color: rollColor(s.stat, s.value) }} title={rollTitle(s.stat, s.value)}>{fmt(s.stat, s.value)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          {existing && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={keepCopy} onChange={(e) => setKeepCopy(e.target.checked)} className="accent-[var(--accent)]" />
              {ui.keepCurrentCopy}
            </label>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-muted hover:text-ink">{ui.cancel}</button>
            <button onClick={apply} disabled={!c}
              className="rounded-full bg-[color-mix(in_oklab,var(--accent,#e9c77b)_35%,transparent)] px-5 py-2 font-display text-sm tracking-wide hover:bg-[color-mix(in_oklab,var(--accent,#e9c77b)_50%,transparent)] disabled:opacity-40">
              {existing ? ui.importReplace : ui.importApply}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
