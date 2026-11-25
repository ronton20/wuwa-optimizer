// Public API of the damage engine. Pure TypeScript — no React — so the v2 optimizer can run it in a Web Worker.
export { computeDamage, BREAKDOWN_GROUPS, type HitResult, type DamageOptions, type Zones } from './damage';
export { computeStats, type Stats, type Contribution, type ContributionGroup } from './stats';
export { collectEffects, resolveEffects, conditionKey, conditionMaxes, teammateEffects } from './effects';
export { NOT_MODELLED } from './effects/characters';
export { DEFAULT_ENEMY, uniformRes, defMultiplier, resMultiplier } from './enemy';
export { statWeights, rollValues, type StatWeight, type RollValue } from './statWeights';
export { SIGNATURE, signatureOf } from './signatures';
export type { Build, EchoPiece, Effect, Enemy, Teammate } from './types';
export { TEAM_ECHOES, TEAM_SETS, TEAM_WEAPONS, TEAM_KITS, TEAM_NOT_MODELLED, echoBaseName } from './effects/team';

import data from '../data/current';
import { KITS } from './effects/characters';
/** Characters whose own kit is modelled (teammate-only characters are left out of the roster). */
export const PLAYABLE = data.characters.filter((c) => KITS[c.name]);
