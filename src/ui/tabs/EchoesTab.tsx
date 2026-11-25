import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import data from '../../data/current';
import type { Echo, StatKey } from '../../data/types';
import type { EchoPiece } from '../../engine/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { RichText, SectionTitle } from '../components/kit';
import { echoImg, img } from '../theme';
import { STAT_LABEL, ui } from '../../strings/en';
import { computeDamage, rollValues, statWeights, type StatWeight } from '../../engine';
import { IconSelect } from '../components/IconSelect';
import { BAND_COLOR, rollColor, rollTitle } from '../rollQuality';

type Weights = Record<string, StatWeight>;

const MAX_COST = 12;
const SLOTS = 5;
const FLAT = new Set<StatKey>(['atk', 'hp', 'def']);
const fmt = (stat: StatKey, v: number) => (FLAT.has(stat) ? `${v}` : `${v.toFixed(1)}%`);
const echoById = (id: number) => data.echoes.find((e) => e.id === id);
const costOf = (p?: EchoPiece) => (p ? echoById(p.echoId)?.cost ?? 0 : 0);

/** New piece for an echo: keeps the old set/main/subs where they still fit. */
function pieceFor(echo: Echo, prev?: EchoPiece): EchoPiece {
  const mains = data.echoStats.main[String(echo.cost) as '1' | '3' | '4'];
  return {
    echoId: echo.id,
    setId: prev && echo.sets.includes(prev.setId) ? prev.setId : echo.sets[0],
    main: prev && mains.some((m) => m.stat === prev.main.stat) ? mains.find((m) => m.stat === prev.main.stat)! : mains[0],
    subs: prev?.subs ?? [],
  };
}

export function EchoesTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const [slot, setSlot] = useState(0);
  const slots: (EchoPiece | undefined)[] = Array.from({ length: SLOTS }, (_, i) => build.echoes[i] ?? undefined);
  const total = slots.reduce((a, p) => a + costOf(p), 0);
  const weights = useMemo(() => statWeights(build, data), [build]);
  const name = data.characters.find((c) => c.id === characterId)!.name;

  const setPiece = (i: number, p: EchoPiece | undefined) =>
    update(characterId, (b) => {
      const next: (EchoPiece | null)[] = Array.from({ length: SLOTS }, (_, k) => b.echoes[k] ?? null);
      next[i] = p ?? null;
      // slots keep their position; trailing empty slots are dropped
      while (next.length && !next[next.length - 1]) next.pop();
      return { ...b, echoes: next };
    });
  const makeMain = (i: number) =>
    update(characterId, (b) => {
      const e = [...b.echoes];
      [e[0], e[i]] = [e[i], e[0]];
      return { ...b, echoes: e };
    });

  return (
    <div className="space-y-6">
      {/* cost + slots */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted">Cost</div>
          <div className={`font-display text-2xl ${total > MAX_COST ? 'text-fusion' : 'text-gold'}`}>{total}/{MAX_COST}</div>
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          {slots.map((p, i) => {
            const e = p && echoById(p.echoId);
            const src = p && echoImg(p.echoId);
            return (
              <button key={i} onClick={() => setSlot(i)} aria-pressed={slot === i}
                className={`relative h-24 w-24 overflow-hidden rounded-xl border-2 bg-black/30 transition ${slot === i ? 'border-[var(--accent)] shadow-[0_0_14px_var(--accent)]' : 'border-white/10 hover:border-white/30'}`}>
                {src ? <img src={src} alt={e?.name} className="h-full w-full object-cover" /> : <span className="text-2xl text-muted">+</span>}
                {e && <span className="absolute right-1 top-0.5 rounded bg-black/60 px-1 text-xs font-semibold text-gold">{e.cost}</span>}
                {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] uppercase tracking-wider text-gold-soft">Main</span>}
              </button>
            );
          })}
        </div>
      </div>

      <RollValues characterId={characterId} />

      <SonataSummary pieces={build.echoes.filter((p): p is EchoPiece => Boolean(p))} />

      <SlotEditor
        key={slot}
        weights={weights}
        who={name}
        index={slot}
        piece={slots[slot]}
        costLeft={MAX_COST - total + costOf(slots[slot])}
        onChange={(p) => setPiece(slot, p)}
        onMakeMain={slot > 0 && slots[slot] ? () => { makeMain(slot); setSlot(0); } : undefined}
      />
    </div>
  );
}

function SonataSummary({ pieces }: { pieces: EchoPiece[] }) {
  const counts = new Map<number, Set<number>>();
  for (const p of pieces) (counts.get(p.setId) ?? counts.set(p.setId, new Set()).get(p.setId)!).add(p.echoId);
  if (!counts.size) return null;
  return (
    <div>
      <SectionTitle>Sonata effects</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {[...counts].map(([id, set]) => {
          const s = data.sonatas.find((x) => x.id === id);
          if (!s) return null;
          const n = set.size;
          return (
            <li key={id} className="rounded-lg bg-black/25 p-3">
              <div className="flex items-center gap-2">
                {img(`sonata:${id}`) && <img src={img(`sonata:${id}`)} alt="" className="h-6 w-6" />}
                <span className="font-display">{s.name}</span>
                <span className="ml-auto text-xs text-gold">({n}/{Math.max(...s.effects.map((e) => e.pieces))})</span>
              </div>
              {s.effects.map((e) => (
                <div key={e.pieces} className={`mt-1.5 text-xs ${n >= e.pieces ? 'text-ink/85' : 'text-muted/60'}`}>
                  <span className="font-semibold">{e.pieces}pc ·</span> <RichText text={e.description} className="inline" />
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SlotEditor({ index, piece, costLeft, onChange, onMakeMain, weights, who }: { index: number; piece?: EchoPiece; costLeft: number; onChange: (p?: EchoPiece) => void; onMakeMain?: () => void; weights: Weights; who: string }) {
  const [picking, setPicking] = useState(!piece);
  const echo = piece && echoById(piece.echoId);

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <SectionTitle right={
        <div className="flex gap-2 text-xs">
          {onMakeMain && <button onClick={onMakeMain} className="rounded-full border border-white/15 px-3 py-1 hover:border-gold">Make main</button>}
          {piece && <button onClick={() => setPicking((v) => !v)} className="rounded-full border border-white/15 px-3 py-1 hover:border-gold">{picking ? 'Done' : 'Change echo'}</button>}
          {piece && <button onClick={() => { onChange(undefined); setPicking(true); }} className="rounded-full border border-white/15 px-3 py-1 text-muted hover:border-fusion hover:text-fusion">Remove</button>}
        </div>
      }>{index === 0 ? 'Main echo' : `Echo ${index + 1}`}</SectionTitle>

      {picking || !piece || !echo ? (
        <EchoPicker costLeft={costLeft} onPick={(e) => { onChange(pieceFor(e, piece)); setPicking(false); }} />
      ) : (
        <PieceForm piece={piece} echo={echo} isMain={index === 0} onChange={onChange} weights={weights} who={who} />
      )}
    </div>
  );
}

function EchoPicker({ costLeft, onPick }: { costLeft: number; onPick: (e: Echo) => void }) {
  const [q, setQ] = useState('');
  const [cost, setCost] = useState<0 | 1 | 3 | 4>(0);
  const [setId, setSetId] = useState(0);
  const list = useMemo(() => data.echoes.filter((e) =>
    (!cost || e.cost === cost) && (!setId || e.sets.includes(setId)) && e.name.toLowerCase().includes(q.toLowerCase()) && e.sets.length,
  ), [q, cost, setId]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search echoes…" className="min-w-40 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]" />
        <div className="flex overflow-hidden rounded-lg border border-white/10 text-sm">
          {([0, 4, 3, 1] as const).map((c) => (
            <button key={c} onClick={() => setCost(c)} className={`px-3 py-1.5 ${cost === c ? 'bg-[color-mix(in_oklab,var(--accent)_30%,transparent)]' : 'hover:bg-white/5'}`}>{c ? `Cost ${c}` : 'All'}</button>
          ))}
        </div>
        <select value={setId} onChange={(e) => setSetId(Number(e.target.value))} className="rounded-lg border border-white/10 bg-night-900 px-2 py-1.5 text-sm">
          <option value={0}>All sets</option>
          {[...data.sonatas].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <ul className="grid max-h-[420px] grid-cols-3 gap-2 overflow-y-auto pr-1 scroll-thin sm:grid-cols-5 xl:grid-cols-6">
        {list.map((e) => {
          const tooMuch = e.cost > costLeft;
          return (
            <motion.li key={e.id} layout>
              <button disabled={tooMuch} onClick={() => onPick(e)} title={tooMuch ? `Not enough cost left (${costLeft})` : e.name}
                className="group w-full rounded-lg border border-white/10 bg-black/20 p-1 text-left transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30">
                <div className="relative">
                  {echoImg(e.id) ? <img src={echoImg(e.id)} alt="" loading="lazy" className="aspect-square w-full rounded object-cover" /> : <div className="aspect-square" />}
                  <span className="absolute right-1 top-0.5 rounded bg-black/60 px-1 text-[11px] font-semibold text-gold">{e.cost}</span>
                </div>
                <div className="mt-1 truncate text-[11px]">{e.name}</div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function PieceForm({ piece, echo, isMain, onChange, weights, who }: { piece: EchoPiece; echo: Echo; isMain: boolean; onChange: (p: EchoPiece) => void; weights: Weights; who: string }) {
  const cost = String(echo.cost) as '1' | '3' | '4';
  const mains = data.echoStats.main[cost];
  const fixed = data.echoStats.fixed[cost];
  const rolls = data.echoStats.subRolls;
  const subKeys = Object.keys(rolls) as StatKey[];
  const subs = [...piece.subs, ...Array(5 - piece.subs.length).fill(null)] as ({ stat: StatKey; value: number } | null)[];
  const setSub = (i: number, v: { stat: StatKey; value: number } | null) => {
    const next = [...subs];
    next[i] = v;
    onChange({ ...piece, subs: next.filter(Boolean) as { stat: StatKey; value: number }[] });
  };

  return (
    <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        {echoImg(echo.id) && <img src={echoImg(echo.id)} alt="" className="w-full rounded-lg" />}
        <div className="mt-2 font-display">{echo.name}</div>
        <div className="text-xs text-muted">Cost {echo.cost} · +25</div>
        {isMain && echo.skill.description && (
          <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted hover:text-ink">Echo skill</summary><RichText text={echo.skill.description} className="mt-1 text-ink/80" /></details>
        )}
      </div>

      <div className="space-y-4">
        {echo.sets.length > 1 && (
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted">Sonata</div>
            <div className="flex flex-wrap gap-2">
              {echo.sets.map((id) => {
                const s = data.sonatas.find((x) => x.id === id);
                return <button key={id} onClick={() => onChange({ ...piece, setId: id })}
                  className={`rounded-full border px-3 py-1 text-sm ${piece.setId === id ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_20%,transparent)]' : 'border-white/15 hover:border-white/40'}`}>{s?.name}</button>;
              })}
            </div>
          </div>
        )}
        {echo.sets.length === 1 && <div className="text-sm text-muted">Sonata · <span className="text-ink">{data.sonatas.find((s) => s.id === piece.setId)?.name}</span></div>}

        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted">Main stat</div>
          <div className="flex flex-wrap items-center gap-2">
            <IconSelect ariaLabel="Main stat" className="min-w-56" value={piece.main.stat}
              options={mains.map((m) => ({ value: m.stat, label: STAT_LABEL[m.stat], hint: fmt(m.stat, m.value), tone: weights[m.stat] }))}
              onChange={(v) => onChange({ ...piece, main: mains.find((m) => m.stat === v)! })} />
            <span className="text-sm text-muted">+ {STAT_LABEL[fixed.stat]} {fmt(fixed.stat, fixed.value)}</span>
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span className="uppercase tracking-wider text-muted">Substats</span>
            <span className="text-muted"><span className="text-gold-soft"><span className="text-[9px] text-gold">◆</span> worth it for {who}</span> · <span className="opacity-50">faded = no damage gain</span>
              <span className="ml-2 inline-flex items-center gap-1" title="Roll quality: low, mid, high, top">{BAND_COLOR.map((c) => <span key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />)} roll</span></span>
          </div>
          <ul className="space-y-1.5">
            {subs.map((s, i) => {
              const used = new Set(subs.filter((x, k) => x && k !== i).map((x) => x!.stat));
              return (
                <li key={i} className="flex gap-2">
                  <IconSelect ariaLabel={`Substat ${i + 1}`} className="flex-1" value={s?.stat ?? ''} placeholder="— empty —"
                    options={[{ value: '', label: '— empty —' }, ...subKeys.map((k) => ({ value: k, label: `${STAT_LABEL[k]}${FLAT.has(k) ? ' (flat)' : ''}`, tone: weights[k], disabled: used.has(k), hint: used.has(k) ? 'in use' : undefined }))]}
                    onChange={(v) => setSub(i, v ? { stat: v as StatKey, value: rolls[v as StatKey]![0] } : null)} />
                  <select disabled={!s} value={s?.value ?? ''} onChange={(e) => s && setSub(i, { ...s, value: Number(e.target.value) })}
                    title={s ? rollTitle(s.stat, s.value) : undefined} style={s ? { color: rollColor(s.stat, s.value), borderColor: rollColor(s.stat, s.value) + '66' } : undefined}
                    className="tabular w-24 rounded-lg border border-white/10 bg-night-900 px-2 py-1.5 text-right text-sm font-semibold disabled:opacity-40">
                    {s && rolls[s.stat]!.map((v) => <option key={v} value={v} style={{ color: rollColor(s.stat, v) }}>{fmt(s.stat, v)}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** "+1 roll of X = +Y%" on the strongest hit, best first: which substat to chase next. */
function RollValues({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const { row, values } = useMemo(() => {
    const hits = computeDamage(build, data, { noBreakdown: true }).hits;
    const sums = new Map<string, number>();
    for (const h of hits) sums.set(h.row.label, (sums.get(h.row.label) ?? 0) + h.avg * h.count);
    const row = [...sums].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { row, values: row ? rollValues(build, data, row) : [] };
  }, [build]);
  if (!row) return null;
  const best = Math.max(...values.map((v) => v.gainPct), 0.0001);
  const shown = values.filter((v) => v.gainPct > 0.005 || v.capped);
  return (
    <div>
      <SectionTitle>{ui.rollTitle}</SectionTitle>
      <p className="mb-2 text-xs text-muted">{ui.rollHint(row.replace(/ DMG$/, ''))}</p>
      <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {shown.map((v) => (
          <li key={v.stat} className="flex items-center gap-3 text-sm">
            <span className="w-52 shrink-0 truncate" title={STAT_LABEL[v.stat]}>{STAT_LABEL[v.stat].replace('Resonance ', '')} <span className="text-xs text-muted">+{fmt(v.stat, v.roll)}</span></span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.span className="block h-full rounded-full bg-[var(--accent)]" initial={false} animate={{ width: `${(v.gainPct / best) * 100}%` }} transition={{ duration: 0.35 }} />
            </span>
            <span className="tabular w-16 text-right text-gold-soft">{v.capped ? <span className="text-xs text-muted">{ui.capped}</span> : `+${v.gainPct.toFixed(2)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
