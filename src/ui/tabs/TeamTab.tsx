import type { ReactNode } from 'react';
import data from '../../data/current';
import { TEAM_ECHOES, TEAM_NOT_MODELLED, TEAM_SETS, echoBaseName, inMode, modeChoice, signatureOf, teammateEffects } from '../../engine';
import type { Character } from '../../data/types';
import { IconSelect, type SelectOption } from '../components/IconSelect';
import type { ModKey, Teammate } from '../../engine/types';
import { useBuild, useBuilds } from '../../state/buildStore';
import { Pips, SectionTitle, Segmented } from '../components/kit';
import { ELEMENT_COLOR, echoImg, img } from '../theme';
import { modLabel, valueLines } from '../effectText';

const NONE = '';

/** Every weapon of the teammate's type: signature first, then by rarity. */
function weaponOptions(c: Character): SelectOption[] {
  const sig = signatureOf(c.name, data);
  const list = data.weapons.filter((w) => w.type === c.weaponType);
  return [
    { value: NONE, label: '— none —' },
    ...(sig ? [{ value: String(sig.id), label: sig.name, icon: img(`weapon:${sig.id}`), group: 'Signature' }] : []),
    ...list.filter((w) => w.id !== sig?.id).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
      .map((w) => ({ value: String(w.id), label: w.name, icon: img(`weapon:${w.id}`), group: `${w.rarity}★` })),
  ];
}

/** Every echo once ("Phantom: " skins merged): team buffs first. */
const ECHO_OPTIONS: SelectOption[] = (() => {
  const seen = new Set<string>();
  const all = data.echoes.filter((e) => e.sets.length && !seen.has(echoBaseName(e.name)) && seen.add(echoBaseName(e.name)));
  const opt = (e: (typeof all)[number], group: string) => ({ value: echoBaseName(e.name), label: echoBaseName(e.name), icon: echoImg(e.id), hint: `Cost ${e.cost}`, group });
  return [
    { value: NONE, label: '— none —' },
    ...all.filter((e) => TEAM_ECHOES[echoBaseName(e.name)]).map((e) => opt(e, 'Buffs the team')),
    ...all.filter((e) => !TEAM_ECHOES[echoBaseName(e.name)]).map((e) => opt(e, 'Other echoes (no team buff)')),
  ];
})();

/** Every sonata set: team buffs first. */
const SET_OPTIONS: SelectOption[] = (() => {
  const sorted = [...data.sonatas].sort((a, b) => a.name.localeCompare(b.name));
  const opt = (s: (typeof sorted)[number], group: string) => ({ value: s.name, label: s.name, icon: img(`sonata:${s.id}`), group });
  return [
    { value: NONE, label: '— none —' },
    ...sorted.filter((s) => TEAM_SETS[s.name]).map((s) => opt(s, 'Buffs the team')),
    ...sorted.filter((s) => !TEAM_SETS[s.name]).map((s) => opt(s, 'Other sets (no team buff)')),
  ];
})();

const CUSTOM_KEYS: ModKey[] = [
  'atkPct', 'hpPct', 'defPct', 'atk', 'critRate', 'critDmg', 'dmgAll', 'dmgGlacio', 'dmgFusion', 'dmgElectro', 'dmgAero', 'dmgSpectro', 'dmgHavoc',
  'dmgBasic', 'dmgHeavy', 'dmgSkill', 'dmgLib', 'dmgIntro', 'dmgEcho', 'amplify', 'resShred', 'defIgnore',
];

export function TeamTab({ characterId }: { characterId: number }) {
  const build = useBuild(characterId);
  const update = useBuilds((s) => s.update);
  const team = [build.team?.[0] ?? null, build.team?.[1] ?? null];
  const setSlot = (i: number, t: Teammate | null) =>
    update(characterId, (b) => {
      const next = [b.team?.[0] ?? null, b.team?.[1] ?? null];
      next[i] = t;
      return { ...b, team: next };
    });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Teammates only add what reaches the on-field Resonator: Outros, team-wide sequences, and team buffs from their weapon, main echo and set. Toggle them in Buffs.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {team.map((t, i) => (
          <SlotCard key={i} slot={i} t={t} self={characterId} other={team[1 - i]?.characterId} onChange={(v) => setSlot(i, v)} />
        ))}
      </div>
    </div>
  );
}

function SlotCard({ slot, t, self, other, onChange }: { slot: number; t: Teammate | null; self: number; other?: number; onChange: (t: Teammate | null) => void }) {
  const choices = data.characters.filter((c) => c.id !== self && c.id !== other).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
  const c = t && data.characters.find((x) => x.id === t.characterId);
  const build = useBuild(self);
  const update = useBuilds((s) => s.update);
  const onField = data.characters.find((x) => x.id === self)?.name;
  const all = t ? teammateEffects(t, slot, data, onField) : [];
  // a teammate with Resonance Modes (Hsin, Lucilla…) gives different buffs per mode
  const modes = [...new Map(all.filter((e) => e.mode).map((e) => [e.mode!.key, e.mode!])).values()];
  const effects = all.filter((e) => inMode(e, build.conditions));
  const setMode = (key: string, i: number) => update(self, (b) => ({ ...b, conditions: { ...b.conditions, [key]: i } }));

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <SectionTitle right={t && <button onClick={() => onChange(null)} className="text-xs text-muted hover:text-fusion">Remove</button>}>
        {`Teammate ${slot + 1}${c ? ` (${c.name})` : ''}`}
      </SectionTitle>

      <div className="mb-4 flex items-center gap-3">
        {c && (img(`char:${c.id}`)
          ? <img src={img(`char:${c.id}`)} alt="" className="h-12 w-12 shrink-0 rounded-full border-2 border-[var(--accent)] object-cover" />
          : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)] font-display" style={{ color: ELEMENT_COLOR[c.element] }}>{c.name[0]}</span>)}
        <IconSelect ariaLabel={`Teammate ${slot + 1}`} className="flex-1" iconShape="round" searchable placeholder="Search a Resonator…"
          value={t ? String(t.characterId) : ''}
          options={choices.map((x) => ({ value: String(x.id), label: x.name, icon: img(`char:${x.id}`), hint: x.element, group: `${x.rarity}★` }))}
          onChange={(v) => {
            const x = data.characters.find((y) => y.id === Number(v));
            if (!x || t?.characterId === x.id) return;
            const sig = signatureOf(x.name, data);
            onChange({ characterId: x.id, sequence: 0, weapon: sig && { id: sig.id, rank: 1 }, custom: [] });
          }} />
      </div>

      {t && c && (
        <div className="space-y-4 text-sm">
          <Row label="Sequence">
            <div className="flex items-center gap-3">
              <Pips count={6} value={t.sequence} onChange={(n) => onChange({ ...t, sequence: n === t.sequence ? 0 : n })} label="Sequence" />
              <span className="text-muted">S{t.sequence}</span>
            </div>
          </Row>

          <Row label="Weapon">
            <div className="flex min-w-0 gap-2">
              <IconSelect ariaLabel="Weapon" iconShape="wide" className="flex-1" value={t.weapon ? String(t.weapon.id) : NONE} options={weaponOptions(c)}
                onChange={(v) => onChange({ ...t, weapon: v ? { id: Number(v), rank: t.weapon?.rank ?? 1 } : undefined })} />
              {t.weapon && <select value={t.weapon.rank} onChange={(e) => onChange({ ...t, weapon: { ...t.weapon!, rank: Number(e.target.value) } })} aria-label="Weapon rank"
                className="rounded-lg border border-white/10 bg-night-900 px-2 py-1.5">
                {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>R{r}</option>)}
              </select>}
            </div>
          </Row>

          <Row label="Main echo">
            <IconSelect ariaLabel="Main echo" value={t.mainEcho ? echoBaseName(t.mainEcho) : NONE} options={ECHO_OPTIONS} onChange={(v) => onChange({ ...t, mainEcho: v || undefined })} />
          </Row>

          <Row label="Sonata set">
            <IconSelect ariaLabel="Sonata set" iconShape="round" value={t.set ?? NONE} options={SET_OPTIONS} onChange={(v) => onChange({ ...t, set: v || undefined })} />
          </Row>

          <Row label="Other buffs" wide>
            <div className="space-y-1.5">
              {t.custom.map((m, k) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_72px_auto] gap-2">
                  <input value={m.label} placeholder="Label (e.g. Weapon)" onChange={(e) => onChange({ ...t, custom: t.custom.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })}
                    className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5" />
                  <select value={m.key} onChange={(e) => onChange({ ...t, custom: t.custom.map((x, j) => (j === k ? { ...x, key: e.target.value as ModKey } : x)) })}
                    className="min-w-0 rounded-lg border border-white/10 bg-night-900 px-2 py-1.5">
                    {CUSTOM_KEYS.map((key) => <option key={key} value={key}>{modLabel(key)}</option>)}
                  </select>
                  <input type="number" step="0.1" value={m.value} onChange={(e) => onChange({ ...t, custom: t.custom.map((x, j) => (j === k ? { ...x, value: Number(e.target.value) } : x)) })}
                    className="tabular min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-right" aria-label="value" />
                  <button onClick={() => onChange({ ...t, custom: t.custom.filter((_, j) => j !== k) })} className="px-2 text-muted hover:text-fusion" aria-label="remove buff">×</button>
                </div>
              ))}
              <button onClick={() => onChange({ ...t, custom: [...t.custom, { key: 'atkPct', value: 0, label: '' }] })} className="rounded-full border border-white/15 px-3 py-1 text-xs hover:border-gold">+ Add buff</button>
            </div>
          </Row>

          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted">Gives the on-field Resonator</div>
            {modes.map((m) => (
              <div key={m.key} className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">{m.label}</span>
                <Segmented options={m.options} value={modeChoice(m.key, build.conditions)} onChange={(i) => setMode(m.key, i)} label={`${m.key} ${m.label}`} />
              </div>
            ))}
            {effects.length ? (
              <ul className="space-y-1 border-l border-[var(--accent)]/50 pl-3 text-xs">
                {effects.map((e) => (
                  <li key={e.id}>
                    <span className="text-ink/80">{e.source.replace(/^Teammate \d \([^)]+\) · /, '')}</span>
                    {valueLines(e, 1).map((l, i) => <span key={i} className="ml-2 text-gold-soft">{l.text}{l.scope && <span className="text-muted"> · {l.scope}</span>}</span>)}
                    {e.raisesMax && <span className="ml-2 text-gold-soft">Negative Status stack limit +{e.raisesMax.by}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted">Nothing modelled yet.</p>}
            {TEAM_NOT_MODELLED[c.name] && <p className="mt-2 text-xs text-muted">Not modelled: {TEAM_NOT_MODELLED[c.name].join(' · ')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'grid gap-1' : 'grid gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:items-center'}>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  );
}

