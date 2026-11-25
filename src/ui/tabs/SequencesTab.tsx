import { useState } from 'react';
import { motion } from 'motion/react';
import data from '../../data/current';
import { useBuild, useBuilds } from '../../state/buildStore';
import { RichText } from '../components/kit';
import { ui } from '../../strings/en';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Clicking node N sets the sequence to SN (up or down); clicking the last lit node clears everything. */
export function nextSequence(current: number, clicked: number) {
  return clicked === current ? 0 : clicked;
}

export function SequencesTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const c = data.characters.find((x) => x.id === characterId)!;
  const [focus, setFocus] = useState(Math.max(1, build.sequence));
  const set = (n: number) => {
    update(characterId, (b) => ({ ...b, sequence: nextSequence(b.sequence, n) }));
    setFocus(n);
  };
  const node = c.sequences[focus - 1];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{ui.sequenceHint}</p>
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        {c.sequences.map((s, i) => {
          const n = i + 1;
          const lit = n <= build.sequence;
          return (
            <div key={n} className="flex items-center gap-3 sm:gap-5">
              <motion.button
                onClick={() => set(n)}
                onMouseEnter={() => setFocus(n)}
                onFocus={() => setFocus(n)}
                aria-pressed={lit}
                aria-label={`S${n} ${s.name}`}
                whileHover={{ scale: 1.08 }}
                animate={{ boxShadow: lit ? '0 0 22px var(--accent)' : '0 0 0 rgba(0,0,0,0)' }}
                transition={{ delay: lit ? 0.05 * i : 0 }}
                className={`flex h-14 w-14 rotate-45 items-center justify-center rounded-xl border-2 ${lit ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_28%,transparent)]' : 'border-white/15 bg-black/30'} ${focus === n ? 'ring-2 ring-gold/50 ring-offset-2 ring-offset-transparent' : ''}`}
              >
                <span className={`-rotate-45 font-display text-lg ${lit ? 'text-ink' : 'text-muted'}`}>{ROMAN[i]}</span>
              </motion.button>
              {n < 6 && <span className={`hidden h-px w-6 sm:block ${n < build.sequence ? 'bg-[var(--accent)]' : 'bg-white/15'}`} />}
            </div>
          );
        })}
      </div>

      <div className="max-w-xl rounded-xl border border-white/10 bg-black/30 p-5">
        <div className="mb-1 text-xs uppercase tracking-wider text-muted">{ui.sequence} {ROMAN[focus - 1]} · {focus <= build.sequence ? 'Active' : 'Locked'}</div>
        <div className="mb-3 font-display text-xl">{node.name}</div>
        <RichText text={node.description} className="text-sm text-ink/85" />
      </div>
    </div>
  );
}
