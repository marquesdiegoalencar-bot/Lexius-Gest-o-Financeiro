import { execSync } from 'child_process';
import * as path from 'path';
import { applyE2eEnv } from './e2e-env';

export default async function globalSetup() {
  applyE2eEnv();

  execSync('node scripts/reset-db.js', {
    env: process.env,
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  execSync('node scripts/seed-dev.js', {
    env: process.env,
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
}