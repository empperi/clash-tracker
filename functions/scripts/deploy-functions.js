/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(functionsDir, 'package.json');
const packageJsonBackupPath = path.join(functionsDir, 'package.json.bak');

console.log('Starting functions deployment wrapper...');

try {
  // 1. Build the functions codebase (compiles & bundles)
  console.log('Building functions codebase...');
  execSync('npm run build', { cwd: functionsDir, stdio: 'inherit' });

  // 2. Back up package.json
  console.log('Backing up package.json...');
  fs.copyFileSync(packageJsonPath, packageJsonBackupPath);

  // 3. Read and modify package.json to remove @clash-tracker/core
  console.log('Removing @clash-tracker/core from package.json dependencies...');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (packageJson.dependencies && packageJson.dependencies['@clash-tracker/core']) {
    delete packageJson.dependencies['@clash-tracker/core'];
  }
  if (packageJson.devDependencies && packageJson.devDependencies['@clash-tracker/core']) {
    delete packageJson.devDependencies['@clash-tracker/core'];
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

  // 4. Run firebase deploy
  console.log('Running firebase deploy...');
  const args = process.argv.slice(2).join(' ');
  execSync(`npx firebase deploy --only functions ${args}`, {
    cwd: functionsDir,
    stdio: 'inherit',
  });
} catch (error) {
  console.error('Deployment failed:', error);
  process.exitCode = 1;
} finally {
  // 5. Restore package.json
  if (fs.existsSync(packageJsonBackupPath)) {
    console.log('Restoring package.json from backup...');
    fs.copyFileSync(packageJsonBackupPath, packageJsonPath);
    fs.unlinkSync(packageJsonBackupPath);
  }
  console.log('Deployment wrapper finished.');
}
