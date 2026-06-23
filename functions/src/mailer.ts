import { Mailer } from './auth.js';
import { HttpClient } from '@clash-tracker/core';
import { buildSignInEmail } from './email.js';

/**
 * Creates a Mailer implementation that delivers emails via the Resend API.
 */
export function makeResendMailer(deps: {
  httpClient: HttpClient;
  apiKey: string;
  sender: string;
}): Mailer {
  async function sendEmail(opts: {
    email: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (!deps.apiKey) {
      throw new Error('Resend API key is missing.');
    }
    const url = 'https://api.resend.com/emails';
    const payload = {
      from: deps.sender,
      to: [opts.email],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    };

    try {
      const res = await deps.httpClient.fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deps.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.status < 200 || res.status >= 300) {
        // Do NOT log the apiKey or OTP code/subject/html here!
        throw new Error(`Resend API failed with status ${res.status}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Clean error message without secrets
      throw new Error(`Resend mailer transport error: ${errMsg}`, { cause: err });
    }
  }

  return {
    async sendSignInLink(email: string, link: string): Promise<void> {
      const subject = 'Sign in to Clash Tracker';
      const html = `<p>Click the link to sign in: <a href="${link}">${link}</a></p>`;
      const text = `Click the link to sign in: ${link}`;
      await sendEmail({ email, subject, html, text });
    },
    async sendSignInCode(email: string, options: { code: string; link: string }): Promise<void> {
      const { subject, html, text } = buildSignInEmail(options.code, options.link);
      await sendEmail({ email, subject, html, text });
    },
    async sendInvitation(email: string, options: { inviteId: string; link: string }): Promise<void> {
      const subject = 'Invitation to join Clash Tracker as an Admin';
      const html = `<p>You have been invited to join Clash Tracker as an administrator. Click the link below to complete your registration:</p><p><a href="${options.link}">${options.link}</a></p>`;
      const text = `You have been invited to join Clash Tracker as an administrator. Click the link below to complete your registration: ${options.link}`;
      await sendEmail({ email, subject, html, text });
    },
  };
}
