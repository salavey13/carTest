#!/usr/bin/env node

/**
 * Public-page screenshot fallback (full-page) via thum.io.
 *
 * IMPORTANT:
 * - This script is NOT a browser smoke-test replacement.
 * - It depends on an external public service (thum.io), so it can only render publicly reachable URLs.
 * - Do not use it for localhost/private-preview validation.
 * - Avoid committing binary outputs from this script into PRs; use runtime/browser artifacts for review evidence.
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
const allowPrivate = getArg('allow-private', 'false') === 'true';

if (!targetUrl) {
  console.error('Missing --url (or SCREENSHOT_TARGET_URL env)');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(targetUrl);
} catch {
  console.error(`Invalid --url value: ${targetUrl}`);
  process.exit(1);
}

const host = parsedUrl.hostname.toLowerCase();
const looksPrivate =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '0.0.0.0' ||
  host === '::1' ||
  host.endsWith('.local') ||
  host.startsWith('10.') ||
  host.startsWith('192.168.') ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

if (looksPrivate && !allowPrivate) {
  console.error(
    [
      `Refusing private URL for thum.io fallback: ${targetUrl}`,
      'Use browser-container/playwright screenshot tooling for local/private routes.',
      'If you explicitly need this, pass --allow-private true (result may still fail on thum.io).',
    ].join('\n'),
  );
  process.exit(1);
}

const screenshotUrl = `https://image.thum.io/get/fullpage/${targetUrl}`;
const curl = spawnSync('curl', ['-sS', screenshotUrl, '-o', outPath], { encoding: 'utf8' });

if (curl.status !== 0) {
  console.error(curl.stderr || curl.stdout || 'Screenshot download failed');
  process.exit(1);
}

console.log(
  JSON.stringify({
    url: targetUrl,
    out: outPath,
    provider: 'thum.io',
    warning:
      'Fallback capture only. Not suitable for private/local smoke checks. Do not commit binary output to PR by default.',
  }),
);
