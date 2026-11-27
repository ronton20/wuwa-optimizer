/**
 * Everything the game data says about a Resonator, plus what the engine already models for them.
 *   npm run kit -- "Hiyuki"     one Resonator: skills, rows, hit terms, sequences, nodes, coverage
 *   npm run kit                 coverage table for every Resonator
 * Read by the `model-character` and `model-character-timings` skills.
 */
import data from '../../src/data/current';
import { KITS, NOT_MODELLED, UNVERIFIED } from '../../src/engine/effects/characters';
import { TEAM_KITS, TEAM_NOT_MODELLED } from '../../src/engine/effects/team';
import { HAS_MACHINE, STATUS_ROWS } from '../../src/engine/rotation/actions';
import { RECORDED_TIMES } from '../../src/engine/rotation/recordedTimes';
import { guessMechanics } from '../../src/engine/mechanics';

const plain = (s = '') => s.replace(/\[\/?c[^\]]*\]/g, '').replace(/[ \t]+/g, ' ').trim();
const name = process.argv.slice(2).join(' ').trim();

function coverage(n: string) {
  return {
    kit: KITS[n]?.length ?? 0,
    team: TEAM_KITS[n] ? TEAM_KITS[n].length : '-',
    machine: HAS_MACHINE.includes(n) ? 'hand-made' : 'generic',
    statusRows: STATUS_ROWS[n] ? Object.keys(STATUS_ROWS[n]).length : 0,
    times: RECORDED_TIMES[n] ? 'recorded' : 'default',
    verified: KITS[n] ? (UNVERIFIED.has(n) ? 'no' : 'yes') : '-',
  };
}

if (!name) {
  const rows = data.characters.map((c) => ({ name: c.name, ...coverage(c.name) })).sort((a, b) => b.kit - a.kit || a.name.localeCompare(b.name));
  console.table(rows);
  console.log(`${rows.filter((r) => r.kit).length}/${rows.length} have a kit, ${HAS_MACHINE.length} a hand-made machine, ${Object.keys(RECORDED_TIMES).length} recorded timings`);
  process.exit(0);
}

const c = data.characters.find((x) => x.name.toLowerCase() === name.toLowerCase());
if (!c) { console.error(`No Resonator "${name}". Names: ${data.characters.map((x) => x.name).join(', ')}`); process.exit(1); }

console.log(`# ${c.name} (id ${c.id}) · ${c.rarity}★ ${c.element} ${c.weaponType}`);
console.log(`Lv90 base: ${JSON.stringify(c.base)}`);
for (const s of [...c.skills].sort((a, b) => (a.treeIndex ?? 99) - (b.treeIndex ?? 99))) {
  console.log(`\n## ${s.kind} · ${s.name} (tree ${s.treeIndex ?? '-'}, max Lv ${s.maxLevel})\n${plain(s.description)}`);
  for (const r of s.rows) {
    console.log(`  - ${r.label}: ${r.values.at(-1) ?? ''}`);
    for (const h of r.hits ?? []) {
      const extra = [h.concerto !== undefined && `concerto ${h.concerto}`, h.energy !== undefined && `energy ${h.energy}`, !h.damageIds.length && 'UNMATCHED damage id'].filter(Boolean).join(', ');
      console.log(`      ${h.pct.at(-1)}% ${h.scaling.toUpperCase()} ×${h.count} · ${h.element} ${h.dmgType}${extra ? ` · ${extra}` : ''}`);
    }
  }
}
console.log('\n## Sequences');
c.sequences.forEach((s, i) => console.log(`S${i + 1} · ${s.name}: ${plain(s.description)}`));
console.log(`\n## Stat nodes\n${c.statNodes.map((n) => `${n.index}: ${n.stats.map((x) => `${x.stat} ${x.value}`).join(', ')}`).join(' | ')}`);

console.log('\n## Engine coverage');
console.log(coverage(c.name));
console.log('Mechanics it triggers (guess from text):', guessMechanics(c).join(', ') || 'none');
const labels = c.skills.flatMap((s) => s.rows.map((r) => r.label));
for (const e of KITS[c.name] ?? []) {
  const dead = e.appliesTo?.rows && !labels.some((l) => e.appliesTo!.rows!.test(l));
  console.log(`  ${dead ? 'NO ROW MATCH ' : ''}S${e.seq}${e.team ? ' team' : ''} ${e.id}: ${e.text}`);
}
for (const e of TEAM_KITS[c.name] ?? []) console.log(`  team-kit ${e.id}: ${e.text}`);
for (const x of [...(NOT_MODELLED[c.name] ?? []), ...(TEAM_NOT_MODELLED[c.name] ?? [])]) console.log(`  NOT MODELLED: ${x}`);
