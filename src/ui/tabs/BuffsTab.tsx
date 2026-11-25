import data from '../../data/current';
import { collectEffects, conditionKey, conditionMaxes, NOT_MODELLED, resolveEffects } from '../../engine';
import type { Effect } from '../../engine/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { SectionTitle, Stepper, Toggle } from '../components/kit';
import { raiseText, valueLines } from '../effectText';
import { ui } from '../../strings/en';

type Section = Effect['group'] | 'account';
const TITLE: Record<Section, string> = {
  self: 'Own kit', sequence: 'Sequences', weapon: 'Weapon', echo: 'Echoes & sets', team: 'Team', enemy: 'Enemy', account: 'Account',
};
const ORDER: Section[] = ['self', 'sequence', 'weapon', 'echo', 'team', 'enemy', 'account'];
const sectionOf = (e: Effect): Section => (e.id.startsWith('acct.') ? 'account' : e.group);

interface Row { key: string; first: Effect; members: { effect: Effect; level: number }[] }

export function BuffsTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const c = data.characters.find((x) => x.id === characterId)!;

  const effects = collectEffects(build, data);
  const maxes = conditionMaxes(effects, build.conditions);
  const levels = new Map(resolveEffects(effects, build.conditions).map((a) => [a.effect.id, a.level]));
  const stackLabels = new Map(effects.filter((e) => e.condition?.kind === 'stacks').map((e) => [conditionKey(e), e.condition!.label.replace(/ stacks$/, '')]));

  // one row per condition: effects sharing a key share one control and list all their values
  const rows = new Map<string, Row>();
  for (const e of effects) {
    if (!e.condition) continue;
    const key = conditionKey(e);
    const member = { effect: e, level: levels.get(e.id) ?? 0 };
    const row = rows.get(key);
    if (row) row.members.push(member);
    else rows.set(key, { key, first: e, members: [member] });
  }
  const set = (key: string, v: boolean | number) => update(characterId, (b) => ({ ...b, conditions: { ...b.conditions, [key]: v } }));

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted">{ui.buffsHint}</p>
      {ORDER.map((section) => {
        const list = [...rows.values()].filter((r) => sectionOf(r.first) === section);
        if (!list.length) return null;
        return (
          <div key={section}>
            <SectionTitle>{TITLE[section]}</SectionTitle>
            <ul className="space-y-2">
              {list.map(({ key, first, members }) => {
                const cond = first.condition!;
                const isStacks = cond.kind === 'stacks';
                const limit = maxes[key] ?? (isStacks ? cond.max : 1);
                const current = members[0].level;
                const on = isStacks ? current > 0 : current > 0;
                return (
                  <li key={key} className="rounded-lg bg-black/25 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{cond.label}</div>
                        <div className="text-xs text-muted">{first.source}</div>
                      </div>
                      {cond.kind === 'toggle'
                        ? <Toggle on={on} onChange={(v) => set(key, v)} label={cond.label} />
                        : <Stepper value={current} max={limit} onChange={(n) => set(key, n)} label={ui.stacks} />}
                    </div>
                    <ul className={`mt-2 space-y-1 border-l pl-3 text-xs ${on ? 'border-[var(--accent)]/60' : 'border-white/10 opacity-60'}`}>
                      {members.map(({ effect, level }) => {
                        const raise = effect.raisesMax ? raiseText(effect, stackLabels.get(effect.raisesMax.key) ?? 'Stack') : null;
                        const lines = valueLines(effect, isStacks ? level : 1);
                        return (
                          <li key={effect.id}>
                            <span className="text-ink/80">{effect.text}</span>
                            {lines.map((l, i) => (
                              <div key={i} className="tabular text-gold-soft">
                                {l.text}{l.scope && <span className="text-muted"> · {l.scope}</span>}
                              </div>
                            ))}
                            {raise && <div className="text-gold-soft">{raise}</div>}
                          </li>
                        );
                      })}
                      {!on && cond.kind === 'toggle' && <li className="text-muted">Off — values shown are what it adds when on.</li>}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {NOT_MODELLED[c.name] && (
        <div>
          <SectionTitle>{ui.notModelled}</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {NOT_MODELLED[c.name].map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
