#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// task88-make-qr-pdf.mjs — VIP-BIKE: PDF with rent-deeplink QR codes
// for every bike (type=bike) of the vip-bike crew.
//
// Deeplink syntax (hooks/useStartParamRouter.ts + docs/DEEP_LINKS_REFERENCE.md):
//   https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}
//
// Input : scripts/task88-bikes.json (from task88-lookup-bikes3.mjs)
// Output: /home/z/my-project/download/vip-bike-qr-rent-deeplinks.pdf
//
// run: node scripts/task88-make-qr-pdf.mjs
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import QRCode from 'qrcode';
import PDFKit from 'pdfkit';

const BOT = 'oneBikePlsBot';
const BASE = `https://t.me/${BOT}/app?startapp=`;
const OUT = '/home/z/my-project/download/vip-bike-qr-rent-deeplinks.pdf';

const ACCENT = '#FFD700';
const BG = '#0A0A0A';
const TEXT = '#FFFAF0';
const MUTED = '#B9B3A3';

// ── Fonts (DejaVu = full Cyrillic) ─────────────────────────────────────────
const F_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const F_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const F_ITAL = ['/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf'].find(existsSync) || F_REG;
const F_MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';

// ── Page geometry (A4 portrait, pt) ───────────────────────────────────────
const PW = 595.28;
const PH = 841.89;
const MARGIN = 40;
const BAR = 6; // accent bar height

const bikes = JSON.parse(readFileSync('/home/z/cartest/scripts/task88-bikes.json', 'utf8'));

function log(...a) { console.error('[task88]', ...a); }

async function makeQrBuf(url, size = 640) {
  return QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'H',
    margin: 1,
    width: size,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

async function fetchPhoto(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) { log(`photo ${res.status}: ${url.slice(-40)}`); return null; }
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length >= 6 * 1024 * 1024) return null;
    // compress: 900px wide, mozjpeg q72 → keeps PDF lean (~2-3MB total)
    const sharp = (await import('sharp')).default;
    return await sharp(raw).resize({ width: 900, withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  } catch (e) {
    log(`photo fetch fail: ${e.message}`);
    return null;
  }
}

function fmtPrice(p) {
  if (!p || p <= 0) return 'цена по запросу';
  return `${p.toLocaleString('ru-RU')} ₽ / сутки`;
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  log(`bikes: ${bikes.length}`);

  const doc = new PDFKit({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: 'VIP BIKE ELECTRO — QR-коды аренды (deeplink на каждый байк)',
      Author: 'VibeRider / oneBikePlsBot',
      Subject: 'rent_{bikeId} deeplink QR codes',
    },
  });
  doc.registerFont('FReg', F_REG);
  doc.registerFont('FBold', F_BOLD);
  doc.registerFont('FItal', F_ITAL);
  if (existsSync(F_MONO)) doc.registerFont('FMono', F_MONO);

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((r) => doc.on('end', () => r(Buffer.concat(chunks))));

  // ────────────────────────────── COVER ───────────────────────────────────
  doc.rect(0, 0, PW, PH).fill(BG);
  doc.rect(0, 0, PW, BAR).fill(ACCENT);
  doc.rect(0, PH - BAR, PW, BAR).fill(ACCENT);

  const CX = MARGIN;
  const CW = PW - MARGIN * 2;
  doc.fillColor(ACCENT).font('FBold').fontSize(13)
    .text('VIP BIKE ELECTRO', CX, 88, { align: 'center', width: CW });
  doc.fillColor(TEXT).font('FBold').fontSize(29)
    .text('QR-коды аренды по байкам', CX, 122, { align: 'center', width: CW });
  doc.fillColor(MUTED).font('FReg').fontSize(13)
    .text('Каждый QR ведёт сразу в форму аренды конкретного мотоцикла', CX, 164, { align: 'center', width: CW });

  // demo QR (catalog link rent-bike) centered on white ring
  const demoUrl = `${BASE}rent-bike`;
  const demoQr = await makeQrBuf(demoUrl, 560);
  const dSize = 210;
  const dX = (PW - dSize) / 2;
  const dY = 200;
  doc.roundedRect(dX - 10, dY - 10, dSize + 20, dSize + 20, 12).fill('#FFFFFF');
  doc.image(demoQr, dX, dY, { width: dSize, height: dSize });

  doc.fillColor(MUTED).font('FReg').fontSize(11.5)
    .text('Ссылки построены по формату:', CX, 456, { align: 'center', width: CW });
  doc.fillColor(ACCENT).font(existsSync(F_MONO) ? 'FMono' : 'FReg').fontSize(11)
    .text(`t.me/${BOT}/app?startapp=rent_{bikeId}`, CX, 476, { align: 'center', width: CW });
  doc.fillColor(TEXT).font('FReg').fontSize(11.5)
    .text(`Байков в документе: ${bikes.length}   ·   Бот: @${BOT}`, CX, 506, { align: 'center', width: CW });
  doc.fillColor(MUTED).font('FReg').fontSize(10)
    .text(`Сформировано ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · VibeRider`, CX, 524, { align: 'center', width: CW });

  doc.fillColor(MUTED).font('FItal').fontSize(9.5)
    .text('Как пользоваться: распечатай страницу нужного байка и приклей на мотоцикл / стенд. Камера телефона открывает Telegram-бота с уже выбранным байком.',
      MARGIN + 60, PH - 110, { align: 'center', width: PW - (MARGIN + 60) * 2, lineBreak: true });

  log('cover done');

  // ────────────────────────── BIKE PAGES ──────────────────────────────────
  for (let i = 0; i < bikes.length; i++) {
    const b = bikes[i];
    const payload = `rent_${b.id}`;
    const url = `${BASE}${payload}`;
    const qr = await makeQrBuf(url);
    const photo = await fetchPhoto(b.image_url);
    log(`[${i + 1}/${bikes.length}] ${b.id} photo:${photo ? 'ok' : '—'}`);

    doc.addPage();
    doc.rect(0, 0, PW, PH).fill(BG);
    doc.rect(0, 0, PW, BAR).fill(ACCENT);
    doc.rect(0, PH - BAR, PW, BAR).fill(ACCENT);

    // header
    doc.fillColor(MUTED).font('FReg').fontSize(9)
      .text(`${i + 1} / ${bikes.length}`, MARGIN, 22, { align: 'right', width: PW - MARGIN * 2 });

    const name = `${b.make} ${b.model}`.trim();
    const nameSize = name.length > 30 ? 21 : name.length > 22 ? 24 : 27;
    doc.fillColor(TEXT).font('FBold').fontSize(nameSize)
      .text(name, MARGIN, 30, { width: PW - MARGIN * 2, lineBreak: true });
    let yHead = 30 + nameSize * 1.35 + 2;
    const subBits = [b.year, b.color, b.engine_cc ? `${b.engine_cc} см³` : '', b.power_hp ? `${b.power_hp} л.с.` : '']
      .filter(Boolean).join('  ·  ');
    if (subBits) {
      doc.fillColor(ACCENT).font('FReg').fontSize(11)
        .text(subBits, MARGIN, yHead, { width: PW - MARGIN * 2, lineBreak: false });
    }

    // ── QR block (left) ──
    const qrOuter = 250;
    const qrPad = 12;
    const qrInner = qrOuter - qrPad * 2;
    const qrX = MARGIN;
    const qrY = 118;
    doc.roundedRect(qrX, qrY, qrOuter, qrOuter, 12).fill('#FFFFFF');
    doc.image(qr, qrX + qrPad, qrY + qrPad, { width: qrInner, height: qrInner });

    // payload under QR (mono)
    doc.fillColor(ACCENT).font(existsSync(F_MONO) ? 'FMono' : 'FReg').fontSize(10.5)
      .text(`startapp=${payload}`, qrX, qrY + qrOuter + 14, { width: qrOuter + 60, lineBreak: false });

    // hidden badge
    let badgeY = qrY + qrOuter + 44;
    if (b.hidden) {
      doc.roundedRect(qrX, badgeY, 150, 20, 5).fill('#3A2E00');
      doc.fillColor(ACCENT).font('FBold').fontSize(9)
        .text('СКРЫТ ИЗ КАТАЛОГА', qrX, badgeY + 5.5, { width: 150, align: 'center', lineBreak: false });
    }

    // ── Right column: photo + specs ──
    const colX = MARGIN + qrOuter + 30;
    const colW = PW - MARGIN - colX;
    if (photo) {
      doc.roundedRect(colX - 2, qrY - 2, colW + 4, 220 + 4, 10).fill('#161616');
      doc.image(photo, colX, qrY, { fit: [colW, 220], align: 'center', valign: 'center' });
    } else {
      doc.roundedRect(colX - 2, qrY - 2, colW + 4, 220 + 4, 10).fill('#161616');
      doc.fillColor(MUTED).font('FItal').fontSize(10)
        .text('фото появится позже', colX, qrY + 100, { width: colW, align: 'center' });
    }

    let sy = qrY + 240;
    doc.fillColor(ACCENT).font('FBold').fontSize(19).text(fmtPrice(b.daily_price), colX, sy, { width: colW, lineBreak: false });
    sy += 32;

    const specLines = [];
    if (b.odometer != null && b.odometer !== '') specLines.push(['Пробег', `~${Number(b.odometer).toLocaleString('ru-RU')} км`]);
    if (b.engine_cc) specLines.push(['Двигатель', `${b.engine_cc} см³`]);
    if (b.power_hp) specLines.push(['Мощность', `${b.power_hp} л.с.`]);
    if (b.color) specLines.push(['Цвет', b.color]);
    if (b.vin) specLines.push(['VIN', b.vin]);
    for (const [k, v] of specLines) {
      doc.fillColor(MUTED).font('FReg').fontSize(9).text(k.toUpperCase(), colX, sy, { width: colW, lineBreak: false });
      sy += 12;
      doc.fillColor(TEXT).font('FReg').fontSize(11.5).text(String(v), colX, sy, { width: colW, lineBreak: false });
      sy += 19;
    }

    // ── Bottom: full URL + hint ──
    const footY = PH - BAR - 74;
    doc.rect(MARGIN, footY - 12, PW - MARGIN * 2, 0.5).fill('#33301F');
    doc.fillColor(MUTED).font('FReg').fontSize(8.5)
      .text(url, MARGIN, footY, { width: PW - MARGIN * 2, lineBreak: false, ellipsis: true });
    doc.fillColor(ACCENT).font('FItal').fontSize(10)
      .text('Сканируй камерой → откроется бот с этим байком → аренда за пару тапов',
        MARGIN, footY + 16, { width: PW - MARGIN * 2, lineBreak: false });
  }

  doc.end();
  const buf = await done;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(OUT, buf);
  log(`✓ saved ${OUT} (${(buf.length / 1024 / 1024).toFixed(2)} MB, ${bikes.length + 1} pages)`);
  console.log(JSON.stringify({ ok: true, out: OUT, pages: bikes.length + 1, bytes: buf.length }));
}

main().catch((e) => { console.error('[task88] FATAL', e); process.exit(1); });
