import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import data from '../../data/current';
import type { Element, WeaponType } from '../../data/types';
import { PLAYABLE } from '../../engine';
import { CharacterCard } from '../components/CharacterCard';
import { ElementGlyph } from '../components/ElementGlyph';
import { ImportCard } from '../import/ImportCard';
import { useBuilds, useMyCharacters } from '../../state/buildStore';
import { ELEMENT_COLOR, img } from '../theme';
import { ui } from '../../strings/en';

const ELEMENTS: Element[] = ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc'];
const WEAPONS: WeaponType[] = ['Broadblade', 'Sword', 'Pistols', 'Gauntlets', 'Rectifier'];

export function CharacterSelect() {
  const select = useBuilds((s) => s.select);
  const mine = useMyCharacters();
  const myChars = mine.map((id) => data.characters.find((c) => c.id === id)!).filter(Boolean);
  const [q, setQ] = useState('');
  const [el, setEl] = useState<Element | null>(null);
  const [wt, setWt] = useState<WeaponType | null>(null);
  const list = useMemo(
    () => PLAYABLE
      .filter((c) => (!el || c.element === el) && (!wt || c.weaponType === wt) && c.name.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)),
    [q, el, wt],
  );
  const chip = (on: boolean) => `flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition ${on ? 'border-gold bg-gold/15 text-ink' : 'border-white/15 text-muted hover:border-white/40 hover:text-ink'}`;

  return (
    <div className="space-y-10">
      <ImportCard />

      {myChars.length > 0 && (
        <section>
          <Heading>{ui.myResonators}</Heading>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {myChars.map((c, i) => (
              <button key={c.id} onClick={() => select(c.id)} className="rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-gold">
                <CharacterCard c={c} index={i} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <Heading>{ui.allResonators}</Heading>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ui.searchResonators}
            className="h-8 min-w-48 flex-1 rounded-full border border-white/15 bg-black/30 px-4 text-sm outline-none focus:border-gold sm:max-w-64" />
          <button className={chip(!el)} onClick={() => setEl(null)}>{ui.allFilter}</button>
          {ELEMENTS.map((e) => (
            <button key={e} className={chip(el === e)} onClick={() => setEl(el === e ? null : e)} title={e} aria-pressed={el === e}>
              <ElementGlyph element={e} size={14} /><span className="hidden sm:inline">{e}</span>
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
          {WEAPONS.map((w) => (
            <button key={w} className={chip(wt === w)} onClick={() => setWt(wt === w ? null : w)} aria-pressed={wt === w}>{w}</button>
          ))}
        </div>
        {list.length === 0 ? <p className="text-sm text-muted">{ui.noMatches}</p> : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {list.map((c, i) => {
              const src = img(`char:${c.id}`);
              const color = ELEMENT_COLOR[c.element];
              return (
                <motion.li key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 24) * 0.012 }}>
                  <button onClick={() => select(c.id)} title={c.name}
                    className="group flex w-full flex-col items-center gap-1.5 rounded-xl p-2 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-gold">
                    <span className="relative h-16 w-16 overflow-hidden rounded-full border-2 transition group-hover:scale-105 sm:h-20 sm:w-20"
                      style={{ borderColor: c.rarity === 5 ? 'var(--color-gold)' : 'var(--color-electro)', background: `radial-gradient(circle at 50% 30%, color-mix(in oklab, ${color} 35%, transparent), transparent 75%)` }}>
                      {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-2xl" style={{ color }}>{c.name[0]}</span>}
                      <span className="absolute bottom-0.5 right-0.5 rounded-full bg-night-900/80 p-0.5"><ElementGlyph element={c.element} size={12} /></span>
                    </span>
                    <span className="w-full truncate text-center text-xs">{c.name}</span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <h2 className="font-display text-lg tracking-wider text-ink/90">{children}</h2>
      <div className="ornament-rule flex-1" />
    </div>
  );
}
