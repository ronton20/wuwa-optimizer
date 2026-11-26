import { describe, expect, it } from 'vitest';
import data from '../../data/current';
import { defaultBuild } from '../../state/buildStore';
import { uniformRes } from '../enemy';
import { genericMachine, machineFor, moveName } from '../rotation/actions';
import { moveResources, simulate, type RotationStep } from '../rotation/sim';
import { DEFAULT_TIMES, FROZEN_LIBERATION_TIME } from '../rotation/timing';
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
    expect(machineFor(char(H).id, data).buttons.map((b) => b.id)).toEqual(['basic', 'heavy', 'skill', 'liberation', 'echo', 'iai']);
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
    expect(blade.rows[0].bonus?.times).toBe(1);
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
    const r = simulate({ steps: press(H, 'basic', 'basic', 'basic') }, team(), data);
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
    expect(normal.time - frozen.time).toBeCloseTo(DEFAULT_TIMES.liberation - FROZEN_LIBERATION_TIME);
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
    expect(res(29, H)).toMatchObject({ bitterfrost: 0, blades: 1 });
    expect(label(30)).toMatch(/Blade Liberation \(1 Snowforged Blade\)/);
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

  it('Hiyuki at S2+ starts the fight with 3 Snowforged Blade (the first Blade Liberation is the big one)', () => {
    expect(machineFor(char(H).id, data, 0).initial().res!.blades).toBe(0);
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
    expect(s.res!.frostheart).toBe(125);
    s = m.press(s, 'skill').state;
    expect(s.res!.frostheart).toBe(250);
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
});
