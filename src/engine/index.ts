// Public API of the damage engine. Pure TypeScript — no React — so the v2 optimizer can run it in a Web Worker.
export { computeDamage, BREAKDOWN_GROUPS, type HitResult, type DamageOptions, type Zones } from './damage';
export { computeStats, type Stats, type Contribution, type ContributionGroup } from './stats';
export { collectEffects, resolveEffects } from './effects';
export { NOT_MODELLED } from './effects/characters';
export { ENEMY_PRESETS, DEFAULT_ENEMY, defMultiplier, resMultiplier } from './enemy';
export type { Build, EchoPiece, Effect, Enemy } from './types';
