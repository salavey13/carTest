#!/usr/bin/env node
/**
 * Robust page screenshot helper:
 * 1) Playwright Chromium
 * 2) Playwright Firefox
 * 3) Playwright WebKit
 * 4) thum.io fallback for public URLs
 *
 * Usage:
 *   node scripts/capture-screenshot.mjs --url http://127.0.0.1:3000 --out artifacts/home.png
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const getArg = (name, fallback = undefined) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : fallback;
};

const url = getArg('--url');
const out = getArg('--out', 'artifacts/screenshot.png');
const timeoutMs = Number(getArg('--timeout', '45000'));
const waitBeforeShotMs = Number(getArg('--wait', '1200'));

if (!url) {
  console.error('Usage: node scripts/capture-screenshot.mjs --url <url> --out <path>');
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });

const engines = [
  { name: 'chromium', cliName: 'chromium' },
  { name: 'firefox', cliName: 'firefox' },
  { name: 'webkit', cliName: 'webkit' },
];

function runPlaywright(engine) {
  return spawnSync(
    'npx',
    [
      'playwright',
      'screenshot',
      '--browser',
      engine.cliName,
      '--full-page',
      '--viewport-size',
      '1440,2200',
      '--wait-for-timeout',
      String(waitBeforeShotMs),
      '--timeout',
      String(timeoutMs),
      url,
      out,
    ],
    { encoding: 'utf8' },
  );
}

function maybeInstallPlaywrightBrowsers(stderrText) {
  const text = stderrText || '';
  if (!text.includes('Please run the following command')) return false;
  console.log('[capture-screenshot] Playwright browser binaries missing. Running: npx playwright install');
  const install = spawnSync('npx', ['playwright', 'install'], { encoding: 'utf8' });
  if (install.status !== 0) {
    console.error('[capture-screenshot] playwright install failed:', (install.stderr || '').trim());
    return false;
  }
  return true;
}

const isPublicUrl = /^https?:\/\//.test(url) && !/127\.0\.0\.1|localhost|0\.0\.0\.0/.test(url);

for (const engine of engines) {
  let result = runPlaywright(engine);
  if (result.status !== 0 && maybeInstallPlaywrightBrowsers(result.stderr || '')) {
    result = runPlaywright(engine);
  }
  if (result.status === 0) {
    console.log(`screenshot_engine=${engine.name}`);
    console.log(`screenshot_path=${out}`);
    process.exit(0);
  }
  console.error(`[capture-screenshot] ${engine.name} failed:`, (result.stderr || '').trim());
}

if (!isPublicUrl) {
  console.error('[capture-screenshot] Playwright engines failed and URL is local/private, skipping thum.io fallback.');
  process.exit(2);
}

const thumUrl = `https://image.thum.io/get/fullpage/${url}`;
const curl = spawnSync('curl', ['-sS', thumUrl, '-o', out], { encoding: 'utf8' });
if (curl.status !== 0) {
  console.error('[capture-screenshot] thum.io fallback failed:', (curl.stderr || '').trim());
  process.exit(3);
}

console.log('screenshot_engine=thumio');
console.log(`screenshot_path=${out}`);
