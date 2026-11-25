import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import data from './data/current';
import { StarField } from './ui/StarField';
import { CharacterSelect } from './ui/screens/CharacterSelect';
import { BuildScreen } from './ui/screens/BuildScreen';
import { useBuilds } from './state/buildStore';
import { t } from './strings/en';

/** #/c/1108 <-> selected character, so the back button and links work. */
function useHashRoute() {
  const activeId = useBuilds((s) => s.activeId);
  const select = useBuilds((s) => s.select);
  useEffect(() => {
    const read = () => {
      const m = location.hash.match(/^#\/c\/(\d+)/);
      const id = m ? Number(m[1]) : null;
      select(id && data.characters.some((c) => c.id === id) ? id : null);
    };
    if (location.hash) read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [select]);
  useEffect(() => {
    const want = activeId ? `#/c/${activeId}` : '';
    if (location.hash !== want) history.pushState(null, '', want || location.pathname);
  }, [activeId]);
  return activeId;
}

/** Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) for build edits. */
function useUndoKeys() {
  const undo = useBuilds((s) => s.undo);
  const redo = useBuilds((s) => s.redo);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
}

export default function App() {
  const activeId = useHashRoute();
  useUndoKeys();

  return (
    <>
      <StarField />
      <div className={`mx-auto flex min-h-screen flex-col px-4 py-6 sm:px-6 ${activeId ? 'max-w-[1500px]' : 'max-w-6xl py-10'}`}>
        {!activeId && (
          <header className="mb-10 text-center">
            <motion.h1
              initial={{ opacity: 0, letterSpacing: '0.3em' }}
              animate={{ opacity: 1, letterSpacing: '0.08em' }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="font-display text-4xl font-semibold text-gold-soft sm:text-5xl"
            >
              {t.appName}
            </motion.h1>
            <p className="mt-3 text-muted">{t.tagline}</p>
          </header>
        )}

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={activeId ?? 'select'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {activeId ? <BuildScreen characterId={activeId} /> : <CharacterSelect />}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-12 space-y-2 text-center text-xs text-muted">
          <div className="ornament-rule mx-auto mb-4 max-w-sm" />
          <p className="tabular">{t.dataVersion(data.meta.gameVersion, data.meta.builtAt)}</p>
          <p>{t.disclaimer}</p>
          <p className="space-x-3">
            <a className="hover:text-gold" href="https://discord.com/users/ronton20" target="_blank" rel="noreferrer">{t.discord}</a>
            <span className="opacity-40">·</span>
            <a className="hover:text-gold" href="https://buymeacoffee.com/ronton20" target="_blank" rel="noreferrer">{t.coffee}</a>
          </p>
        </footer>
      </div>
    </>
  );
}
