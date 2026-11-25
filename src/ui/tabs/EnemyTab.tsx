import type { Element } from '../../data/types';
import { DEFAULT_ENEMY, defMultiplier, resMultiplier } from '../../engine';
import type { Enemy } from '../../engine/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { SectionTitle } from '../components/kit';
import { ELEMENT_COLOR } from '../theme';

const ELEMENTS: Element[] = ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'Physical'];
export const enemyOf = (b: ReturnType<typeof useBuild>): Enemy => ({ level: b.enemy?.level ?? DEFAULT_ENEMY.level, res: { ...DEFAULT_ENEMY.res, ...b.enemy?.res } });

export function EnemyTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const enemy = enemyOf(build);
  const set = (patch: Partial<Enemy>) => update(characterId, (b) => ({ ...b, enemy: { ...enemyOf(b), ...patch } }));
  const isDefault = enemy.level === DEFAULT_ENEMY.level && ELEMENTS.every((el) => enemy.res[el] === DEFAULT_ENEMY.res[el]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <SectionTitle right={!isDefault && (
          <button onClick={() => set({ level: DEFAULT_ENEMY.level, res: { ...DEFAULT_ENEMY.res } })} className="text-xs text-muted hover:text-gold">Reset</button>
        )}>Level</SectionTitle>
        <div className="flex flex-wrap items-center gap-4">
          <input type="number" min={1} max={150} value={enemy.level} onChange={(e) => set({ level: Math.max(1, Math.min(150, Number(e.target.value) || 1)) })}
            className="tabular w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-right" aria-label="Enemy level" />
          <span className="text-sm text-muted">DEF {8 * enemy.level + 792} · your damage × {defMultiplier(enemy.level, 0).toFixed(3)} before DEF ignore</span>
        </div>
      </div>

      <div>
        <SectionTitle>Resistances</SectionTitle>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ELEMENTS.map((el) => (
            <li key={el} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
              <span className="h-2 w-2 rounded-full" style={{ background: ELEMENT_COLOR[el] }} />
              <span className="flex-1 text-sm">{el}</span>
              <input type="number" step={1} value={enemy.res[el]} onChange={(e) => set({ res: { ...enemy.res, [el]: Number(e.target.value) } })}
                className="tabular w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right text-sm" aria-label={`${el} resistance`} />
              <span className="w-20 text-right text-xs text-muted">% · × {resMultiplier(enemy.res[el]).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
