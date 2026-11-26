import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import data from '../../data/current';
import type { SkillKind, StatKey } from '../../data/types';
import { computeDamage, rollValues } from '../../engine';
import { MECHANICS, teamMechanics, type Mechanic } from '../../engine/mechanics';
import { applyCandidate, type Candidate, type OptimizeOptions, type OptimizeResult, type OptimizeTarget } from '../../engine/optimizer';
import { useBuild, useBuilds } from '../../state/buildStore';
import { useSettings } from '../../state/settings';
import { SKILL_LABEL, STAT_LABEL } from '../../strings/en';
import { Segmented, SectionTitle } from '../components/kit';
import { echoImg, img } from '../theme';

const fmt = (n: number) => Math.round(n).toLocaleString();
const shortStat = (k: StatKey) => STAT_LABEL[k].replace(/ DMG Bonus$/, ' DMG').replace(/%$/, '');
const RANKS = ['R1', 'R2', 'R3', 'R4', 'R5'];

/** Search for the best main stats, set, main echo and weapon for one damage row. */
export function OptimizeTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const { focus, setFocus } = useSettings();

  // damage rows to aim at, biggest first (by the focused number)
  const rows = useMemo(() => {
    const sums = new Map<string, { target: OptimizeTarget; value: number }>();
    for (const h of computeDamage(build, data, { noBreakdown: true }).hits) {
      const key = `${h.skill.kind}|${h.row.label}`;
      const t = sums.get(key) ?? { target: { skillKind: h.skill.kind, row: h.row.label }, value: 0 };
      t.value += (focus === 'crit' ? h.crit : h.avg) * h.count;
      sums.set(key, t);
    }
    return [...sums.values()].sort((a, b) => b.value - a.value);
  }, [build, focus]);

  const [targetKey, setTargetKey] = useState<string>('');
  const target = rows.find((r) => `${r.target.skillKind}|${r.target.row}` === targetKey)?.target ?? rows[0]?.target;
  const [weapons, setWeapons] = useState<OptimizeOptions['weapons']>('all');
  const [otherRank, setOtherRank] = useState(1);
  const [sets, setSets] = useState<OptimizeOptions['sets']>('all');

  // what the team can trigger: a guess from the kits, re-made when the team changes; the player can correct it
  const teamKey = [build.characterId, ...(build.team ?? []).map((t) => t?.characterId ?? 0)].join();
  const [edited, setEdited] = useState<{ team: string; can: Mechanic[] } | null>(null);
  const can = edited?.team === teamKey ? edited.can : teamMechanics(build, data);
  const setCan = (next: Mechanic[]) => setEdited({ team: teamKey, can: next });

  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<(OptimizeResult & { target: OptimizeTarget; metric: 'crit' | 'avg' }) | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);

  const run = () => {
    if (!target) return;
    worker.current?.terminate();
    const w = new Worker(new URL('../../engine/optimizer.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    const opts: OptimizeOptions = { target, metric: focus, weapons, otherRank, sets, can };
    setProgress(0); setResult(null); setApplied(null);
    w.onmessage = (e) => {
      if (e.data.type === 'progress') setProgress(e.data.done / e.data.total);
      else { setResult({ ...e.data.result, target, metric: focus }); setProgress(null); w.terminate(); }
    };
    w.postMessage({ build, opts });
  };

  const best = result?.best[0];
  const subTargets = useMemo(() => {
    if (!best || !result) return [];
    return rollValues(applyCandidate(build, data, best), data, result.target.row).filter((r) => r.gainPct > 0).slice(0, 6);
  }, [best, result]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted">
        Finds the best main stats, sonata set, main echo and weapon for one hit. Your substats stay on their slots; team, buffs and enemy stay as you set them.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted">Aim for</span>
          <select value={target ? `${target.skillKind}|${target.row}` : ''} onChange={(e) => setTargetKey(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-night-900 px-2 py-2">
            {rows.map((r) => (
              <option key={`${r.target.skillKind}|${r.target.row}`} value={`${r.target.skillKind}|${r.target.row}`}>
                {r.target.row.replace(/ DMG$/, '')} · {SKILL_LABEL[r.target.skillKind as SkillKind]} · {fmt(r.value)}
              </option>
            ))}
          </select>
        </label>
        <Field label="Number">
          <Segmented options={['Crit hit', 'Average']} value={focus === 'crit' ? 0 : 1} onChange={(i) => setFocus(i ? 'avg' : 'crit')} label="optimize-metric" />
        </Field>
        <Field label="Weapons">
          <Segmented options={['4★ and 5★', '5★ only', 'Keep mine']} value={['all', 'five', 'mine'].indexOf(weapons)} onChange={(i) => setWeapons((['all', 'five', 'mine'] as const)[i])} label="optimize-weapons" />
        </Field>
        <Field label="Rank for other weapons">
          <Segmented options={RANKS} value={otherRank - 1} onChange={(i) => setOtherRank(i + 1)} label="optimize-rank" />
        </Field>
        <Field label="Sets">
          <Segmented options={['Any', 'Keep mine']} value={sets === 'all' ? 0 : 1} onChange={(i) => setSets(i ? 'mine' : 'all')} label="optimize-sets" />
        </Field>
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-muted">Your team can trigger</div>
        <p className="mb-2 text-xs text-muted">Guessed from the kits. Set and weapon buffs that need something not ticked here count as off.</p>
        <div className="flex flex-wrap gap-1.5">
          {MECHANICS.map((m) => {
            const on = can.includes(m);
            return (
              <button key={m} onClick={() => setCan(on ? can.filter((x) => x !== m) : [...can, m])} aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] text-ink' : 'border-white/10 text-muted hover:text-ink'}`}>
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={run} disabled={progress !== null || !target}
          className="rounded-full border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_25%,transparent)] px-6 py-2 font-display tracking-wider transition hover:bg-[color-mix(in_oklab,var(--accent)_40%,transparent)] disabled:opacity-50">
          {progress !== null ? 'Optimizing…' : result ? 'Run again' : 'Optimize'}
        </button>
        {progress !== null && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
            <motion.div className="h-full bg-[var(--accent)]" animate={{ width: `${progress * 100}%` }} transition={{ ease: 'linear', duration: 0.1 }} />
          </div>
        )}
        {result && progress === null && <span className="text-xs text-muted">{result.evaluated.toLocaleString()} builds tried</span>}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <SectionTitle right={<span className="text-xs text-muted">now {fmt(result.current)}</span>}>
                Best builds · {result.target.row.replace(/ DMG$/, '')}
              </SectionTitle>
              <ol className="space-y-2">
                {result.best.slice(0, 8).map((c, i) => (
                  <ResultCard key={i} rank={i + 1} c={c} current={result.current} applied={applied === i}
                    onApply={() => { update(characterId, (b) => applyCandidate(b, data, c)); setApplied(i); }} />
                ))}
              </ol>
            </div>

            {subTargets.length > 0 && (
              <div>
                <SectionTitle>Substats to chase (for #1)</SectionTitle>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {subTargets.map((r) => (
                    <li key={r.stat} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
                      <span>{STAT_LABEL[r.stat]}</span>
                      <span className="tabular text-gold-soft">+{r.gainPct.toFixed(2)}% per roll{r.capped && <span className="text-muted"> · capped</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}

function ResultCard({ rank, c, current, applied, onApply }: { rank: number; c: Candidate; current: number; applied: boolean; onApply: () => void }) {
  const weapon = data.weapons.find((w) => w.id === c.weapon.id)!;
  const echo = data.echoes.find((e) => e.id === c.mainEchoId)!;
  const set = (id: number) => data.sonatas.find((s) => s.id === id)!;
  const delta = current > 0 ? (c.value / current - 1) * 100 : 0;
  const mono = c.sets[0] === c.sets[1];
  return (
    <li className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-lg text-muted">#{rank}</span>
        <span className="tabular font-display text-xl text-gold">{fmt(c.value)}</span>
        <span className={`tabular text-sm ${delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>
        <div className="flex-1" />
        <button onClick={onApply} disabled={applied}
          className="rounded-full border border-white/15 px-4 py-1 text-xs hover:border-[var(--accent)] disabled:border-[var(--accent)] disabled:text-[var(--accent)]">
          {applied ? 'Applied — undo with ↶' : 'Apply'}
        </button>
      </div>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <Thing icon={img(`weapon:${weapon.id}`)} title={`${weapon.name} R${c.weapon.rank}`} sub={`${weapon.rarity}★ ${weapon.type}`} />
        <Thing icon={echoImg(echo.id)} title={echo.name.replace(/^Phantom:\s*/, '')}
          sub={c.alsoEchoes?.length ? `Main echo · or ${c.alsoEchoes.map((id) => data.echoes.find((e) => e.id === id)!.name).join(' / ')}` : 'Main echo'} />
        <Thing icon={img(`sonata:${c.sets[0]}`)} title={mono ? `${set(c.sets[0]).name} 5pc` : `${set(c.sets[0]).name} 3pc`}
          sub={mono ? '' : `+ ${[c.sets[1], ...(c.alsoSets ?? [])].map((s) => set(s).name).join(' / ')} 2pc`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {c.mains.map((m, i) => (
          <span key={i} className="rounded-md bg-white/5 px-2 py-0.5"><span className="text-muted">{[4, 3, 3, 1, 1][i]} · </span>{shortStat(m)}</span>
        ))}
      </div>
      {c.relies && c.relies.length > 0 && (
        <div className="mt-2 text-xs text-muted">Counts on: {c.relies.join(' · ')}</div>
      )}
    </li>
  );
}

function Thing({ icon, title, sub }: { icon?: string; title: string; sub: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {icon ? <img src={icon} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-md bg-white/5" />}
      <div className="min-w-0">
        <div className="truncate">{title}</div>
        {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}
