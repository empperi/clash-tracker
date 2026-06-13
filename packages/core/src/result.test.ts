import { expect, test } from 'vitest';
import { ok, err } from './result';

test('ok creates successful result', () => {
  const res = ok('hello');
  expect(res.success).toBe(true);
  expect(res.value).toBe('hello');
});

test('err creates failed result', () => {
  const res = err('some error');
  expect(res.success).toBe(false);
  expect(res.error).toBe('some error');
});
