import { expect, test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

test('generates manifest.webmanifest in build output with correct settings', () => {
  const manifestPath = path.resolve(__dirname, '../dist/manifest.webmanifest');

  // Verify that the build output manifest exists
  const exists = fs.existsSync(manifestPath);
  expect(exists).toBe(true);

  if (exists) {
    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.name).toBe('Clash Tracker');
    expect(manifest.short_name).toBe('Clash Tracker');
    expect(manifest.theme_color).toBe('#0f0904');
    expect(manifest.background_color).toBe('#0f0904');
    expect(manifest.display).toBe('standalone');
  }
});
