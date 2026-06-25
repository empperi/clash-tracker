import { describe, it, expect } from 'vitest';
import { buildSignInEmail, buildInvitationEmail } from './email.js';

describe('buildSignInEmail', () => {
  it('builds email with correct subject, prominent OTP code, and magic link', () => {
    const code = '789012';
    const link = 'https://clash-tracker.web.app/login?apiKey=123';

    const email = buildSignInEmail(code, link);

    // Check subject
    expect(email.subject).toContain(code);
    expect(email.subject).toContain('Sign-In Code');

    // Check HTML content
    expect(email.html).toContain(code);
    expect(email.html).toContain(link);
    expect(email.html).toContain('Preferred');
    expect(email.html).toContain('10 minutes');
    expect(email.html).toContain('single-use');

    // Check text content
    expect(email.text).toContain(code);
    expect(email.text).toContain(link);
    expect(email.text).toContain('PREFERRED');
    expect(email.text).toContain('10 minutes');
    expect(email.text).toContain('single-use');

    // Ensure no secrets are leaked
    expect(email.html).not.toContain('API_KEY');
    expect(email.html).not.toContain('PEPPER');
  });
});

describe('buildInvitationEmail', () => {
  it('builds invitation email with correct subject, details and registration link', () => {
    const link = 'https://clash-tracker.web.app/register?inviteId=invite123';

    const email = buildInvitationEmail(link);

    // Check subject
    expect(email.subject).toContain('Invitation to join Clash Tracker as an Admin');

    // Check HTML content
    expect(email.html).toContain(link);
    expect(email.html).toContain('administrator');
    expect(email.html).toContain('30 minutes');
    expect(email.html).toContain('single-use');

    // Check text content
    expect(email.text).toContain(link);
    expect(email.text).toContain('administrator');
    expect(email.text).toContain('30 minutes');
    expect(email.text).toContain('single-use');
  });
});
