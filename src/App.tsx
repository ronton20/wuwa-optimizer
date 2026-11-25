import { motion } from 'motion/react';
import data from './data/current';
import { StarField } from './ui/StarField';
import { CharacterCard } from './ui/components/CharacterCard';
import { t } from './strings/en';

export default function App() {
  return (
    <>
      <StarField />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-10 sm:px-8">
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

        <main className="flex-1">
          <div className="mb-5 flex items-center gap-4">
            <h2 className="font-display text-lg tracking-wider text-ink/90">{t.chooseResonator}</h2>
            <div className="ornament-rule flex-1" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.characters.map((c, i) => (
              <CharacterCard key={c.id} c={c} index={i} />
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted">{t.comingSoon}</p>
        </main>

        <footer className="mt-16 space-y-2 text-center text-xs text-muted">
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
