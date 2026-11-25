import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  /** small text after the label (e.g. a stat value) */
  hint?: string;
  /** group heading the option is listed under */
  group?: string;
  /** 'key' = highlighted as worth it for this build, 'none' = faded (no gain) */
  tone?: 'key' | 'minor' | 'none';
  disabled?: boolean;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** show a search box (default: when there are more than 10 options) */
  searchable?: boolean;
  className?: string;
  iconShape?: 'square' | 'wide' | 'round';
}

const ICON_CLASS = { square: 'h-7 w-7 rounded', wide: 'h-7 w-12 rounded object-contain', round: 'h-6 w-6 rounded-full' };

/** Dropdown with icons, groups, search and per-option highlighting. Opens in a portal so cards never clip it. */
export function IconSelect({ value, options, onChange, placeholder = 'Select…', ariaLabel, searchable, className = '', iconShape = 'square' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number }>();
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 10;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, 260);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    if (below >= 260 || below >= above) setPos({ left, top: r.bottom + 4, width, maxH: Math.min(380, below) });
    else setPos({ left, bottom: window.innerHeight - r.top + 4, width, maxH: Math.min(380, above) });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, shown.findIndex((o) => o.value === value)));
    const away = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', away);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (o?: SelectOption) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    setQ('');
    btn.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[active]); }
  };
  useEffect(() => { pop.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  let lastGroup: string | undefined;
  return (
    <>
      <button ref={btn} type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((v) => !v)} onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { e.preventDefault(); setOpen(true); } else if (open) onKey(e); }}
        className={`flex min-h-[38px] min-w-0 items-center gap-2 rounded-lg border bg-night-900 px-2 py-1 text-left text-sm transition hover:border-white/30 ${open ? 'border-[var(--accent)]' : 'border-white/10'} ${className}`}>
        {current?.icon && <img src={current.icon} alt="" className={`${ICON_CLASS[iconShape]} shrink-0 object-cover`} />}
        <span className={`min-w-0 flex-1 truncate ${current ? toneText(current.tone) : 'text-muted'}`}>{current?.tone === 'key' && <span className="mr-1 text-[9px] text-gold">◆</span>}{current ? current.label : placeholder}</span>
        {current?.hint && <span className="tabular shrink-0 text-xs text-muted">{current.hint}</span>}
        <svg viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`}><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open && pos && createPortal(
        <div ref={pop} onKeyDown={onKey} role="listbox" aria-label={ariaLabel}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-white/15 bg-night-900/95 shadow-2xl backdrop-blur-md">
          {showSearch && (
            <input autoFocus={!window.matchMedia('(pointer: coarse)').matches} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="Search…"
              className="m-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]" />
          )}
          <ul className="overflow-y-auto p-1 scroll-thin" style={{ maxHeight: pos.maxH - (showSearch ? 50 : 0) }} tabIndex={showSearch ? -1 : 0} ref={(el) => { if (!showSearch) el?.focus(); }}>
            {shown.map((o, i) => {
              const heading = o.group !== lastGroup ? o.group : undefined;
              lastGroup = o.group;
              return (
                <li key={o.value}>
                  {heading && <div className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-widest text-muted">{heading}</div>}
                  <button type="button" data-i={i} role="option" aria-selected={o.value === value} disabled={o.disabled}
                    onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition disabled:cursor-not-allowed ${i === active && !o.disabled ? 'bg-white/10' : ''} ${o.value === value ? 'text-[var(--accent)]' : ''}`}>
                    {o.icon ? <img src={o.icon} alt="" loading="lazy" className={`${ICON_CLASS[iconShape]} shrink-0 object-cover`} /> : iconShape !== 'round' && options.some((x) => x.icon) && <span className={`${ICON_CLASS[iconShape]} shrink-0`} />}
                    <span className={`min-w-0 flex-1 truncate ${o.value === value ? '' : toneText(o.tone)}`}>{o.tone === 'key' && <span className="mr-1 text-[9px] text-gold">◆</span>}{o.label}</span>
                    {o.hint && <span className="tabular shrink-0 text-xs text-muted">{o.hint}</span>}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-2 py-3 text-sm text-muted">No matches</li>}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}

export const toneText = (tone?: SelectOption['tone']) => (tone === 'key' ? 'text-gold-soft' : tone === 'none' ? 'opacity-40' : '');
