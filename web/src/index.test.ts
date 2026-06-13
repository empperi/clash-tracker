import { expect, test } from 'vitest';
import { clanRoleRank } from '@clash-tracker/core';

test('import core from web works', () => {
  expect(clanRoleRank('leader')).toBe(4);
});
