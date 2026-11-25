import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { GameData, SkillKind, StatKey } from '../data/types';
import type { Build, EchoPiece, ModKey, Teammate } from '../engine/types';
import { uniformRes } from '../engine/enemy';

/**
 * Build <-> short URL code. The build is packed into positional arrays (ids and numbers, no key names),
 * then lz-compressed. Version prefix "1" lets old links keep working if the format changes.
 */
const VERSION = '1';
const KINDS: SkillKind[] = ['Normal', 'Skill', 'Forte', 'Liberation', 'Intro', 'Outro', 'Inherent', 'TuneBreak'];
const ELEMENTS = ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'Physical'] as const;

type Packed = [
  number, // character
  number, // sequence
  [number, number][], // skill levels that aren't 10: [kind index, level]
  [number, number], // weapon id, rank
  ([number, number, string, [string, number][]] | 0)[], // echoes: id, set, main stat, subs
  [string, boolean | number][], // conditions
  ([number, number, number, number, string, string, [string, number, string][]] | 0)[] | 0, // team (0 = never set)
  [number, number[]] | 0, // enemy: level, RES in ELEMENTS order
  number[]?, // stat nodes switched off (optional: older links don't have it)
];

export function encodeBuild(b: Build): string {
  const packed: Packed = [
    b.characterId,
    b.sequence,
    Object.entries(b.skillLevels).filter(([, l]) => l !== 10).map(([k, l]) => [KINDS.indexOf(k as SkillKind), l!]),
    [b.weapon.id, b.weapon.rank],
    b.echoes.map((p) => (p ? [p.echoId, p.setId, p.main.stat, p.subs.map((s) => [s.stat, s.value])] : 0)),
    Object.entries(b.conditions),
    b.team === undefined ? 0 : b.team.map((t) => (t ? [t.characterId, t.sequence, t.weapon?.id ?? 0, t.weapon?.rank ?? 1, t.mainEcho ?? '', t.set ?? '', t.custom.map((c) => [c.key, c.value, c.label])] : 0)),
    b.enemy ? [b.enemy.level, ELEMENTS.map((e) => b.enemy!.res[e] ?? 0)] : 0,
    ...(b.nodesOff?.length ? [b.nodesOff] : []),
  ] as Packed;
  return VERSION + compressToEncodedURIComponent(JSON.stringify(packed));
}

/** null when the code is broken or refers to things this data version doesn't have. */
export function decodeBuild(code: string, data: GameData): Build | null {
  try {
    if (!code.startsWith(VERSION)) return null;
    const json = decompressFromEncodedURIComponent(code.slice(VERSION.length));
    if (!json) return null;
    const [cid, seq, levels, [wid, rank], echoes, conditions, team, enemy, nodesOff] = JSON.parse(json) as Packed;
    const c = data.characters.find((x) => x.id === cid);
    if (!c || !data.weapons.some((w) => w.id === wid)) return null;
    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
    const main = (cost: number, stat: string) =>
      data.echoStats.main[String(cost) as '1' | '3' | '4']?.find((m) => m.stat === stat);
    return {
      characterId: cid,
      sequence: clamp(seq, 0, 6),
      skillLevels: Object.fromEntries(levels.filter(([k]) => KINDS[k]).map(([k, l]) => [KINDS[k], clamp(l, 1, 10)])),
      weapon: { id: wid, rank: clamp(rank, 1, 5) },
      echoes: echoes.map((p): EchoPiece | null => {
        if (!p) return null;
        const [id, setId, stat, subs] = p;
        const e = data.echoes.find((x) => x.id === id);
        const m = e && main(e.cost, stat);
        if (!e || !m) return null;
        return { echoId: id, setId: e.sets.includes(setId) ? setId : e.sets[0], main: m, subs: subs.slice(0, 5).map(([s, v]) => ({ stat: s as StatKey, value: Number(v) })) };
      }).slice(0, 5),
      conditions: Object.fromEntries(conditions),
      team: team === 0 ? undefined : team.slice(0, 2).map((t): Teammate | null => {
        if (!t || !data.characters.some((x) => x.id === t[0])) return null;
        const [id, s, w, r, echo, set, custom] = t;
        return {
          characterId: id, sequence: clamp(s, 0, 6),
          weapon: w && data.weapons.some((x) => x.id === w) ? { id: w, rank: clamp(r, 1, 5) } : undefined,
          mainEcho: echo || undefined, set: set || undefined,
          custom: custom.map(([key, value, label]) => ({ key: key as ModKey, value: Number(value), label: String(label) })),
        };
      }),
      ...(nodesOff?.length ? { nodesOff: nodesOff.filter((n) => n === 4 || n === 5 || (n >= 9 && n <= 16)) } : {}),
      enemy: enemy ? { level: clamp(enemy[0], 1, 150), res: { ...uniformRes(0), ...Object.fromEntries(ELEMENTS.map((e, i) => [e, Number(enemy[1][i]) || 0])) } } : undefined,
    };
  } catch {
    return null;
  }
}

/** Full link for a build, on whatever host/base the app is served from. */
export const shareUrl = (b: Build) => `${location.origin}${location.pathname}#/s/${encodeBuild(b)}`;
