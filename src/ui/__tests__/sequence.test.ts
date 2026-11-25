import { expect, it } from 'vitest';
import { nextSequence } from '../tabs/SequencesTab';

it('sequence nodes: click jumps to that node, clicking the last lit node clears all', () => {
  expect(nextSequence(0, 3)).toBe(3); // up
  expect(nextSequence(5, 2)).toBe(2); // down
  expect(nextSequence(4, 4)).toBe(0); // last lit -> S0
  expect(nextSequence(6, 6)).toBe(0);
});
