// Small shared UI pieces: animated numbers, rich game text, pips, sliders, toggles, tabs.
import { useEffect, useRef, type ReactNode } from 'react';
import { animate, motion } from 'motion/react';

/** Number that tweens to its new value; changed values flash gold briefly. */
export function AnimatedNumber({ value, format = (n) => Math.floor(n).toLocaleString(), className = '' }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (from === value) { el.textContent = format(value); return; }
    el.classList.remove('flash');
    void el.offsetWidth; // restart the flash animation
    el.classList.add('flash');
    const controls = animate(from, value, { duration: 0.35, ease: 'easeOut', onUpdate: (v) => { el.textContent = format(v); } });
    return () => controls.stop();
  }, [value, format]);
  return <span ref={ref} className={`tabular ${className}`}>{format(value)}</span>;
}

export const pct = (n: number) => `${n.toFixed(1)}%`;

const TAG_CLASS: Record<string, string> = {
  Highlight: 'text-gold', Title: 'text-gold-soft font-semibold',
  Wind: 'text-aero', Ice: 'text-glacio', Fire: 'text-fusion', Thunder: 'text-electro', Light: 'text-spectro', Dark: 'text-havoc',
};

/** Renders game text with [c=Name]…[/c] colour tags and line breaks. */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  const re = /\[c=([A-Za-z]+)\]([\s\S]*?)\[\/c\]/g;
  let last = 0, i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<span key={i++} className={TAG_CLASS[m[1]] ?? 'text-gold'}>{m[2]}</span>);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <p className={`whitespace-pre-line leading-relaxed ${className}`}>{parts}</p>;
}

/** Row of selectable pips, e.g. weapon rank R1–R5. */
export function Pips({ count, value, onChange, label }: { count: number; value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={n === value}
          onClick={() => onChange(n)}
          className={`h-8 w-8 rotate-45 rounded-[6px] border transition-colors ${n <= value ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_30%,transparent)]' : 'border-white/15 hover:border-white/40'}`}
        >
          <span className="block -rotate-45 text-xs font-semibold">{n}</span>
        </button>
      ))}
    </div>
  );
}

/** Level slider 1..max with the value shown. */
export function LevelSlider({ value, max = 10, onChange, label }: { value: number; max?: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="flex items-center gap-3">
      <span className="sr-only">{label}</span>
      <input
        type="range" min={1} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--accent)]"
      />
      <span className="tabular w-14 text-right font-display text-lg">Lv.<span className="text-gold">{value}</span></span>
    </label>
  );
}

/** Pill toggle switch. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_35%,transparent)]' : 'border-white/20 bg-white/5'}`}>
      {/* animate only the slide itself: `layout` would also animate the knob when the whole row moves (e.g. a card above expands) */}
      <motion.span initial={false} animate={{ x: on ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full transition-colors ${on ? 'bg-[var(--accent)]' : 'bg-white/60'}`} />
    </button>
  );
}

/** A few mutually exclusive options (e.g. Resonance Mode). */
export function Segmented({ options, value, onChange, label }: { options: string[]; value: number; onChange: (i: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/30 p-1">
      {options.map((o, i) => (
        <button key={o} role="radio" aria-checked={i === value} onClick={() => onChange(i)}
          className={`relative rounded-full px-3 py-1 text-xs transition-colors ${i === value ? 'text-ink' : 'text-muted hover:text-ink'}`}>
          {i === value && <motion.span layoutId={`seg-${label}`} transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className="absolute inset-0 rounded-full border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_25%,transparent)]" />}
          <span className="relative">{o}</span>
        </button>
      ))}
    </div>
  );
}

/** Stack count stepper. */
export function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  const btn = 'h-7 w-7 rounded-full border border-white/15 hover:border-[var(--accent)] disabled:opacity-30';
  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <button className={btn} disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label={`fewer ${label}`}>−</button>
      <span className="tabular w-12 text-center">{value}/{max}</span>
      <button className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`more ${label}`}>+</button>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h3 className="font-display text-sm uppercase tracking-[0.18em] text-muted">{children}</h3>
      <div className="ornament-rule flex-1" />
      {right}
    </div>
  );
}
