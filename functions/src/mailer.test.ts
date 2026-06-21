import { describe, it, expect, vi } from 'vitest';
import { makeResendMailer } from './mailer.js';
import { HttpClient } from '@clash-tracker/core';

describe('makeResendMailer', () => {
  it('targets the Resend send endpoint with Bearer header and a payload matching specification', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ id: 'email-id-123' }),
    });
    const httpClient: HttpClient = {
      fetch: fetchMock,
    };
    const apiKey = 're_testApiKey';
    const sender = 'Clash Tracker <onboarding@resend.dev>';
    const mailer = makeResendMailer({ httpClient, apiKey, sender });

    const email = 'user@example.com';
    const code = '123456';
    const link = 'https://example.com/login';

    await mailer.sendSignInCode(email, { code, link });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];

    expect(calledUrl).toBe('https://api.resend.com/emails');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers).toEqual({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    });

    const parsedBody = JSON.parse(calledInit.body);
    expect(parsedBody.from).toBe(sender);
    expect(parsedBody.to).toEqual([email]);
    expect(parsedBody.subject).toContain(code);
    expect(parsedBody.html).toContain(code);
    expect(parsedBody.html).toContain(link);
    expect(parsedBody.text).toContain(code);
    expect(parsedBody.text).toContain(link);
  });

  it('throws typed error on non-2xx failures without logging apiKey or OTP', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 400,
      json: async () => ({ message: 'Bad request details' }),
    });
    const httpClient: HttpClient = {
      fetch: fetchMock,
    };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mailer = makeResendMailer({
      httpClient,
      apiKey: 'secret-key-123',
      sender: 'test@example.com',
    });

    await expect(
      mailer.sendSignInCode('user@example.com', { code: '123456', link: 'https://link' })
    ).rejects.toThrowError(/Resend API failed with status 400/);

    // Verify secrets are never logged
    consoleErrorSpy.mock.calls.forEach((args) => {
      const msg = args.join(' ');
      expect(msg).not.toContain('secret-key-123');
      expect(msg).not.toContain('123456');
    });
    consoleLogSpy.mock.calls.forEach((args) => {
      const msg = args.join(' ');
      expect(msg).not.toContain('secret-key-123');
      expect(msg).not.toContain('123456');
    });

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('throws typed error on transport/network failure without logging apiKey or OTP', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection timed out'));
    const httpClient: HttpClient = {
      fetch: fetchMock,
    };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mailer = makeResendMailer({
      httpClient,
      apiKey: 'secret-key-123',
      sender: 'test@example.com',
    });

    await expect(
      mailer.sendSignInCode('user@example.com', { code: '123456', link: 'https://link' })
    ).rejects.toThrowError(/Resend mailer transport error: Connection timed out/);

    // Verify secrets are never logged
    consoleErrorSpy.mock.calls.forEach((args) => {
      const msg = args.join(' ');
      expect(msg).not.toContain('secret-key-123');
      expect(msg).not.toContain('123456');
    });
    consoleLogSpy.mock.calls.forEach((args) => {
      const msg = args.join(' ');
      expect(msg).not.toContain('secret-key-123');
      expect(msg).not.toContain('123456');
    });

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
