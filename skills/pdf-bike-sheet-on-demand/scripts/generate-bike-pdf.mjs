#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// generate-bike-pdf.mjs — Single-bike PDF sheet generator
// ═══════════════════════════════════════════════════════════════════════════
//
// Generates a PDF "buy sheet" for ONE specific bike by calling the existing
// /api/franchize/[slug]/buy/print-pdf endpoint with returnBytes=true.
//
// See SKILL.md in this skill's directory for full reference.
//
// ═══════════════════════════════════════════════════════════════════════════

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

// ── CLI helpers ──────────────────────────────────────────────────────────
function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] || '') : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function log(...args) {
  console.error('[bike-pdf]', ...args);
}

function fail(msg, code = 2) {
  console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  process.exit(code);
}

// ── Configuration ────────────────────────────────────────────────────────
const slug = arg('slug').trim().toLowerCase();
const bikeId = arg('bikeId').trim();
const pageSize = arg('pageSize', 'A4') === 'A5' ? 'A5' : 'A4';
const outPath = arg('out');
const siteUrl = arg('siteUrl') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const telegramChatId = arg('telegramChatId');
const noSave = hasFlag('noSave');
const serviceRoleKey = arg('serviceRoleKey') || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Validation ───────────────────────────────────────────────────────────
if (!slug) fail('Missing --slug');
if (!bikeId) fail('Missing --bikeId');
if (!noSave && !outPath) fail('Missing --out (required unless --noSave is set)');
if (!serviceRoleKey) fail('Missing SUPABASE_SERVICE_ROLE_KEY (env or --serviceRoleKey)');

// ── Main flow ─────────────────────────────────────────────────────────────
async function main() {
  const apiUrl = `${siteUrl}/api/franchize/${slug}/buy/print-pdf`;
  log(`Calling API: ${apiUrl}`);
  log(`bikeId=${bikeId} pageSize=${pageSize}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        bikeId,
        pageSize,
        serviceRoleKey,
        returnBytes: true,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') fail('API timeout (15s)', 6);
    fail(`Network error: ${e.message}`, 6);
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) fail('Unauthorized — check SUPABASE_SERVICE_ROLE_KEY', 5);
  if (res.status === 404) fail(`Bike not found: ${bikeId}`, 4);
  if (!res.ok) {
    const text = await res.text();
    fail(`API error ${res.status}: ${text.slice(0, 200)}`, 3);
  }

  const data = await res.json();
  if (!data.success || !data.bytes) {
    fail(`API returned failure: ${JSON.stringify(data).slice(0, 300)}`, 3);
  }

  const pdfBuf = Buffer.from(data.bytes, 'base64');
  log(`Got PDF: ${pdfBuf.length} bytes, fileName=${data.fileName}`);

  let savedPath = null;
  if (!noSave && outPath) {
    const dir = dirname(resolve(outPath));
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(outPath, pdfBuf);
    savedPath = outPath;
    log(`✓ Saved: ${outPath} (${(pdfBuf.length / 1024).toFixed(1)} KB)`);
  }

  // Optional Telegram delivery
  let telegramSent = false;
  let telegramMessageId = null;
  let telegramError = null;
  if (telegramChatId) {
    try {
      const forwardApi = process.env.FORWARD_TELEGRAM_API || 'https://v0-car-test.vercel.app/api/forward-telegram';
      const tgRes = await fetch(`${forwardApiApiCheck(forwardApi)}/sendDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: telegramChatId,
          document: pdfBuf.toString('base64'),
          fileName: data.fileName || `BUY_${bikeId}.pdf`,
          mimeType: 'application/pdf',
          caption: `📄 PDF для байка ${bikeId} (${slug})`,
        }),
      });
      if (tgRes.ok) {
        const tgData = await tgRes.json();
        telegramSent = true;
        telegramMessageId = tgData.messageId || tgData.result?.message_id || null;
        log(`✓ Sent to Telegram chat ${telegramChatId}, messageId=${telegramMessageId}`);
      } else {
        telegramError = `Telegram API ${tgRes.status}: ${(await tgRes.text()).slice(0, 200)}`;
        log(`Telegram send failed: ${telegramError}`);
      }
    } catch (e) {
      telegramError = e.message;
      log(`Telegram send error: ${telegramError}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    slug,
    bikeId,
    pageSize,
    file: savedPath,
    fileName: data.fileName,
    sizeBytes: pdfBuf.length,
    telegramSent,
    telegramMessageId,
    telegramError,
  }, null, 2));
}

// Forward-telegram API may end with /forward-telegram — normalize.
function forwardApiApiCheck(baseUrl) {
  if (baseUrl.endsWith('/forward-telegram')) {
    return baseUrl.replace('/forward-telegram', '/api/forward-telegram');
  }
  return baseUrl.replace(/\/$/, '');
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
