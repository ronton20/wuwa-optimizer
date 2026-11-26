import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import data from '../../data/current';
import { useBuilds, useMyCharacters, type Team } from '../../state/buildStore';
import { IconSelect } from '../components/IconSelect';
import { ELEMENT_COLOR, img } from '../theme';

/** Named teams of three. Saving a team points each member's teammates at the other two, following their builds. */
export function TeamsSection() {
  const teams = useBuilds((s) => s.teams);
  const mainTeam = useBuilds((s) => s.mainTeam);
  const { select, deleteTeam, setMainTeam, showTeam } = useBuilds.getState();
  const [editing, setEditing] = useState<Partial<Team> | null>(null);

  return (
    <section>
      <div className="mb-5 flex items-center gap-4">
        <h2 className="font-display text-lg tracking-wider text-ink/90">Your Teams</h2>
        <div className="ornament-rule flex-1" />
        {!editing && <button onClick={() => setEditing({ name: '', members: [] })} className="rounded-full border border-white/15 px-4 py-1 text-xs hover:border-gold">+ New team</button>}
      </div>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
            <TeamEditor team={editing} onDone={() => setEditing(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {teams.length === 0 && !editing ? (
        <p className="text-sm text-muted">Group three Resonators into a team: each one's Team tab then follows the other two's builds. Then build a rotation for the team and see its DPS.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <li key={t.id} className={`group relative rounded-2xl border bg-black/25 p-4 transition ${t.id === mainTeam ? 'border-gold/60' : 'border-white/10 hover:border-white/25'}`}>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {t.members.map((m) => <Avatar key={m} id={m} onClick={() => select(m)} />)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display tracking-wide">{t.name}</div>
                  <div className="truncate text-xs text-muted">{t.members.map((m) => data.characters.find((c) => c.id === m)?.name).join(' · ')}</div>
                </div>
                <button onClick={() => setMainTeam(t.id === mainTeam ? null : t.id)} title={t.id === mainTeam ? 'Main team' : 'Make main team'} aria-pressed={t.id === mainTeam}
                  className={`text-lg leading-none transition ${t.id === mainTeam ? 'text-gold' : 'text-muted/50 hover:text-gold'}`}>★</button>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                <button onClick={() => showTeam(t.id)} className="rounded-full border border-gold/40 px-3 py-0.5 text-gold-soft hover:border-gold hover:text-gold">Rotation →</button>
                <button onClick={() => setEditing(t)} className="hover:text-ink">Edit</button>
                <button onClick={() => { if (confirm(`Delete ${t.name}? The builds stay.`)) deleteTeam(t.id); }} className="hover:text-fusion">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Avatar({ id, onClick }: { id: number; onClick?: () => void }) {
  const c = data.characters.find((x) => x.id === id);
  if (!c) return null;
  const src = img(`char:${c.id}`);
  return (
    <button onClick={onClick} title={`Open ${c.name}`} className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-night-900 bg-night-800 transition hover:z-10 hover:scale-110"
      style={{ boxShadow: `0 0 0 2px color-mix(in oklab, ${ELEMENT_COLOR[c.element]} 70%, transparent)` }}>
      {src ? <img src={src} alt={c.name} className="h-full w-full object-cover" /> : <span className="font-display" style={{ color: ELEMENT_COLOR[c.element] }}>{c.name[0]}</span>}
    </button>
  );
}

function TeamEditor({ team, onDone }: { team: Partial<Team>; onDone: () => void }) {
  const mine = useMyCharacters();
  const saveTeam = useBuilds((s) => s.saveTeam);
  const [name, setName] = useState(team.name ?? '');
  const [members, setMembers] = useState<(number | null)[]>([0, 1, 2].map((i) => team.members?.at(i) ?? null));
  const picked = members.filter((m): m is number => m !== null);
  // my Resonators first; anyone else gets a fresh build when the team is saved
  const options = (slot: number) => {
    const taken = members.filter((m, i) => i !== slot && m !== null);
    const all = [...data.characters].filter((c) => !taken.includes(c.id)).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
    return [
      ...all.filter((c) => mine.includes(c.id)).map((c) => ({ value: String(c.id), label: c.name, icon: img(`char:${c.id}`), hint: c.element, group: 'Your Resonators' })),
      ...all.filter((c) => !mine.includes(c.id)).map((c) => ({ value: String(c.id), label: c.name, icon: img(`char:${c.id}`), hint: c.element, group: 'Others' })),
    ];
  };
  const auto = picked.map((m) => data.characters.find((c) => c.id === m)?.name).join(' / ');

  return (
    <div className="rounded-2xl border border-gold/40 bg-black/30 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,1fr))]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={auto || 'Team name'} aria-label="Team name"
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-gold" />
        {members.map((m, i) => (
          <IconSelect key={i} ariaLabel={`Member ${i + 1}`} iconShape="round" searchable placeholder={`Member ${i + 1}`}
            value={m === null ? '' : String(m)} options={options(i)}
            onChange={(v) => setMembers(members.map((x, j) => (j === i ? (v ? Number(v) : null) : x)))} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button disabled={picked.length < 2} onClick={() => { saveTeam({ id: team.id, name: name || auto, members: picked }); onDone(); }}
          className="rounded-full border border-gold bg-gold/15 px-5 py-1.5 text-sm transition hover:bg-gold/25 disabled:opacity-40">Save team</button>
        <button onClick={onDone} className="text-sm text-muted hover:text-ink">Cancel</button>
        <span className="text-xs text-muted">Each member's Team tab will follow the other two's builds.</span>
      </div>
    </div>
  );
}
