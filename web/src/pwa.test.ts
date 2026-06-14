import { expect, test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

test('Vite configuration has VitePWA configured with correct settings', () => {
  const configPath = path.resolve(__dirname, '../vite.config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');

  expect(configContent).toContain('VitePWA');
  expect(configContent).toContain("name: 'Clash Tracker'");
  expect(configContent).toContain("theme_color: '#0f0904'");
  expect(configContent).toContain("registerType: 'autoUpdate'");
});
