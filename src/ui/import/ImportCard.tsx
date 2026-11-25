import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CardResult } from '../../import/readCard';
import { ImportDialog } from './ImportDialog';
import { ui } from '../../strings/en';

/** Drop / paste / pick a WuwaBot card; reads it on the device and opens the preview. */
export function ImportCard({ compact = false }: { compact?: boolean }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ r: CardResult; url: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const run = useCallback(async (file: Blob) => {
    if (!file.type.startsWith('image/')) { setError(ui.importNotImage); return; }
    setError(null);
    setBusy(ui.importLoading);
    try {
      const { readCardFile } = await import('../../import/browser');
      const r = await readCardFile(file, (step) => setBusy(ui.importStep(step)));
      setResult({ r, url: URL.createObjectURL(file) });
    } catch (e) {
      setError(e instanceof Error && e.message === 'not-a-card' ? ui.importNotCard : ui.importFailedRead);
    } finally {
      setBusy(null);
    }
  }, []);

  // paste anywhere on the page (Ctrl+V a screenshot / copied image)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
      if (f && !busy) { e.preventDefault(); run(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [run, busy]);

  const pick = () => input.current?.click();
  const drop = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) run(f);
  };

  return (
    <>
      {compact ? (
        <button onClick={pick} disabled={!!busy} className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 text-sm hover:border-gold disabled:opacity-50">
          <UploadIcon /> {busy ? ui.importBusy : ui.importShort}
        </button>
      ) : (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
          className={`glass relative overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-8 ${over ? 'border-gold bg-gold/10' : 'border-white/15'}`}>
          <div className="mx-auto max-w-xl">
            <div className="mb-2 font-display text-xl tracking-wide text-gold-soft">{ui.importTitle}</div>
            <p className="mb-5 text-sm text-muted">{ui.importHint}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button onClick={pick} disabled={!!busy}
                className="flex items-center gap-2 rounded-full bg-gold/20 px-5 py-2.5 font-display tracking-wide text-gold-soft transition hover:bg-gold/30 disabled:opacity-50">
                <UploadIcon /> {ui.importPick}
              </button>
              <span className="text-xs text-muted">{ui.importOr}</span>
            </div>
            <AnimatePresence>
              {busy && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 flex items-center justify-center gap-3 text-sm" role="status">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />{busy}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-4 text-[11px] text-muted/80">{ui.importPrivacy}</p>
          </div>
        </motion.section>
      )}
      {error && !result && (
        <div role="alert" className={`${compact ? 'fixed right-4 top-4 z-[90] max-w-sm' : 'mt-3'} rounded-xl border border-[#ff6b8b]/50 bg-[#ff6b8b]/10 px-4 py-3 text-sm`}>
          {error} <button onClick={() => setError(null)} className="ml-2 text-muted hover:text-ink">✕</button>
        </div>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ''; }} />
      {result && <ImportDialog result={result.r} imageUrl={result.url} onClose={() => { URL.revokeObjectURL(result.url); setResult(null); }} />}
    </>
  );
}

function UploadIcon() {
  return <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10" /></svg>;
}
