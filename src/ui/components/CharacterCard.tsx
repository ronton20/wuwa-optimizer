import { useState } from 'react';
import { motion } from 'motion/react';
import type { Character } from '../../data/types';
import { ELEMENT_COLOR, img } from '../theme';
import { ElementGlyph } from './ElementGlyph';
import { t } from '../../strings/en';

export function CharacterCard({ c, index }: { c: Character; index: number }) {
  const [imgOk, setImgOk] = useState(true);
  const color = ELEMENT_COLOR[c.element];
  const hits = c.skills.reduce((n, s) => n + s.rows.filter((r) => r.hits).length, 0);
  const scaling = c.skills.flatMap((s) => s.rows).find((r) => r.hits)?.hits?.[0].scaling ?? 'atk';

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -6 }}
      className="glass group relative overflow-hidden rounded-2xl"
      style={{ ['--el' as string]: color }}
    >
      {/* element glow */}
      <div
        className="absolute inset-x-0 top-0 h-56 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(ellipse at 50% 0%, color-mix(in oklab, ${color} 45%, transparent), transparent 70%)` }}
      />

      <div className="relative flex h-56 items-end justify-center">
        {imgOk ? (
          <img src={img(c.images.icon)} alt={c.name} onError={() => setImgOk(false)} className="h-48 w-48 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
        ) : (
          <div
            className="mb-6 flex h-32 w-32 rotate-45 items-center justify-center rounded-2xl border"
            style={{ borderColor: color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
          >
            <span className="-rotate-45 font-display text-5xl font-semibold" style={{ color }}>{c.name[0]}</span>
          </div>
        )}
      </div>

      <div className="relative space-y-3 px-5 pb-5 pt-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <ElementGlyph element={c.element} />
          <span style={{ color }}>{c.element}</span>
          <span className="opacity-40">·</span>
          <span>{c.weaponType}</span>
        </div>
        <h3 className="font-display text-2xl font-semibold tracking-wide">{c.name}</h3>
        <div className="text-gold" aria-label={`${c.rarity} stars`}>{'★'.repeat(c.rarity)}</div>
        <div className="ornament-rule my-3" />
        <dl className="tabular grid grid-cols-3 gap-2 text-center text-sm">
          {(['hp', 'atk', 'def'] as const).map((k) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wider text-muted">{t[k]}</dt>
              <dd className="font-display text-lg">{Math.floor(c.base[k]).toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">
          {t.baseStats} · {t.scalesOn} <span className="uppercase text-ink">{scaling}</span> · {hits} {t.damageRows}
        </p>
      </div>
    </motion.article>
  );
}
