import { useMemo } from 'react';
import data from '../data/current';
import { computeDamage, DEFAULT_ENEMY } from '../engine';
import type { Build } from '../engine/types';

/** Stats + every hit for a build. Recomputed only when the build object changes. */
export function useDamage(build: Build) {
  return useMemo(() => computeDamage(build, data, { enemy: DEFAULT_ENEMY }), [build]);
}
