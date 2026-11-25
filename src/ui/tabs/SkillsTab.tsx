import { useState } from 'react';
import data from '../../data/current';
import type { SkillKind } from '../../data/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { LevelSlider, RichText } from '../components/kit';
import { SKILL_LABEL, ui } from '../../strings/en';

const LEVELED: SkillKind[] = ['Normal', 'Skill', 'Forte', 'Liberation', 'Intro'];

export function SkillsTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const c = data.characters.find((x) => x.id === characterId)!;
  const [open, setOpen] = useState<SkillKind | null>(null);
  const setLevel = (kind: SkillKind, lv: number) => update(characterId, (b) => ({ ...b, skillLevels: { ...b.skillLevels, [kind]: lv } }));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => update(characterId, (b) => ({ ...b, skillLevels: {} }))} className="rounded-full border border-white/15 px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink">{ui.setAll10}</button>
      </div>
      {LEVELED.map((kind) => {
        const skill = c.skills.find((s) => s.kind === kind);
        if (!skill) return null;
        const lv = build.skillLevels[kind] ?? 10;
        const isOpen = open === kind;
        return (
          <div key={kind} className="rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted">{SKILL_LABEL[kind]}</div>
                <div className="font-display text-lg">{skill.name}</div>
              </div>
              <button onClick={() => setOpen(isOpen ? null : kind)} className="text-xs text-muted hover:text-gold" aria-expanded={isOpen}>{isOpen ? 'Hide details' : 'Details'}</button>
            </div>
            <LevelSlider value={lv} onChange={(v) => setLevel(kind, v)} label={`${skill.name} level`} />
            {isOpen && (
              <div className="mt-4 space-y-4">
                <table className="w-full text-sm">
                  <tbody>
                    {skill.rows.map((r, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className={`py-1.5 pr-3 ${r.hits ? 'text-ink' : 'text-muted'}`}>{r.label}</td>
                        <td className="tabular py-1.5 text-right text-gold-soft">{r.values[lv - 1] ?? r.values.at(-1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted hover:text-ink">Skill description</summary>
                  <RichText text={skill.description} className="mt-2 text-ink/80" />
                </details>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
