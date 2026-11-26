/// <reference lib="webworker" />
// Runs the optimizer off the main thread so the page stays responsive.
import data from '../data/current';
import { optimize, type OptimizeOptions } from './optimizer';
import type { Build } from './types';

self.onmessage = (e: MessageEvent<{ build: Build; opts: OptimizeOptions }>) => {
  const { build, opts } = e.data;
  const result = optimize(build, data, opts, (done, total) => self.postMessage({ type: 'progress', done, total }));
  self.postMessage({ type: 'done', result });
};
