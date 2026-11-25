import data from '../../data/current';
import { collectEffects, conditionKey, NOT_MODELLED } from '../../engine';
import type { Effect } from '../../engine/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { SectionTitle, Stepper, Toggle } from '../components/kit';
import { ui } from '../../strings/en';

type Section = Effect['group'] | 'account';
const TITLE: Record<Section, string> = {
  self: 'Own kit', sequence: 'Sequences', weapon: 'Weapon', echo: 'Echoes & sets', team: 'Team', enemy: 'Enemy', account: 'Account',
};
const ORDER: Section[] = ['self', 'sequence', 'weapon', 'echo', 'team', 'enemy', 'account'];
const sectionOf = (e: Effect): Section => (e.id.startsWith('acct.') ? 'account' : e.group);

export function BuffsTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const c = data.characters.find((x) => x.id === characterId)!;

  // one row per condition: effects sharing a key share a toggle, their texts are joined
  const rows = new Map<string, { key: string; first: Effect; texts: string[] }>();
  for (const e of collectEffects(build, data)) {
    if (!e.condition) continue;
    const key = conditionKey(e);
    const row = rows.get(key);
    if (row) row.texts.push(e.text);
    else rows.set(key, { key, first: e, texts: [e.text] });
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
              {list.map(({ key, first, texts }) => {
                const cond = first.condition!;
                const v = build.conditions[key];
                const text = [...new Set(texts)].join(' · ');
                return (
                  <li key={key} className="flex items-center gap-4 rounded-lg bg-black/25 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{cond.label}</div>
                      <div className="text-xs text-muted">{first.source} · {text}</div>
                    </div>
                    {cond.kind === 'toggle'
                      ? <Toggle on={(v ?? cond.default) as boolean} onChange={(on) => set(key, on)} label={cond.label} />
                      : <Stepper value={typeof v === 'number' ? v : cond.default} max={cond.max} onChange={(n) => set(key, n)} label={ui.stacks} />}
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
