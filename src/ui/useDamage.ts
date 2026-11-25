import { useMemo } from 'react';
import data from '../data/current';
import { computeDamage } from '../engine';
import type { Build } from '../engine/types';

/** Stats + every hit for a build. Recomputed only when the build object changes. */
export function useDamage(build: Build) {
  return useMemo(() => computeDamage(build, data), [build]);
}
