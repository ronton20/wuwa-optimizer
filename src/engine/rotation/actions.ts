import type { Character, GameData, Skill, SkillKind } from '../../data/types';

/**
 * Buttons and the machines that turn button presses into what the game actually does.
 * Every Resonator has the same buttons (Basic, Heavy, Skill, Liberation, Echo) plus a few special ones
 * (Hiyuki's Iai); a press becomes whatever that button does right now (Heavy with full Whiteout
 * Bitterfrost is Bitterfrost). The rotation shows the press; the math uses the real move.
 */

/** Things that happen in a rotation; timed buffs start on them. */
export type GameEvent = 'basic' | 'heavy' | 'skill' | 'liberation' | 'echo' | 'intro' | 'outro' | 'forte';

export interface Button { id: string; label: string; kind: SkillKind; hint?: string }

export interface RowRef {
  skillKind: SkillKind;
  row: string;
  /** extra multiplier from another row, `times` over (Hiyuki: Blade Liberation's bonus per Snowforged Blade) */
  bonus?: { row: string; times: number };
  /** the row hits this many times in the move (Lucilla: one Oblivion per Photo) */
  times?: number;
}

/** A choice on one press (Lucilla's Skill: Spotlight or Compensate; Hiyuki: how many Snowforged Blades). */
export interface Choice { label: string; options: string[]; value: number }

/** One resolved move: what it hits with, how long it takes, what it triggers. */
export interface Move {
  /** what's shown: "Heavy Attack - Bitterfrost: Foreclaimed Self" */
  label: string;
  /** the skill it belongs to (its icon) */
  kind: SkillKind;
  rows: RowRef[];
  timing: TimingKind;
  events: GameEvent[];
  /** a skill cast: the skill's own Concerto Regen / Resonance Cost rows apply */
  cast?: boolean;
  /** something isn't right (a resource is missing); the move is still counted */
  warn?: string;
  /** Concerto the kit text gives on top of the data ("Spotlight restores 20 Concerto") */
  concerto?: number;
  /** a choice the step can change */
  choice?: Choice;
  /** numbers buffs can depend on (Suisui's Outro: Floral Epistle spent) */
  tags?: Record<string, number>;
  /** default time when it isn't one action of its kind (Lucilla's whole held Tracing Forms string) */
  seconds?: number;
  /** stack counts this move sets for its own hits, by effect id (Lucilla S6: Remembrance = Photos spent) */
  levels?: Record<string, number>;
  /** Glacio Chafe stacks the move inflicts on the target */
  chafe?: number;
  /** consumes 10 Glacio Bite to trigger Frostbind when the target has 10+ (Hiyuki: Inward Vision, Iai) */
  frostbind?: boolean;
}

/** Glacio Chafe each damage row inflicts, from the kit texts (Hiyuki's checked against her in-game sheet). */
export const CHAFE_ROWS: Record<string, Record<string, number>> = {
  Hiyuki: {
    'Basic Attack - Present Self Stage 3 DMG': 1, 'Heavy Attack - Frost Splinter: Present Self DMG': 1, 'Foreclaiming: Inward Vision DMG': 4,
    'Skill DMG': 1, 'Basic Attack - Foreclaimed Self Stage 3 DMG': 1, 'Basic Attack - Foreclaimed Self Stage 4 DMG': 1, 'Basic Attack - Foreclaimed Self Stage 5 DMG': 1,
    'Mid-air Attack - Foreclaimed Self Stage 2 DMG': 1, 'Mid-air Plunging Attack - Foreclaimed Self DMG': 1, 'Heavy Attack - Bitterfrost: Foreclaimed Self DMG': 1,
  },
  Lucilla: { 'Clip It DMG': 1, 'Clip It: Hard Cut DMG': 1 },
  Suisui: { 'Awakening Spring DMG': 1, 'Skill DMG': 1, 'Basic Attack - Drizzle Stance Stage 4 DMG': 1 },
};

export type TimingKind = 'basic' | 'heavy' | 'skill' | 'liberation' | 'echo' | 'intro' | 'outro' | 'forte' | 'dodge' | 'air';

/** Combo position plus whatever the kit tracks (forms, resources). */
export interface MachineState {
  stage: number;
  family: string;
  form?: string;
  next?: number;
  res?: Record<string, number>;
  /** in the air (some moves launch, some only work airborne, plunges land) */
  air?: boolean;
}

export interface Machine {
  /** the buttons: Basic, Heavy, Skill, Liberation, Echo, then specials */
  buttons: Button[];
  /** every damaging move, for anything the buttons don't reach */
  exact: Button[];
  initial: () => MachineState;
  /** `option`: the step's pick for the move's choice (undefined = the default) */
  press: (s: MachineState, button: string, option?: number) => { move: Move; state: MachineState };
  /** state after being switched out (combos and stances reset) */
  swappedOut: (s: MachineState) => MachineState;
  /** resources worth showing ("Dedication 200") */
  gauges?: (s: MachineState) => { label: string; value: number; max: number }[];
}

const STAGE = /^(.*?) Stage (\d+)(?: DMG)?$/;
const TYPED = /^(Basic Attack|Heavy Attack|Mid-air|Plunging|Dodge|Resonance Skill|Resonance Liberation|Intro Skill|Outro Skill|Echo Skill)\b/;
const PREFIX: Record<SkillKind, string> = {
  Normal: 'Normal Attack', Skill: 'Resonance Skill', Liberation: 'Resonance Liberation', Forte: 'Forte Circuit', Intro: 'Intro Skill', Outro: 'Outro Skill',
} as Record<SkillKind, string>;

/** "Type - Name" for a damage row: "Resonance Liberation - Foreclaiming: Inward Vision", "Intro Skill - Frostedge". */
export function moveName(skill: Pick<Skill, 'kind' | 'name'>, rowLabel?: string) {
  const base = (rowLabel ?? '').replace(/ DMG$/, '').trim();
  if (TYPED.test(base)) return base;
  if (!base || /^(Skill|DMG|Skill DMG)$/i.test(base)) return `${PREFIX[skill.kind] ?? skill.kind} - ${skill.name}`;
  return `${PREFIX[skill.kind] ?? skill.kind} - ${base}`;
}

/** The skill a row belongs to. */
export function skillOfRow(c: Character, ref: RowRef) {
  return c.skills.find((s) => s.kind === ref.skillKind && s.rows.some((r) => r.label === ref.row));
}

const rowsOf = (c: Character, kind: SkillKind) => c.skills.filter((s) => s.kind === kind).flatMap((s) => s.rows.filter((r) => r.hits?.length).map((r) => r.label));
const ref = (skillKind: SkillKind, row: string): RowRef => ({ skillKind, row });

/** A move from rows (named after its first row), or from a skill when it has no damage of its own. */
function mk(c: Character, kind: SkillKind, rows: RowRef[], timing: TimingKind, events: GameEvent[], extra: Partial<Move> = {}): Move {
  const skill = (rows[0] && skillOfRow(c, rows[0])) || c.skills.find((s) => s.kind === kind) || { kind, name: kind };
  const label = rows.length ? [...new Set(rows.map((r) => moveName(skillOfRow(c, r) ?? skill, r.row)))].join(' + ') : moveName(skill);
  return { label, kind: (skill as Skill).kind ?? kind, rows, timing, events, ...extra };
}

/** Combo families of a skill kind ("Basic Attack - Present Self" → [Stage 1, 2, 3]). */
function families(c: Character, kind: SkillKind) {
  const out = new Map<string, string[]>();
  for (const label of rowsOf(c, kind)) {
    const m = label.match(STAGE);
    if (!m) continue;
    const list = out.get(m[1]) ?? [];
    list[Number(m[2]) - 1] = label;
    out.set(m[1], list);
  }
  return out;
}

function timingOf(kind: SkillKind, label: string): TimingKind {
  if (kind === 'Liberation') return 'liberation';
  if (kind === 'Skill') return 'skill';
  if (kind === 'Intro') return 'intro';
  if (kind === 'Outro') return 'outro';
  if (/^Heavy/.test(label)) return 'heavy';
  if (/^Dodge/.test(label)) return 'dodge';
  if (/^Mid-air|Plunging/.test(label)) return 'air';
  return kind === 'Forte' ? 'forte' : 'basic';
}
const eventOf = (t: TimingKind): GameEvent => (t === 'dodge' || t === 'air' ? 'basic' : t);

/** Every damaging move of a Resonator, typed: "Resonance Skill - Awakening Spring". */
function exactButtons(c: Character): Button[] {
  const kinds: SkillKind[] = ['Normal', 'Skill', 'Liberation', 'Forte', 'Intro', 'Outro'];
  return kinds.flatMap((k) => c.skills.filter((s) => s.kind === k).flatMap((s) =>
    s.rows.filter((r) => r.hits?.length).map((r) => ({ id: `row:${k}|${r.label}`, label: moveName(s, r.label), kind: k }))));
}

function exactPress(c: Character, id: string): Move {
  const [kind, label] = id.slice(4).split('|') as [SkillKind, string];
  const timing = timingOf(kind, label);
  return mk(c, kind, [ref(kind, label)], timing, [eventOf(timing)]);
}

const BASE_BUTTONS: Button[] = [
  { id: 'basic', label: 'Basic Attack', kind: 'Normal' },
  { id: 'heavy', label: 'Heavy Attack', kind: 'Normal' },
  { id: 'skill', label: 'Resonance Skill', kind: 'Skill' },
  { id: 'liberation', label: 'Resonance Liberation', kind: 'Liberation' },
  { id: 'echo', label: 'Echo Skill', kind: 'Normal', hint: 'Main echo (its own hit is not counted yet)' },
];

/** Works for every Resonator: Basic cycles the first combo, the others use their skill's first move. */
export function genericMachine(c: Character): Machine {
  const fam = families(c, 'Normal');
  const basic = [...fam.entries()].find(([k]) => /^Basic Attack/.test(k)) ?? [...fam.entries()][0];
  const first = (kind: SkillKind, re?: RegExp) => rowsOf(c, kind).find((l) => !re || re.test(l));
  const heavy = first('Normal', /^Heavy Attack/);
  const skill = first('Skill');
  const lib = first('Liberation');
  const reset: MachineState = { stage: 0, family: '' };
  return {
    buttons: BASE_BUTTONS,
    exact: exactButtons(c),
    initial: () => ({ ...reset }),
    swappedOut: () => ({ ...reset }),
    press: (s, b) => {
      if (b === 'basic') {
        if (!basic) return { move: mk(c, 'Normal', [], 'basic', ['basic'], { label: 'Basic Attack', warn: 'No Basic Attack damage in the game data' }), state: s };
        const stages = basic[1].filter(Boolean);
        const n = s.family === basic[0] ? s.stage % stages.length : 0;
        return { move: mk(c, 'Normal', [ref('Normal', stages[n])], 'basic', ['basic']), state: { stage: n + 1, family: basic[0] } };
      }
      if (b === 'heavy') return { move: mk(c, 'Normal', heavy ? [ref('Normal', heavy)] : [], 'heavy', ['heavy'], heavy ? {} : { label: 'Heavy Attack' }), state: { ...reset } };
      if (b === 'skill') return { move: mk(c, 'Skill', skill ? [ref('Skill', skill)] : [], 'skill', ['skill'], { cast: true }), state: { ...reset } };
      if (b === 'liberation') return { move: mk(c, 'Liberation', lib ? [ref('Liberation', lib)] : [], 'liberation', ['liberation'], { cast: true }), state: { ...reset } };
      if (b === 'intro') return { move: mk(c, 'Intro', rowsOf(c, 'Intro').map((r) => ref('Intro', r)), 'intro', ['intro'], { cast: true }), state: { ...reset } };
      // the Outro leaves forms and resources as they are
      if (b === 'outro') return { move: mk(c, 'Outro', rowsOf(c, 'Outro').map((r) => ref('Outro', r)), 'outro', ['outro']), state: s };
      if (b === 'echo') return { move: { label: 'Echo Skill', kind: 'Normal', rows: [], timing: 'echo', events: ['echo'] }, state: s };
      if (b.startsWith('row:')) return { move: exactPress(c, b), state: { ...reset } };
      return { move: { label: b, kind: 'Normal', rows: [], timing: 'basic', events: [] }, state: s };
    },
  };
}

/**
 * Frostheart each Foreclaimed Self move restores. The game doesn't publish these; they're set so that the
 * in-game check (0 after Inward Vision → Basic ×5 + Jade Cleave + Petalfall → 300) holds. Change freely.
 */
export const FROSTHEART_GAIN = { basic: 30, heavy: 30, skill: 75, air: 30, dodge: 30 };

/**
 * Hiyuki (checked against her in-game rotation).
 * Present Self: Intro +200 Dedication and chains into Basic 3 (+100; +200 after her Skill), Frost Splinter at 300
 * Dedication unlocks Inward Vision, which enters Foreclaimed Self with 3 Frostharden Iai and 0 Frostheart.
 * Foreclaimed Self: Basics and skills restore Frostheart; Skill is Jade Cleave, then Petalfall right after it;
 * Iai costs 100 Frostheart and turns 1 Frostharden Iai into 1 Whiteout Bitterfrost; Heavy at 3 Whiteout Bitterfrost
 * is Bitterfrost (+1 Snowforged Blade); Blade Liberation spends as many Blades as chosen and returns to Present Self.
 */
function hiyukiMachine(c: Character, sequence = 0): Machine {
  const g = genericMachine(c);
  const present = [1, 2, 3].map((n) => `Basic Attack - Present Self Stage ${n} DMG`);
  const fore = [1, 2, 3, 4, 5].map((n) => `Basic Attack - Foreclaimed Self Stage ${n} DMG`);
  const R = (s: MachineState) => ({ dedication: 0, frostheart: 0, iai: 0, bitterfrost: 0, blades: 0, enhanced: 0, ready: 0, bonus: 0, s1: 0, ...s.res });
  // S2: out of combat for 4s (the start of a fight) restores 3 Snowforged Blade, and the next 2 Jade Cleave /
  // Petalfall restore 50 more Frostheart each
  const start: Record<string, number> = sequence >= 2 ? { blades: 3, bonus: 2 } : {};
  const m = (kind: SkillKind, row: string, timing: TimingKind, events: GameEvent[], extra: Partial<Move> = {}) => mk(c, kind, [ref(kind, row)], timing, events, extra);
  const hints: Record<string, string> = {
    basic: 'In the air: mid-air attacks (the last one plunges and lands)',
    heavy: 'Frost Splinter (Present Self, 300 Dedication) · thrust, or Bitterfrost at 3 Whiteout Bitterfrost (Foreclaimed Self, lands first)',
    skill: 'Present Self skill · Foreclaimed Self: Jade Cleave on the ground (launches her), Petalfall in the air',
    liberation: 'Inward Vision (enters Foreclaimed Self) · Blade Liberation (pick how many Snowforged Blades)',
  };
  return {
    buttons: [
      ...BASE_BUTTONS.slice(0, 4).map((b) => ({ ...b, hint: hints[b.id] })),
      BASE_BUTTONS[4],
      { id: 'iai', label: 'Iai', kind: 'Forte', hint: 'Basic Attack - Iai (Foreclaimed Self): 100 Frostheart; turns 1 Frostharden Iai into 1 Whiteout Bitterfrost' },
    ],
    exact: g.exact,
    initial: () => ({ stage: 0, family: 'present', form: 'present', res: R({ stage: 0, family: '', res: start }) }),
    swappedOut: (s) => ({ stage: 0, family: s.form ?? 'present', form: s.form, res: { ...R(s), enhanced: 0 } }),
    gauges: (s) => {
      const r = R(s);
      return s.form === 'fore'
        ? [{ label: 'Frostheart', value: r.frostheart, max: 300 }, { label: 'Frostharden Iai', value: r.iai, max: 3 }, { label: 'Whiteout Bitterfrost', value: r.bitterfrost, max: 3 }, { label: 'Snowforged Blade', value: r.blades, max: 3 }]
        : [{ label: 'Dedication', value: r.dedication, max: 300 }, { label: 'Snowforged Blade', value: r.blades, max: 3 }];
    },
    press: (s, b, option) => {
      const form = s.form ?? 'present';
      const r = R(s);
      // moves land her unless they say otherwise (air: true)
      const keep = (patch: Partial<MachineState>, res: Partial<typeof r> = {}): MachineState => ({ stage: 0, family: form, form, air: false, ...patch, res: { ...r, ...res } });
      const ded = (n: number) => Math.min(300, r.dedication + n);
      const heart = (n: number) => Math.min(300, r.frostheart + n);
      if (b === 'basic' && s.air) {
        // mid-air: Present Self plunges; Foreclaimed Self does 2 mid-air attacks, then the plunge lands her
        if (form === 'present') return { move: m('Normal', 'Mid-air Attack - Present Self DMG', 'air', ['basic']), state: keep({}) };
        const n = s.family === 'fore-air' ? s.stage : 0;
        const row = n < 2 ? `Mid-air Attack - Foreclaimed Self Stage ${n + 1} DMG` : 'Mid-air Plunging Attack - Foreclaimed Self DMG';
        return { move: m('Normal', row, 'air', ['basic']), state: n < 2 ? keep({ stage: n + 1, family: 'fore-air', air: true }, { frostheart: heart(FROSTHEART_GAIN.air) }) : keep({}, { frostheart: heart(FROSTHEART_GAIN.air) }) };
      }
      if (b === 'basic') {
        const list = form === 'fore' ? fore : present;
        const n = s.next !== undefined ? s.next : s.family === form ? s.stage % list.length : 0;
        // S1: after Inward Vision, Foreclaimed Basic 1 and 2 also inflict Glacio Chafe
        const s1 = form === 'fore' && n < 2 && (r.s1 ?? 0) > 0;
        if (form === 'fore') return { move: m('Normal', list[n], 'basic', ['basic'], s1 ? { chafe: 1 } : {}), state: keep({ stage: n + 1 }, { frostheart: heart(FROSTHEART_GAIN.basic), ...(s1 ? { s1: r.s1 - 1 } : {}) }) };
        const third = n === 2;
        return { move: m('Normal', list[n], 'basic', ['basic']), state: keep({ stage: n + 1 }, third ? { dedication: ded(r.enhanced ? 200 : 100), enhanced: 0 } : {}) };
      }
      if (b === 'heavy') {
        if (form === 'fore') {
          return r.bitterfrost >= 3
            ? { move: m('Normal', 'Heavy Attack - Bitterfrost: Foreclaimed Self DMG', 'heavy', ['heavy']), state: keep({}, { bitterfrost: 0, blades: Math.min(3, r.blades + 1) }) }
            // the thrust chains into Stage 2
            : { move: m('Normal', 'Heavy Attack - Foreclaimed Self DMG', 'heavy', ['heavy']), state: keep({ next: 1 }, { frostheart: heart(FROSTHEART_GAIN.heavy) }) };
        }
        const warn = r.dedication < 300 ? `Frost Splinter needs 300 Dedication (has ${r.dedication})` : undefined;
        return { move: m('Normal', 'Heavy Attack - Frost Splinter: Present Self DMG', 'heavy', ['heavy'], { warn }), state: keep({}, { dedication: 0, ready: 1 }) };
      }
      if (b === 'skill') {
        if (form === 'fore') {
          // Jade Cleave on the ground launches her; in the air the Skill is Petalfall
          const gain = { frostheart: heart(FROSTHEART_GAIN.skill + (r.bonus > 0 ? 50 : 0)), bonus: Math.max(0, r.bonus - 1) };
          return s.air
            ? { move: m('Skill', 'Frostblight: Petalfall DMG', 'skill', ['skill']), state: keep({}, gain) }
            : { move: m('Skill', 'Frostblight: Jade Cleave DMG', 'skill', ['skill']), state: keep({ air: true }, gain) };
        }
        return { move: m('Skill', 'Resonance Skill - Present Self DMG', 'skill', ['skill']), state: keep({ next: 2 }, { enhanced: 1 }) };
      }
      if (b === 'liberation') {
        if (form === 'fore') {
          const used = Math.min(r.blades, option ?? r.blades);
          const row: RowRef = { skillKind: 'Liberation', row: 'Foreclaiming: Blade Liberation Base DMG', ...(used ? { bonus: { row: 'Total Foreclaiming: Blade Liberation DMG Increase per Snowforged Blade', times: used } } : {}) };
          const choice: Choice = { label: 'Snowforged Blades used', options: Array.from({ length: r.blades + 1 }, (_, i) => String(i)), value: used };
          return {
            move: { ...mk(c, 'Liberation', [row], 'liberation', ['liberation'], { cast: true, choice }), label: `Resonance Liberation - Foreclaiming: Blade Liberation (${used} Snowforged Blade${used === 1 ? '' : 's'})` },
            state: { stage: 0, family: 'present', form: 'present', res: { ...r, blades: r.blades - used, iai: 0, bitterfrost: 0, dedication: 0, frostheart: 0 } },
          };
        }
        const warn = r.ready ? undefined : 'Inward Vision becomes available after Frost Splinter';
        return { move: m('Liberation', 'Foreclaiming: Inward Vision DMG', 'liberation', ['liberation'], { cast: true, warn, frostbind: true }), state: { stage: 0, family: 'fore', form: 'fore', res: { ...r, ready: 0, iai: 3, dedication: 0, frostheart: 0, s1: sequence >= 1 ? 2 : 0 } } };
      }
      if (b === 'iai') {
        // Iai is a dash: she stays where she is (ground or air)
        const warn = form !== 'fore' ? 'Iai is only in Foreclaimed Self' : r.frostheart < 100 ? `Iai needs 100 Frostheart (has ${r.frostheart})` : undefined;
        const res = { frostheart: Math.max(0, r.frostheart - 100), ...(r.iai > 0 ? { iai: r.iai - 1, bitterfrost: Math.min(3, r.bitterfrost + 1) } : {}) };
        return { move: m('Forte', 'Basic Attack - Iai DMG', 'forte', ['basic', 'forte'], { warn, chafe: r.iai > 0 ? 3 : 0, frostbind: true }), state: keep({ air: !!s.air }, res) };
      }
      if (b === 'intro') {
        return { move: mk(c, 'Intro', [ref('Intro', 'Skill DMG')], 'intro', ['intro'], { cast: true }), state: keep({ next: form === 'fore' ? 1 : 2 }, form === 'present' ? { dedication: ded(200) } : {}) };
      }
      return g.press(s, b);
    },
  };
}

/**
 * Suisui. Zephyr Stance: 4-stage Basic fills Cloud Breath (30 each, max 120); Skill at full Cloud Breath is Awakening
 * Spring and enters Drizzle Stance (so does her Intro). Drizzle Stance: 4-stage Basic, 150 Floral Epistle each (max 600).
 * Her Outro spends all Floral Epistle (its buffs depend on how much) and leaves Drizzle Stance.
 */
function suisuiMachine(c: Character, sequence = 0): Machine {
  const g = genericMachine(c);
  const zephyr = rowsOf(c, 'Normal').filter((l) => /^Basic Attack - Zephyr Stance ?Stage \d/.test(l)).sort((a, b) => Number(a.match(/Stage (\d)/)![1]) - Number(b.match(/Stage (\d)/)![1]));
  const drizzle = [1, 2, 3, 4].map((n) => `Basic Attack - Drizzle Stance Stage ${n} DMG`);
  const R = (s: MachineState) => ({ cloud: 0, epistle: 0, kingfisher: 0, ...s.res });
  return {
    buttons: [...BASE_BUTTONS.map((b) => ({ ...b, hint: ({ basic: 'Zephyr Stance: +30 Cloud Breath · Drizzle Stance: +150 Floral Epistle', skill: 'Awakening Spring at full Cloud Breath (enters Drizzle Stance)' } as Record<string, string>)[b.id] ?? b.hint }))],
    exact: g.exact,
    initial: () => ({ stage: 0, family: 'zephyr', form: 'zephyr', res: { cloud: 0, epistle: 0 } }),
    // switching ends Kingfisher (S3)
    swappedOut: (s) => ({ ...s, stage: 0, next: undefined, res: { ...R(s), kingfisher: 0 } }),
    gauges: (s) => s.form === 'drizzle' ? [{ label: 'Floral Epistle', value: R(s).epistle, max: 600 }] : [{ label: 'Cloud Breath', value: R(s).cloud, max: 120 }],
    press: (s, b) => {
      const form = s.form ?? 'zephyr';
      const r = R(s);
      const at = (f: string, patch: Partial<MachineState>, res: Partial<typeof r> = {}): MachineState => ({ stage: 0, family: f, form: f, ...patch, res: { ...r, ...res } });
      if (b === 'basic') {
        const list = form === 'drizzle' ? drizzle : zephyr;
        const n = s.next !== undefined ? s.next : s.family === form ? s.stage % list.length : 0;
        // S3: Drizzle Stage 4 spends Kingfisher for +350 Floral Epistle and +20 Concerto
        const king = form === 'drizzle' && n === 3 && r.kingfisher > 0;
        const res = form === 'drizzle' ? { epistle: Math.min(600, r.epistle + 150 + (king ? 350 : 0)), kingfisher: king ? 0 : r.kingfisher } : { cloud: Math.min(120, r.cloud + 30) };
        return { move: mk(c, form === 'drizzle' ? 'Forte' : 'Normal', [ref(form === 'drizzle' ? 'Forte' : 'Normal', list[n])], 'basic', ['basic'], king ? { concerto: 20 } : {}), state: at(form, { stage: n + 1 }, res) };
      }
      if (b === 'heavy' && form === 'drizzle') {
        return { move: mk(c, 'Forte', [ref('Forte', 'Heavy Attack - Drizzle Stance')], 'heavy', ['heavy']), state: at(form, {}, { epistle: Math.min(600, r.epistle + 150) }) };
      }
      if (b === 'skill') {
        // S3: the Drizzle Skill chains into Stage 4 and grants Kingfisher
        if (form === 'drizzle') return { move: mk(c, 'Skill', [ref('Skill', 'Resonance Skill - Drizzle Stance DMG')], 'skill', ['skill']), state: at(form, sequence >= 3 ? { next: 3 } : {}, { epistle: Math.min(600, r.epistle + 150), ...(sequence >= 3 ? { kingfisher: 1 } : {}) }) };
        return r.cloud >= 120
          ? { move: mk(c, 'Skill', [ref('Skill', 'Awakening Spring DMG')], 'skill', ['skill']), state: at('drizzle', {}, { cloud: 0, epistle: 0 }) }
          : { move: mk(c, 'Skill', [ref('Skill', 'Resonance Skill - Zephyr Stance DMG')], 'skill', ['skill']), state: at(form, {}, { cloud: Math.min(120, r.cloud + 30) }) };
      }
      if (b === 'intro') return { move: mk(c, 'Intro', [ref('Intro', 'Skill DMG')], 'intro', ['intro'], { cast: true }), state: at('drizzle', {}, { cloud: 0, epistle: 0 }) };
      if (b === 'outro') {
        const o = g.press(s, 'outro').move;
        return { move: { ...o, tags: { 'Floral Epistle': r.epistle }, label: `${o.label} (${r.epistle} Floral Epistle)` }, state: at('zephyr', {}, { epistle: 0 }) };
      }
      const out = g.press(s, b);
      return { move: out.move, state: b === 'echo' ? s : at(form, {}) };
    },
  };
}

/**
 * Lucilla. Trace makes Photos (50 Trace each, max 3): Intro +100, Spotlight +50, Basic 3 Commendable +50,
 * Compensate / Basic 3 Unremarkable +25. Liberation (3 Photos) enters Reminiscence: holding Basic there is
 * Tracing Forms 1-2-3, one Oblivion per Photo, then Letting It Go (+20 Concerto), which ends Reminiscence.
 */
function lucillaMachine(c: Character): Machine {
  const g = genericMachine(c);
  const R = (s: MachineState) => ({ trace: 0, ...s.res });
  const photos = (trace: number) => Math.min(3, Math.floor(trace / 50));
  return {
    buttons: BASE_BUTTONS.map((b) => ({ ...b, hint: ({ basic: 'In Reminiscence: held, Tracing Forms 1-2-3, Oblivion per Photo, Letting It Go', skill: 'Spotlight (perfect hold) or Compensate', liberation: 'Clear As Day: needs 3 Photos' } as Record<string, string>)[b.id] ?? b.hint })),
    exact: g.exact,
    initial: () => ({ stage: 0, family: 'basic', form: 'normal', res: { trace: 0 } }),
    swappedOut: (s) => ({ ...s, stage: 0, next: undefined }),
    gauges: (s) => [{ label: 'Photos', value: photos(R(s).trace), max: 3 }],
    press: (s, b, option) => {
      const form = s.form ?? 'normal';
      const r = R(s);
      const at = (f: string, patch: Partial<MachineState>, res: Partial<typeof r> = {}): MachineState => ({ stage: 0, family: f, form: f, ...patch, res: { ...r, ...res } });
      const trace = (n: number) => Math.min(150, r.trace + n);
      if (b === 'basic') {
        if (form === 'remi') {
          const p = photos(r.trace);
          const rows: RowRef[] = [1, 2, 3].map((n) => ref('Liberation', `Basic Attack - Tracing Forms Stage ${n} DMG`));
          if (p) rows.push({ ...ref('Forte', 'Oblivion DMG'), times: p });
          rows.push(ref('Liberation', 'Letting It Go DMG'));
          return { move: { ...mk(c, 'Liberation', rows, 'basic', ['basic'], { concerto: 20, levels: { 'c.luc.s6': p, 'c.luc.s4': p }, tags: { chafeMode: p } }), label: `Basic Attack - Tracing Forms 1-2-3 + Oblivion ×${p} + Letting It Go`, timing: 'basic', seconds: 4 }, state: at('normal', {}, { trace: 0 }) };
        }
        const n = s.next !== undefined ? s.next : s.family === 'basic' ? s.stage % 3 : 0;
        if (n < 2) return { move: mk(c, 'Normal', [ref('Normal', `Basic Attack Stage ${n + 1} DMG`)], 'basic', ['basic']), state: { ...at('normal', { stage: n + 1 }), family: 'basic' } };
        const perfect = (option ?? 0) === 0;
        const choice: Choice = { label: 'Basic Attack Stage 3', options: ['Commendable', 'Unremarkable'], value: perfect ? 0 : 1 };
        return { move: mk(c, 'Normal', [ref('Normal', `Basic Attack Stage 3 - ${perfect ? 'Commendable' : 'Unremarkable'} DMG`)], 'basic', ['basic'], { choice }), state: at('normal', {}, { trace: trace(perfect ? 50 : 25) }) };
      }
      if (b === 'skill') {
        if (form === 'remi') return { move: { ...mk(c, 'Skill', [], 'skill', [], { warn: "Lucilla can't cast her Skill in Reminiscence" }) }, state: s };
        const spot = (option ?? 0) === 0;
        const choice: Choice = { label: 'Resonance Skill', options: ['Spotlight', 'Compensate'], value: spot ? 0 : 1 };
        // both chain into Basic Stage 2
        return { move: mk(c, 'Skill', [ref('Skill', spot ? 'Spotlight DMG' : 'Compensate DMG')], 'skill', ['skill'], { choice, ...(spot ? { concerto: 20, tags: { chafeMode: 1 } } : {}) }), state: { ...at('normal', { next: 1 }, { trace: trace(spot ? 50 : 25) }), family: 'basic' } };
      }
      if (b === 'liberation') {
        if (form === 'remi') return { move: mk(c, 'Liberation', [], 'liberation', [], { warn: "Lucilla can't cast her Liberation in Reminiscence" }), state: s };
        const warn = photos(r.trace) < 3 ? `Clear As Day needs 3 Photos (has ${photos(r.trace)})` : undefined;
        return { move: mk(c, 'Liberation', [ref('Liberation', 'Clear As Day DMG')], 'liberation', ['liberation'], { cast: true, warn, tags: { filmRoll: 4 } }), state: at('remi', {}) };
      }
      if (b === 'intro') {
        if (form === 'remi') return { move: mk(c, 'Intro', [ref('Intro', 'Clip It: Hard Cut DMG')], 'intro', ['intro'], { cast: true }), state: at('remi', {}) };
        return { move: mk(c, 'Intro', [ref('Intro', 'Clip It DMG')], 'intro', ['intro'], { cast: true }), state: at('normal', {}, { trace: trace(100) }) };
      }
      const out = g.press(s, b);
      return { move: out.move, state: b === 'echo' || b === 'outro' ? s : at(form, {}) };
    },
  };
}

const MACHINES: Record<string, (c: Character, sequence?: number) => Machine> = { Hiyuki: hiyukiMachine, Suisui: suisuiMachine, Lucilla: lucillaMachine };

/** Characters with a hand-made machine (the rest use the generic one). */
export const HAS_MACHINE = Object.keys(MACHINES);

const cache = new WeakMap<Character, Map<number, Machine>>();
/** A Resonator's machine at a sequence level (sequences can change resources and moves). */
export function machineFor(characterId: number, data: GameData, sequence = 0): Machine {
  const c = data.characters.find((x) => x.id === characterId)!;
  if (!cache.has(c)) cache.set(c, new Map());
  const byS = cache.get(c)!;
  if (!byS.has(sequence)) byS.set(sequence, (MACHINES[c.name] ?? ((x: Character) => genericMachine(x)))(c, sequence));
  return byS.get(sequence)!;
}
