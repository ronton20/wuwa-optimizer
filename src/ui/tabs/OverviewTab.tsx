import data from '../../data/current';
import type { StatKey } from '../../data/types';
import type { Stats } from '../../engine';
import { useBuild } from '../../state/buildStore';
import { AnimatedNumber, SectionTitle, pct } from '../components/kit';
import { img } from '../theme';
import { STAT_LABEL, ui } from '../../strings/en';

const PCT_LINES: StatKey[] = [
  'critRate', 'critDmg', 'energyRegen', 'healing', 'dmgBasic', 'dmgHeavy', 'dmgSkill', 'dmgLib', 'dmgIntro', 'dmgEcho', 'dmgAll',
  'dmgGlacio', 'dmgFusion', 'dmgElectro', 'dmgAero', 'dmgSpectro', 'dmgHavoc', 'dmgPhysical',
];

/** Stat panel styled like the in-game "More Stats" screen (passive effects only — toggles are in Buffs). */
export function OverviewTab({ characterId, stats }: { characterId: number; stats: Stats }) {
  const build = useBuild(characterId);
  const c = data.characters.find((x) => x.id === characterId)!;
  const w = data.weapons.find((x) => x.id === build.weapon.id);
  const lines = PCT_LINES.filter((k) => ['critRate', 'critDmg', 'energyRegen'].includes(k) || stats.sheet[k] > 0);

  return (
    <div className="grid max-w-[460px] gap-6">
      <div>
        <SectionTitle>{ui.baseStats}</SectionTitle>
        <ul className="space-y-1.5">
          {(['hp', 'atk', 'def'] as const).map((k) => (
            <li key={k} className="flex items-baseline justify-between rounded-lg bg-black/20 px-3 py-2">
              <span className="text-muted">{STAT_LABEL[k]}</span>
              <span className="font-display text-lg">
                <AnimatedNumber value={stats.base[k]} />
                <span className="ml-1.5 text-aero">+<AnimatedNumber value={stats.bonus[k]} /></span>
              </span>
            </li>
          ))}
          {lines.map((k) => (
            <li key={k} className="flex items-baseline justify-between px-3 py-1.5">
              <span className="text-muted">{STAT_LABEL[k]}</span>
              <AnimatedNumber value={stats.sheet[k]} format={pct} className="font-display" />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionTitle>{ui.tabs.weapon}</SectionTitle>
        {w && (
          <div className="flex items-center gap-3 rounded-xl bg-black/20 p-3">
            {img(`weapon:${w.id}`) && <img src={img(`weapon:${w.id}`)} alt="" className="h-12 w-20 object-contain" />}
            <div>
              <div className="font-display">{w.name} <span className="text-gold">R{build.weapon.rank}</span></div>
              <div className="text-xs text-muted">ATK {Math.floor(w.baseAtk)} · {STAT_LABEL[w.substat.stat]} {w.substat.value}{w.substat.stat === 'atk' || w.substat.stat === 'hp' || w.substat.stat === 'def' ? '' : '%'}</div>
            </div>
          </div>
        )}
      </div>

      <div>
        <SectionTitle right={<span className="text-xs text-muted">{ui.cost} {build.echoes.reduce((a, p) => a + (p ? data.echoes.find((e) => e.id === p.echoId)?.cost ?? 0 : 0), 0)}/12</span>}>{ui.echoes}</SectionTitle>
                <ul className="grid grid-cols-5 gap-2">
          {build.echoes.map((p, i) => {
            if (!p) return <li key={i} className="aspect-square rounded-lg border border-dashed border-white/10" />;
            const e = data.echoes.find((x) => x.id === p.echoId);
            const src = img(`echo:${p.echoId}`);
            return (
              <li key={i} title={e?.name} className={`relative overflow-hidden rounded-lg border bg-black/25 ${i === 0 ? 'border-gold/60' : 'border-white/10'}`}>
                {src ? <img src={src} alt={e?.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
                <span className="absolute right-1 top-0.5 text-xs font-semibold text-gold">{e?.cost}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-muted">{c.name} · Lv 90</p>
    </div>
  );
}
