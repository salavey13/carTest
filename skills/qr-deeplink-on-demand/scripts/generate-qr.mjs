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
// Reduced defaults on 2026-07-30: A6 card is only 297×419 pt — a 280pt QR
// was eating 70% of the card. New defaults leave breathing room for text.
const effectiveQrSize = qrSize || (format === 'raw_png' ? 512 : format === 'vcard_png' ? 320 : 200);

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
// Layout (revised 2026-07-30):
//   - QR code on the LEFT (340px square) with white padding ring
//   - Text block centered vertically on the right
//   - Accent top bar + accent left bar framing the text
//   - Footer hint at bottom of text block
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
  const RING_PAD = 16;
  const QR_TOTAL = qrFinalSize + RING_PAD * 2; // QR + white ring
  const QR_AREA_X = 50;
  const QR_AREA_Y = Math.round((H - QR_TOTAL) / 2);

  const textX = QR_AREA_X + QR_TOTAL + 40;
  const textRight = W - 50;
  const textWidth = textRight - textX;

  // Compose SVG with text — balanced, with proper line heights
  const escapeXml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]
  );

  // Build text elements with vertical positioning
  const textLines = [];
  let yPos = 80;

  // Brand name (large, bold)
  const brandFontSize = brandName.length > 18 ? 36 : brandName.length > 12 ? 42 : 48;
  textLines.push({
    text: brandName,
    size: brandFontSize,
    weight: 'bold',
    color: textColor,
    y: yPos,
  });
  yPos += brandFontSize + 8;

  // Accent underline
  textLines.push({
    rect: { x: textX, y: yPos, w: 60, h: 3, fill: accentColor },
    y: yPos,
  });
  yPos += 14;

  // Tagline
  if (tagline) {
    textLines.push({
      text: tagline,
      size: 18,
      weight: 'normal',
      color: accentColor,
      y: yPos,
      italic: true,
    });
    yPos += 30;
  }

  // Contact lines with labels
  const contacts = [];
  if (phone) contacts.push({ label: 'ТЕЛ.', value: phone });
  if (telegram) contacts.push({ label: 'TELEGRAM', value: telegram });
  if (address) contacts.push({ label: 'АДРЕС', value: address });

  for (const c of contacts) {
    // Label
    textLines.push({
      text: c.label,
      size: 12,
      weight: 'bold',
      color: accentColor,
      y: yPos,
    });
    yPos += 16;
    // Value
    textLines.push({
      text: c.value,
      size: 18,
      weight: 'normal',
      color: textColor,
      y: yPos,
    });
    yPos += 28;
  }

  // Footer divider + hint
  const footerY = H - 60;
  textLines.push({
    rect: { x: textX, y: footerY - 10, w: textWidth, h: 1, fill: accentColor, opacity: 0.4 },
    y: footerY - 10,
  });
  textLines.push({
    text: 'Сканируйте QR → откроется Telegram',
    size: 13,
    weight: 'normal',
    color: accentColor,
    y: footerY,
    italic: true,
  });

  // Render text elements to SVG
  const svgElements = textLines.map((line) => {
    if (line.rect) {
      const opacityAttr = line.rect.opacity ? ` opacity="${line.rect.opacity}"` : '';
      return `<rect x="${line.rect.x}" y="${line.rect.y}" width="${line.rect.w}" height="${line.rect.h}" fill="${line.rect.fill}"${opacityAttr}/>`;
    }
    const italicAttr = line.italic ? ' font-style="italic"' : '';
    return `<text x="${textX}" y="${line.y + line.size}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}"${italicAttr}>${escapeXml(line.text)}</text>`;
  }).join('\n');

  // Compose full SVG
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${bgColor}"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${accentColor}"/>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="${accentColor}"/>
  <rect x="${QR_AREA_X}" y="${QR_AREA_Y}" width="${QR_TOTAL}" height="${QR_TOTAL}" fill="#FFFFFF" rx="12"/>
  ${svgElements}
</svg>`;

  // Compose layers
  const layers = [
    { input: Buffer.from(svg), top: 0, left: 0 },
    {
      input: qrPngBuf,
      top: QR_AREA_Y + RING_PAD,
      left: QR_AREA_X + RING_PAD,
    },
  ];

  // Optional logo
  if (logoBuf) {
    try {
      const logoSize = Math.round(qrFinalSize * 0.20);
      const resizedLogo = await sharp(logoBuf).resize(logoSize, logoSize, { fit: 'inside' }).png().toBuffer();
      // White background for logo
      const logoBg = await sharp({
        create: { width: logoSize + 12, height: logoSize + 12, channels: 4, background: '#FFFFFF' }
      }).png().toBuffer();
      const logoBgX = QR_AREA_X + RING_PAD + (qrFinalSize - logoSize - 12) / 2;
      const logoBgY = QR_AREA_Y + RING_PAD + (qrFinalSize - logoSize - 12) / 2;
      layers.push({ input: logoBg, top: Math.round(logoBgY), left: Math.round(logoBgX) });
      layers.push({
        input: resizedLogo,
        top: Math.round(logoBgY + 6),
        left: Math.round(logoBgX + 6),
      });
    } catch (e) {
      log(`vCard logo composition failed: ${e.message}`);
    }
  }

  return sharp({
    create: { width: W, height: H, channels: 4, background: bgColor }
  }).composite(layers).png().toBuffer();
}

// ── Compose PDF card (A6 landscape, 105×148 mm) ───────────────────────────
//
// Layout (revised 2026-07-30 for contrast + Cyrillic support):
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← accent bar (top, 4pt)
//   │                                                                  │
//   │   ┌─────────────────────┐    BRAND NAME                         │
//   │   │ ┌─────────────────┐ │    ─────                              │ ← accent underline
//   │   │ │                 │ │    Tagline (accent color)            │
//   │   │ │                 │ │                                      │
//   │   │ │     QR CODE     │ │    Phone:    +7 900 000 00 00        │
//   │   │ │                 │ │    Telegram: @salavey13               │
//   │   │ │                 │ │    Address:  Нижний Новгород         │
//   │   │ │ ┌───┐           │ │                                      │
//   │   │ │ │LGO│  (logo)   │ │    ─────────────────────             │ ← divider
//   │   │ │ └───┘           │ │    Сканируйте QR → Telegram          │ ← footer hint
//   │   │ └─────────────────┘ │                                      │
//   │   └─────────────────────┘                                       │
//   │   ↑ white padding ring around QR for reliable scanning          │
//   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← accent bar (bottom, 4pt)
//   └──────────────────────────────────────────────────────────────────┘
//
// Font: DejaVu Sans (registered from /usr/share/fonts/truetype/dejavu/) for
// full Cyrillic support. PDFKit's default Helvetica only covers Latin-1,
// which produces mojibake for Russian text.
async function composePdfCard(qrPngBuf, logoBuf) {
  let PDFDocument, PDFKit;
  try {
    PDFKit = await import('pdfkit');
    PDFDocument = PDFKit.default || PDFKit.PDFDocument || PDFKit;
  } catch {
    fail('pdfkit package not installed. Run: npm install pdfkit');
  }

  // ── Register Unicode TTF fonts (DejaVu Sans covers Latin + Cyrillic + Greek) ──
  // Try common Linux paths; fall back to Helvetica if no font file exists.
  const fs = await import('node:fs');
  const fontCandidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  ];
  const fontBoldCandidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  ];
  const fontItalicCandidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf',
  ];

  const fontPath = fontCandidates.find((p) => fs.existsSync(p));
  const fontBoldPath = fontBoldCandidates.find((p) => fs.existsSync(p));
  const fontItalicPath = fontItalicCandidates.find((p) => fs.existsSync(p));

  const FONT_REGULAR = fontPath ? 'DejaVuRegular' : 'Helvetica';
  const FONT_BOLD = fontBoldPath ? 'DejaVuBold' : 'Helvetica-Bold';
  const FONT_ITALIC = fontItalicPath ? 'DejaVuItalic' : 'Helvetica-Oblique';

  // A6 landscape: 297.64 × 419.53 pt (105×148 mm at 72 DPI)
  const PAGE_W = 419.53;
  const PAGE_H = 297.64;
  const MARGIN = 22;
  const ACCENT_BAR_H = 5;

  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  });

  // Register fonts BEFORE first text() call
  if (fontPath) doc.registerFont('DejaVuRegular', fontPath);
  if (fontBoldPath) doc.registerFont('DejaVuBold', fontBoldPath);
  if (fontItalicPath) doc.registerFont('DejaVuItalic', fontItalicPath);

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolveP) => doc.on('end', () => resolveP(Buffer.concat(chunks))));

  // ── Background ──
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(bgColor);

  // ── Top + bottom accent bars (frames the card) ──
  doc.rect(0, 0, PAGE_W, ACCENT_BAR_H).fill(accentColor);
  doc.rect(0, PAGE_H - ACCENT_BAR_H, PAGE_W, ACCENT_BAR_H).fill(accentColor);

  // ── QR code with white padding ring (left side) ──
  // White ring improves scannability when card is printed on dark stock.
  const RING_PAD = 8;
  const QR_AREA = effectiveQrSize + RING_PAD * 2; // total white area
  const qrAreaX = MARGIN + 6;
  const qrAreaY = (PAGE_H - QR_AREA) / 2;

  // White rounded rectangle behind QR
  doc.roundedRect(qrAreaX, qrAreaY, QR_AREA, QR_AREA, 8).fill('#FFFFFF');
  // QR code centered in white area
  doc.image(qrPngBuf, qrAreaX + RING_PAD, qrAreaY + RING_PAD, {
    width: effectiveQrSize,
    height: effectiveQrSize,
  });

  // Optional logo in center of QR
  if (logoBuf) {
    try {
      const logoSize = Math.round(effectiveQrSize * 0.20);
      const logoX = qrAreaX + RING_PAD + (effectiveQrSize - logoSize) / 2;
      const logoY = qrAreaY + RING_PAD + (effectiveQrSize - logoSize) / 2;
      // White background behind logo for contrast
      doc.roundedRect(logoX - 3, logoY - 3, logoSize + 6, logoSize + 6, 4).fill('#FFFFFF');
      doc.image(logoBuf, logoX, logoY, { width: logoSize, height: logoSize });
    } catch (e) {
      log(`PDF logo embed failed: ${e.message}`);
    }
  }

  // ── Text column (right side, ~60% width) ──
  const textX = qrAreaX + QR_AREA + 20;
  const textRight = PAGE_W - MARGIN - 6;
  const textWidth = textRight - textX;
  let textY = MARGIN + 16;

  // ── Brand name (auto-shrink for long names so it fits on 1-2 lines) ──
  // Approximate char width at 20pt ≈ 12pt for DejaVu Sans Bold.
  // If brandName is wider than textWidth / 12 chars, drop font size.
  const brandCharsPerLine = Math.floor(textWidth / 12);
  const brandFontSize = brandName.length > brandCharsPerLine * 2
    ? 14
    : brandName.length > brandCharsPerLine
      ? 17
      : 20;

  doc.fillColor(textColor)
    .font(FONT_BOLD)
    .fontSize(brandFontSize)
    .text(brandName, textX, textY, { width: textWidth, lineBreak: true });
  // Advance by 1.4× font size per line, accounting for word wrap
  const brandLineCount = Math.max(1, Math.ceil(brandName.length / brandCharsPerLine));
  textY += brandFontSize * 1.4 * brandLineCount + 6;

  // ── Accent underline beneath brand ──
  doc.rect(textX, textY, 40, 2).fill(accentColor);
  textY += 10;

  // ── Tagline (smaller, accent color, italic) ──
  if (tagline) {
    doc.fillColor(accentColor)
      .font(FONT_ITALIC)
      .fontSize(10)
      .text(tagline, textX, textY, { width: textWidth, lineBreak: true });
    // Estimate tagline height — 10pt font, ~14pt line height, account for wraps
    const taglineCharsPerLine = Math.floor(textWidth / 6);
    const taglineLineCount = Math.max(1, Math.ceil(tagline.length / taglineCharsPerLine));
    textY += 14 * taglineLineCount + 10;
  } else {
    textY += 8;
  }

  // ── Contact details (with labels for clarity) ──
  // Use "Label: value" format instead of unicode emoji (which don't render in
  // PDFKit default fonts and cause mojibake).
  const contactLines = [];
  if (phone) contactLines.push({ label: 'ТЕЛ.', value: phone });
  if (telegram) contactLines.push({ label: 'TELEGRAM', value: telegram });
  if (address) contactLines.push({ label: 'АДРЕС', value: address });

  for (const line of contactLines) {
    // Label (smaller, accent color)
    doc.fillColor(accentColor)
      .font(FONT_BOLD)
      .fontSize(8)
      .text(line.label, textX, textY, { width: textWidth, lineBreak: false });
    textY += 11;

    // Value (regular weight, text color) — allow wrapping for long addresses
    doc.fillColor(textColor)
      .font(FONT_REGULAR)
      .fontSize(11)
      .text(line.value, textX, textY, { width: textWidth, lineBreak: true });
    const valueCharsPerLine = Math.floor(textWidth / 6.5);
    const valueLineCount = Math.max(1, Math.ceil(line.value.length / valueCharsPerLine));
    textY += 14 * valueLineCount + 6;
  }

  // ── Footer (anchored to bottom, with divider above) ──
  const footerHint = 'Сканируйте QR-код камерой → откроется Telegram';
  const footerY = PAGE_H - MARGIN - ACCENT_BAR_H - 18;
  // Divider line
  doc.rect(textX, footerY - 4, textWidth, 0.5).fill(accentColor);
  // Footer text
  doc.fillColor(accentColor)
    .font(FONT_ITALIC)
    .fontSize(8)
    .text(footerHint, textX, footerY, {
      width: textWidth,
      lineBreak: true,
      align: 'left',
    });

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
