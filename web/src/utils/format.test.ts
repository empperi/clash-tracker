import { describe, it, expect } from 'vitest';
import { roleLabel } from './format';

describe('roleLabel', () => {
  it('maps each role to the game terminology', () => {
    expect(roleLabel('leader')).toBe('Leader');
    expect(roleLabel('coLeader')).toBe('Co-Leader');
    expect(roleLabel('elder')).toBe('Elder');
    expect(roleLabel('member')).toBe('Member');
  });
});
