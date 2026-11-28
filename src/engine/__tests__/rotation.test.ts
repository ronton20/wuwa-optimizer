import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { defaultBuild } from '../../state/buildStore';
import { uniformRes } from '../enemy';
import { FROSTHEART_SKILL, genericMachine, machineFor, moveName } from '../rotation/actions';
import { maxEnergyOf, moveResources, simulate, type RotationStep } from '../rotation/sim';
import { DEFAULT_TIMES, FROZEN_LIBERATION_TIME } from '../rotation/timing';
import { SNOW_RUST_BITE } from '../rotation/status';
import { RECORDED_TIMES } from '../rotation/recordedTimes';
import type { Build, Teammate } from '../types';

const char = (name: string) => data.characters.find((c) => c.name === name)!;
const mate = (name: string): Teammate => ({ characterId: char(name).id, sequence: 0, custom: [] });
const build = (name: string, team: string[] = []): Build => ({ ...defaultBuild(char(name).id), enemy: { level: 100, res: uniformRes(0) }, team: team.map(mate) });
const press = (name: string, ...buttons: string[]): RotationStep[] => buttons.map((button) => ({ char: char(name).id, button }));

const H = 'Hiyuki', L = 'Lucilla', S = 'Suisui';
const team = () => ({
  [char(H).id]: build(H, [L, S]),
  [char(L).id]: build(L, [H, S]),
  [char(S).id]: build(S, [H, L]),
});

describe('rotation machines', () => {
  it('Basic presses walk the combo stages and loop', () => {
    const m = machineFor(char(L).id, data);
    let s = m.initial();
    const rows: string[] = [];
    for (let i = 0; i < 5; i++) { const r = m.press(s, 'basic'); rows.push(r.move.rows[0].row); s = r.state; }
    expect(rows[0]).toMatch(/Stage 1/);
    expect(rows[1]).toMatch(/Stage 2/);
    expect(new Set(rows).size).toBeLessThan(5);
  });

  it('every Resonator has a working generic machine', () => {
    for (const c of data.characters) {
      const m = genericMachine(c);
      for (const b of m.buttons) expect(() => m.press(m.initial(), b.id), `${c.name} · ${b.id}`).not.toThrow();
    }
  });

  it('every Resonator has the same five buttons', () => {
    for (const c of data.characters) expect(machineFor(c.id, data).buttons.slice(0, 5).map((b) => b.id), c.name).toEqual(['basic', 'heavy', 'skill', 'liberation', 'echo']);
    expect(machineFor(char(H).id, data).buttons.map((b) => b.id)).toEqual(['basic', 'heavy', 'skill', 'liberation', 'echo', 'stance']);
    expect(machineFor(char(S).id, data).buttons.map((b) => b.id)).toEqual(['basic', 'heavy', 'skill', 'liberation', 'echo']);
  });

  it("Hiyuki: each button does what it does in the game at that point", () => {
    const m = machineFor(char(H).id, data);
    let s = m.initial();
    const go = (b: string) => { const r = m.press(s, b); s = r.state; return r.move; };
    expect(go('basic').rows[0].row).toBe('Basic Attack - Present Self Stage 1 DMG');
    expect(go('skill').rows[0].row).toBe('Resonance Skill - Present Self DMG');
    expect(go('basic').rows[0].row).toBe('Basic Attack - Present Self Stage 3 DMG'); // the skill chains into Stage 3, enhanced: +200
    expect(go('heavy').warn).toMatch(/300 Dedication \(has 200\)/);
    expect(go('liberation').rows[0].row).toBe('Foreclaiming: Inward Vision DMG');
    for (let n = 1; n <= 5; n++) expect(go('basic').rows[0].row).toBe(`Basic Attack - Foreclaimed Self Stage ${n} DMG`);
    expect(go('heavy').rows[0].row).toBe('Heavy Attack - Foreclaimed Self DMG');
    // three Iai fill Whiteout Bitterfrost: Heavy becomes Bitterfrost (+1 Snowforged Blade)
    for (let n = 0; n < 3; n++) expect(go('iai').rows[0].row).toBe('Basic Attack - Iai DMG');
    const bitter = go('heavy');
    expect(bitter.rows[0].row).toBe('Heavy Attack - Bitterfrost: Foreclaimed Self DMG');
    expect(bitter.label).toBe('Heavy Attack - Bitterfrost: Foreclaimed Self');
    expect(go('heavy').rows[0].row).toBe('Heavy Attack - Foreclaimed Self DMG');
    expect(go('skill').label).toBe('Resonance Skill - Frostblight: Jade Cleave');
    const blade = go('liberation');
    expect(blade.rows[0].bonus?.times).toBe(2); // 1 from her inherent + 1 from Bitterfrost
    expect(go('basic').rows[0].row).toBe('Basic Attack - Present Self Stage 1 DMG');
  });

  it('moves are named with their type', () => {
    const c = char(H);
    const lib = c.skills.find((s) => s.kind === 'Liberation')!;
    const intro = c.skills.find((s) => s.kind === 'Intro')!;
    expect(moveName(lib, 'Foreclaiming: Inward Vision DMG')).toBe('Resonance Liberation - Foreclaiming: Inward Vision');
    expect(moveName(intro, 'Skill DMG')).toBe(`Intro Skill - ${intro.name}`);
    expect(machineFor(char(S).id, data).exact.every((b) => / - /.test(b.label))).toBe(true);
  });

  it('Concerto and Energy come from the game data', () => {
    const m = machineFor(char(H).id, data);
    const res = (b: string, s = m.initial()) => moveResources(char(H), m.press(s, b).move);
    expect(res('basic').concerto).toBeCloseTo(2.44);
    expect(res('intro').concerto).toBe(10);
    expect(res('liberation').concerto).toBe(20); // Inward Vision: its own Concerto Regen row
    expect(res('liberation').cost).toBe(0); // and it costs no Energy
    const fore = m.press(m.initial(), 'liberation').state;
    expect(res('liberation', fore).cost).toBe(125); // Blade Liberation
  });

  it('every row a hand-made machine names exists', () => {
    const m = machineFor(char(H).id, data);
    const labels = new Set(char(H).skills.flatMap((s) => s.rows.map((r) => `${s.kind}|${r.label}`)));
    let s = m.initial();
    for (const b of ['basic', 'skill', 'basic', 'heavy', 'intro', 'liberation', 'basic', 'heavy', 'iai', 'iai', 'iai', 'heavy', 'skill', 'iai', 'intro', 'liberation']) {
      const r = m.press(s, b); s = r.state;
      for (const row of r.move.rows) expect(labels.has(`${row.skillKind}|${row.row}`), `${b} → ${row.row}`).toBe(true);
    }
  });
});

describe('rotation simulation', () => {
  it('adds up damage and time, and DPS = damage / time', () => {
    const r = simulate({ steps: press(L, 'basic', 'basic', 'basic') }, team(), data);
    expect(r.moves).toHaveLength(3);
    expect(r.total).toBeGreaterThan(0);
    expect(r.time).toBeCloseTo(3 * DEFAULT_TIMES.basic);
    expect(r.dps).toBeCloseTo(r.total / r.time);
  });

  it('switching Resonators adds the Intro of the one coming in', () => {
    const r = simulate({ steps: [...press(L, 'basic'), ...press(H, 'basic')], fullConcerto: true }, team(), data);
    expect(r.moves.map((m) => m.move.kind)).toContain('Intro');
    // Hiyuki's Intro chains into Present Self Stage 3
    expect(r.moves.at(-1)!.move.rows[0].row).toBe('Basic Attack - Present Self Stage 3 DMG');
  });

  it("an Outro buff is up only after that teammate's Outro, and only for its duration", () => {
    // Hiyuki's Outro: Glacio DMG of the others Amplified for 20s
    const steps: RotationStep[] = [...press(L, 'basic'), ...press(H, 'basic'), ...press(L, 'basic')];
    const r = simulate({ steps, fullConcerto: true }, team(), data);
    const lucilla = r.moves.filter((m) => m.char === char(L).id && m.via === 'press');
    expect(lucilla[0].buffs.some((b) => b.includes('Snowlight'))).toBe(false);
    expect(lucilla[1].buffs.some((b) => b.includes('Snowlight'))).toBe(true);
    const lane = r.lanes.find((l) => l.owner === char(H).id && l.label.includes('Snowlight'))!;
    expect(lane.rule.seconds).toBe(20);

    // long enough later, it has run out
    const late = simulate({ steps: [...steps, ...Array.from({ length: 40 }, () => press(L, 'basic')[0])], fullConcerto: true }, team(), data);
    const last = late.moves.at(-1)!;
    expect(last.buffs.some((b) => b.includes('Snowlight'))).toBe(false);
    expect(last.t).toBeGreaterThan(20);
  });

  it('the same move hits harder while a timed buff is up', () => {
    const before = simulate({ steps: press(L, 'skill') }, team(), data).moves[0].damage;
    const r = simulate({ steps: [...press(H, 'basic'), ...press(L, 'skill')], fullConcerto: true }, team(), data);
    const after = r.moves.filter((m) => m.char === char(L).id && m.via === 'press')[0].damage;
    expect(after).toBeGreaterThan(before);
  });

  it('Tower of Adversity time freeze shortens Liberations', () => {
    const steps = press(H, 'heavy', 'liberation');
    const normal = simulate({ steps }, team(), data);
    const frozen = simulate({ steps, freezeLiberation: true }, team(), data);
    expect(normal.time - frozen.time).toBeCloseTo(RECORDED_TIMES.Hiyuki.moves!['Resonance Liberation - Foreclaiming: Inward Vision'] - FROZEN_LIBERATION_TIME);
    expect(frozen.total).toBeCloseTo(normal.total);
  });

  it('a step can set its own time', () => {
    const r = simulate({ steps: [{ char: char(H).id, button: 'basic', seconds: 2.5 }] }, team(), data);
    expect(r.time).toBe(2.5);
  });

  it('a switch is Outro + Intro only with full Concerto, unless forced', () => {
    const steps = [...press(L, 'basic'), ...press(H, 'basic')];
    const empty = simulate({ steps }, team(), data);
    expect(empty.swaps[1]).toBe('quick');
    expect(empty.moves.some((m) => m.move.kind === 'Intro')).toBe(false);
    const forced = simulate({ steps: [steps[0], { ...steps[1], swap: 'intro' }] }, team(), data);
    expect(forced.swaps[1]).toBe('intro');
    expect(forced.moves.find((m) => m.move.kind === 'Outro')!.warn.join()).toMatch(/Concerto isn't full/);
    // Concerto resets on Outro
    const full = simulate({ steps, fullConcerto: true }, team(), data);
    expect(full.moves.find((m) => m.move.kind === 'Outro')!.concerto).toBe(0);
  });

  it("support Outro buffs last their full time; 'incoming Resonator' ones end when that Resonator leaves", () => {
    // Suisui's Outro (team All DMG Amplified, 30s) stays up through switches
    const steps: RotationStep[] = [...press(S, 'basic'), ...press(H, 'basic'), ...press(L, 'basic'), ...press(H, 'basic')];
    const r = simulate({ steps, fullConcerto: true }, team(), data);
    const lane = r.lanes.find((l) => l.owner === char(S).id && /Rippling Waters/.test(l.label))!;
    expect(lane.rule.incomingOnly).toBe(false);
    expect(lane.rule.seconds).toBe(30);
    const lastHiyuki = r.moves.filter((m) => m.char === char(H).id && m.via === 'press').at(-1)!;
    expect(lastHiyuki.buffs.some((b) => /Rippling Waters/.test(b))).toBe(true);
  });

  it('Liberations spend Resonance Energy and warn when short', () => {
    const r = simulate({ steps: press(S, 'liberation', 'liberation') }, team(), data);
    expect(r.moves[0].warn).toEqual([]);
    expect(r.moves[1].warn.join()).toMatch(/Not enough Resonance Energy/);
  });

  it("the in-game Suisui > Lucilla > Hiyuki rotation gives the in-game resources", () => {
    const steps: RotationStep[] = [
      ...press(S, 'basic', 'basic', 'basic', 'basic', 'skill', 'basic', 'basic', 'basic', 'basic', 'liberation', 'echo'),
      { char: char(L).id, button: 'skill', swap: 'intro' }, ...press(L, 'liberation', 'basic', 'echo'),
      { char: char(H).id, button: 'basic', swap: 'intro' },
      ...press(H, 'heavy', 'liberation', 'echo', 'basic', 'basic', 'basic', 'basic', 'basic', 'skill', 'skill', 'iai', 'iai', 'iai', 'heavy', 'liberation'),
    ];
    const r = simulate({ steps, freezeLiberation: true }, team(), data);
    const res = (i: number, c: string) => r.states[i].get(char(c).id)!.res!;
    const label = (i: number) => r.moves.filter((m) => m.step === i && m.via === 'press')[0].move.label;
    // Suisui: Zephyr ×4 fills Cloud Breath, Skill is Awakening Spring, Drizzle ×4 = 600 Floral Epistle
    expect(label(4)).toBe('Resonance Skill - Awakening Spring');
    expect(res(8, S).epistle).toBe(600);
    expect(r.moves.find((m) => m.move.kind === 'Outro' && m.char === char(S).id)!.move.tags).toEqual({ 'Floral Epistle': 600 });
    // Lucilla: Intro 2 Photos, Spotlight 3, Liberation, held Basic spends them
    expect(Math.floor(r.states[11].get(char(L).id)!.res!.trace / 50)).toBe(3);
    expect(label(13)).toMatch(/Tracing Forms 1-2-3 \+ Oblivion ×3 \+ Letting It Go/);
    expect(r.moves.filter((m) => m.step === 13)[0].concerto).toBe(100);
    // Hiyuki: Intro 200 → Basic 3 300 → Frost Splinter 0
    expect(label(15)).toBe('Basic Attack - Present Self Stage 3');
    expect(res(15, H).dedication).toBe(300);
    expect(res(16, H).dedication).toBe(0);
    expect(res(17, H)).toMatchObject({ frostheart: 0, iai: 3, bitterfrost: 0 });
    expect(label(25)).toBe('Resonance Skill - Frostblight: Petalfall');
    expect(res(25, H)).toMatchObject({ frostheart: 300, iai: 3, bitterfrost: 0 });
    expect(res(28, H)).toMatchObject({ frostheart: 0, iai: 0, bitterfrost: 3 });
    expect(label(29)).toBe('Heavy Attack - Bitterfrost: Foreclaimed Self');
    expect(res(29, H)).toMatchObject({ bitterfrost: 0, blades: 2 }); // 1 from her inherent at the start + 1
    expect(label(30)).toMatch(/Blade Liberation \(2 Snowforged Blades\)/);
    // no warnings on Hiyuki's or Lucilla's own moves
    expect(r.moves.filter((m) => m.via === 'press' && m.char !== char(S).id).flatMap((m) => m.warn)).toEqual([]);
    // Suisui's 600 Floral Epistle Outro unlocks her 400+ buff lane
    expect(r.lanes.some((l) => l.owner === char(S).id && l.rule.needs?.min === 400)).toBe(true);
  });

  it('Blade Liberation uses as many Snowforged Blades as the step picks', () => {
    const m = machineFor(char(H).id, data);
    const s = { stage: 0, family: 'fore', form: 'fore', res: { blades: 3 } };
    expect(m.press(s, 'liberation').move.rows[0].bonus?.times).toBe(3);
    const one = m.press(s, 'liberation', 1);
    expect(one.move.rows[0].bonus?.times).toBe(1);
    expect(one.state.res!.blades).toBe(2);
    expect(one.move.choice!.options).toEqual(['0', '1', '2', '3']);
  });

  it("Lucilla's Skill can be Spotlight or Compensate", () => {
    const m = machineFor(char(L).id, data);
    expect(m.press(m.initial(), 'skill').move.rows[0].row).toBe('Spotlight DMG');
    expect(m.press(m.initial(), 'skill', 1).move.rows[0].row).toBe('Compensate DMG');
  });

  it("Hiyuki's position: Jade Cleave launches her, mid-air Basics end in a plunge that lands her", () => {
    const m = machineFor(char(H).id, data);
    let s = m.press(m.initial(), 'liberation').state;
    const go = (b: string) => { const r = m.press(s, b); s = r.state; return r.move.rows[0].row; };
    expect(go('skill')).toBe('Frostblight: Jade Cleave DMG');
    expect(s.air).toBe(true);
    expect(go('basic')).toBe('Mid-air Attack - Foreclaimed Self Stage 1 DMG');
    expect(go('basic')).toBe('Mid-air Attack - Foreclaimed Self Stage 2 DMG');
    expect(go('basic')).toBe('Mid-air Plunging Attack - Foreclaimed Self DMG');
    expect(s.air).toBe(false);
    expect(go('skill')).toBe('Frostblight: Jade Cleave DMG');
    expect(go('skill')).toBe('Frostblight: Petalfall DMG');
    expect(s.air).toBe(false); // Petalfall lands her
    go('skill');
    s = { ...s, res: { ...s.res, frostheart: 300 } };
    expect(go('iai')).toBe('Basic Attack - Iai DMG');
    expect(s.air).toBe(true); // Iai is a dash: still in the air
    expect(go('basic')).toBe('Mid-air Attack - Foreclaimed Self Stage 1 DMG');
  });

  it('Hiyuki: Iai Stance (0 s) makes Basic the Iai strike while 100+ Frostheart is left; other moves end it', () => {
    const m = machineFor(char(H).id, data, 0);
    let s = m.press(m.initial(), 'liberation').state; // Inward Vision
    expect(m.press(s, 'stance').move.warn).toMatch(/100 Frostheart \(has 0\)/);
    s = { ...s, res: { ...s.res, frostheart: 250 } };
    const stance = m.press(s, 'stance');
    expect(stance.move).toMatchObject({ seconds: 0, rows: [], icon: 'E1' });
    expect(stance.move.warn).toBeUndefined();
    s = stance.state;
    const go = (b: string) => { const r = m.press(s, b); s = r.state; return r.move; };
    expect(go('basic')).toMatchObject({ label: 'Basic Attack - Iai', special: true, icon: 'A1' }); // 150 left
    expect(go('basic').label).toBe('Basic Attack - Iai'); // 50 left: stance ends
    expect(go('basic').label).toBe('Basic Attack - Foreclaimed Self Stage 1');
    s = m.press({ ...s, res: { ...s.res, frostheart: 300 } }, 'stance').state;
    go('skill');
    expect(go('basic').label).not.toBe('Basic Attack - Iai');
  });

  it('Hiyuki starts the fight with 1 Snowforged Blade (inherent), 3 at S2+ (the first Blade Liberation is the big one)', () => {
    expect(machineFor(char(H).id, data, 0).initial().res!.blades).toBe(1);
    const m = machineFor(char(H).id, data, 6);
    let s = m.initial();
    expect(s.res!.blades).toBe(3);
    s = m.press(s, 'liberation').state; // Inward Vision
    const blade = m.press(s, 'liberation');
    expect(blade.move.rows[0].bonus?.times).toBe(3);
    expect(blade.move.choice!.options).toEqual(['0', '1', '2', '3']);
    // and in a rotation, the build's sequence decides
    const b = team();
    b[char(H).id] = { ...b[char(H).id], sequence: 6 };
    const r = simulate({ steps: press(H, 'liberation', 'liberation') }, b, data);
    expect(r.moves[1].move.rows[0].bonus?.times).toBe(3);
  });

  it("S2: the first two Jade Cleave / Petalfall restore 50 more Frostheart", () => {
    const m = machineFor(char(H).id, data, 2);
    let s = m.press(m.initial(), 'liberation').state;
    s = m.press(s, 'skill').state;
    expect(s.res!.frostheart).toBe(FROSTHEART_SKILL + 50);
    s = m.press(s, 'skill').state;
    expect(s.res!.frostheart).toBe(Math.min(300, 2 * (FROSTHEART_SKILL + 50)));
  });

  it('sequence buffs time themselves from the sequence text (Hiyuki S4: 30s after her Skill)', () => {
    const b = team();
    b[char(H).id] = { ...b[char(H).id], sequence: 4 };
    const r = simulate({ steps: press(H, 'skill', 'basic') }, b, data);
    const lane = r.lanes.find((l) => /S4/.test(l.label))!;
    expect(lane.rule).toMatchObject({ on: ['skill'], seconds: 30 });
    expect(r.moves[0].buffs.some((x) => /S4/.test(x))).toBe(false);
    expect(r.moves[1].buffs.some((x) => /S4/.test(x))).toBe(true);
  });

  it('every move lists the other buffs that counted (weapon, sets, teammates…)', () => {
    const r = simulate({ steps: press(H, 'basic') }, team(), data);
    expect(r.moves[0].always.length).toBeGreaterThan(0);
    expect(r.moves[0].always.some((b) => / R\d/.test(b))).toBe(true); // her weapon
  });

  it("weapon buffs time themselves from the weapon's text, and can start on either of two events", () => {
    const w = data.weapons.find((x) => x.name === 'The Last Dance')!;
    const user = data.characters.find((c) => c.weaponType === w.type)!;
    const b = { ...build(user.name), weapon: { id: w.id, rank: 1 } };
    const r = simulate({ steps: [{ char: user.id, button: 'basic' }, { char: user.id, button: 'liberation' }, { char: user.id, button: 'basic' }] }, { [user.id]: b }, data);
    const lane = r.lanes.find((l) => /The Last Dance/.test(l.label))!;
    expect(lane.rule.on).toEqual(['intro', 'liberation']);
    expect(r.moves[0].buffs.some((x) => /The Last Dance/.test(x))).toBe(false);
    expect(r.moves[2].buffs.some((x) => /The Last Dance/.test(x))).toBe(true);
  });

  it('Suisui S3: Drizzle Skill chains into Stage 4, which spends Kingfisher for +350 Floral Epistle and +20 Concerto', () => {
    const at = (seq: number) => {
      const m = machineFor(char(S).id, data, seq);
      let s = m.press(m.initial(), 'intro').state; // Drizzle Stance
      s = m.press(s, 'skill').state;
      const r = m.press(s, 'basic');
      return { row: r.move.rows[0].row, epistle: r.state.res!.epistle, concerto: r.move.concerto };
    };
    expect(at(0)).toEqual({ row: 'Basic Attack - Drizzle Stance Stage 1 DMG', epistle: 300, concerto: undefined });
    expect(at(3)).toEqual({ row: 'Basic Attack - Drizzle Stance Stage 4 DMG', epistle: 600, concerto: 20 });
  });

  it("Lucilla S6: Letting It Go gets one Remembrance stack per Photo spent", () => {
    const b = team();
    b[char(L).id] = { ...b[char(L).id], sequence: 6 };
    const hit = (photos: number) => {
      const steps: RotationStep[] = [...press(L, ...Array(photos).fill('skill')), ...press(L, 'liberation', 'basic')];
      const r = simulate({ steps }, b, data);
      return r.moves.at(-1)!.hits.find((h) => h.row.row === 'Letting It Go DMG')!.value;
    };
    // 1 Photo vs 3 Photos: Remembrance (+200% each) and the S4 ATK stacks both follow the Photos spent
    expect(hit(3) / hit(1)).toBeGreaterThan(2);
    const b5 = { ...b, [char(L).id]: { ...b[char(L).id], sequence: 5 } };
    const r5 = simulate({ steps: [...press(L, 'skill', 'skill', 'skill'), ...press(L, 'liberation', 'basic')] }, b5, data);
    expect(hit(3) / r5.moves.at(-1)!.hits.find((h) => h.row.row === 'Letting It Go DMG')!.value).toBeGreaterThan(2);
  });

  it("the Echo button hits with the build's main echo", () => {
    const echo = data.echoes.find((e) => e.name === 'Sentry Construct')!;
    const b = team();
    b[char(H).id] = { ...b[char(H).id], echoes: [{ echoId: echo.id, setId: echo.sets[0], main: { stat: 'critRate', value: 22 }, subs: [] }, null, null, null, null] };
    const r = simulate({ steps: press(H, 'echo') }, b, data);
    expect(r.moves[0].move.label).toBe('Echo Skill - Sentry Construct');
    expect(r.moves[0].damage).toBeGreaterThan(0);
    // and no echo: no damage, no warning
    const none = simulate({ steps: press(H, 'echo') }, team(), data);
    expect(none.moves[0].damage).toBe(0);
  });

  it('Glacio Chafe: stacks per move, Frostbind, Snow Rust, Film Roll and Snow Rust Glacio Bite', () => {
    const b = team();
    b[char(H).id] = { ...b[char(H).id], sequence: 6 };
    const steps: RotationStep[] = [
      ...press(S, 'skill', 'skill', 'skill', 'skill', 'basic', 'basic', 'basic', 'basic', 'skill'), // Zephyr Skill ×4 fills Cloud Breath → Awakening Spring
      { char: char(L).id, button: 'skill', swap: 'intro' }, ...press(L, 'liberation', 'basic'),
      { char: char(H).id, button: 'basic', swap: 'intro' }, ...press(H, 'heavy', 'liberation'),
    ];
    const r = simulate({ steps }, b, data);
    const ch = r.moves.filter((m) => m.chafe);
    expect(ch.length).toBeGreaterThan(4);
    // Lucilla's Film Roll adds 2 when Hiyuki inflicts (Intro: 1 + 2)
    const intro = r.moves.find((m) => m.char === char(H).id && m.move.kind === 'Intro')!;
    expect(intro.chafe!.inflicted).toBe(3);
    // Inward Vision at 10+ stacks triggers Frostbind
    const iv = r.moves.find((m) => /Inward Vision/.test(m.move.label))!;
    expect(iv.chafe!.frostbind).toBe(true);
    // Snow Rust 3 (all three inflicted), and Hiyuki's own Glacio Chafe adds Glacio Bite hits
    expect(intro.chafe!.snowRust).toBe(3);
    expect(intro.chafe!.bites).toBeGreaterThan(0);
    expect(intro.hits.some((h) => /Glacio Bite/.test(h.row.row))).toBe(true);
    // Suisui's and Lucilla's own Glacio Chafe off Hiyuki's field time adds no Glacio Bite
    expect(r.moves.filter((m) => m.char !== char(H).id).every((m) => !m.chafe?.bites)).toBe(true);
    // at S0 (Snow Rust 2 needs two inflicting Resonators) the multiplier is 102% instead of 590%
    const s0 = simulate({ steps }, team(), data).moves.find((m) => m.char === char(H).id && m.move.kind === 'Intro')!;
    const bite = (m: typeof intro) => m.hits.find((h) => h.row.row === SNOW_RUST_BITE)!.value;
    expect(bite(intro) / bite(s0)).toBeGreaterThan(5);
    // with Hiyuki in the team every new stack is a Glacio Bite hit at the multiplier of the stack limit (10: 203.77%)
    const own = intro.hits.filter((h) => h.row.row === 'Glacio Bite DMG');
    expect(own).toHaveLength(intro.chafe!.inflicted);
    expect(own.every((h) => h.status === 'Glacio Bite')).toBe(true);
  });

  it('weapons that restore Concerto on a Skill or Liberation count (Variation R5: +16 per Resonance Skill)', () => {
    const w = data.weapons.find((x) => x.name === 'Variation')!;
    const b = team();
    const plain = simulate({ steps: press(S, 'skill') }, b, data).moves[0].concerto;
    b[char(S).id] = { ...b[char(S).id], weapon: { id: w.id, rank: 5 } };
    expect(simulate({ steps: press(S, 'skill') }, b, data).moves[0].concerto).toBeCloseTo(plain + 16);
    const lull = data.weapons.find((x) => x.name === 'Lullaby')!;
    b[char(S).id] = { ...b[char(S).id], weapon: { id: lull.id, rank: 1 } };
    // +8 on Liberation, once every 20s
    const r = simulate({ steps: press(S, 'liberation', 'liberation') }, b, data);
    expect(r.moves[1].concerto - r.moves[0].concerto).toBeCloseTo(20);
  });
});

describe('Chisa, Ciaccona and Cartethyia machines (the owner\'s ToA floor 1 press list)', () => {
  const builds = () => Object.fromEntries(['Chisa', 'Ciaccona', 'Cartethyia'].map((n) => [char(n).id, defaultBuild(char(n).id)]));
  const steps: RotationStep[] = [
    ...press('Chisa', 'skill', 'basic', 'basic', 'basic', 'liberation', 'echo'), { char: char('Chisa').id, button: 'skill', option: 1 }, ...press('Chisa', 'basic', 'basic', 'basic'),
    { char: char('Ciaccona').id, button: 'basic', swap: 'intro' }, ...press('Ciaccona', 'basic', 'jump', 'basic', 'basic', 'basic', 'skill', 'heavy', 'liberation'),
    { char: char('Cartethyia').id, button: 'basic', swap: 'intro' },
    ...press('Cartethyia', 'basic', 'basic', 'skill', 'basic', 'liberation', 'skill', 'echo', 'jump', 'basic', 'basic', 'skill', 'basic', 'basic', 'basic', 'heavy', 'basic', 'liberation'),
  ];
  const r = simulate({ steps, freezeLiberation: true }, builds(), data);
  const labels = (name: string) => r.moves.filter((m) => m.char === char(name).id && m.via === 'press').map((m) => m.move.label);

  it('a swap-cancelled move still lands and takes no time; its cast Concerto counts, its hits’ Concerto comes after the Outro', () => {
    const ch = char('Chisa').id;
    const base = [...steps.slice(0, 9), { ...steps[9], cancel: true }, ...steps.slice(10)];
    const c = simulate({ steps: base, freezeLiberation: true }, builds(), data);
    const era = c.moves.find((m) => /Eradication/.test(m.move.label))!;
    expect(era.seconds).toBe(0);
    expect(era.damage).toBeGreaterThan(0);
    const outro = c.moves.find((m) => m.char === ch && m.move.kind === 'Outro')!;
    // Eradication's 45 Concerto Regen counts on cast; only its hits' 4.8 come late
    expect(outro.warn[0]).toMatch(/isn't full \(90\/100\)/);
    const withoutCancel = simulate({ steps, freezeLiberation: true }, builds(), data);
    expect(withoutCancel.time - c.time).toBeCloseTo(withoutCancel.moves.find((m) => /Eradication/.test(m.move.label))!.seconds, 6);
  });

  it('Chisa: Skill chains into Rending Lunge → Death Snip; Serrated Loop → Sawring - Blitz 2, 3 → Eradication', () => {
    expect(labels('Chisa')).toEqual([
      'Resonance Skill - Eye of Unraveling', 'Normal Attack - Rending Lunge', 'Normal Attack - Death Snip', 'Normal Attack - Death Snip Additional',
      'Resonance Liberation - Moment of Nihility', expect.stringMatching(/^Echo Skill/), 'Resonance Skill - Serrated Loop',
      'Sawring - Blitz Stage 2 + Discordance', 'Sawring - Blitz Stage 3 + Falltone', expect.stringMatching(/^Sawring - Eradication \(\d+ Ring of Chainsaw spent\)$/),
    ]);
    // Ring of Chainsaw from the game data per hit: 92 by the forced Serrated Loop (the game had 100)
    expect(r.moves.find((m) => /Serrated Loop/.test(m.move.label))!.warn).toEqual(['Serrated Loop needs 100 Ring of Chainsaw (has 92)']);
    // Eradication: Ring spent (Blitz 2, 3 with Discordance, Falltone) × 2.2 in Woven Myriad - Convergence (after her Liberation)
    const era = r.moves.find((m) => /Eradication/.test(m.move.label))!;
    expect(era.move.rows[0].bonus).toEqual({ row: 'Bonus DMG Multiplier per Ring of Chainsaw', times: 101 }); // 46 spent
    expect(era.move.levels).toEqual({ 'c.chisa.conv': 1 });
  });

  it('Ciaccona: Intro → Stage 3, Stage 4, jump, Mid-air 1-2 → Stage 4; 3 Musical Essence → Quadruple Downbeat; Recital Tonic on the switch', () => {
    expect(labels('Ciaccona')).toEqual([
      'Normal Attack - Stage 3', 'Normal Attack - Stage 4', 'Jump', 'Mid-air Attack Stage 1', 'Mid-air Attack Stage 2',
      'Normal Attack - Stage 4', 'Resonance Skill - Harmonic Allegro', 'Forte Circuit - Quadruple Downbeat', 'Resonance Liberation - Improvised Symphonic Poem Skill',
    ]);
    const lib = r.moves.find((m) => /Improvised Symphonic Poem/.test(m.move.label))!;
    expect(lib.concerto).toBe(100);
    expect(r.moves.find((m) => m.char === char('Ciaccona').id && m.move.kind === 'Outro')!.move.rows.map((x) => x.row)).toContain('Symphonic Poem: Tonic DMG');
  });

  it("Cartethyia: Sword Shadows recalled by her plunge, Fleurdelys' moves, Blade of Howling Squall at 120 Conviction", () => {
    const l = labels('Cartethyia');
    // Intro → Stage 2; Intro, Stage 4 and Skill summoned all 3 Sword Shadows (owner: "I did 2, 3, 4")
    expect(l).toEqual([
      'Basic Attack - Cartethyia Stage 2', 'Basic Attack - Cartethyia Stage 3', 'Basic Attack - Cartethyia Stage 4', 'Resonance Skill - Cartethyia',
      'Mid-air Attack - Cartethyia (3 Sword Shadows recalled)',
      "Resonance Liberation - A Knight's Heartfelt Prayers", "Resonance Skill - Sword to Answer Waves' Call", expect.stringMatching(/^Echo Skill/), 'Jump',
      'Mid-air Attack - Fleurdelys Stage 1', 'Mid-air Attack - Fleurdelys Stage 2', 'Resonance Skill - May Tempest Break the Tides',
      'Basic Attack - Fleurdelys Stage 3', 'Basic Attack - Fleurdelys Stage 4', 'Basic Attack - Fleurdelys Stage 5', 'Heavy Attack - Fleurdelys',
      'Enhanced Heavy Attack - Fleurdelys', 'Resonance Liberation - Blade of Howling Squall',
    ]);
    // A Knight's Heartfelt Prayers has no damage row but costs its 125 Energy and gives its 20 Concerto
    const prayers = r.moves.find((m) => /Heartfelt Prayers/.test(m.move.label))!;
    expect(prayers.energy).toBe(0);
    expect(prayers.concerto - r.moves[r.moves.indexOf(prayers) - 1].concerto).toBeCloseTo(20);
    expect(r.moves.filter((m) => m.char === char('Cartethyia').id).flatMap((m) => m.warn)).toEqual([]);
  });
});

describe('Qingxiao and Hsin machines (from the kit text)', () => {
  const run = (name: string, buttons: string[], conditions: Record<string, number> = {}) => {
    const id = char(name).id;
    const r = simulate({ steps: buttons.map((button) => ({ char: id, button })), freezeLiberation: true }, { [id]: { ...defaultBuild(id), conditions } }, data);
    const m = machineFor(id, data, 0, conditions);
    return { r, labels: r.moves.filter((x) => x.via === 'press').map((x) => x.move.label), gauge: (i: number) => Object.fromEntries((m.gauges?.(r.states[i].get(id)!) ?? []).map((g) => [g.label, Math.round(g.value)])) };
  };

  it('Qingxiao: Stringblade fills Qin Heart (1, 4) and Sword Cadence (2, 3) from the data, doubled by Heaven’s Clarity; Heavy → Ephemeral Transcendence → Heaven’s Reckoning', () => {
    const q = run('Qingxiao', ['intro', 'basic', 'basic', 'basic', 'basic', 'skill', 'basic', 'basic', 'basic', 'basic', 'heavy', 'basic', 'basic', 'basic', 'basic', 'heavy', 'liberation']);
    expect(q.gauge(1)).toEqual({ 'Qin Heart': 39, 'Sword Cadence': 30 }); // Stage 1: 19.48 × 2; Intro +30 Sword Cadence
    expect(q.labels[5]).toBe('Resonance Skill - Severing Note: Judgement');
    expect(q.labels[6]).toBe('Basic Attack - Stringblade Stage 4'); // Judgement chains into Stage 4
    expect(q.labels[10]).toBe('Heavy Attack - Stringblade');
    expect(q.gauge(14)).toEqual({ 'Heart Sword Intent': 100 });
    expect(q.labels[15]).toMatch(/Heaven's Reckoning/);
    const hr = q.r.moves.find((m) => /Heaven's Reckoning/.test(m.move.label))!;
    expect(hr.move.levels).toEqual({ 'c.qing.hr': 1 }); // Heavy Attack - Stringblade was cast with Heaven's Clarity
    expect(q.r.moves.filter((m) => m.via === 'press').flatMap((m) => m.warn)).toEqual([]);
    expect(q.r.moves.at(-1)!.concerto).toBe(100);
  });

  it('Qingxiao: Severing Note during Stage 2 is Ascendant; a Heavy without full gauges warns', () => {
    expect(run('Qingxiao', ['basic', 'basic', 'skill']).labels[2]).toBe('Resonance Skill - Severing Note: Ascendant');
    expect(run('Qingxiao', ['heavy']).r.moves[0].warn[0]).toMatch(/needs full Qin Heart and Sword Cadence/);
  });

  it('Hsin (Electro Flare): Realm Wanderer at 100 Answering Heart unlocks Formshift; the Heartlock collapse gives +150 Illumining Heart; Pillars Aligned → Dominion → Beholding → Pillars Across Heaven', () => {
    const h = run('Hsin', ['intro', 'basic', 'skill', 'basic', 'basic', 'basic', 'heavy', 'liberation', 'basic', 'basic', 'skill', 'skill', 'skill', 'basic', 'basic', 'basic', 'basic', 'heavy', 'liberation']);
    expect(h.labels[1]).toBe('Basic Attack - Answering Form Stage 4'); // Electro Flare Intro chains into Stage 4
    expect(h.labels[6]).toBe('Heavy Attack - Answering Form: Realm Wanderer');
    expect(h.labels[7]).toBe('Resonance Liberation - Formshift');
    expect(h.gauge(9)).toEqual({ 'Illumining Heart': 30 + 30 + 150 });
    expect(h.labels[12]).toBe('Resonance Skill - Illumining Form: Pillars Aligned');
    expect(h.labels.slice(13, 17)).toEqual([1, 2, 3, 4].map((n) => `Basic Attack - Illumining Form: Pillars Aligned Stage ${n}`));
    expect(h.labels[17]).toBe('Heavy Attack - Illumining Form: Beholding All Horizons');
    expect(h.labels[18]).toBe('Resonance Liberation - Pillars Across Heaven');
    expect(h.r.moves.filter((m) => m.via === 'press').flatMap((m) => m.warn).filter((w) => !/Energy/.test(w))).toEqual([]);
  });

  it('Hsin (Unison): her Intro chains into Stage 3 and uses the Unison row', () => {
    const h = run('Hsin', ['intro', 'basic'], { 'c.hsin.mode': 1 });
    expect(h.r.moves[0].move.rows[0].row).toBe('Intro Skill - Answering Form DMG in Resonance Mode - Unison');
    expect(h.labels[1]).toBe('Basic Attack - Answering Form Stage 3');
  });

  it('Resonance Energy: "Resonance Energy Cost" rows count as costs, and a max of 0 holds nothing', () => {
    expect(maxEnergyOf(char('Mornye'))).toBe(175);
    expect(maxEnergyOf(char('Lynae'))).toBe(125);
    expect(maxEnergyOf(char('Lucilla'))).toBe(0); // "Lucilla holds up to 0 Resonance Energy"
    const r = simulate({ steps: [...press(L, 'basic', 'basic', 'skill')] }, team(), data);
    expect(r.moves.every((m) => m.energy === 0)).toBe(true);
  });

  it('Hsin at S2 enters the fight with 100 Answering Heart', () => {
    expect(machineFor(char('Hsin').id, data, 1).initial().res!.answer).toBe(0);
    expect(machineFor(char('Hsin').id, data, 2).initial().res!.answer).toBe(100);
  });
});
