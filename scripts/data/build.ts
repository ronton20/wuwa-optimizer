/**
 * Turns the raw game tables in .cache/wuwa-data into one clean snapshot:
 *   src/data/wuwa-<version>.json  +  src/data/current.ts (points the app at it)
 *
 *   npm run data:build
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pickRoster } from './roster.ts';
import { SUB_ROLLS } from './echoRolls.ts';
import { addTextHits } from './textHits.ts';
import type {
  Character, DmgType, Echo, EchoStatTables, Element, GameData, HitTerm, NegativeStatus, Scaling, Sequence, Skill, SkillKind,
  SkillRow, Sonata, StatKey, StatNode, StatValue, StatusDef, Weapon, WeaponType,
} from '../../src/data/types.ts';

const DIR = resolve(process.env.WUWA_DATA_DIR ?? '.cache/wuwa-data');
const OUT = resolve('src/data');

// ---------- loading ----------
const load = <T = any>(p: string): T => JSON.parse(readFileSync(join(DIR, p), 'utf8'));

const text: Record<string, string> = {};
(function loadText(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) loadText(p);
    else if (f.endsWith('.json')) for (const e of JSON.parse(readFileSync(p, 'utf8'))) text[String(e.Id)] = e.Content;
  }
})(join(DIR, 'Textmaps/en'));
const T = (key: unknown) => (key == null ? '' : text[String(key)] ?? String(key));

// ---------- enums ----------
const ELEMENTS: Record<number, Element> = { 0: 'Physical', 1: 'Glacio', 2: 'Fusion', 3: 'Electro', 4: 'Aero', 5: 'Spectro', 6: 'Havoc' };
const WEAPON_TYPES: Record<number, WeaponType> = { 1: 'Broadblade', 2: 'Sword', 3: 'Pistols', 4: 'Gauntlets', 5: 'Rectifier' };
const SKILL_KINDS: Record<number, SkillKind> = { 1: 'Normal', 2: 'Skill', 3: 'Liberation', 4: 'Inherent', 5: 'Intro', 6: 'Forte', 11: 'Outro', 12: 'TuneBreak' };
// damage.json "Type" -> category. 0–4 verified by matching every skill row of the 4 launch characters
// (e.g. Qingxiao: Heavy rows = 1, Liberation = 2, Intro = 3, Resonance Skill = 4). 5/6 not yet verified.
const DMG_TYPES: Record<number, DmgType> = { 0: 'Basic', 1: 'Heavy', 2: 'Liberation', 3: 'Intro', 4: 'Skill', 5: 'Echo', 6: 'Outro' };
const SCALING: Record<number, Scaling> = { 7: 'atk', 2: 'hp', 10: 'def' };

// property id (mod 10000) -> stat key; hp/atk/def become *Pct when the value is a ratio
const PROP: Record<number, StatKey> = {
  2: 'hp', 7: 'atk', 10: 'def', 8: 'critRate', 9: 'critDmg', 11: 'energyRegen', 35: 'healing',
  14: 'dmgSkill', 15: 'dmgAll', 17: 'dmgBasic', 18: 'dmgHeavy', 19: 'dmgLib', 20: 'dmgIntro', 114: 'dmgEcho',
  21: 'dmgPhysical', 22: 'dmgGlacio', 23: 'dmgFusion', 24: 'dmgElectro', 25: 'dmgAero', 26: 'dmgSpectro', 27: 'dmgHavoc',
  99: 'defIgnore',
};
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Converts a raw game property into our stat. `raw` is in game units (1/10000 for %, plain for flat). */
function stat(propId: number, raw: number, isRatio: boolean): StatValue | null {
  const key = PROP[propId % 10000];
  if (!key) return null;
  if (key === 'hp' || key === 'atk' || key === 'def') {
    if (isRatio) return { stat: `${key}Pct` as StatKey, value: round(raw / 100, 2) };
    return { stat: key, value: raw };
  }
  return { stat: key, value: round(raw / 100, 2) };
}
/** For tables that store ratios as fractions (0.018 = 1.8%) with IsRatio=true. */
const propStat = (p: { Id: number; Value: number; IsRatio: boolean }) =>
  p.IsRatio ? stat(p.Id, p.Value * 10000, true) : stat(p.Id, p.Value, false);

// ---------- rich text ----------
/** Game markup -> our light markup: [c=Name]…[/c], with {0}{1} params filled in. */
function rich(raw: string, params: string[] = []): string {
  return raw
    .replace(/\{Cus:[^}]*?PC=([^ }]+)[^}]*\}/g, '$1')
    .replace(/\{Cus:Sap,S=([^ }]+) P=([^ }]+)[^}]*\}/g, '$2')
    .replace(/\{(\d+)\}/g, (_, i) => params[Number(i)] ?? `{${i}}`)
    .replace(/<size=\d+>(.*?)<\/size>/gs, '$1')
    .replace(/<te href=\d+>(.*?)<\/te>/gs, '$1')
    .replace(/<SapTag=\d+>(.*?)<\/SapTag>/gs, '$1')
    .replace(/<color=([A-Za-z]+)>(.*?)<\/color>/gs, '[c=$1]$2[/c]')
    .replace(/<\/?[a-z]+[^>]*>/gi, '')
    .replace(/\r/g, '')
    .trim();
}
const asset = (p?: string) => (p ? p.replace(/\.[^./]+$/, '') : ''); // drop the UE ".Name" suffix

// ---------- tables ----------
const roleInfo = load<any[]>('BinData/role/roleinfo.json');
const baseProps = new Map(load<any[]>('BinData/property/baseproperty.json').filter((p) => p.Lv === 1).map((p) => [p.Id, p]));
const roleGrowth = load<any[]>('BinData/property/rolepropertygrowth.json').find((g) => g.Level === 90 && g.BreachLevel === 6);
const weaponCurve = new Map<number, number>(
  load<any[]>('BinData/property/weaponpropertygrowth.json').filter((g) => g.Level === 90 && g.BreachLevel === 6).map((g) => [g.CurveId, g.CurveValue / 10000]),
);
const skills = load<any[]>('BinData/skill/skill.json');
const skillDesc = load<any[]>('BinData/skill/skilldescription.json');
const skillTree = load<any[]>('BinData/skillTree/skilltree.json');
const chain = load<any[]>('BinData/resonate_chain/resonantchain.json');
const damage = new Map(load<any[]>('BinData/damage/damage.json').map((d) => [d.Id, d]));

// ---------- characters ----------
const ROW_DMG = /^\s*[\d.]+%(\*\d+)?(\s*\+\s*[\d.]+%(\*\d+)?)*\s*$/;

function parseTerms(s: string): { pct: number; count: number }[] {
  return s.split('+').map((t) => {
    const m = t.trim().match(/^([\d.]+)%(?:\*(\d+))?$/)!;
    return { pct: Number(m[1]), count: m[2] ? Number(m[2]) : 1 };
  });
}

function buildSkill(s: any, charElement: Element, unmatched: string[]): Skill {
  const kind = SKILL_KINDS[s.SkillType];
  const dmgEntries = (s.DamageList ?? []).map((id: number) => damage.get(id)).filter(Boolean);
  const rows: SkillRow[] = skillDesc
    .filter((d) => d.SkillLevelGroupId === s.SkillLevelGroupId)
    .sort((a, b) => a.Order - b.Order)
    .map((d) => {
      const values: string[] = (d.SkillDetailNum?.[0]?.ArrayString ?? []).slice(0, 10);
      const label = T(d.AttributeName);
      const row: SkillRow = { label, values };
      if (values.length && values.every((v) => ROW_DMG.test(v)) && !/Cost|Regen|Cooldown|Duration|Increase|Bonus|Multiplier per|Healing|Shield/i.test(label) && !/\bSTA\b/.test(label)) {
        const perLevel = values.map(parseTerms);
        row.hits = perLevel[0].map((_, i) => {
          const pct = perLevel.map((lv) => lv[i]?.pct ?? 0);
          const lv10 = pct[pct.length - 1];
          // match this term to raw damage entries by their Lv10 multiplier
          const matches = dmgEntries.filter((e: any) => Math.abs((e.RateLv?.[values.length - 1] ?? -1) / 100 - lv10) < 0.006);
          const m = matches[0];
          if (!m) unmatched.push(`${s.Id} ${label} term ${i + 1} (${lv10}%)`);
          const term: HitTerm = {
            pct,
            count: perLevel[0][i].count,
            element: m ? ELEMENTS[m.Element] ?? charElement : charElement,
            scaling: m ? SCALING[m.RelatedProperty] ?? 'atk' : 'atk',
            dmgType: m ? DMG_TYPES[m.Type] ?? 'Other' : guessType(kind, label),
            damageIds: matches.map((e: any) => e.Id),
          };
          // Concerto and Resonance Energy per hit (the game stores them x100)
          if (m?.ElementPower?.[0]) term.concerto = m.ElementPower[0] / 100;
          if (m?.Energy?.[0]) term.energy = m.Energy[0] / 100;
          return term;
        });
      }
      return row;
    });
  return {
    id: s.Id,
    kind,
    name: T(s.SkillName),
    description: rich(T(s.SkillDescribe), (s.SkillDetailNum ?? []).map(String)),
    icon: asset(s.Icon),
    maxLevel: s.MaxSkillLevel,
    rows,
  };
}

function guessType(kind: SkillKind, label: string): DmgType {
  if (/^Heavy|Mid-air Plunging/i.test(label)) return 'Heavy';
  if (/^Basic|^Mid-air|^Dodge Counter/i.test(label)) return 'Basic';
  return ({ Normal: 'Basic', Skill: 'Skill', Liberation: 'Liberation', Intro: 'Intro', Outro: 'Outro', Forte: 'Other' } as Record<string, DmgType>)[kind] ?? 'Other';
}

const unmatched: string[] = [];
const textHits: string[] = [];
const characters: Character[] = pickRoster(roleInfo, T).map((id) => {
  const r = roleInfo.find((x) => x.Id === id)!;
  const tree = skillTree.filter((n) => n.NodeGroup === r.SkillTreeGroupId);
  const bp = baseProps.get(r.PropertyId);
  const element = ELEMENTS[r.ElementId];
  const charSkills = skills
    .filter((s) => s.SkillGroupId === r.SkillId && SKILL_KINDS[s.SkillType])
    .sort((a, b) => a.SortIndex - b.SortIndex || a.Id - b.Id)
    .map((s) => ({ ...buildSkill(s, element, unmatched), treeIndex: tree.find((n) => n.SkillId === s.Id)?.NodeIndex }));

  const sequences: Sequence[] = chain
    .filter((c) => c.GroupId === r.ResonantChainGroupId)
    .sort((a, b) => a.GroupIndex - b.GroupIndex)
    .map((c) => ({ index: c.GroupIndex, name: T(c.NodeName), description: rich(T(c.AttributesDescription), c.AttributesDescriptionParams), icon: asset(c.NodeIcon), buffIds: c.BuffIds }));

  const statNodes: StatNode[] = tree
    .filter((n) => n.NodeType === 4)
    .map((n) => ({ id: n.Id, index: n.NodeIndex, name: rich(T(n.PropertyNodeTitle)), stats: n.Property.map(propStat).filter(Boolean) as StatValue[], icon: asset(n.PropertyNodeIcon) }));

  const c: Character = {
    id,
    name: T(r.Name),
    element,
    weaponType: WEAPON_TYPES[r.WeaponType],
    rarity: r.QualityId,
    base: {
      // the game truncates each part separately, so keep decimals here and floor at display time
      hp: (bp.LifeMax * roleGrowth.LifeMaxRatio) / 10000,
      atk: (bp.Atk * roleGrowth.AtkRatio) / 10000,
      def: (bp.Def * roleGrowth.DefRatio) / 10000,
      critRate: bp.Crit / 100,
      critDmg: bp.CritDamage / 100,
      energyRegen: bp.EnergyEfficiency / 100,
    },
    skills: charSkills,
    sequences,
    statNodes,
    images: { icon: asset(r.RoleHeadIconLarge), card: asset(r.Card), portrait: asset(r.RolePortrait), stand: asset(r.FormationRoleCard) },
  };
  textHits.push(...addTextHits(c));
  return c;
});

// ---------- weapons ----------
const weaponReson = load<any[]>('BinData/weapon/weaponreson.json');
const weapons: Weapon[] = load<any[]>('BinData/weapon/weaponconf.json')
  .filter((w) => w.IsShow && w.QualityId >= 4 && WEAPON_TYPES[w.WeaponType])
  .map((w) => {
    const first = w.FirstPropId, second = w.SecondPropId;
    const c1 = weaponCurve.get(w.FirstCurve) ?? 1, c2 = weaponCurve.get(w.SecondCurve) ?? 1;
    const sub = second.IsRatio ? stat(second.Id, second.Value * 10000 * c2, true) : stat(second.Id, second.Value * c2, false);
    const resonName = weaponReson.find((x) => x.ResonId === w.ResonId && x.Level === 1)?.Name;
    const params: string[][] = (w.DescParams ?? []).map((p: any) => p.ArrayString);
    return {
      id: w.ItemId,
      name: T(w.WeaponName),
      type: WEAPON_TYPES[w.WeaponType],
      rarity: w.QualityId,
      baseAtk: first.Value * c1,
      substat: sub ?? { stat: 'atkPct', value: 0 },
      passive: {
        name: resonName ? T(resonName) : '',
        descriptions: [0, 1, 2, 3, 4].map((r) => rich(T(w.Desc), params.map((p) => p[r] ?? p[0]))),
      },
      icon: asset(w.Icon),
      iconBig: asset(w.IconBig),
    };
  })
  .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));

// ---------- echoes ----------
const rarityCost = new Map<number, 1 | 3 | 4>(load<any[]>('BinData/phantom/phantomrarity.json').map((r) => [r.Rare, r.Cost]));
const phantomSkills = new Map(load<any[]>('BinData/phantom/phantomskill.json').map((s) => [s.PhantomSkillId, s]));
const echoesById = new Map<number, Echo>();
for (const p of load<any[]>('BinData/phantom/phantomitem.json')) {
  if (p.QualityId !== 5 || echoesById.has(p.MonsterId)) continue;
  const sk = phantomSkills.get(p.SkillId);
  const lastLevel = sk?.LevelDescStrArray?.at(-1)?.ArrayString ?? [];
  const desc = sk ? rich(T(sk.DescriptionEx), lastLevel) : '';
  // the echo skill's hits: one per damage entry, at the highest rank; the element from the text when the entry has none
  const textElement = (desc.match(/\b(Glacio|Fusion|Electro|Aero|Spectro|Havoc|Physical) DMG/) ?? [])[1] as Element | undefined;
  const hits: HitTerm[] = (sk?.SettleIds ?? []).map((id: number) => damage.get(id)).filter(Boolean).map((d: any): HitTerm => ({
    pct: Array(10).fill((d.RateLv?.at(-1) ?? 0) / 100),
    count: 1,
    element: (d.Element ? ELEMENTS[d.Element] : undefined) ?? textElement ?? 'Physical',
    scaling: SCALING[d.RelatedProperty] ?? 'atk',
    dmgType: 'Echo',
    damageIds: [d.Id],
    ...(d.ElementPower?.[0] ? { concerto: d.ElementPower[0] / 100 } : {}),
    ...(d.Energy?.[0] ? { energy: d.Energy[0] / 100 } : {}),
  })).filter((h: HitTerm) => h.pct[0] > 0)
    // the text names each multiplier once; entries repeating one are variants of the same hit (charged / uncharged)
    .filter((h: HitTerm, i: number, all: HitTerm[]) => all.findIndex((x) => x.pct[0] === h.pct[0] && x.element === h.element) === i);
  // keep the hits the text talks about (others are hidden variants), unless that would leave none
  const textPcts = [...desc.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
  const named = hits.filter((h) => textPcts.some((p) => Math.abs(p - h.pct[0]) < 0.02));
  if (named.length) hits.splice(0, hits.length, ...named);
  echoesById.set(p.MonsterId, {
    id: p.MonsterId,
    name: T(p.MonsterName),
    cost: rarityCost.get(p.Rarity) ?? 1,
    sets: p.FetterGroup ?? [],
    skill: { description: desc, cooldown: sk?.SkillCD, ...(hits.length ? { hits } : {}) },
    icon: asset(p.Icon),
    iconBig: asset(p.IconBig),
  });
}
const echoes = [...echoesById.values()].filter((e) => e.name && !e.name.startsWith('MonsterInfo_')).sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
// "Phantom: X" skins drop the same sets as X in game, but the table often lists fewer for them
for (const e of echoes) {
  const base = e.name.startsWith('Phantom: ') && echoes.find((x) => x.name === e.name.slice('Phantom: '.length));
  if (base) e.sets = [...new Set([...base.sets, ...e.sets])].sort((a, b) => a - b);
}

// ---------- echo main stats (5-star, +25) ----------
const mainProp = load<any[]>('BinData/phantom/phantommainproperty.json');
const mainItem = new Map(load<any[]>('BinData/phantom/phantommainpropitem.json').map((m) => [m.Id, m]));
const growth25 = load<any[]>('BinData/phantom/phantomgrowth.json').find((g) => g.GrowthId === 1 && g.Level === 25)!.Value / 10000;
const mainOf = (itemId: number) => {
  const m = mainItem.get(itemId);
  return stat(m.PropId, m.StandardProperty * growth25, m.AddType === 2)!;
};
const groupFor: Record<'1' | '3' | '4', number> = { '4': 501, '3': 502, '1': 503 };
const echoStats: EchoStatTables = { main: { '1': [], '3': [], '4': [] }, fixed: {} as EchoStatTables['fixed'], subRolls: SUB_ROLLS };
for (const cost of ['1', '3', '4'] as const) {
  const groups = mainProp.filter((g) => g.RandGroupId === groupFor[cost]);
  echoStats.main[cost] = groups.map((g) => mainOf(g.PropGroup[0]));
  echoStats.fixed[cost] = mainOf(groups[0].PropGroup[1]);
}

// ---------- sonata sets ----------
const fetters = new Map(load<any[]>('BinData/phantom/phantomfetter.json').map((f) => [f.Id, f]));
const sonatas: Sonata[] = load<any[]>('BinData/phantom/phantomfettergroup.json')
  .map((g) => ({
    id: g.Id,
    name: T(g.FetterGroupName),
    icon: asset(g.FetterElementPath),
    effects: (g.FetterMap ?? []).map((kv: any) => {
      const f = fetters.get(kv.Value);
      return { pieces: kv.Key, description: rich(T(f.EffectDescription), f.EffectDescriptionParam), stats: (f.AddProp ?? []).map(propStat).filter(Boolean), buffIds: f.BuffIds ?? [] };
    }),
  }))
  .filter((s) => s.name && !s.name.startsWith('PhantomFetter_'));

// ---------- Negative Statuses ----------
// The base buff each status puts on the target (ExtraEffectID = its abnormal id, which is also its damage.json
// entry) holds the per-stack tables as "1#3000 | 2#5439 | …" in ‱. Which parameter is the damage table was read
// against the in-game explanations (Glacio Chafe's 1st/2nd are slow and freeze time; Electro Flare's 4th).
// The level base is AbnormalDamageConfig, the same for every status.
const perStack = (s: string) => s.split('|').reduce<number[]>((out, kv) => { const [k, v] = kv.trim().split('#').map(Number); out[k - 1] = v / 100; return out; }, []);
const buffs = new Map(load<any[]>('BinData/buff/buff.json').map((b) => [b.Id, b]));
const STATUS_BUFF: Record<NegativeStatus, { buff: number; param?: number; def?: true }> = {
  'Glacio Chafe': { buff: 10010000, param: 2 }, 'Glacio Bite': { buff: 10011100, param: 0 }, 'Fusion Burst': { buff: 10020000, param: 0 },
  'Electro Flare': { buff: 10030000, param: 3 }, 'Aero Erosion': { buff: 10040000, param: 0 }, 'Spectro Frazzle': { buff: 10050000, param: 0 },
  'Havoc Bane': { buff: 10060000, def: true },
};
const statuses = Object.fromEntries(Object.entries(STATUS_BUFF).map(([name, s]) => {
  const b = buffs.get(s.buff);
  if (!b) throw new Error(`Negative Status buff ${s.buff} (${name}) missing from buff.json`);
  const table = perStack(b.ExtraEffectParameters[s.param ?? 0]);
  const def: StatusDef = {
    element: ELEMENTS[damage.get(b.ExtraEffectID)?.Element],
    maxStacks: b.StackLimitCount, duration: round(b.DurationMagnitude?.[0] ?? 0, 2), period: b.Period,
    tickOnApply: b.Period > 0 && b.bExecutePeriodicEffectOnApplication, dmg: s.def ? [] : table, ...(s.def ? { def: table } : {}),
  };
  return [name, def];
})) as Record<NegativeStatus, StatusDef>;
const abnormal = load<any[]>('BinData/AbnormalDamage/abnormaldamageconfig.json');
const levelBase: number[] = [0];
for (const row of abnormal) {
  const cols = Object.keys(row).filter((k) => k.startsWith('Abnormal')).map((k) => row[k]);
  if (new Set(cols).size > 1) console.warn(`Negative Status level base differs by status at Lv ${row.Level}: ${cols.join(', ')} (using the first)`);
  levelBase[row.Level] = cols[0];
}

// ---------- write ----------
const commitMsg = (() => { try { return execFileSync('git', ['log', '-1', '--format=%s'], { cwd: DIR }).toString().trim(); } catch { return ''; } })();
const gameVersion = commitMsg.match(/GameVer ([\d.]+)/)?.[1] ?? 'unknown';
const data: GameData = {
  meta: { gameVersion, dataCommit: commitMsg, builtAt: new Date().toISOString().slice(0, 10), source: 'github.com/Arikatsu/WutheringWaves_Data' },
  characters, weapons, echoes, sonatas, echoStats,
  negativeStatus: { levelBase, statuses },
};
const file = `wuwa-${gameVersion}.json`;
writeFileSync(join(OUT, file), JSON.stringify(data));
writeFileSync(join(OUT, 'current.ts'), `// Generated by scripts/data/build.ts — do not edit.\nimport data from './${file}';\nimport type { GameData } from './types';\nexport default data as unknown as GameData;\n`);

console.log(`Wrote src/data/${file}: ${characters.length} characters, ${weapons.length} weapons, ${echoes.length} echoes, ${sonatas.length} sonata sets.`);
console.log(`\n${textHits.length} hits added from the kit text (no Skill Detail row):\n  ${textHits.join('\n  ')}`);
if (unmatched.length) console.log(`\n${unmatched.length} damage terms not matched to a damage entry (they use the skill's default element/type):\n  ${unmatched.join('\n  ')}`);
