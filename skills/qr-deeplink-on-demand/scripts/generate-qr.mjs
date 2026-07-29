#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// generate-qr.mjs — On-demand QR code generator for startapp deep links
// ═══════════════════════════════════════════════════════════════════════════
//
// Generates QR codes for Telegram WebApp deep links routed by
// hooks/useStartParamRouter.ts. Three output formats:
//   --format raw_png   → 512×512 PNG with just the QR
//   --format vcard_png → 1024×576 PNG: QR + vCard-style contact info
//   --format pdf_card  → A6 landscape PDF: QR + branding (print-ready)
//
// USAGE:
//   See SKILL.md in this skill's directory for full reference.
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

function log(...args) {
  console.error('[qr-deeplink]', ...args);
}

// ── Configuration ────────────────────────────────────────────────────────
const type = arg('type');
const bot = arg('bot');
const format = arg('format');
const outPath = arg('out');
const slug = arg('slug');
const leadId = arg('leadId');
const rentalId = arg('rentalId');
const customPayload = arg('payload');
const brandName = arg('brandName', 'Экипаж');
const tagline = arg('tagline', '');
const phone = arg('phone', '');
const telegram = arg('telegram', '');
const address = arg('address', '');
const logoUrl = arg('logoUrl', '');
const accentColor = arg('accentColor', '#FFD700');
const bgColor = arg('bgColor', '#0A0A0A');
const textColor = arg('textColor', '#FFFAF0');
const qrSize = parseInt(arg('qrSize', '0'), 10) || 0;
const errorCorrection = arg('errorCorrection', 'H');

// ── Validation ───────────────────────────────────────────────────────────
if (!type) {
  fail('Missing --type (one of: create_crew, join_crew, profile, lead, rental, analytics, custom)');
}
if (!bot) {
  fail('Missing --bot (Telegram bot username, e.g. oneBikePlsBot)');
}
if (!format || !['raw_png', 'vcard_png', 'pdf_card'].includes(format)) {
  fail('Missing or invalid --format (one of: raw_png, vcard_png, pdf_card)');
}
if (!outPath) {
  fail('Missing --out (absolute path to output file)');
}

// ── Build startapp payload ──────────────────────────────────────────────
function buildPayload() {
  switch (type) {
    case 'create_crew':
      return 'create_crew';
    case 'join_crew':
      if (!slug) fail('Missing --slug for type=join_crew');
      return `crew_${slug}_join_crew`;
    case 'profile':
      if (!slug) fail('Missing --slug for type=profile');
      return `franchize/${slug}/profile`;
    case 'lead':
      if (!leadId) fail('Missing --leadId for type=lead');
      return `lead_${leadId}`;
    case 'rental':
      if (!rentalId) fail('Missing --rentalId for type=rental');
      return `rental_${rentalId}`;
    case 'analytics':
      // payload format: analytics_<tab>_<date>
      if (!customPayload) fail('Missing --payload for type=analytics (format: <tab>_<date>)');
      return `analytics_${customPayload}`;
    case 'custom':
      if (!customPayload) fail('Missing --payload for type=custom');
      return customPayload;
    default:
      fail(`Unknown --type: ${type}`);
  }
}

const payload = buildPayload();
const encodedPayload = encodeURIComponent(payload);
const fullUrl = `https://t.me/${bot}/app?startapp=${encodedPayload}`;
log(`type=${type} bot=${bot} format=${format}`);
log(`Generated URL: ${fullUrl}`);

// ── Resolve QR size default per format ────────────────────────────────────
const effectiveQrSize = qrSize || (format === 'raw_png' ? 512 : format === 'vcard_png' ? 360 : 280);

// ── Try to load qrcode library ────────────────────────────────────────────
let QRCode;
try {
  QRCode = (await import('qrcode')).default;
} catch {
  fail('qrcode package not installed. Run: npm install qrcode');
}

// ── Render QR code to PNG buffer (without logo first) ────────────────────
async function renderQrPng(size) {
  return QRCode.toBuffer(fullUrl, {
    type: 'png',
    errorCorrectionLevel: errorCorrection,
    margin: 2,
    width: size,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

// ── Download logo if provided ─────────────────────────────────────────────
async function downloadLogo(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      log(`Logo download failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    log(`Downloaded logo from ${url} (${buf.length} bytes)`);
    return buf;
  } catch (e) {
    log(`Logo download error: ${e.message}`);
    return null;
  }
}

// ── Compose vCard PNG (1024×576) ──────────────────────────────────────────
async function composeVcardPng(qrPngBuf, logoBuf) {
  // Try to load sharp for image composition
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    log('sharp not installed; falling back to raw QR PNG');
    return qrPngBuf;
  }

  const W = 1024;
  const H = 576;
  const qrFinalSize = effectiveQrSize;
  const padding = 40;
  const textX = qrFinalSize + padding * 2;

  // Compose SVG with text on the right
  const escapeXml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]
  );

  const textLines = [
    { text: brandName, size: 42, weight: 'bold', color: textColor },
    ...(tagline ? [{ text: tagline, size: 20, weight: 'normal', color: accentColor }] : []),
    ...(phone ? [{ text: phone, size: 24, weight: 'normal', color: textColor }] : []),
    ...(telegram ? [{ text: telegram, size: 24, weight: 'normal', color: textColor }] : []),
    ...(address ? [{ text: address, size: 18, weight: 'normal', color: textColor }] : []),
  ];

  let yPos = 60;
  const textLinesSvg = textLines.map((line) => {
    const t = `<text x="${textX}" y="${yPos}" font-family="Arial, sans-serif" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}">${escapeXml(line.text)}</text>`;
    yPos += line.size + 12;
    return t;
  }).join('\n');

  // Accent bar on the left of text
  const accentBar = `<rect x="${textX - 16}" y="50" width="4" height="${yPos - 70}" fill="${accentColor}" rx="2"/>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${bgColor}"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${accentColor}"/>
  ${accentBar}
  ${textLinesSvg.join ? textLinesSvg : ''}
  <text x="${textX}" y="${H - 30}" font-family="Arial, sans-serif" font-size="14" fill="${accentColor}" opacity="0.7">Отсканируйте QR для запуска в Telegram</text>
</svg>`;

  // Compose: bg SVG → QR → optional logo
  const pipeline = sharp({
    create: { width: W, height: H, channels: 4, background: bgColor }
  }).composite([
    { input: Buffer.from(svg), top: 0, left: 0 },
    { input: qrPngBuf, top: (H - qrFinalSize) / 2, left: padding },
    ...(logoBuf ? [{
      input: logoBuf,
      top: (H - qrFinalSize) / 2 + (qrFinalSize / 2) - 40,
      left: padding + (qrFinalSize / 2) - 40,
      // scale logo to 80×80
      ...(sharp ? {} : {})
    }] : [])
  ]);

  // If logo provided, resize it to 80×80 first
  if (logoBuf) {
    try {
      const resizedLogo = await sharp(logoBuf).resize(80, 80, { fit: 'inside' }).png().toBuffer();
      const pipeline2 = sharp({
        create: { width: W, height: H, channels: 4, background: bgColor }
      }).composite([
        { input: Buffer.from(svg), top: 0, left: 0 },
        { input: qrPngBuf, top: (H - qrFinalSize) / 2, left: padding },
        {
          input: resizedLogo,
          top: (H - qrFinalSize) / 2 + (qrFinalSize / 2) - 40,
          left: padding + (qrFinalSize / 2) - 40,
        }
      ]);
      return pipeline2.png().toBuffer();
    } catch (e) {
      log(`Logo composition failed: ${e.message}`);
    }
  }

  return pipeline.png().toBuffer();
}

// ── Compose PDF card (A6 landscape, 105×148 mm) ───────────────────────────
async function composePdfCard(qrPngBuf, logoBuf) {
  let PDFDocument, PDFKit;
  try {
    PDFKit = await import('pdfkit');
    PDFDocument = PDFKit.default || PDFKit.PDFDocument || PDFKit;
  } catch {
    fail('pdfkit package not installed. Run: npm install pdfkit');
  }

  // A6 landscape: 297.64 × 419.53 pt (105×148 mm at 72 DPI)
  const PAGE_W = 419.53;
  const PAGE_H = 297.64;
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margins: { top: 20, bottom: 20, left: 20, right: 20 },
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolveP) => doc.on('end', () => resolveP(Buffer.concat(chunks))));

  // Background
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(bgColor);

  // Accent bar at top
  doc.rect(0, 0, PAGE_W, 6).fill(accentColor);

  // QR code on the left
  const qrX = 24;
  const qrY = (PAGE_H - effectiveQrSize) / 2;
  doc.image(qrPngBuf, qrX, qrY, { width: effectiveQrSize, height: effectiveQrSize });

  // Optional logo in center of QR
  if (logoBuf) {
    try {
      const logoSize = Math.round(effectiveQrSize * 0.22);
      doc.image(logoBuf, qrX + (effectiveQrSize - logoSize) / 2, qrY + (effectiveQrSize - logoSize) / 2, {
        width: logoSize,
        height: logoSize,
      });
    } catch (e) {
      log(`PDF logo embed failed: ${e.message}`);
    }
  }

  // Text on the right
  const textX = qrX + effectiveQrSize + 28;
  let textY = 56;

  doc.fillColor(textColor)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(brandName, textX, textY);
  textY += 32;

  if (tagline) {
    doc.fillColor(accentColor)
      .font('Helvetica')
      .fontSize(11)
      .text(tagline, textX, textY, { width: PAGE_W - textX - 24 });
    textY += 26;
  }

  if (phone) {
    doc.fillColor(textColor)
      .font('Helvetica')
      .fontSize(13)
      .text(`☎ ${phone}`, textX, textY);
    textY += 22;
  }

  if (telegram) {
    doc.fillColor(textColor)
      .font('Helvetica')
      .fontSize(13)
      .text(`✈ ${telegram}`, textX, textY);
    textY += 22;
  }

  if (address) {
    doc.fillColor(textColor)
      .font('Helvetica')
      .fontSize(11)
      .text(`⌖ ${address}`, textX, textY, { width: PAGE_W - textX - 24 });
    textY += 24;
  }

  // Footer hint
  doc.fillColor(accentColor)
    .font('Helvetica-Oblique')
    .fontSize(9)
    .text('Отсканируйте QR-код камерой телефона для запуска в Telegram', textX, PAGE_H - 30, {
      width: PAGE_W - textX - 24,
    });

  // Small accent line under brand
  doc.rect(textX, 50, 36, 3).fill(accentColor);

  doc.end();
  return done;
}

// ── Main flow ─────────────────────────────────────────────────────────────
async function main() {
  log(`Rendering QR (${effectiveQrSize}×${effectiveQrSize}, errorCorrection=${errorCorrection})...`);
  const qrPngBuf = await renderQrPng(effectiveQrSize);

  const logoBuf = await downloadLogo(logoUrl);

  let outputBuf;
  if (format === 'raw_png') {
    outputBuf = qrPngBuf;
  } else if (format === 'vcard_png') {
    log('Composing vCard PNG (1024×576)...');
    outputBuf = await composeVcardPng(qrPngBuf, logoBuf);
  } else if (format === 'pdf_card') {
    log('Composing PDF card (A6 landscape, 105×148 mm)...');
    outputBuf = await composePdfCard(qrPngBuf, logoBuf);
  }

  // Ensure output dir exists
  const dir = dirname(resolve(outPath));
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(outPath, outputBuf);
  const sizeKb = (outputBuf.length / 1024).toFixed(1);
  log(`✓ Saved: ${outPath} (${sizeKb} KB)`);
  console.log(JSON.stringify({
    ok: true,
    type,
    bot,
    format,
    url: fullUrl,
    payload,
    file: outPath,
    sizeBytes: outputBuf.length,
  }, null, 2));
}

function fail(msg) {
  console.error(JSON.stringify({ ok: false, error: msg }, null, 2));
  process.exit(2);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
