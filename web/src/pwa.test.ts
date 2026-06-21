import { expect, test } from 'vitest';
import { manifestConfig } from './pwa-manifest';

test('shared manifestConfig has the correct settings', () => {
  expect(manifestConfig.name).toBe('Clash Tracker');
  expect(manifestConfig.short_name).toBe('Clash Tracker');
  expect(manifestConfig.theme_color).toBe('#0f0904');
  expect(manifestConfig.background_color).toBe('#0f0904');
  expect(manifestConfig.display).toBe('standalone');
  expect(manifestConfig.orientation).toBe('portrait');
  expect(manifestConfig.icons.length).toBeGreaterThanOrEqual(2);
});

test('manifestConfig declares link handling so installed PWAs can open the magic link in-app', () => {
  // scope must cover /login for in-scope link handling to apply to the sign-in link.
  expect(manifestConfig.scope).toBe('/');
  expect('/login'.startsWith(manifestConfig.scope)).toBe(true);
  expect(manifestConfig.start_url).toBe('/');

  // handle_links: 'preferred' asks supporting browsers (Android/ChromeOS) to open
  // in-scope links in the installed app instead of the browser tab.
  expect(manifestConfig.handle_links).toBe('preferred');

  // launch_handler navigates an existing client so the running PWA processes the link
  // via LoginView's onMounted magic-link path rather than spawning a fresh instance.
  expect(manifestConfig.launch_handler).toEqual({ client_mode: 'navigate-existing' });
});
