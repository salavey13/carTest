#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// bulk-sale-pdf-skill.mjs — Bulk PDF generator for sale bikes
// ═══════════════════════════════════════════════════════════════════════════
//
// USAGE:
//   node bulk-sale-pdf-skill.mjs --slug vip-bike --telegramChatId 123456789
//   node bulk-sale-pdf-skill.mjs --slug vip-bike --saveToDisk --outputDir ./tmp/pdfs
//
// ─── SUPPORTED CLI FLAGS ───────────────────────────────────────────────────
//   --slug            (REQUIRED) Franchize slug
//   --telegramChatId   Telegram chat ID to send PDFs (required unless --saveToDisk)
//   --bikeIds          Comma-separated bike IDs (default: all with sale pricing)
//   --pageSize         Page size: "A4" (default) or "A5"
//   --limit            Max PDFs to generate (default: unlimited)
//   --delayMs          Delay between PDFs in ms (default: 500)
//   --saveToDisk       Save PDFs to disk instead of sending to Telegram
//   --outputDir        Directory to save PDFs (default: ./tmp/bulk-pdfs)
//   --siteUrl          Next.js site URL (default: NEXT_PUBLIC_SITE_URL or localhost:3000)
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
const saveToDisk = hasFlag('saveToDisk');
const outputDir = arg('outputDir', './tmp/bulk-pdfs');
const siteUrl = arg('siteUrl') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// ── Validation ───────────────────────────────────────────────────────────
if (!slug) {
  error('Missing --slug');
}

if (!saveToDisk && !telegramChatId) {
  error('Missing --telegramChatId (required unless --saveToDisk is used)');
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
    // Skip test/internal bikes (id starts with "vipbike")
    if (bike.id && bike.id.startsWith("vipbike")) return false;
    // specs is stored as jsonb, so it's already an object
    const specs = bike.specs || {};

    // Check if bike has sale=true in specs (exact match for boolean)
    const hasSale = specs.sale === true || specs.sale === 1 || String(specs.sale).toLowerCase() === "true";

    // Also require basic data for PDF generation
    return hasSale && bike.title && bike.gallery && bike.gallery.length > 0;
  });
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
  console.error(`Using site URL: ${siteUrl}`);
  console.error(saveToDisk
    ? `Saving PDFs to disk: ${outputDir}`
    : `Sending PDFs to Telegram chat: ${telegramChatId}`
  );

  const apiUrl = `${siteUrl}/api/franchize/${slug}/buy/print-pdf-bulk`;
  console.error(`Calling API: ${apiUrl}`);

  // Call the bulk PDF API
  const bulkResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug,
      pageSize,
      bikeIds: bikeIds.join(','),
      telegramChatId: saveToDisk ? undefined : telegramChatId,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      saveToDisk,
      outputDir,
      delayMs,
    }),
  });

  if (!bulkResponse.ok) {
    const errorText = await bulkResponse.text();
    throw new Error(`Bulk API error (${bulkResponse.status}): ${errorText}`);
  }

  const bulkResult = await bulkResponse.json();

  if (!bulkResult.success) {
    throw new Error(bulkResult.error || 'Bulk PDF generation failed');
  }

  console.error(`\n✓ Generated ${bulkResult.sent} PDF${bulkResult.sent > 1 ? 's' : ''} successfully`);

  if (saveToDisk && bulkResult.outputDir) {
    console.error(`\nOutput directory: ${bulkResult.outputDir}`);
    console.error(`\nGenerated files:`);
    bulkResult.files?.forEach((file) => {
      console.error(`  - ${file.fileName}`);
    });
  }

  if (bulkResult.skipped > 0) {
    console.error(`\n⚠ Skipped ${bulkResult.skipped} PDF${bulkResult.skipped > 1 ? 's' : ''}:`);
    bulkResult.skippedDetails?.forEach((detail) => {
      console.error(`  - ${detail.bikeId}: ${detail.reason}`);
    });
  }

  success({
    ok: true,
    sent: bulkResult.sent,
    total: bulkResult.total,
    savedToDisk: bulkResult.savedToDisk,
    outputDir: bulkResult.outputDir,
    files: bulkResult.files,
    skipped: bulkResult.skipped,
    skippedDetails: bulkResult.skippedDetails,
  });
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(2);
});
