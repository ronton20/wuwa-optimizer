import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import data from '../../data/current';
import type { SkillKind } from '../../data/types';
import { machineFor, skillOfRow, type MachineState, type Move } from '../../engine/rotation/actions';
import { maxEnergyOf, simulate, type Rotation, type RotationStep, type SimMove, type SimResult } from '../../engine/rotation/sim';
import { actionTime, DEFAULT_TIMES, FROZEN_LIBERATION_TIME } from '../../engine/rotation/timing';
import type { Build } from '../../engine/types';
import { teamBuild, useBuilds } from '../../state/buildStore';
import { ui } from '../../strings/en';
import { AnimatedNumber, SectionTitle, Toggle } from '../components/kit';
import { echoImg, ELEMENT_COLOR, img } from '../theme';

const uid = () => Math.random().toString(36).slice(2, 10);
const char = (id: number) => data.characters.find((c) => c.id === id)!;
/** Team members get distinct colors (a team is often one element); the first keeps its element color. */
const SLOT = ['', '#e6b85c', '#c48cff'];
const ColorCtx = createContext((id: number) => ELEMENT_COLOR[char(id).element]);
const fmt = (n: number) => Math.round(n).toLocaleString();
const secs = (n: number) => `${n.toFixed(1)}s`;
/** "Heavy Attack - Bitterfrost: Foreclaimed Self" → "Bitterfrost: Foreclaimed Self" */
const bare = (label: string) => label.replace(/^(Normal Attack|Basic Attack|Heavy Attack|Resonance Skill|Resonance Liberation|Forte Circuit|Intro Skill|Outro Skill) - /, '');

function skillIcon(charId: number, kind: SkillKind) {
  const s = char(charId).skills.find((x) => x.kind === kind);
  return s ? img(`skill:${s.id}`) : '';
}
/** The icon of what actually happens: the skill its first row comes from. */
function moveIcon(charId: number, move: Move, build?: Build) {
  if (move.timing === 'echo') { const e = build?.echoes[0]; return e ? echoImg(e.echoId) : ''; }
  const hud = move.icon ? img(`hud:${charId}:${move.icon}`) : '';
  if (hud) return hud;
  const s = move.rows[0] && skillOfRow(char(charId), move.rows[0]);
  return s ? img(`skill:${s.id}`) : skillIcon(charId, move.kind);
}

/** One team's rotation: press skills per Resonator, see each move's damage, Concerto, buffs that were up, and the DPS. */
export function RotationScreen({ teamId }: { teamId: string }) {
  const team = useBuilds((s) => s.teams.find((t) => t.id === teamId));
  const allRotations = useBuilds((s) => s.rotations);
  const rotations = useMemo(() => allRotations.filter((r) => r.teamId === teamId), [allRotations, teamId]);
  const builds = useBuilds((s) => s.builds);
  const { showTeam, saveRotation, deleteRotation, select } = useBuilds.getState();
  const [rotId, setRotId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const members = useMemo(() => team?.members ?? [], [team]);
  const color = useCallback((id: number) => { const i = members.indexOf(id); return i > 0 ? SLOT[i] : ELEMENT_COLOR[char(id).element]; }, [members]);
  const memberBuilds = useMemo(() => Object.fromEntries(members.map((m) => [m, teamBuild(m, members, builds)])), [members, builds]);
  const [fresh] = useState<Rotation>(() => ({ id: uid(), name: 'Rotation 1', teamId, steps: [], freezeLiberation: true }));
  const rot: Rotation = rotations.find((r) => r.id === rotId) ?? rotations[0] ?? fresh;
  const result = useMemo(() => simulate(rot, memberBuilds, data), [rot, memberBuilds]);

  if (!team) {
    return (
      <div className="py-20 text-center text-muted">
        This team no longer exists. <button className="text-gold underline" onClick={() => showTeam(null)}>{ui.back}</button>
      </div>
    );
  }

  const save = (patch: Partial<Rotation>) => { const next = { ...rot, ...patch }; saveRotation(next); setRotId(next.id); };
  const setSteps = (steps: RotationStep[]) => save({ steps });
  const insertAt = selected === null ? rot.steps.length : selected + 1;
  const add = (charId: number, button: string) => {
    setSteps([...rot.steps.slice(0, insertAt), { char: charId, button }, ...rot.steps.slice(insertAt)]);
    if (selected !== null) setSelected(insertAt);
  };
  const remove = (i: number) => { setSteps(rot.steps.filter((_, j) => j !== i)); setSelected(null); };
  // right-click: keep the selected step selected (its index moves up when an earlier one goes)
  const moveStep = (from: number, to: number) => {
    const order = moved(rot.steps.length, from, to);
    setSteps(order.map((k) => rot.steps[k]));
    setHover(null);
    setSelected((sel) => (sel === null ? null : order.indexOf(sel)));
  };
  const removeAt = (i: number) => { setSteps(rot.steps.filter((_, j) => j !== i)); setHover(null); setSelected((sel) => (sel === null || sel === i ? null : sel > i ? sel - 1 : sel)); };
  const shift = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rot.steps.length) return;
    const s = [...rot.steps]; [s[i], s[j]] = [s[j], s[i]];
    setSteps(s); setSelected(j);
  };
  const patchStep = (i: number, patch: Partial<RotationStep>) => setSteps(rot.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const newRotation = () => { const r = { id: uid(), name: `Rotation ${rotations.length + 1}`, teamId, steps: [], freezeLiberation: true }; saveRotation(r); setRotId(r.id); setSelected(null); };

  // where the next move goes: each Resonator's state, Concerto and Energy at that point
  const before = result.states[insertAt - 1];
  const lastChar = rot.steps[insertAt - 1]?.char;
  const lastMove = (m: number) => [...result.moves].reverse().find((x) => x.char === m && x.step < insertAt);
  // with full Concerto, switching in plays the Intro first: show the others as they'll be after it
  const introNext = lastChar !== undefined && (lastMove(lastChar)?.concerto ?? 0) >= 100;
  const stateAt = (m: number): MachineState => {
    const mc = machineFor(m, data, memberBuilds[m]?.sequence ?? 0, memberBuilds[m]?.conditions);
    const s = before?.get(m) ?? mc.initial();
    if (lastChar === undefined || lastChar === m) return s;
    const out = mc.swappedOut(s);
    return introNext ? mc.press(out, 'intro').state : out;
  };

  const accent = color(members[0] ?? 0);
  return (
    <ColorCtx.Provider value={color}>
    <div style={{ '--accent': accent } as CSSProperties} className="relative space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => showTeam(null)} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-ink">← {ui.back}</button>
        <h1 className="font-display text-2xl font-semibold tracking-wide">{team.name}</h1>
        <span className="flex gap-2 text-sm text-muted">
          {members.map((m, i) => <button key={m} onClick={() => select(m)} className="hover:text-ink" title={`Open ${char(m).name}'s build`}>{i > 0 && '· '}{char(m).name}</button>)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <select value={rot.id} onChange={(e) => { setRotId(e.target.value); setSelected(null); }} aria-label="Rotation"
            className="rounded-full border border-white/15 bg-night-900 px-3 py-1.5">
            {!rotations.some((r) => r.id === rot.id) && <option value={rot.id}>{rot.name}</option>}
            {rotations.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => { const n = prompt('Rotation name', rot.name); if (n) save({ name: n.trim() || rot.name }); }} className="rounded-full border border-white/15 px-3 py-1.5 text-muted hover:text-ink">Rename</button>
          <button onClick={newRotation} className="rounded-full border border-white/15 px-3 py-1.5 text-muted hover:text-ink">+ New</button>
          {rotations.some((r) => r.id === rot.id) && (
            <button onClick={() => { if (confirm(`Delete ${rot.name}?`)) { deleteRotation(rot.id); setRotId(null); setSelected(null); } }} className="rounded-full border border-white/15 px-3 py-1.5 text-muted hover:text-fusion">Delete</button>
          )}
        </div>
      </div>

      <Summary result={result} members={members} rot={rot} onSave={save} />

      {/* palette */}
      <section>
        <SectionTitle>Add a move</SectionTitle>
        <p className="-mt-1 mb-3 text-xs text-muted">
          {selected === null ? 'Moves go to the end of the rotation.' : `Moves go after #${selected + 1}.`} Each button adds what it does in the game at that point; switching Resonators adds Outro and Intro when Concerto is full.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {members.map((m) => (
            <Palette key={m} charId={m} build={memberBuilds[m]} state={stateAt(m)} afterIntro={introNext && lastChar !== m} last={lastMove(m)} startConcerto={rot.fullConcerto ? 100 : 0} startEnergy={result.energies[insertAt - 1]?.get(m) ?? (rot.emptyEnergy ? 0 : maxEnergyOf(char(m)))}
              onPress={(b) => add(m, b)} />
          ))}
        </div>
      </section>

      {/* the rotation strip */}
      <section>
        <SectionTitle right={rot.steps.length > 0 && (
          <button onClick={() => { if (confirm('Clear every move?')) { setSteps([]); setSelected(null); } }} className="text-xs text-muted hover:text-fusion">Clear</button>
        )}>Rotation</SectionTitle>
        {rot.steps.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">Press skills above, in order. Pressing Basic Attack three times is Stage 1, 2 and 3.</p>
        ) : (
          <Strip rot={rot} result={result} builds={memberBuilds} selected={selected} hover={hover} onSelect={(i) => setSelected(selected === i ? null : i)} onHover={setHover} onRemove={removeAt} onMove={moveStep} />
        )}
        <AnimatePresence initial={false}>
          {selected !== null && rot.steps[selected] && (
            <motion.div key="detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <StepDetail i={selected} step={rot.steps[selected]} moves={result.moves.filter((m) => m.step === selected)} freeze={!!rot.freezeLiberation}
                swap={result.swaps[selected]}
                onPatch={(p) => patchStep(selected, p)} onRemove={() => remove(selected)} onShift={(d) => shift(selected, d)} onClose={() => setSelected(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {rot.steps.length > 0 && <Timeline result={result} members={members} hover={hover} onHover={setHover} onSelect={setSelected} onRemove={removeAt} />}
    </div>
    </ColorCtx.Provider>
  );
}

function Summary({ result, members, rot, onSave }: { result: SimResult; members: number[]; rot: Rotation; onSave: (p: Partial<Rotation>) => void }) {
  const color = useContext(ColorCtx);
  const warnings = result.moves.filter((m) => m.warn.length).length;
  const negative = result.moves.flatMap((m) => m.hits).filter((h) => h.status).reduce((a, h) => a + h.value, 0);
  return (
    <div className="glass grid gap-4 rounded-2xl p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <div className="flex gap-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted">DPS</div>
          <AnimatedNumber value={result.dps} className="font-display text-4xl text-gold-soft tabular" />
        </div>
        <div className="space-y-1 text-sm">
          <div><span className="text-muted">Damage </span><span className="tabular">{fmt(result.total)}</span></div>
          <div><span className="text-muted">Time </span><span className="tabular">{secs(result.time)}</span></div>
          {negative > 0 && <div className="text-xs text-muted" title={ui.negativeHint}>{ui.negativeIncl} ~<span className="tabular">{fmt(negative)}</span> {ui.estimate}</div>}
          {warnings > 0 && <div className="text-xs text-fusion">{warnings} move{warnings > 1 ? 's' : ''} with a warning</div>}
        </div>
      </div>
      <div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
          {members.map((m) => <div key={m} style={{ width: `${result.total ? ((result.byChar[m] ?? 0) / result.total) * 100 : 0}%`, background: color(m) }} className="transition-all" />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {members.map((m) => (
            <span key={m}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: color(m) }} />{char(m).name} <span className="tabular text-ink">{result.total ? Math.round(((result.byChar[m] ?? 0) / result.total) * 100) : 0}%</span></span>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-muted">
        <label className="flex items-center gap-2" title={ui.clockStopHint(FROZEN_LIBERATION_TIME, DEFAULT_TIMES.liberation)}>
          <Toggle on={!!rot.freezeLiberation} onChange={(v) => onSave({ freezeLiberation: v })} label={ui.clockStop} /> {ui.clockStop}
        </label>
        <label className="flex items-center gap-2">
          <Toggle on={!!rot.fullConcerto} onChange={(v) => onSave({ fullConcerto: v })} label="Start with full Concerto" /> Start with full Concerto
        </label>
        <label className="flex items-center gap-2">
          <Toggle on={!rot.emptyEnergy} onChange={(v) => onSave({ emptyEnergy: !v })} label="Start with full Resonance Energy" /> Start with full Energy
        </label>
      </div>
      <p className="text-xs text-muted lg:col-span-3">
        {ui.rotationNote}
      </p>
    </div>
  );
}

function Meter({ label, value, max, tint }: { label: string; value: number; max: number; tint?: string }) {
  return (
    <div className="text-[10px] text-muted" title={`${label} ${Math.floor(value)} / ${max}`}>
      <div className="flex justify-between"><span>{label}</span><span className="tabular text-ink">{Math.floor(value)}/{max}</span></div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: tint ?? 'var(--accent)' }} />
      </div>
    </div>
  );
}

function Palette({ charId, build, state, afterIntro, last, startConcerto, startEnergy, onPress }: {
  charId: number; build?: Build; state: MachineState; afterIntro?: boolean; last?: SimMove; startConcerto: number; startEnergy: number; onPress: (button: string) => void;
}) {
  const color = useContext(ColorCtx);
  const c = char(charId);
  const machine = machineFor(charId, data, build?.sequence ?? 0, build?.conditions);
  const [more, setMore] = useState(false);
  const head = img(`char:${charId}`);
  const maxE = maxEnergyOf(c);
  const concerto = last?.concerto ?? startConcerto;
  const energy = startEnergy; // the Energy at this point in the rotation, off-field gains included
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3" style={{ '--accent': color(charId) } as CSSProperties}>
      <div className="mb-2 flex items-center gap-2">
        {head && <img src={head} alt="" className="h-8 w-8 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${color(charId)}` }} />}
        <span className="font-display tracking-wide">{c.name}</span>
        {afterIntro && <span className="ml-auto rounded-full border border-[var(--accent)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink/90" title={ui.afterIntroHint}>{ui.afterIntro}</span>}
        {state.air && <span className={`${afterIntro ? '' : 'ml-auto '}rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted`} title="In the air: Basic and Skill do their mid-air versions">Mid-air</span>}
      </div>
      <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <Meter label="Concerto" value={concerto} max={100} tint={concerto >= 100 ? '#f2d27a' : undefined} />
        {maxE > 0 && <Meter label="Energy" value={energy} max={maxE} />}
        {machine.gauges?.(state).map((g) => <Meter key={g.label} {...g} />)}
      </div>
      <div className="flex flex-wrap gap-1">
        {machine.buttons.map((b) => {
          const { move } = machine.press(state, b.id);
          const icon = moveIcon(charId, move, build);
          const ready = move.special && !move.warn;
          return (
            <button key={b.id} onClick={() => onPress(b.id)} title={`${move.label}${ready ? `\n${ui.moveReady}` : ''}${move.warn ? `\n⚠ ${move.warn}` : ''}${b.hint ? `\n${b.hint}` : ''}`}
              className="group flex w-[4.6rem] flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] leading-tight text-muted transition hover:bg-white/5 hover:text-ink active:scale-95">
              <span className={`relative grid h-10 w-10 place-items-center rounded-full border bg-night-900 transition group-hover:border-[var(--accent)] ${ready ? 'border-[var(--accent)]' : 'border-white/15'}`}
                style={ready ? { boxShadow: '0 0 12px color-mix(in oklab, var(--accent) 70%, transparent)' } : undefined}>
                {icon ? <img src={icon} alt="" className="h-7 w-7 object-contain" /> : <span className="font-display text-sm">{b.label[0]}</span>}
                {move.warn && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-fusion" />}
              </span>
              <span className="text-center text-ink/90">{b.label}</span>
              {move.timing !== 'echo' && bare(move.label) !== b.label && <span className="line-clamp-2 text-center text-[9px] text-muted">{bare(move.label)}</span>}
            </button>
          );
        })}
      </div>
      <button onClick={() => setMore(!more)} className="mt-2 text-xs text-muted hover:text-ink">{more ? 'Fewer moves ▴' : `Every move (${machine.exact.length}) ▾`}</button>
      {more && (
        <div className="scroll-thin mt-2 max-h-56 space-y-0.5 overflow-y-auto pr-1">
          {machine.exact.map((b) => {
            const { move } = machine.press(state, b.id);
            const icon = moveIcon(charId, move, build);
            return (
              <button key={b.id} onClick={() => onPress(b.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-muted hover:bg-white/5 hover:text-ink">
                {icon && <img src={icon} alt="" className="h-4 w-4" />}
                {b.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Step indices 0..n-1 with the one at `from` moved to `to`. */
function moved(n: number, from: number, to: number) {
  const o = Array.from({ length: n }, (_, i) => i);
  o.splice(from, 1);
  o.splice(to, 0, from);
  return o;
}

let nextStepKey = 0;
const SLIDE = { type: 'spring', stiffness: 700, damping: 42, mass: 0.6 } as const;

function Strip({ rot, result, builds, selected, hover, onSelect, onHover, onRemove, onMove }: {
  rot: Rotation; result: SimResult; builds: Record<number, Build>; selected: number | null; hover: number | null; onSelect: (i: number) => void; onHover: (i: number | null) => void; onRemove: (i: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const color = useContext(ColorCtx);
  const olRef = useRef<HTMLOListElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [drag, setDrag] = useState<{ from: number; to: number; x: number; y: number } | null>(null);
  const dragged = useRef(false);
  // keys that follow a step when it's dragged, so the slide animates the right circle; new keys when steps are added / removed
  const [stepKeys, setStepKeys] = useState<number[]>([]);
  let keys = stepKeys;
  if (keys.length !== rot.steps.length) { keys = rot.steps.map(() => nextStepKey++); setStepKeys(keys); }
  const order = drag ? moved(rot.steps.length, drag.from, drag.to) : rot.steps.map((_, i) => i);

  const startDrag = (e: ReactPointerEvent, from: number) => {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let to = from, started = false;
    // slot centres (relative to the strip), measured at rest; slots keep their places while circles slide between them
    let slots: { x: number; y: number }[] = [];
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      const box = olRef.current!.getBoundingClientRect();
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        started = dragged.current = true;
        onHover(null);
        slots = rot.steps.map((_, k) => {
          const r = buttons.current.get(k)!.getBoundingClientRect();
          return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
        });
      }
      const px = ev.clientX - box.left, py = ev.clientY - box.top;
      // nearest slot; rows count 3× so a wrapped strip prefers the row the pointer is on
      let dist = Infinity;
      slots.forEach((c, k) => { const d = (c.x - px) ** 2 + 9 * (c.y - py) ** 2; if (d < dist) { dist = d; to = k; } });
      setDrag({ from, to, x: ev.clientX, y: ev.clientY });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (started && to !== from) {
        setStepKeys(moved(rot.steps.length, from, to).map((k) => keys[k]));
        onMove(from, to);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const view = (i: number) => {
    const s = rot.steps[i];
    const moves = result.moves.filter((m) => m.step === i);
    const press = moves.find((m) => m.via === 'press');
    const label = press?.move.label ?? s.button;
    return { s, moves, label, icon: press ? moveIcon(s.char, press.move, builds[s.char]) : '', warn: moves.some((m) => m.warn.length) };
  };
  const ghost = drag && view(drag.from);
  return (
    <div>
      <ol ref={olRef} className={`relative flex select-none flex-wrap items-center gap-y-3 ${drag ? 'cursor-grabbing' : ''}`}>
        {order.map((i, pos) => {
          const { s, label, icon, warn } = view(i);
          // switch markers belong to the slot, not the circle: they stay put while circles slide past
          const swap = result.swaps[pos];
          const lifted = drag?.from === i;
          const on = !drag && (selected === i || hover === i);
          return (
            <motion.li key={keys[i]} layout="position" transition={SLIDE} className="flex items-center">
              {pos > 0 && (swap
                ? <span className="mx-1.5 flex items-center gap-1 text-[10px] text-muted" title={swap === 'intro' ? 'Switch with full Concerto: Outro → Intro' : 'Switch without Outro / Intro (Concerto not full)'}>
                    <span className="h-px w-3 bg-white/20" />
                    {swap === 'intro' ? <img src={skillIcon(rot.steps[pos].char, 'Intro')} alt="Intro" className="h-4 w-4 opacity-80" /> : <span>⇄</span>}
                    <span className="h-px w-3 bg-white/20" />
                  </span>
                : <span className="mx-0.5 text-white/20">›</span>)}
              <button ref={(el) => { if (el) buttons.current.set(i, el); else buttons.current.delete(i); }}
                onPointerDown={(e) => startDrag(e, i)}
                onClick={() => { if (dragged.current) { dragged.current = false; return; } onSelect(i); }}
                onContextMenu={(e) => { e.preventDefault(); onRemove(i); }} onMouseEnter={() => !drag && onHover(i)} onMouseLeave={() => !drag && onHover(null)} aria-label={label} title={drag ? undefined : `${label}\n${ui.removeHint}`}
                className={`relative grid h-11 w-11 touch-none place-items-center rounded-full border-2 bg-night-900 transition ${on ? 'scale-110' : ''} ${lifted ? 'border-dashed opacity-30' : 'cursor-grab'}`}
                style={{ borderColor: on || lifted ? color(s.char) : `color-mix(in oklab, ${color(s.char)} 45%, transparent)`, boxShadow: on ? `0 0 14px color-mix(in oklab, ${color(s.char)} 55%, transparent)` : undefined }}>
                {icon ? <img src={icon} alt="" draggable={false} className="h-7 w-7 object-contain" /> : <span className="font-display text-sm">{label[0]}</span>}
                {warn && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-fusion" />}
              </button>
            </motion.li>
          );
        })}
      </ol>
      {/* the step being dragged, under the pointer */}
      {drag && ghost && (
        <motion.div initial={{ scale: 1 }} animate={{ scale: 1.18 }} transition={{ type: 'spring', stiffness: 900, damping: 30 }}
          className="pointer-events-none fixed z-50 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-night-900"
          style={{ left: drag.x, top: drag.y, borderColor: color(ghost.s.char), boxShadow: `0 10px 28px rgba(0,0,0,.55), 0 0 18px color-mix(in oklab, ${color(ghost.s.char)} 60%, transparent)` }}>
          {ghost.icon ? <img src={ghost.icon} alt="" className="h-7 w-7 object-contain" /> : <span className="font-display text-sm">{ghost.label[0]}</span>}
        </motion.div>
      )}
      {/* the name of the hovered move, typed like the "Every move" list */}
      <div className="mt-2 h-5 text-sm">
        {hover !== null && rot.steps[hover] && (() => {
          const ms = result.moves.filter((m) => m.step === hover);
          const press = ms.find((m) => m.via === 'press');
          return (
            <span>
              <span className="text-muted">#{hover + 1} · {char(rot.steps[hover].char).name} · </span>{press?.move.label}
              {press && <span className="text-muted"> · {fmt(press.damage)}</span>}
              {ms.flatMap((m) => m.warn).map((w) => <span key={w} className="ml-2 text-fusion">⚠ {w}</span>)}
            </span>
          );
        })()}
      </div>
    </div>
  );
}

function StepDetail({ i, step, moves, freeze, swap, onPatch, onRemove, onShift, onClose }: {
  i: number; step: RotationStep; moves: SimMove[]; freeze: boolean; swap?: 'intro' | 'quick';
  onPatch: (p: Partial<RotationStep>) => void; onRemove: () => void; onShift: (d: -1 | 1) => void; onClose: () => void;
}) {
  const color = useContext(ColorCtx);
  const press = moves.find((m) => m.via === 'press');
  const deflt = press ? actionTime(char(press.char).name, press.move, freeze) : undefined;
  const warns = moves.flatMap((m) => m.warn);
  return (
    <div className="glass mt-2 rounded-2xl p-4" style={{ '--accent': color(step.char) } as CSSProperties}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display tracking-wide">#{i + 1} · {char(step.char).name} · {press?.move.label}</span>
        <span className="text-sm text-muted">at {secs(press?.t ?? 0)}</span>
        <div className="ml-auto flex gap-2 text-xs">
          <button onClick={() => onShift(-1)} className="rounded-full border border-white/15 px-2.5 py-1 hover:border-[var(--accent)]" aria-label="Move earlier">←</button>
          <button onClick={() => onShift(1)} className="rounded-full border border-white/15 px-2.5 py-1 hover:border-[var(--accent)]" aria-label="Move later">→</button>
          <button onClick={onRemove} className="rounded-full border border-white/15 px-3 py-1 hover:text-fusion">Remove</button>
          <button onClick={onClose} className="rounded-full border border-white/15 px-3 py-1 text-muted hover:text-ink">Done</button>
        </div>
      </div>
      {warns.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-fusion">{warns.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          {moves.map((m, k) => (
            <div key={k}>
              <div className="flex justify-between gap-3">
                <span className={m.via === 'swap' ? 'text-muted' : ''}>{m.via === 'swap' ? `${char(m.char).name} · ${m.move.label}` : m.move.label}</span>
                <span className="tabular">{fmt(m.damage)}</span>
              </div>
              {m.hits.length > 1 && m.hits.map((h, j) => (
                <div key={j} className="flex justify-between gap-3 pl-3 text-xs text-muted">
                  <span>{h.row.row.replace(/ DMG$/, '')}{h.by !== undefined && h.by !== m.char && <> ({char(h.by).name})</>}</span><span className="tabular">{fmt(h.value)}</span>
                </div>
              ))}
              {m.move.rows.length === 0 && m.move.kind !== 'Outro' && <div className="pl-3 text-xs text-muted">No damage of its own.</div>}
              {m.chafe && (
                <div className="pl-3 text-xs text-muted">
                  Glacio Chafe +{m.chafe.inflicted} → <span className="tabular text-ink">{m.chafe.stacks}/{m.chafe.limit}</span>
                  {m.chafe.frostbind && <span className="text-[#9be7ff]"> · Frostbind (−10)</span>}
                  {m.chafe.snowRust > 0 && <> · Snow Rust {m.chafe.snowRust}</>}
                  {m.chafe.bites > 0 && <> · Glacio Bite ×{m.chafe.bites} (estimate)</>}
                </div>
              )}
              <div className="pl-3 text-xs text-muted">Concerto after: <span className="tabular text-ink">{Math.floor(m.concerto)}</span>{m.maxEnergy > 0 && <> · Energy after: <span className="tabular text-ink">{Math.floor(m.energy)}/{m.maxEnergy}</span></>}</div>
            </div>
          ))}
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted">Timed buffs up</div>
            {press && press.buffs.length
              ? <ul className="flex flex-wrap gap-1.5">{press.buffs.map((b) => <li key={b} className="rounded-full border border-[var(--accent)]/40 px-2 py-0.5 text-xs">{b}</li>)}</ul>
              : <p className="text-xs text-muted">None</p>}
          </div>
          {press && press.always.length > 0 && (
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted" title="Always on, or on by their toggle in each Resonator's Buffs tab">Other buffs counted</div>
              <ul className="flex flex-wrap gap-1.5">{press.always.map((b) => <li key={b} className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-muted">{b}</li>)}</ul>
            </div>
          )}
          <label className="flex items-center gap-2">
            <span className="text-muted">{ui.time}</span>
            <input type="number" min={0} step={0.1} value={step.seconds ?? ''} placeholder={(deflt?.seconds ?? 0).toFixed(1)}
              onChange={(e) => onPatch({ seconds: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
              className="w-20 rounded-lg border border-white/15 bg-night-900 px-2 py-1 tabular" />
            <span className="text-xs text-muted">s {step.seconds === undefined && deflt ? ui.timeSource[deflt.source] : ''}</span>
          </label>
          <label className="flex items-center gap-2" title={ui.swapCancelHint}>
            <Toggle on={!!step.cancel} onChange={(v) => onPatch({ cancel: v || undefined })} label={ui.swapCancel} />
            <span className="text-muted">{ui.swapCancel}</span>
          </label>
          {press?.move.choice && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">{press.move.choice.label}</span>
              {press.move.choice.options.map((o, k) => (
                <button key={o} onClick={() => onPatch({ option: k })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${press.move.choice!.value === k ? 'border-[var(--accent)] text-ink' : 'border-white/15 text-muted hover:text-ink'}`}>{o}</button>
              ))}
            </div>
          )}
          {swap && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">Switch</span>
              {(['auto', 'intro', 'quick'] as const).map((v) => (
                <button key={v} onClick={() => onPatch({ swap: v === 'auto' ? undefined : v })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${(step.swap ?? 'auto') === v ? 'border-[var(--accent)] text-ink' : 'border-white/15 text-muted hover:text-ink'}`}>
                  {v === 'auto' ? 'By Concerto' : v === 'intro' ? 'Outro + Intro' : 'Plain switch'}
                </button>
              ))}
              <span className="text-xs text-muted">({swap === 'intro' ? 'Outro + Intro' : 'plain switch'})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Timeline({ result, members, hover, onHover, onSelect, onRemove }: { result: SimResult; members: number[]; hover: number | null; onHover: (i: number | null) => void; onSelect: (i: number) => void; onRemove: (i: number) => void }) {
  const color = useContext(ColorCtx);
  const T = Math.max(result.time, 1);
  const pct = (t: number) => `${(t / T) * 100}%`;
  const ticks = Array.from({ length: Math.floor(T / 5) + 1 }, (_, k) => k * 5);
  return (
    <section>
      <SectionTitle>Timeline</SectionTitle>
      <div className="glass rounded-2xl p-4">
        <div className="relative ml-56 h-4 text-[10px] text-muted">
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2 tabular" style={{ left: pct(t) }}>{t}s</span>)}
        </div>
        <div className="flex items-center">
          <span className="w-56 shrink-0 pr-2 text-xs text-muted">Moves</span>
          <div className="relative h-7 flex-1 rounded bg-white/5">
            {result.moves.map((m, k) => (
              <button key={k} onMouseEnter={() => onHover(m.step)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(m.step)} onContextMenu={(e) => { e.preventDefault(); onRemove(m.step); }}
                aria-label={`${char(m.char).name} · ${m.move.label}`} title={`${char(m.char).name} · ${m.move.label} · ${fmt(m.damage)} · ${secs(m.t)}
${ui.removeHint}`}
                className="absolute top-0 h-full border-r border-night-950/80 transition-opacity"
                style={{ left: pct(m.t), width: `max(2px, ${pct(Math.max(m.seconds, 0.05))})`, background: color(m.char), opacity: hover === null || hover === m.step ? (m.via === 'swap' ? 0.55 : 0.9) : 0.3 }} />
            ))}
          </div>
        </div>
        {/* Concerto per Resonator */}
        {members.map((c) => {
          const own = result.moves.filter((m) => m.char === c);
          return (
            <div key={c} className="mt-1.5 flex items-center">
              <span className="w-56 shrink-0 truncate pr-2 text-xs text-muted"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: color(c) }} />{char(c).name} Concerto</span>
              <div className="relative h-4 flex-1 rounded bg-white/5">
                {own.map((m, k) => {
                  const end = own[k + 1]?.t ?? T;
                  return <span key={k} className="absolute bottom-0" style={{ left: pct(m.t), width: pct(Math.max(0, end - m.t)), height: `${m.concerto}%`, background: m.concerto >= 100 ? '#f2d27a' : `color-mix(in oklab, ${color(c)} 45%, transparent)` }} />;
                })}
              </div>
            </div>
          );
        })}
        {result.moves.some((m) => m.chafe) && (() => {
          const ch = result.moves.filter((m) => m.chafe);
          return (
            <div className="mt-1.5 flex items-center">
              <span className="w-56 shrink-0 truncate pr-2 text-xs text-muted" title="Glacio Chafe stacks on the target (Frostbind marked)">Glacio Chafe on target</span>
              <div className="relative h-4 flex-1 rounded bg-white/5">
                {ch.map((m, k) => {
                  const end = ch[k + 1]?.t ?? T;
                  return <span key={k} className="absolute bottom-0" title={`${m.chafe!.stacks}/${m.chafe!.limit}${m.chafe!.frostbind ? ' · Frostbind' : ''}`}
                    style={{ left: pct(m.t), width: pct(Math.max(0, end - m.t)), height: `${(m.chafe!.stacks / 13) * 100}%`, background: m.chafe!.frostbind ? '#9be7ff' : 'color-mix(in oklab, #9be7ff 45%, transparent)' }} />;
                })}
              </div>
            </div>
          );
        })()}
        {result.lanes.length === 0 && <p className="mt-3 text-xs text-muted">No timed buffs went up in this rotation.</p>}
        {result.lanes.map((l) => (
          <div key={l.key} className="mt-1.5 flex items-center">
            <span className="w-56 shrink-0 truncate pr-2 text-xs" title={`${char(l.owner).name} · ${l.label} · ${l.rule.seconds}s after ${l.rule.on.join(' or ')}${l.rule.incomingOnly ? ', for the Resonator switched in, until they leave' : ''}`}>
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: color(l.owner) }} />{l.label}
            </span>
            <div className="relative h-3 flex-1 rounded bg-white/5">
              {l.intervals.map(([a, b], k) => (
                <span key={k} className="absolute top-0 h-full rounded" style={{ left: pct(a), width: pct(b - a), background: `color-mix(in oklab, ${color(l.owner)} 55%, transparent)` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
