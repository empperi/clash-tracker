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
