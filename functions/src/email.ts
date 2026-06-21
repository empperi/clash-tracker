export interface SignInEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Builds a sign-in email with a prominent 6-digit OTP code and a magic link alternative.
 */
export function buildSignInEmail(code: string, link: string): SignInEmail {
  const subject = `Your Clash Tracker Sign-In Code: ${code}`;

  const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
  <h2 style="color: #1e3a8a;">Welcome to Clash Tracker!</h2>
  <p>Hello,</p>
  <p>You requested a sign-in code for Clash Tracker. Please use the following 6-digit verification code. This code is single-use and will expire in 10 minutes.</p>
  
  <div style="margin: 24px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold;">Preferred Sign-In Method (Enter in App)</p>
    <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 0.1em; color: #111827;">${code}</span>
  </div>
  
  <p>Alternatively, you can sign in automatically by clicking the button below:</p>
  
  <div style="margin: 24px 0; text-align: center;">
    <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign In Automatically</a>
  </div>
  
  <p style="font-size: 14px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
    If you did not request this email, you can safely ignore it.
  </p>
</div>
  `.trim();

  const text = `
Welcome to Clash Tracker!

You requested a sign-in code for Clash Tracker. Please use the following 6-digit verification code. This code is single-use and will expire in 10 minutes.

PREFERRED SIGN-IN METHOD:
Verification Code: ${code}

Alternatively, you can sign in automatically by clicking the link below:
${link}

If you did not request this email, you can safely ignore it.
  `.trim();

  return { subject, html, text };
}
