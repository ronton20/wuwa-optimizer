import type { Character, Sonata } from '../../data/types';
import type { Effect } from '../types';

/** Sonata set effects. 2-piece stat bonuses come straight from the game data; conditional ones are written here. */
const SET_CONDITIONAL: Record<string, Record<number, Effect[]>> = {
  'Wishes of Quiet Snowfall': {
    5: [{
      id: 's.wqs.5', group: 'echo', source: 'Wishes of Quiet Snowfall 5pc', text: 'Inflicting Glacio Chafe: Glacio DMG +10%',
      condition: { kind: 'toggle', label: 'Inflicted Glacio Chafe', default: true },
      mods: [{ key: 'dmgGlacio', value: 10 }],
    }, {
      id: 's.wqs.5.cr', group: 'echo', source: 'Wishes of Quiet Snowfall 5pc', text: 'Snowfall consumed by Liberation DMG: Crit. Rate +25%',
      condition: { kind: 'toggle', label: 'Snowfall → Crit. Rate', default: false },
      mods: [{ key: 'critRate', value: 25 }],
    }],
  },
  'Windward Pilgrimage': {
    5: [{
      id: 's.windward.5', group: 'echo', source: 'Windward Pilgrimage 5pc', text: 'Hitting a target with Aero Erosion: Crit. Rate +10%, Aero DMG +30%',
      condition: { kind: 'toggle', label: 'Target has Aero Erosion', default: true },
      mods: [{ key: 'critRate', value: 10 }, { key: 'dmgAero', value: 30 }],
    }],
  },
  "Heart of Evil's Purge": {
    5: [{
      id: 's.hoep.5', group: 'echo', source: "Heart of Evil's Purge 5pc", text: 'Inflicting Tune Strain - Shifting: Crit. DMG +20%, Aero DMG +30%',
      condition: { kind: 'toggle', label: 'Inflicted Tune Strain - Shifting', default: true },
      mods: [{ key: 'critDmg', value: 20 }, { key: 'dmgAero', value: 30 }],
    }],
  },
  'Thread of Severed Fate': {
    3: [{
      id: 's.thread.3', group: 'echo', source: 'Thread of Severed Fate 3pc', text: 'Inflicting Havoc Bane: ATK +20%, Liberation DMG +30%',
      condition: { kind: 'toggle', label: 'Inflicted Havoc Bane', default: true },
      mods: [{ key: 'atkPct', value: 20 }, { key: 'dmgLib', value: 30 }],
    }],
  },
};

export function sonataEffects(counts: Map<Sonata, number>): Effect[] {
  const out: Effect[] = [];
  for (const [set, n] of counts) {
    for (const piece of set.effects) {
      if (n < piece.pieces) continue;
      if (piece.stats.length)
        out.push({ id: `s.${set.id}.${piece.pieces}`, group: 'echo', source: `${set.name} ${piece.pieces}pc`, text: piece.stats.map((s) => `${s.stat} +${s.value}`).join(', '), mods: piece.stats.map((s) => ({ key: s.stat, value: s.value })) });
      out.push(...(SET_CONDITIONAL[set.name]?.[piece.pieces] ?? []));
    }
  }
  return out;
}

/** Main-slot echo passives. */
const MAIN_ECHO: Record<string, (c: Character) => Effect[]> = {
  'Reminiscence: Threnodian - Voidborne Construct': () => [{
    id: 'e.voidborne', group: 'echo', source: 'Main echo · Voidborne Construct', text: 'Glacio DMG +12%, Resonance Liberation DMG +12%',
    mods: [{ key: 'dmgGlacio', value: 12 }, { key: 'dmgLib', value: 12 }],
  }],
  'Reminiscence: Threnodian - Leviathan': () => [{
    id: 'e.leviathan', group: 'echo', source: 'Main echo · Leviathan', text: 'Havoc DMG +12%, Resonance Liberation DMG +12%',
    mods: [{ key: 'dmgHavoc', value: 12 }, { key: 'dmgLib', value: 12 }],
  }],
  'Reminiscence: Fleurdelys': (c) => [{
    id: 'e.fleurdelys', group: 'echo', source: 'Main echo · Fleurdelys', text: 'Aero DMG +10% (+10% more for Aero Rover or Cartethyia)',
    mods: [{ key: 'dmgAero', value: c.name === 'Cartethyia' || /Rover/.test(c.name) && c.element === 'Aero' ? 20 : 10 }],
  }],
  'Calamity Effigy': () => [{
    id: 'e.calamity', group: 'echo', source: 'Main echo · Calamity Effigy', text: 'Aero DMG +10%',
    mods: [{ key: 'dmgAero', value: 10 }],
  }, {
    id: 'e.calamity.shift', group: 'echo', source: 'Main echo · Calamity Effigy', text: 'Inflicting Tune Strain - Shifting: Aero DMG +10%',
    condition: { kind: 'toggle', label: 'Inflicted Tune Strain - Shifting', default: true },
    mods: [{ key: 'dmgAero', value: 10 }],
  }],
};

export function mainEchoEffects(echoName: string, c: Character): Effect[] {
  return MAIN_ECHO[echoName]?.(c) ?? [];
}
