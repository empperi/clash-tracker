import { describe, it, expect } from 'vitest';
import { classifyCocError } from './gateway-types';

describe('classifyCocError', () => {
  it('should map HTTP statuses to CocApiError types', () => {
    expect(classifyCocError(401)).toBe('Unauthorized');
    expect(classifyCocError(403)).toBe('IpNotWhitelisted');
    expect(classifyCocError(404)).toBe('NotFound');
    expect(classifyCocError(429)).toBe('RateLimited');
    expect(classifyCocError(503)).toBe('Maintenance');

    // Other errors
    expect(classifyCocError(500)).toBe('Unknown');
    expect(classifyCocError(400)).toBe('Unknown');
  });
});
