import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import data from '../../data/current';
import type { Weapon } from '../../data/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { Pips, RichText, SectionTitle } from '../components/kit';
import { img } from '../theme';
import { STAT_LABEL, ui } from '../../strings/en';
import { signatureOf } from '../../engine';

const substatText = (w: Weapon) => `${STAT_LABEL[w.substat.stat]} ${w.substat.value}${['atk', 'hp', 'def'].includes(w.substat.stat) ? '' : '%'}`;

export function WeaponTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const c = data.characters.find((x) => x.id === characterId)!;
  const [query, setQuery] = useState('');
  const current = data.weapons.find((w) => w.id === build.weapon.id)!;
  const sig = signatureOf(c.name, data);
  const list = useMemo(
    () => data.weapons
      .filter((w) => w.type === c.weaponType && w.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => Number(b.id === sig?.id) - Number(a.id === sig?.id)),
    [c.weaponType, query, sig],
  );
  const setWeapon = (id: number) => update(characterId, (b) => ({ ...b, weapon: { id, rank: b.weapon.id === id ? b.weapon.rank : 1 } }));
  const setRank = (rank: number) => update(characterId, (b) => ({ ...b, weapon: { ...b.weapon, rank } }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-black/30 p-4">
          {img(`weapon:${current.id}`) && <img src={img(`weapon:${current.id}`)} alt="" className="mx-auto h-36 object-contain" />}
          <div className="mt-2 font-display text-xl">{current.name} <span className="text-gold">{'★'.repeat(current.rarity)}</span></div>
          <div className="text-sm text-muted">ATK {Math.floor(current.baseAtk)} · {substatText(current)}</div>
        </div>
        <div>
          <SectionTitle>{ui.rank}</SectionTitle>
          <Pips count={5} value={build.weapon.rank} onChange={setRank} label={ui.rank} />
        </div>
        <div>
          <SectionTitle>{current.passive.name || 'Passive'}</SectionTitle>
          <RichText text={current.passive.descriptions[build.weapon.rank - 1]} className="text-sm text-ink/85" />
        </div>
      </div>

      <div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${c.weaponType.toLowerCase()}s…`}
          className="mb-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <ul className="grid max-h-[560px] grid-cols-2 gap-2 overflow-y-auto pr-1 scroll-thin sm:grid-cols-3">
          {list.map((w) => (
            <motion.li key={w.id} layout>
              <button onClick={() => setWeapon(w.id)} aria-pressed={w.id === current.id}
                className={`relative h-full w-full rounded-lg border p-2 text-left transition ${w.id === current.id ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]' : 'border-white/10 bg-black/20 hover:border-white/30'}`}>
                {w.id === sig?.id && <span className="absolute left-1.5 top-1.5 rounded bg-gold/90 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-night-900">Signature</span>}
                {img(`weapon:${w.id}`) ? <img src={img(`weapon:${w.id}`)} alt="" loading="lazy" className="h-14 w-full object-contain" /> : <div className="h-14" />}
                <div className="mt-1 truncate text-sm">{w.name}</div>
                <div className={`text-xs ${w.rarity === 5 ? 'text-gold' : 'text-electro'}`}>{'★'.repeat(w.rarity)}</div>
                <div className="truncate text-xs text-muted">{substatText(w)}</div>
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
