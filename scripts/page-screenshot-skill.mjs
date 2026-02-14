#!/usr/bin/env node

/**
 * Page screenshot skill (full-page) via thum.io
 *
 * Example:
 *   node scripts/page-screenshot-skill.mjs --url https://v0-car-test.vercel.app/repo-xml --out artifacts/repo-xml-fullpage.png
 */

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function getArg(name, fallback = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1];
}

const targetUrl = getArg('url', process.env.SCREENSHOT_TARGET_URL);
const outPath = getArg('out', 'artifacts/page-fullpage.png');

if (!targetUrl) {
  console.error('Missing --url (or SCREENSHOT_TARGET_URL env)');
  process.exit(1);
}

const screenshotUrl = `https://image.thum.io/get/fullpage/${targetUrl}`;
const curl = spawnSync('curl', ['-sS', screenshotUrl, '-o', outPath], { encoding: 'utf8' });

if (curl.status !== 0) {
  console.error(curl.stderr || curl.stdout || 'Screenshot download failed');
  process.exit(1);
}

console.log(JSON.stringify({ url: targetUrl, out: outPath, provider: 'thum.io' }));
