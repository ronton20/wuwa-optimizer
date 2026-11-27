import type { Character, GameData, NegativeStatus, Skill, SkillKind } from '../../data/types';

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
  /** Resonance Energy the kit text gives on top of the data (before Energy Regen) */
  energy?: number;
  /** a choice the step can change */
  choice?: Choice;
  /** numbers buffs can depend on (Suisui's Outro: Floral Epistle spent) */
  tags?: Record<string, number>;
  /** default time when it isn't one action of its kind (Lucilla's whole held Tracing Forms string) */
  seconds?: number;
  /**
   * Tower of Adversity stops the clock during it, like a Liberation (Hiyuki's Bitterfrost: the ToA timer stands still
   * for its whole 2.2 s animation in the owner's recording). Liberations stop it without this.
   */
  stopsClock?: boolean;
  /** the name its "<name> Concerto Regen" / "<name> Resonance Cost" rows use, when the move has no damage row */
  named?: string;
  /** stack counts this move sets for its own hits, by effect id (Lucilla S6: Remembrance = Photos spent) */
  levels?: Record<string, number>;
  /** Glacio Chafe stacks the move inflicts on the target */
  chafe?: number;
  /** consumes 10 Glacio Bite to trigger Frostbind when the target has 10+ (Hiyuki: Inward Vision, Iai) */
  frostbind?: boolean;
}

/** Stacks of a Negative Status a damage row inflicts. */
export interface Inflicts {
  status: NegativeStatus;
  stacks: number;
  /** from this sequence on it inflicts this many instead: [sequence, stacks] */
  fromSeq?: [number, number];
  /** only in this Resonance Mode: [condition key, option index] */
  mode?: [string, number];
}
const inf = (status: NegativeStatus, stacks: number, extra: Partial<Inflicts> = {}): Inflicts => ({ status, stacks, ...extra });
const each = (rows: string[], i: Inflicts) => Object.fromEntries(rows.map((r) => [r, i]));

/**
 * Negative Status stacks each damage row inflicts, from the kit texts (Hiyuki's checked against her in-game sheet).
 * Keys are the row label, or "Kind|Row label" where several skills share a label. Glacio Chafe becomes Glacio Bite
 * with Hiyuki in the team (rotation/status.ts).
 * Not row-based, so not here yet: Chisa's / Yangyang: Xuanling's Havoc Bane, Buling's array, Aemeath's refill,
 * Phoebe's Confession Enhancement, Hsin's Formshift / Fleeting Thunder, Cartethyia S2, Ciaccona's Yellow Tonic.
 */
export const STATUS_ROWS: Record<string, Record<string, Inflicts>> = {
  Hiyuki: {
    ...each(['Basic Attack - Present Self Stage 3 DMG', 'Heavy Attack - Frost Splinter: Present Self DMG', 'Skill DMG', 'Basic Attack - Foreclaimed Self Stage 3 DMG',
      'Basic Attack - Foreclaimed Self Stage 4 DMG', 'Basic Attack - Foreclaimed Self Stage 5 DMG', 'Mid-air Attack - Foreclaimed Self Stage 2 DMG',
      'Mid-air Plunging Attack - Foreclaimed Self DMG', 'Heavy Attack - Bitterfrost: Foreclaimed Self DMG'], inf('Glacio Chafe', 1)),
    'Foreclaiming: Inward Vision DMG': inf('Glacio Chafe', 4),
  },
  Lucilla: each(['Clip It DMG', 'Clip It: Hard Cut DMG'], inf('Glacio Chafe', 1)),
  Suisui: each(['Awakening Spring DMG', 'Skill DMG', 'Basic Attack - Drizzle Stance Stage 4 DMG'], inf('Glacio Chafe', 1)),
  Ciaccona: each(['Normal|Stage 4 DMG', 'Skill|Skill DMG', 'Intro|Skill DMG', 'Symphonic Poem: Tonic DMG', 'Quadruple Downbeat DMG'], inf('Aero Erosion', 1)),
  Cartethyia: {
    'Normal|Stage 4 DMG': inf('Aero Erosion', 1), 'Skill|Skill DMG': inf('Aero Erosion', 2), "Sword to Mark Tide's Trace DMG": inf('Aero Erosion', 2),
    ...each(['Basic Attack Stage 5 DMG', 'Mid-air Attack 2 DMG', 'Enhanced Heavy Attack DMG', 'May Tempest Break the Tides DMG'], inf('Aero Erosion', 0, { fromSeq: [3, 2] })),
  },
  Hsin: {
    ...each(['Resonance Skill - Illumining Form: Pillars Aligned DMG', 'Heavy Attack - Illumining Form: Stilling All Horizons DMG'], inf('Electro Flare', 5)),
    ...each(['Intro Skill - Illumining Form DMG in Resonance Mode - Electro Flare', 'Intro Skill - Answering Form DMG in Resonance Mode - Electro Flare',
      'Heavy Attack - Answering Form: Realm Protector DMG'], inf('Electro Flare', 1)),
  },
  'Rover: Electro': { 'Overshock DMG': inf('Electro Flare', 10), 'Liberation|Skill DMG': inf('Electro Flare', 0, { fromSeq: [2, 5] }) },
  Denia: {
    ...each(["It's Been A While! DMG", 'Knock Knock DMG', 'Final Act - Stagecraft Form DMG', 'Final Act - Breakdown Form DMG', 'Erosion Field DMG per tick'],
      inf('Fusion Burst', 2, { mode: ['c.den.mode', 0] })),
    ...each(['Basic Attack - Stagecraft Form Stage 3 DMG', 'Basic Attack - Stagecraft Form Stage 4 DMG', 'Basic Attack - Breakdown Form Stage 3 DMG', 'Basic Attack - Breakdown Form Stage 4 DMG',
      'Mid-air Attack - Breakdown Form Stage 3 DMG', 'Mid-air Attack - Breakdown Form Stage 4 DMG'], inf('Fusion Burst', 1, { mode: ['c.den.mode', 0] })),
  },
  Phoebe: each(['Absolution Litany DMG', 'Utter Confession DMG'], inf('Spectro Frazzle', 1)),
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

// "Basic Attack - Present Self Stage 3 DMG" or a bare "Stage 3 DMG" (many kits' plain Basic Attack)
const STAGE = /^(?:(.*?) )?Stage (\d+)(?: DMG)?$/;
// "Basic Attack 2 DMG", "Moonring - Basic Attack 2 DMG"
const NUMBERED = /^(.*\bBasic Attack) (\d+)(?: DMG)?$/;
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

/** A gauge a row's hits change in total (HitTerm.special[slot] × hits): Frostheart, Ring of Chainsaw… */
export function gaugeOf(c: Character, kind: SkillKind, row: string, slot: number) {
  const r = c.skills.filter((s) => s.kind === kind).flatMap((s) => s.rows).find((x) => x.label === row);
  return (r?.hits ?? []).reduce((sum, h) => sum + (h.special?.[slot] ?? 0) * h.count, 0);
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
    const m = label.match(STAGE) ?? label.match(NUMBERED);
    if (!m) continue;
    const key = m[1] ?? '';
    const list = out.get(key) ?? [];
    list[Number(m[2]) - 1] = label;
    out.set(key, list);
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
  const entries = [...fam.entries()];
  const basic = entries.find(([k]) => /^Basic Attack/.test(k)) ?? entries.find(([k]) => k === '') ?? entries[0];
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
 * Frostheart: Basic / Heavy / mid-air / Dodge hits restore what the game data gives per hit (HitTerm.special[1]:
 * Basic 1–5 = 10, 16, 17, 30, 24). Jade Cleave and Petalfall restore it "while casting", which isn't in the damage
 * data: set so the in-game check (0 after Inward Vision → Basic ×5 + Jade Cleave + Petalfall → 300) holds, (300 − 97) / 2.
 */
export const FROSTHEART_SKILL = 102;
const FROSTHEART = 1;

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
        const fh = { frostheart: heart(gaugeOf(c, 'Normal', row, FROSTHEART)) };
        return { move: m('Normal', row, 'air', ['basic']), state: n < 2 ? keep({ stage: n + 1, family: 'fore-air', air: true }, fh) : keep({}, fh) };
      }
      if (b === 'basic') {
        const list = form === 'fore' ? fore : present;
        const n = s.next !== undefined ? s.next : s.family === form ? s.stage % list.length : 0;
        // S1: after Inward Vision, Foreclaimed Basic 1 and 2 also inflict Glacio Chafe
        const s1 = form === 'fore' && n < 2 && (r.s1 ?? 0) > 0;
        if (form === 'fore') return { move: m('Normal', list[n], 'basic', ['basic'], s1 ? { chafe: 1 } : {}), state: keep({ stage: n + 1 }, { frostheart: heart(gaugeOf(c, 'Normal', list[n], FROSTHEART)), ...(s1 ? { s1: r.s1 - 1 } : {}) }) };
        const third = n === 2;
        return { move: m('Normal', list[n], 'basic', ['basic']), state: keep({ stage: n + 1 }, third ? { dedication: ded(r.enhanced ? 200 : 100), enhanced: 0 } : {}) };
      }
      if (b === 'heavy') {
        if (form === 'fore') {
          return r.bitterfrost >= 3
            ? { move: m('Normal', 'Heavy Attack - Bitterfrost: Foreclaimed Self DMG', 'heavy', ['heavy'], { stopsClock: true }), state: keep({}, { bitterfrost: 0, blades: Math.min(3, r.blades + 1) }) }
            // the thrust chains into Stage 2
            : { move: m('Normal', 'Heavy Attack - Foreclaimed Self DMG', 'heavy', ['heavy']), state: keep({ next: 1 }, { frostheart: heart(gaugeOf(c, 'Normal', 'Heavy Attack - Foreclaimed Self DMG', FROSTHEART)) }) };
        }
        const warn = r.dedication < 300 ? `Frost Splinter needs 300 Dedication (has ${r.dedication})` : undefined;
        return { move: m('Normal', 'Heavy Attack - Frost Splinter: Present Self DMG', 'heavy', ['heavy'], { warn }), state: keep({}, { dedication: 0, ready: 1 }) };
      }
      if (b === 'skill') {
        if (form === 'fore') {
          // Jade Cleave on the ground launches her; in the air the Skill is Petalfall
          const gain = { frostheart: heart(FROSTHEART_SKILL + (r.bonus > 0 ? 50 : 0)), bonus: Math.max(0, r.bonus - 1) };
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
/**
 * Inherent Sky Over Water: "When Awakening Spring and Intro Skill - Tinkling Jade hit a target, they additionally restore
 * 18 points of Concerto Energy and 13 points of Resonance Energy … once every 25s".
 * shortcut: the 25s cooldown isn't tracked (her rotation is longer than 25s); track it if a rotation casts both within 25s.
 */
const SKY_OVER_WATER = { concerto: 18, energy: 13 };

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
          ? { move: mk(c, 'Skill', [ref('Skill', 'Awakening Spring DMG')], 'skill', ['skill'], SKY_OVER_WATER), state: at('drizzle', {}, { cloud: 0, epistle: 0 }) }
          : { move: mk(c, 'Skill', [ref('Skill', 'Resonance Skill - Zephyr Stance DMG')], 'skill', ['skill']), state: at(form, {}, { cloud: Math.min(120, r.cloud + 30) }) };
      }
      if (b === 'intro') return { move: mk(c, 'Intro', [ref('Intro', 'Skill DMG')], 'intro', ['intro'], { cast: true, ...SKY_OVER_WATER }), state: at('drizzle', {}, { cloud: 0, epistle: 0 }) };
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
          return { move: { ...mk(c, 'Liberation', rows, 'basic', ['basic'], { concerto: 20, levels: { 'c.luc.s6': p, 'c.luc.s4': p }, tags: { chafeMode: p } }), label: `Basic Attack - Tracing Forms 1-2-3 + Oblivion ×${p} + Letting It Go`, timing: 'basic', seconds: 3.2 }, state: at('normal', {}, { trace: 0 }) }; // measured: 3.19 / 3.22 s (ToA, end of Clear As Day → switch)
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

/** Jumping: no damage of its own; it cancels the move before it and puts her in the air (estimate: 0.3 s). */
const JUMP: Button = { id: 'jump', label: 'Jump', kind: 'Normal', hint: 'Jump (cancels the move before it); Basic in the air does mid-air attacks' };
const jump = (s: MachineState) => ({ move: { label: 'Jump', kind: 'Normal' as SkillKind, rows: [], timing: 'dodge' as TimingKind, events: [], seconds: 0.3 }, state: { ...s, stage: 0, next: undefined, air: true } });

/**
 * Chisa. Basic string: Stage 1 → Stage 2 → Rending Lunge → Death Snip (a press during it: Death Snip Additional DMG)
 * → Thread Withdrawn. Eye of Unraveling chains into Rending Lunge. Ring of Chainsaw (max 100): Normal Attacks and Eye
 * of Unraveling restore it on hit (game data per hit), Liberation +40, Intro +20. At 100, on the ground, Skill is
 * Serrated Loop: Chainsaw Mode, chained into Sawring - Blitz Stage 2. In Chainsaw Mode Basic is Sawring - Blitz 1 → 2 →
 * 3 (they spend Ring of Chainsaw, game data per hit), then Sawring - Eradication: its multiplier gets 2.59% per Ring
 * spent (×2.2 in Woven Myriad - Convergence, ×2.2 more at S3), and it ends Chainsaw Mode and Convergence.
 * Liberation: Woven Myriad - Convergence (Sawring multipliers +120%) until Eradication.
 */
function chisaMachine(c: Character, sequence = 0): Machine {
  const g = genericMachine(c);
  const R = (s: MachineState) => ({ ring: 0, spent: 0, saw: 0, conv: 0, snip: 0, ...s.res });
  const ground = ['Stage 1 DMG', 'Stage 2 DMG', 'Rending Lunge DMG', 'Death Snip DMG', 'Thread Withdrawn DMG'];
  const blitz = ['Sawring - Blitz Stage 1 DMG', 'Sawring - Blitz Stage 2 DMG', 'Sawring - Blitz Stage 3 DMG'];
  const RING = 0;
  const hints: Record<string, string> = {
    basic: 'Stage 1-2 → Rending Lunge → Death Snip (press again: Additional DMG) → Thread Withdrawn · Chainsaw Mode: Sawring - Blitz 1-3, then Eradication',
    skill: 'Eye of Unraveling (chains into Rending Lunge) · Serrated Loop at 100 Ring of Chainsaw (Chainsaw Mode)',
    liberation: 'Moment of Nihility: +40 Ring of Chainsaw, Woven Myriad - Convergence until Eradication',
  };
  return {
    buttons: BASE_BUTTONS.map((b) => ({ ...b, hint: hints[b.id] ?? b.hint })),
    exact: g.exact,
    initial: () => ({ stage: 0, family: 'ground', form: 'normal', res: {} }),
    swappedOut: (s) => ({ ...s, stage: 0, next: undefined, res: { ...R(s), snip: 0 } }),
    gauges: (s) => [{ label: 'Ring of Chainsaw', value: Math.round(R(s).ring), max: 100 }],
    press: (s, b, option) => {
      const r = R(s);
      const at = (patch: Partial<MachineState>, res: Partial<typeof r> = {}): MachineState => ({ stage: 0, family: 'ground', form: r.saw ? 'saw' : 'normal', ...patch, res: { ...r, ...res } });
      const saw = (patch: Partial<MachineState>, res: Partial<typeof r> = {}): MachineState => ({ ...at({ family: 'saw', ...patch }, res), form: 'saw' });
      const ring = (kind: SkillKind, row: string) => Math.max(0, Math.min(100, r.ring + gaugeOf(c, kind, row, RING)));
      const conv = { 'c.chisa.conv': r.conv };
      if (b === 'basic' && r.saw) {
        const n = s.next !== undefined ? s.next : s.family === 'saw' ? s.stage : 0;
        if (n < 3) {
          // tapped (not held), Stage 2 and 3 end in Discordance / Falltone (seen: 304s after the 902s in the owner's clip)
          const tail = n === 1 ? 'Sawring - Blitz Stage 2: Discordance DMG' : n === 2 ? 'Sawring - Blitz Stage 3: Falltone DMG' : undefined;
          const rows = [blitz[n], ...(tail ? [tail] : [])];
          const used = rows.reduce((a, x) => a - gaugeOf(c, 'Forte', x, RING), 0);
          const label = `Sawring - Blitz Stage ${n + 1}${tail ? ` + ${n === 1 ? 'Discordance' : 'Falltone'}` : ''}`;
          return {
            move: { ...mk(c, 'Forte', rows.map((x) => ref('Forte', x)), 'basic', ['basic'], { levels: conv }), label },
            state: saw({ stage: n + 1 }, { ring: Math.max(0, r.ring - used), spent: Math.min(100, r.spent + used) }),
          };
        }
        // Eradication: +2.59% per Ring of Chainsaw spent, that bonus +120% in Convergence and +120% at S3
        const times = Math.round(r.spent * (1 + 1.2 * r.conv + (sequence >= 3 ? 1.2 : 0)));
        const row: RowRef = { skillKind: 'Forte', row: 'Sawring - Eradication DMG', ...(times ? { bonus: { row: 'Bonus DMG Multiplier per Ring of Chainsaw', times } } : {}) };
        return {
          move: { ...mk(c, 'Forte', [row], 'basic', ['basic'], { levels: conv }), label: `Sawring - Eradication (${Math.round(r.spent)} Ring of Chainsaw spent)` },
          state: { ...at({}, { ring: 0, spent: 0, saw: 0, conv: 0 }), form: 'normal' },
        };
      }
      if (b === 'basic' && s.air) return { move: mk(c, 'Normal', [ref('Normal', 'Hanging Finality DMG')], 'air', ['basic']), state: at({ next: 3, air: false }, { ring: ring('Normal', 'Hanging Finality DMG') }) };
      if (b === 'basic') {
        // a press during Death Snip is its Additional DMG
        if (r.snip) return { move: mk(c, 'Normal', [ref('Normal', 'Death Snip Additional DMG')], 'basic', ['basic']), state: at({ next: 4 }, { ring: ring('Normal', 'Death Snip Additional DMG'), snip: 0 }) };
        const n = s.next !== undefined ? s.next : s.family === 'ground' ? s.stage % ground.length : 0;
        return { move: mk(c, 'Normal', [ref('Normal', ground[n])], 'basic', ['basic']), state: at({ stage: n + 1 }, { ring: ring('Normal', ground[n]), snip: n === 3 ? 1 : 0 }) };
      }
      if (b === 'heavy') {
        if (r.saw) return { move: mk(c, 'Normal', [], 'heavy', [], { label: 'Heavy Attack', warn: 'No Heavy Attack in Chainsaw Mode' }), state: s };
        return { move: mk(c, 'Normal', [ref('Normal', 'Heavy Attack DMG')], 'heavy', ['heavy']), state: at({ air: true }, { ring: ring('Normal', 'Heavy Attack DMG') }) };
      }
      if (b === 'skill') {
        // Serrated Loop needs a full Ring of Chainsaw; the step can force it (with a warning) when the count runs short
        const loop = !r.saw && !s.air && (option ?? (r.ring >= 100 ? 1 : 0)) === 1;
        const choice: Choice | undefined = r.saw || s.air ? undefined : { label: 'Resonance Skill', options: ['Eye of Unraveling', 'Serrated Loop'], value: loop ? 1 : 0 };
        if (loop) {
          const warn = r.ring < 100 ? `Serrated Loop needs 100 Ring of Chainsaw (has ${Math.round(r.ring)})` : undefined;
          return { move: mk(c, 'Skill', [ref('Skill', 'Serrated Loop DMG')], 'skill', ['skill'], { cast: true, choice, warn }), state: saw({ next: 1 }, { saw: 1, spent: 0, ring: 100 }) };
        }
        // not in Chainsaw Mode it chains into Rending Lunge; in Chainsaw Mode into Sawring - Blitz Stage 2
        const eye = mk(c, 'Skill', [ref('Skill', 'Eye of Unraveling DMG')], 'skill', ['skill'], { cast: true, ...(choice ? { choice } : {}) });
        return { move: eye, state: r.saw ? saw({ next: 1 }) : at({ next: 2, air: false }, { ring: ring('Skill', 'Eye of Unraveling DMG') }) };
      }
      if (b === 'liberation' || b === 'intro') {
        const lib = b === 'liberation';
        const move = mk(c, lib ? 'Liberation' : 'Intro', [ref(lib ? 'Liberation' : 'Intro', 'Skill DMG')], b, [b], { cast: true });
        const res = { ring: Math.min(100, r.ring + (lib ? 40 : 20)), ...(lib ? { conv: 1 } : {}) };
        return { move, state: r.saw ? saw(lib ? { stage: s.stage } : { next: 1 }, res) : at({ next: 1 }, res) };
      }
      const out = g.press(s, b);
      return { move: out.move, state: b === 'echo' || b === 'outro' ? s : out.state };
    },
  };
}

/**
 * Ciaccona. Basic 1-4 (Stage 4: +1 Musical Essence, +1 more at S3; at S6 her Solo Concert's 220% hit). Intro +1
 * Musical Essence and chains into Stage 3; Skill chains into Stage 2. In the air: Mid-air Attack 1, 2, then Basic is
 * Stage 4. Heavy at 3 Musical Essence is Quadruple Downbeat (spends them all); otherwise it jumps into a mid-air Heavy.
 * Liberation starts Recital: switching her out while in it fires a Symphonic Poem: Tonic (Green by default).
 */
function ciacconaMachine(c: Character, sequence = 0): Machine {
  const g = genericMachine(c);
  const R = (s: MachineState) => ({ essence: 0, recital: 0, ...s.res });
  const stages = [1, 2, 3, 4].map((n) => `Stage ${n} DMG`);
  const hints: Record<string, string> = {
    basic: 'Stage 1-4 (Stage 4: +1 Musical Essence) · in the air: Mid-air 1, 2, then Stage 4',
    heavy: 'Quadruple Downbeat at 3 Musical Essence · otherwise a jumping Heavy Attack',
    liberation: "Singer's Triple Cadenza: Recital (switching out fires a Tonic)",
  };
  return {
    buttons: [...BASE_BUTTONS.map((b) => ({ ...b, hint: hints[b.id] ?? b.hint })), JUMP],
    exact: g.exact,
    initial: () => ({ stage: 0, family: 'basic', form: 'normal', res: {} }),
    swappedOut: (s) => ({ ...s, stage: 0, next: undefined, air: false }),
    gauges: (s) => [{ label: 'Musical Essence', value: R(s).essence, max: 3 }],
    press: (s, b) => {
      const r = R(s);
      const at = (patch: Partial<MachineState>, res: Partial<typeof r> = {}): MachineState => ({ stage: 0, family: 'basic', form: 'normal', air: false, ...patch, res: { ...r, ...res } });
      if (b === 'jump') return jump(s);
      if (b === 'basic' && s.air) {
        const n = s.family === 'air' ? s.stage : 0;
        // after Mid-air 2, Basic is Stage 4
        if (n < 2) return { move: mk(c, 'Normal', [ref('Normal', `Mid-air Attack Stage ${n + 1} DMG`)], 'air', ['basic']), state: n === 1 ? at({ next: 3 }) : at({ stage: 1, family: 'air', air: true }) };
      }
      if (b === 'basic') {
        const n = s.next !== undefined ? s.next : s.family === 'basic' ? s.stage % 4 : 0;
        const rows = [ref('Normal', stages[n]), ...(n === 3 && sequence >= 6 ? [ref('Liberation', 'S6 · Unending Cadence DMG')] : [])];
        return { move: mk(c, 'Normal', rows, 'basic', ['basic']), state: at({ stage: n + 1 }, n === 3 ? { essence: Math.min(3, r.essence + (sequence >= 3 ? 2 : 1)) } : {}) };
      }
      if (b === 'heavy') {
        if (r.essence >= 3) return { move: mk(c, 'Forte', [ref('Forte', 'Quadruple Downbeat DMG')], 'heavy', ['heavy'], { cast: true }), state: at({}, { essence: 0 }) };
        return { move: mk(c, 'Normal', [ref('Normal', 'Heavy Attack DMG')], 'heavy', ['heavy']), state: at({ family: 'air', air: true }) };
      }
      if (b === 'skill') return { move: mk(c, 'Skill', [ref('Skill', 'Skill DMG')], 'skill', ['skill'], { cast: true }), state: at({ next: 1 }) };
      if (b === 'liberation') return { move: mk(c, 'Liberation', [ref('Liberation', 'Improvised Symphonic Poem Skill DMG')], 'liberation', ['liberation'], { cast: true }), state: at({}, { recital: 1 }) };
      // coming back on the field ends Recital
      if (b === 'intro') return { move: mk(c, 'Intro', [ref('Intro', 'Skill DMG')], 'intro', ['intro'], { cast: true }), state: at({ next: 2 }, { essence: Math.min(3, r.essence + 1), recital: 0 }) };
      if (b === 'outro' && r.recital) {
        const o = g.press(s, 'outro').move;
        return { move: { ...o, rows: [...o.rows, ref('Liberation', 'Symphonic Poem: Tonic DMG')], label: `${o.label} + Symphonic Poem: Tonic` }, state: s };
      }
      const out = g.press(s, b);
      return { move: out.move, state: b === 'echo' || b === 'outro' ? s : out.state };
    },
  };
}

/**
 * Conviction each Fleurdelys move restores (not in the damage data). Read off the ring around her Liberation button
 * in the owner's ToA floor 1 clip (cartethyia/toa_1, 10 fps, 2026-11-27): 0 → 120 over Answer Waves' Call (its field
 * keeps ticking: ~27), mid-air 1-2 (~10 each), May Tempest (~14), Basic 3, 4, 5 (~10, 8, 10), Heavy (~10), Enhanced
 * Heavy (~21, full at 120). Steps were matched to the press list by time, so single values are ±3; the total is exact.
 * Moves not in that clip use 10 (estimate).
 */
export const CONVICTION_GAIN: Record<string, number> = {
  "Sword to Answer Waves' Call DMG": 27, 'Mid-air Attack 1 DMG': 10, 'Mid-air Attack 2 DMG': 10, 'May Tempest Break the Tides DMG': 14,
  'Basic Attack Stage 3 DMG': 10, 'Basic Attack Stage 4 DMG': 8, 'Basic Attack Stage 5 DMG': 10, 'Heavy Attack DMG': 10, 'Enhanced Heavy Attack DMG': 21,
};
const conviction = (row: string) => CONVICTION_GAIN[row] ?? 10;

/**
 * Cartethyia. Basic 1-4 (Stage 4 summons Sword of Divinity's Shadow), Heavy and Intro summon Sword of Discord's Shadow,
 * Skill summons Sword of Virtue's Shadow and leaves her in the air. Her plunge (Basic in the air) recalls them all
 * (the "N Sword Shadows Recalled" row) for Heart of Virtue / Mandate of Divinity / Power of Discord, then Basic is
 * Stage 2. Liberation - A Knight's Heartfelt Prayers: Fleurdelys (Manifest, Conviction 0).
 * Fleurdelys: Basic 1-5, mid-air 1-2, Skill Sword to Answer Waves' Call then May Tempest Break the Tides (chains into
 * Stage 3), Heavy then Basic = Enhanced Heavy. Liberation at 120 Conviction is Blade of Howling Squall (ends Manifest);
 * below it, Avatar swaps to the other form (Cartethyia's Stage 2 / Fleurdelys' Stage 2) without ending Manifest.
 */
function cartethyiaMachine(c: Character): Machine {
  const g = genericMachine(c);
  const R = (s: MachineState) => ({ divinity: 0, discord: 0, virtue: 0, heart: 0, mandate: 0, power: 0, manifest: 0, conviction: 0, tempest: 0, enhanced: 0, ...s.res });
  const hints: Record<string, string> = {
    basic: 'Cartethyia: Stage 1-4 (4 summons a Sword Shadow) · in the air: plunge, recalling the Sword Shadows · Fleurdelys: Stage 1-5, mid-air 1-2, after Heavy: Enhanced Heavy',
    heavy: 'Cartethyia: summons a Sword Shadow · Fleurdelys: Heavy (then Basic: Enhanced Heavy)',
    skill: "Cartethyia: summons a Sword Shadow, leaves her in the air · Fleurdelys: Sword to Answer Waves' Call, then May Tempest Break the Tides",
    liberation: 'Fleurdelys (Manifest) · Blade of Howling Squall at 120 Conviction · otherwise swaps form (Avatar)',
  };
  return {
    buttons: [...BASE_BUTTONS.map((b) => ({ ...b, hint: hints[b.id] ?? b.hint })), JUMP],
    exact: g.exact,
    initial: () => ({ stage: 0, family: 'carte', form: 'carte', res: {} }),
    swappedOut: (s) => ({ ...s, stage: 0, next: undefined, air: false, res: { ...R(s), tempest: 0, enhanced: 0 } }),
    gauges: (s) => {
      const r = R(s);
      return s.form === 'fleur' ? [{ label: 'Conviction', value: r.conviction, max: 120 }] : [{ label: 'Sword Shadows', value: r.divinity + r.discord + r.virtue, max: 3 }];
    },
    press: (s, b) => {
      const form = s.form ?? 'carte';
      const r = R(s);
      const at = (f: string, patch: Partial<MachineState>, res: Partial<typeof r> = {}): MachineState => ({ stage: 0, family: f, form: f, air: false, ...patch, res: { ...r, ...res } });
      const conv = (n: number) => ({ conviction: Math.min(120, r.conviction + n) });
      if (b === 'jump') return jump(s);
      if (form === 'fleur') {
        // named as the game does: "Basic Attack - Fleurdelys Stage 3", "Resonance Skill - May Tempest Break the Tides"
        const fleurName = (row: string) => row.replace(/ DMG$/, '').replace(/^Basic Attack Stage (\d)$/, 'Basic Attack - Fleurdelys Stage $1')
          .replace(/^Mid-air Attack (\d)$/, 'Mid-air Attack - Fleurdelys Stage $1').replace(/^(Enhanced )?Heavy Attack$/, '$1Heavy Attack - Fleurdelys')
          .replace(/^(Sword to Answer Waves' Call|May Tempest Break the Tides)$/, 'Resonance Skill - $1');
        const F = (row: string, timing: TimingKind, event: GameEvent, gain: number, patch: Partial<MachineState> = {}, res: Partial<typeof r> = {}) =>
          ({ move: { ...mk(c, 'Forte', [ref('Forte', row)], timing, [event]), label: fleurName(row) }, state: at('fleur', patch, { ...conv(gain), ...res }) });
        if (b === 'basic' && s.air) {
          const n = s.family === 'fleur-air' ? s.stage % 2 : 0;
          return F(`Mid-air Attack ${n + 1} DMG`, 'air', 'basic', conviction(`Mid-air Attack ${n + 1} DMG`), { stage: n + 1, family: 'fleur-air', air: true });
        }
        if (b === 'basic' && r.enhanced) return F('Enhanced Heavy Attack DMG', 'heavy', 'heavy', conviction('Enhanced Heavy Attack DMG'), {}, { enhanced: 0 });
        if (b === 'basic') {
          const n = s.next !== undefined ? s.next : s.family === 'fleur' ? s.stage % 5 : 0;
          return F(`Basic Attack Stage ${n + 1} DMG`, 'basic', 'basic', conviction(`Basic Attack Stage ${n + 1} DMG`), { stage: n + 1 });
        }
        if (b === 'heavy') return F('Heavy Attack DMG', 'heavy', 'heavy', conviction('Heavy Attack DMG'), {}, { enhanced: 1 });
        if (b === 'skill') {
          return r.tempest
            ? F('May Tempest Break the Tides DMG', 'skill', 'skill', conviction('May Tempest Break the Tides DMG'), { next: 2 }, { tempest: 0 })
            : F("Sword to Answer Waves' Call DMG", 'skill', 'skill', conviction("Sword to Answer Waves' Call DMG"), { air: !!s.air }, { tempest: 1 });
        }
        if (b === 'liberation') {
          if (r.conviction >= 120) {
            return { move: mk(c, 'Liberation', [ref('Liberation', 'Blade of Howling Squall DMG')], 'liberation', ['liberation'], { cast: true }), state: at('carte', {}, { conviction: 0, manifest: 0, heart: 0, mandate: 0, power: 0 }) };
          }
          return { move: { ...mk(c, 'Normal', [ref('Normal', 'Stage 2 DMG')], 'basic', ['basic']), label: 'Avatar - Cartethyia (Basic Attack - Cartethyia Stage 2)' }, state: at('carte', { stage: 2 }) };
        }
        if (b === 'intro') return { move: mk(c, 'Intro', [ref('Intro', 'Sword to Call for Freedom DMG')], 'intro', ['intro'], { cast: true }), state: at('fleur', { next: 1 }, conv(conviction('Sword to Call for Freedom DMG'))) };
        const out = g.press(s, b);
        return { move: out.move, state: b === 'echo' || b === 'outro' ? s : at('fleur', {}) };
      }
      // Cartethyia
      if (b === 'basic' && s.air) {
        const n = r.divinity + r.discord + r.virtue;
        const row = n === 0 ? 'Mid-air Attack' : `Mid-air Attack ${n} Sword Shadow${n > 1 ? 's' : ''} Recalled`;
        const res = { divinity: 0, discord: 0, virtue: 0, heart: r.heart || r.virtue, mandate: r.mandate || r.divinity, power: r.power || r.discord };
        return { move: { ...mk(c, 'Normal', [ref('Normal', row)], 'air', ['basic']), label: `Mid-air Attack - Cartethyia (${n} Sword Shadow${n === 1 ? '' : 's'} recalled)` }, state: at('carte', { next: 1 }, res) };
      }
      if (b === 'basic') {
        const n = s.next !== undefined ? s.next : s.family === 'carte' ? s.stage % 4 : 0;
        return { move: { ...mk(c, 'Normal', [ref('Normal', `Stage ${n + 1} DMG`)], 'basic', ['basic']), label: `Basic Attack - Cartethyia Stage ${n + 1}` }, state: at('carte', { stage: n + 1 }, n === 3 ? { divinity: 1 } : {}) };
      }
      if (b === 'heavy') return { move: { ...mk(c, 'Normal', [ref('Normal', 'Heavy Attack DMG')], 'heavy', ['heavy']), label: 'Heavy Attack - Cartethyia' }, state: at('carte', { air: !!s.air }, { discord: 1 }) };
      if (b === 'skill') return { move: { ...mk(c, 'Skill', [ref('Skill', 'Skill DMG')], 'skill', ['skill'], { cast: true }), label: 'Resonance Skill - Cartethyia' }, state: at('carte', { air: true }, { virtue: 1 }) };
      if (b === 'liberation') {
        if (r.manifest) return { move: { ...mk(c, 'Forte', [ref('Forte', 'Basic Attack Stage 2 DMG')], 'basic', ['basic']), label: 'Avatar - Fleurdelys (Basic Attack - Fleurdelys Stage 2)' }, state: at('fleur', { stage: 2 }) };
        return {
          move: { ...mk(c, 'Liberation', [], 'liberation', ['liberation'], { cast: true, named: "A Knight's Heartfelt Prayers" }), label: "Resonance Liberation - A Knight's Heartfelt Prayers" },
          state: at('fleur', {}, { manifest: 1, conviction: 0 }),
        };
      }
      if (b === 'intro') return { move: mk(c, 'Intro', [ref('Intro', "Sword to Mark Tide's Trace DMG")], 'intro', ['intro'], { cast: true }), state: at('carte', { next: 1 }, { discord: 1 }) };
      const out = g.press(s, b);
      return { move: out.move, state: b === 'echo' || b === 'outro' ? s : at('carte', {}) };
    },
  };
}

const MACHINES: Record<string, (c: Character, sequence?: number) => Machine> = {
  Hiyuki: hiyukiMachine, Suisui: suisuiMachine, Lucilla: lucillaMachine, Chisa: chisaMachine, Ciaccona: ciacconaMachine, Cartethyia: cartethyiaMachine,
};

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
