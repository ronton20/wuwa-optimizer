import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import data from '../../data/current';
import type { Character, Skill, SkillKind, StatNode } from '../../data/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { LevelSlider, RichText, Toggle } from '../components/kit';
import { img } from '../theme';
import { SKILL_LABEL, STAT_LABEL, ui } from '../../strings/en';

/**
 * In-game Forte layout: five columns (Normal, Skill, Forte, Liberation, Intro).
 * Each non-Forte column has its skill at the bottom and two stat nodes above it (tree indices 9-12 below 13-16);
 * the Forte column has the two inherent skills above it (tree indices 4, 5).
 */
const COLUMNS: { kind: SkillKind; skill: number; above: [number, number] | 'inherents' }[] = [
  { kind: 'Normal', skill: 1, above: [9, 13] },
  { kind: 'Skill', skill: 2, above: [10, 14] },
  { kind: 'Forte', skill: 7, above: 'inherents' },
  { kind: 'Liberation', skill: 3, above: [11, 15] },
  { kind: 'Intro', skill: 6, above: [12, 16] },
];
const LEVELED: SkillKind[] = ['Normal', 'Skill', 'Forte', 'Liberation', 'Intro'];

type Sel = { type: 'skill'; skill: Skill } | { type: 'node'; node: StatNode };

const skillAt = (c: Character, index: number) => c.skills.find((s) => s.treeIndex === index);
const nodeAt = (c: Character, index: number) => c.statNodes.find((n) => n.index === index);
const nodeIconKey = (n: StatNode) => `node:${n.icon.split('/').pop()!.split('.')[0]}` as const;
const statText = (n: StatNode) => n.stats.map((s) => `${STAT_LABEL[s.stat]} +${s.value}${['atk', 'hp', 'def'].includes(s.stat) ? '' : '%'}`).join(', ');

export function SkillsTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const c = data.characters.find((x) => x.id === characterId)!;
  const [sel, setSel] = useState<Sel | null>(() => {
    const s = skillAt(c, 3);
    return s ? { type: 'skill', skill: s } : null;
  });
  const level = (k: SkillKind) => build.skillLevels[k] ?? 10;
  const setLevel = (kind: SkillKind, lv: number) => update(characterId, (b) => ({ ...b, skillLevels: { ...b.skillLevels, [kind]: Math.max(1, Math.min(10, lv)) } }));
  const isSel = (x: Skill | StatNode | undefined) => !!x && !!sel && (sel.type === 'skill' ? sel.skill === x : sel.node === x);
  const extras = [skillAt(c, 8), skillAt(c, 17)].filter((s): s is Skill => !!s);

  const off = new Set(build.nodesOff ?? []);
  const isOn = (index: number) => !off.has(index);
  const nodeOn = (n: StatNode) => isOn(n.index);
  /** In game the upper node needs the lower one: turning a lower node off turns its upper node off, and vice versa.
   *  Pairs: stat nodes 9→13 … 12→16, inherents 4→5. */
  const setOn = (index: number, on: boolean) => update(characterId, (b) => {
    const next = new Set(b.nodesOff ?? []);
    const [lower, upper] = index === 4 || index === 5 ? [4, 5] : index <= 12 ? [index, index + 4] : [index - 4, index];
    if (on) { next.delete(index); if (index === upper) next.delete(lower); }
    else { next.add(index); if (index === lower) next.add(upper); }
    return { ...b, nodesOff: [...next].sort((a, x) => a - x) };
  });
  const setNode = (n: StatNode, on: boolean) => setOn(n.index, on);
  const allNodes = c.statNodes.every(nodeOn) && isOn(4) && isOn(5);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{ui.skillsHint}</p>
        <div className="flex gap-2">
          <button onClick={() => update(characterId, (b) => ({ ...b, nodesOff: allNodes ? [4, 5, ...c.statNodes.map((n) => n.index)] : [] }))}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink">{allNodes ? ui.nodesAllOff : ui.nodesAllOn}</button>
          <button onClick={() => update(characterId, (b) => ({ ...b, skillLevels: {} }))} className="rounded-full border border-white/15 px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink">{ui.setAll10}</button>
        </div>
      </div>

      {/* the tree: every column has the same rows, so levels and names line up at the bottom */}
      <div className="relative rounded-2xl border border-white/10 bg-black/30 px-1 py-5 sm:px-6">
        <div className="grid grid-cols-5 gap-1 sm:gap-4">
          {COLUMNS.map((col) => {
            const skill = skillAt(c, col.skill);
            const isForte = col.kind === 'Forte';
            const above = col.above === 'inherents' ? [skillAt(c, 5), skillAt(c, 4)] : [nodeAt(c, col.above[1]), nodeAt(c, col.above[0])];
            const lv = level(col.kind);
            return (
              <div key={col.kind} className="relative grid grid-rows-[auto_88px_auto_auto] justify-items-center sm:grid-rows-[auto_112px_auto_auto]">
                <span aria-hidden className="absolute left-1/2 top-6 h-[calc(100%-7rem)] w-px -translate-x-1/2 bg-gradient-to-b from-white/5 via-[var(--accent)]/40 to-[var(--accent)]/70" />
                <div className="z-10 flex h-[100px] flex-col items-center justify-end gap-3 sm:h-[112px]">
                  {above.map((x, i) => x && (
                    'stats' in x
                      ? <NodeButton key={i} label={statText(x)} icon={img(nodeIconKey(x))} on={nodeOn(x)} selected={isSel(x)}
                          onClick={() => { setSel({ type: 'node', node: x }); setNode(x, !nodeOn(x)); }} />
                      : <NodeButton key={i} label={x.name} icon={img(`skill:${x.id}`)} on={isOn(x.treeIndex!)} selected={isSel(x)} inherent
                          onClick={() => { setSel({ type: 'skill', skill: x }); setOn(x.treeIndex!, !isOn(x.treeIndex!)); }} />
                  ))}
                </div>
                {skill && (
                  <motion.button onClick={() => setSel({ type: 'skill', skill })} aria-pressed={isSel(skill)} title={skill.name}
                    whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="group z-10 flex items-center justify-center self-center">
                    <span className={`relative flex rotate-45 items-center justify-center border-2 transition-[background-color,border-color,box-shadow] duration-300 ${isForte ? 'h-12 w-12 sm:h-[4.5rem] sm:w-[4.5rem]' : 'h-10 w-10 sm:h-14 sm:w-14'} ${isSel(skill)
                      ? 'border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_22px_var(--accent)]'
                      : 'border-white bg-white shadow-[0_0_0_transparent] group-hover:shadow-[0_0_16px_rgba(255,255,255,0.55)]'}`}>
                      {img(`skill:${skill.id}`)
                        ? <img src={img(`skill:${skill.id}`)} alt="" className={`-rotate-45 object-contain transition duration-300 ${isForte ? 'h-9 w-9 sm:h-12 sm:w-12' : 'h-7 w-7 sm:h-10 sm:w-10'} ${isSel(skill) ? '' : 'brightness-0 opacity-75'}`} />
                        : <span className={`-rotate-45 font-display text-lg ${isSel(skill) ? 'text-white' : 'text-night-900'}`}>{SKILL_LABEL[col.kind][0]}</span>}
                    </span>
                  </motion.button>
                )}
                <div className="z-10 flex items-center gap-0.5 sm:gap-1">
                  <StepBtn label={`${ui.levelDown}: ${SKILL_LABEL[col.kind]}`} disabled={lv <= 1} onClick={() => setLevel(col.kind, lv - 1)}>−</StepBtn>
                  <span className="rounded-full bg-black/60 px-1.5 py-0.5 font-display text-[11px] tabular sm:px-2 sm:text-xs">Lv.<span className="text-gold">{lv}</span></span>
                  <StepBtn label={`${ui.levelUp}: ${SKILL_LABEL[col.kind]}`} disabled={lv >= 10} onClick={() => setLevel(col.kind, lv + 1)}>+</StepBtn>
                </div>
                <span className="mt-1.5 text-center text-[10px] leading-tight text-muted sm:text-xs">{SKILL_LABEL[col.kind]}</span>
              </div>
            );
          })}
        </div>
        {extras.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2 border-t border-white/10 pt-4">
            {extras.map((s) => (
              <button key={s.id} onClick={() => setSel({ type: 'skill', skill: s })} aria-pressed={isSel(s)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${isSel(s) ? 'border-[var(--accent)] text-ink' : 'border-white/15 text-muted hover:border-white/40 hover:text-ink'}`}>
                {img(`skill:${s.id}`) && <img src={img(`skill:${s.id}`)} alt="" className="h-5 w-5" />}
                <span>{SKILL_LABEL[s.kind]} · {s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* details of the selected node */}
      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.type === 'skill' ? `s${sel.skill.id}` : `n${sel.node.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="rounded-xl border border-white/10 bg-black/25 p-4">
            {sel.type === 'node' ? (
              <div className="flex items-center gap-3">
                {img(nodeIconKey(sel.node)) && <img src={img(nodeIconKey(sel.node))} alt="" className={`h-10 w-10 ${nodeOn(sel.node) ? '' : 'opacity-35 grayscale'}`} />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wider text-muted">{ui.statNode}</div>
                  <div className={`font-display text-lg ${nodeOn(sel.node) ? 'text-gold-soft' : 'text-muted line-through'}`}>{statText(sel.node)}</div>
                  <div className="text-xs text-muted">{nodeOn(sel.node) ? ui.statNodeOn : ui.statNodeOff}</div>
                </div>
                <Toggle on={nodeOn(sel.node)} onChange={(v) => setNode(sel.node, v)} label={statText(sel.node)} />
              </div>
            ) : (
              <SkillDetail skill={sel.skill} level={LEVELED.includes(sel.skill.kind) ? level(sel.skill.kind) : null} onLevel={(v) => setLevel(sel.skill.kind, v)}
                toggle={sel.skill.kind === 'Inherent' && sel.skill.treeIndex ? { on: isOn(sel.skill.treeIndex), set: (v) => setOn(sel.skill.treeIndex!, v) } : undefined} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepBtn({ children, label, disabled, onClick }: { children: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none text-[var(--accent)] transition hover:bg-white/10 disabled:opacity-25 sm:h-6 sm:w-6">{children}</button>
  );
}

function NodeButton({ label, icon, on, selected, onClick, inherent }: { label: string; icon: string; on: boolean; selected: boolean; onClick: () => void; inherent?: boolean }) {
  const look = selected
    ? (on ? 'border-[var(--accent)] bg-[var(--accent)] shadow-[0_0_16px_var(--accent)]' : 'border-[var(--accent)] bg-[#2a3142]')
    : (on ? 'border-white bg-white shadow-[0_0_10px_rgba(255,255,255,0.35)] hover:shadow-[0_0_16px_rgba(255,255,255,0.6)]' : 'border-white/15 bg-[#2a3142] hover:border-white/40');
  return (
    <motion.button onClick={onClick} title={`${label} (${on ? 'on' : 'off'}: click to switch)`} aria-label={label} aria-pressed={on}
      whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 420, damping: 20 }}
      className={`relative flex items-center justify-center rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-300 ${inherent ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-9 w-9 sm:h-10 sm:w-10'} ${look}`}>
      {/* burst when switched on */}
      <AnimatePresence>
        {on && (
          <motion.span key="burst" aria-hidden initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 1.9, opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }} className="pointer-events-none absolute inset-0 rounded-full border-2 border-white" />
        )}
      </AnimatePresence>
      <motion.span key={String(on)} initial={{ scale: 0.55, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className="flex h-3/4 w-3/4 items-center justify-center">
        {icon
          ? <img src={icon} alt="" className={`h-full w-full object-contain transition duration-300 ${on ? (selected ? '' : 'brightness-0 opacity-80') : 'opacity-35'}`} />
          : <span className={`text-xs ${on ? (selected ? 'text-white' : 'text-night-900') : 'text-muted'}`}>◆</span>}
      </motion.span>
    </motion.button>
  );
}

function SkillDetail({ skill, level, onLevel, toggle }: { skill: Skill; level: number | null; onLevel: (v: number) => void; toggle?: { on: boolean; set: (v: boolean) => void } }) {
  const lv = level ?? 10;
  const [view, setView] = useState<'details' | 'description'>(skill.rows.length ? 'details' : 'description');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {img(`skill:${skill.id}`) && <img src={img(`skill:${skill.id}`)} alt="" className="h-11 w-11 rounded-lg bg-black/40 p-1" />}
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted">{SKILL_LABEL[skill.kind]}</div>
          <div className={`font-display text-lg ${toggle && !toggle.on ? 'text-muted line-through' : ''}`}>{skill.name}</div>
          {toggle && <div className="text-xs text-muted">{toggle.on ? ui.inherentOn : ui.inherentOff}</div>}
        </div>
        {toggle && <Toggle on={toggle.on} onChange={toggle.set} label={skill.name} />}
        {skill.rows.length > 0 && (
          <div role="tablist" aria-label={skill.name} className="flex rounded-full border border-white/15 p-0.5 text-xs">
            {(['details', 'description'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 transition ${view === v ? 'bg-[color-mix(in_oklab,var(--accent)_35%,transparent)] text-ink' : 'text-muted hover:text-ink'}`}>
                {v === 'details' ? ui.skillDetails : ui.skillDescription}
              </button>
            ))}
          </div>
        )}
      </div>
      {level != null && (
        <div className="flex items-center gap-2">
          <button onClick={() => onLevel(lv - 1)} disabled={lv <= 1} aria-label={ui.levelDown} className="h-7 w-7 rounded-full border border-white/15 hover:border-gold disabled:opacity-30">−</button>
          <div className="flex-1"><LevelSlider value={lv} onChange={onLevel} label={`${skill.name} level`} /></div>
          <button onClick={() => onLevel(lv + 1)} disabled={lv >= 10} aria-label={ui.levelUp} className="h-7 w-7 rounded-full border border-white/15 hover:border-gold disabled:opacity-30">+</button>
        </div>
      )}
      {view === 'details' ? (
        <table className="w-full text-sm">
          <tbody>
            {skill.rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className={`py-1.5 pr-3 ${r.hits ? 'text-ink' : 'text-muted'}`}>
                  {r.label}
                  {r.fromText && <span className="ml-2 text-xs text-muted" title={ui.fromTextHint}>{ui.fromText(r.seq)}</span>}
                </td>
                <td className="tabular py-1.5 text-right text-gold-soft">{r.values[lv - 1] ?? r.values.at(-1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <RichText text={skill.description} className="text-sm leading-relaxed text-ink/85" />
      )}
    </div>
  );
}
