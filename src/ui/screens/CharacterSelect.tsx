import { PLAYABLE } from '../../engine';
import { CharacterCard } from '../components/CharacterCard';
import { useBuilds } from '../../state/buildStore';
import { t } from '../../strings/en';

export function CharacterSelect() {
  const select = useBuilds((s) => s.select);
  return (
    <>
      <div className="mb-5 flex items-center gap-4">
        <h2 className="font-display text-lg tracking-wider text-ink/90">{t.chooseResonator}</h2>
        <div className="ornament-rule flex-1" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLAYABLE.map((c, i) => (
          <button key={c.id} onClick={() => select(c.id)} className="text-left focus-visible:outline-2 focus-visible:outline-gold rounded-2xl">
            <CharacterCard c={c} index={i} />
          </button>
        ))}
      </div>
    </>
  );
}
