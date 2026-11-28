import data from '../data/current';
import { simulate, type Rotation, type SimResult } from '../engine/rotation/sim';
import type { Build } from '../engine/types';
import { teamBuild, type Builds, type Team } from './buildStore';

/** The rotation that stands for a Resonator: the main team's if they're in it, else their first team's; its first rotation with moves. */
export function rotationFor(characterId: number, s: { teams: Team[]; mainTeam: string | null; rotations: Rotation[] }): { team: Team; rotation: Rotation } | undefined {
  const teams = s.teams.filter((t) => t.members.includes(characterId)).sort((a, b) => Number(b.id === s.mainTeam) - Number(a.id === s.mainTeam));
  for (const team of teams) {
    const rotation = s.rotations.find((r) => r.teamId === team.id && r.steps.length);
    if (rotation) return { team, rotation };
  }
  return undefined;
}

/** That rotation simulated with the team's builds; `override` replaces one member's build (a saved build to compare). */
export function rotationDps(team: Team, rotation: Rotation, builds: Builds, override?: Build): SimResult {
  const b = override ? { ...builds, [override.characterId]: override } : builds;
  const members = Object.fromEntries(team.members.map((m) => [m, teamBuild(m, team.members, b)]));
  return simulate(rotation, members, data);
}
