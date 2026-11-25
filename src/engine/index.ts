// Public API of the damage engine. Pure TypeScript — no React — so the v2 optimizer can run it in a Web Worker.
export { computeDamage, BREAKDOWN_GROUPS, type HitResult, type DamageOptions, type Zones } from './damage';
export { computeStats, type Stats, type Contribution, type ContributionGroup } from './stats';
export { collectEffects, resolveEffects, conditionKey, conditionMaxes, teammateEffects } from './effects';
export { NOT_MODELLED } from './effects/characters';
export { DEFAULT_ENEMY, uniformRes, defMultiplier, resMultiplier } from './enemy';
export { statWeights, rollValues, echoScores, type StatWeight, type RollValue, type EchoScore } from './statWeights';
export { SIGNATURE, signatureOf } from './signatures';
export type { Build, EchoPiece, Effect, Enemy, Teammate } from './types';
export { TEAM_ECHOES, TEAM_SETS, TEAM_WEAPONS, TEAM_KITS, TEAM_NOT_MODELLED, echoBaseName } from './effects/team';

import data from '../data/current';
import { KITS } from './effects/characters';
/** Every playable Resonator. */
export const PLAYABLE = data.characters;
/** True when a character's own conditional buffs (inherents, Forte, sequences) are modelled. */
export const hasKit = (name: string) => Boolean(KITS[name]);
