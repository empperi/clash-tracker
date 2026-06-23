import { Result, ok, err } from './result.js';

/**
 * Validates that the acceptance percentage is an integer between 0 and 100.
 */
export function validateAcceptancePercent(val: unknown): Result<number, string> {
  if (typeof val !== 'number') {
    return err('Acceptance percentage must be a number');
  }
  if (!Number.isInteger(val)) {
    return err('Acceptance percentage must be an integer');
  }
  if (val < 0 || val > 100) {
    return err('Acceptance percentage must be between 0 and 100');
  }
  return ok(val);
}

/**
 * Validates that the minimum war participation is an integer between 0 and 20.
 */
export function validateMinWarParticipation(val: unknown): Result<number, string> {
  if (typeof val !== 'number') {
    return err('Minimum war participation must be a number');
  }
  if (!Number.isInteger(val)) {
    return err('Minimum war participation must be an integer');
  }
  if (val < 0 || val > 20) {
    return err('Minimum war participation must be between 0 and 20');
  }
  return ok(val);
}
