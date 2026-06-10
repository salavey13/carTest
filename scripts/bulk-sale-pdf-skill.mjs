#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// bulk-sale-pdf-skill.mjs — Bulk PDF generator for sale bikes
// ═══════════════════════════════════════════════════════════════════════════
//
// USAGE:
//   node bulk-sale-pdf-skill.mjs --slug vip-bike --telegramChatId 123456789
//
// ─── SUPPORTED CLI FLAGS ───────────────────────────────────────────────────
//   --slug            (REQUIRED) Franchize slug
//   --telegramChatId   (REQUIRED) Telegram chat ID to send PDFs
//   --bikeIds          Comma-separated bike IDs (default: all with sale pricing)
//   --pageSize         Page size: "A4" (default) or "A5"
//   --limit            Max PDFs to generate (default: unlimited)
//   --delayMs          Delay between PDFs in ms (default: 500)
//
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// ── CLI helpers ──────────────────────────────────────────────────────────
function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] || '') : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

// ── Configuration ────────────────────────────────────────────────────────
const slug = arg('slug').trim().toLowerCase();
const telegramChatId = arg('telegramChatId');
const bikeIds = arg('bikeIds').split(',').map(id => id.trim()).filter(Boolean);
const pageSize = arg('pageSize', 'A4') === 'A5' ? 'A5' : 'A4';
const limit = parseInt(arg('limit', '0'), 10) || 0;
const delayMs = parseInt(arg('delayMs', '500'), 10) || 500;

// ── Validation ───────────────────────────────────────────────────────────
if (!slug) {
  error('Missing --slug');
}

if (!telegramChatId) {
  error('Missing --telegramChatId (PDF delivery to Telegram is currently required)');
}

if (pageSize !== 'A4' && pageSize !== 'A5') {
  error('Invalid --pageSize, must be A4 or A5');
}

// ── Supabase client ─────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  error('Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Fetch franchize data ─────────────────────────────────────────────────
async function getFranchizeBySlug(slug) {
  const { data: crew, error: crewError } = await supabase
    .from('crews')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (crewError || !crew) {
    throw new Error(`Franchize not found: ${slug}`);
  }

  const { data: cars, error: carsError } = await supabase
    .from('cars')
    .select('*')
    .eq('crew_id', crew.id)
    .eq('type', 'bike');

  if (carsError) {
    throw new Error(`Failed to fetch bikes: ${carsError.message}`);
  }

  return { crew, bikes: cars || [] };
}

// ── Filter sale bikes ─────────────────────────────────────────────────────
function filterSaleBikes(bikes) {
  return bikes.filter(bike => {
    const specs = bike.specs || {};

    // Check if bike has sale pricing
    const hasSale = specs.sale === true || specs.sale === '1' || specs.sale === 1 ||
                   specs.sale_price > 0 || specs.price_rub > 0;

    return hasSale && bike.title && bike.gallery?.[0];
  });
}

// ── Rate limiting ─────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Send PDF to Telegram via API ────────────────────────────────────────────
async function sendPdfToTelegram(bike, pageSize, chatId) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const response = await fetch(
    `${siteUrl}/api/franchize/${slug}/buy/print-pdf`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug,
        bikeId: bike.id,
        pageSize,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// ── Error output ──────────────────────────────────────────────────────────
function error(message) {
  const payload = { ok: false, error: message };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

// ── Success output ───────────────────────────────────────────────────────
function success(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// ── Main flow ─────────────────────────────────────────────────────────────
async function main() {
  const { crew, bikes } = await getFranchizeBySlug(slug);

  // Filter bikes that have sale pricing
  let saleBikes = filterSaleBikes(bikes);

  // Filter by bikeIds if provided
  if (bikeIds.length > 0) {
    saleBikes = saleBikes.filter(bike => bikeIds.includes(bike.id));
  }

  // Apply limit
  if (limit > 0) {
    saleBikes = saleBikes.slice(0, limit);
  }

  console.error(`Found ${saleBikes.length} bikes to generate PDFs for`);

  const results = [];
  const skipped = [];

  for (let i = 0; i < saleBikes.length; i++) {
    const bike = saleBikes[i];

    try {
      console.error(`[${i + 1}/${saleBikes.length}] Sending PDF for ${bike.id}...`);

      // Send PDF via API (which handles generation + Telegram delivery)
      const apiResult = await sendPdfToTelegram(bike, pageSize, telegramChatId);

      if (apiResult.success) {
        results.push({
          bikeId: bike.id,
          fileName: apiResult.fileName,
        });
        console.error(`  ✓ Sent to Telegram`);
      } else {
        throw new Error(apiResult.error || 'Unknown API error');
      }

      // Rate limiting
      if (i < saleBikes.length - 1) {
        await delay(delayMs);
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      skipped.push({
        bikeId: bike.id,
        reason: err.message
      });
    }
  }

  success({
    ok: true,
    sent: results,
    total: results.length,
    skipped: skipped.length,
    skippedDetails: skipped
  });
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(2);
});
