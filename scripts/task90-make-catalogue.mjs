#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// task90-make-catalogue.mjs — VIP-BIKE: print-light QR catalogue
//   5 section PDFs (cover+TOC, electro/ice × rent/sale) → merged later by pypdf
// Palette: white bg (ink-light for printing), dark accents, contrast kept.
//   EV accent #0B7A4B (dark green) · ICE accent #8A5A16 (dark bronze)
//   brand gold #C9A227 thin decorative bars only · text gold #8A6D1D
// Deeplinks (hooks/useStartParamRouter.ts):
//   rent_{bikeId} → /franchize/vip-bike?vehicle=…&flow=rent
//   sale_{bikeId} → /franchize/vip-bike/market/{id}/buy
// Input : /home/z/cartest/scripts/task90-bikes.json (fresh live fetch)
// Output: /home/z/my-project/download/task90-sections/*.pdf
// Run:  node /home/z/qrtool/task90-make-catalogue.mjs
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import QRCode from 'qrcode';
import PDFKit from 'pdfkit';

const BOT = 'oneBikePlsBot';
const BASE = `https://t.me/${BOT}/app?startapp=`;
const OUT_DIR = '/home/z/my-project/download/task90-sections';
mkdirSync(OUT_DIR, { recursive: true });

// ── print-light palette ──
const BG = '#FFFFFF';
const INK = '#1A1A1A';
const MUTED = '#6E6A5E';
const HAIR = '#E3DFD3';
const GOLD = '#C9A227';      // thin decorative bars
const GOLD_TEXT = '#8A6D1D'; // readable gold on white
const THEME = {
  ev:  { accent: '#0B7A4B', soft: '#E9F4EE', ru: 'ЭЛЕКТРО',  ruLow: 'электро'  },
  ice: { accent: '#8A5A16', soft: '#F6EFE3', ru: 'БЕНЗИН',   ruLow: 'бензин'   },
};

// ── fonts (DejaVu = full Cyrillic) ──
const F_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const F_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const F_ITAL = ['/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf'].find(existsSync) || F_REG;
const F_MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';

// ── page geometry (A4 portrait, pt) ──
const PW = 595.28, PH = 841.89, MARGIN = 40, BAR = 6;
const CX = MARGIN, CW = PW - MARGIN * 2;

const bikes = JSON.parse(readFileSync('/home/z/cartest/scripts/task90-bikes.json', 'utf8'));

// ── sections (fixed order → deterministic global page numbers) ──
const SECTIONS = [
  { key: 'ev-rent',  pw: 'ev',  flow: 'rent', file: '01-electro-rent.pdf', title: 'ЭЛЕКТРО · АРЕНДА',  flowRu: 'АРЕНДА'  },
  { key: 'ev-sale',  pw: 'ev',  flow: 'sale', file: '02-electro-sale.pdf', title: 'ЭЛЕКТРО · ПРОДАЖА', flowRu: 'ПРОДАЖА' },
  { key: 'ice-rent', pw: 'ice', flow: 'rent', file: '03-ice-rent.pdf',     title: 'БЕНЗИН · АРЕНДА',   flowRu: 'АРЕНДА'  },
  { key: 'ice-sale', pw: 'ice', flow: 'sale', file: '04-ice-sale.pdf',     title: 'БЕНЗИН · ПРОДАЖА',  flowRu: 'ПРОДАЖА' },
];
for (const s of SECTIONS) {
  s.items = bikes
    .filter((b) => b.powertrain === s.pw && (s.flow === 'rent' ? b.for_rent : b.for_sale))
    .sort((a, b) => (s.flow === 'rent' ? b.daily_price - a.daily_price : b.sale_price - a.sale_price));
}
// global page numbers
let g = 2; // cover=1, toc=2
for (const s of SECTIONS) { s.start = g + 1; s.end = g + s.items.length + 1; g = s.end; }
const TOTAL_PAGES = g;
const total = { ev: bikes.filter(b => b.powertrain === 'ev').length, ice: bikes.filter(b => b.powertrain === 'ice').length,
  rent: bikes.filter(b => b.for_rent).length, sale: bikes.filter(b => b.for_sale).length };

function log(...a) { console.error('[task90]', ...a); }
const rub = (n) => Number(n || 0).toLocaleString('ru-RU');

async function makeQrBuf(url, size = 640) {
  return QRCode.toBuffer(url, {
    type: 'png', errorCorrectionLevel: 'H', margin: 1, width: size,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

const photoCache = new Map();
async function fetchPhoto(url) {
  if (!url) return null;
  if (photoCache.has(url)) return photoCache.get(url);
  const p = (async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) { log(`photo ${res.status}: ${url.slice(-40)}`); return null; }
      const raw = Buffer.from(await res.arrayBuffer());
      if (raw.length >= 6 * 1024 * 1024) return null;
      const sharp = (await import('sharp')).default;
      return await sharp(raw).resize({ width: 900, withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    } catch (e) { log(`photo fail: ${e.message}`); return null; }
  })();
  photoCache.set(url, p);
  return p;
}

function newDoc(title) {
  const doc = new PDFKit({
    size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: title, Author: 'VibeRider / oneBikePlsBot', Subject: 'vip-bike QR catalogue: rent & sale deeplinks' },
  });
  doc.registerFont('FReg', F_REG);
  doc.registerFont('FBold', F_BOLD);
  doc.registerFont('FItal', F_ITAL);
  if (existsSync(F_MONO)) doc.registerFont('FMono', F_MONO);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.done = new Promise((r) => doc.on('end', () => r(Buffer.concat(chunks))));
  return doc;
}

function goldBars(doc) {
  doc.rect(0, 0, PW, BAR).fill(GOLD);
  doc.rect(0, PH - BAR, PW, BAR).fill(GOLD);
}

function specRows(b) {
  const rows = [];
  if (b.odometer != null && b.odometer !== '') rows.push(['Пробег', `~${Number(b.odometer).toLocaleString('ru-RU')} км`]);
  if (b.powertrain === 'ev') {
    const kw = b.motor_peak_kw ? `${b.motor_peak_kw} кВт${b.motor_nominal_kw ? ` (ном. ${b.motor_nominal_kw})` : ' (пик)'}` : '';
    if (kw) rows.push(['Мотор', kw]);
    if (b.battery_kwh) rows.push(['Батарея', `${b.battery_kwh} кВт·ч`]);
    else if (b.voltage_v) rows.push(['Батарея', `${b.voltage_v} В`]);
    if (b.range_km) rows.push(['Запас хода', `${b.range_km} км`]);
    if (b.charge_time_h) rows.push(['Зарядка', `${b.charge_time_h} ч`]);
  } else {
    if (b.engine_cc) rows.push(['Двигатель', `${b.engine_cc} см³`]);
    if (b.power_hp) rows.push(['Мощность', `${b.power_hp} л.с.`]);
    if (b.fuel) rows.push(['Топливо', b.fuel]);
  }
  if (b.top_speed_kmh) rows.push(['Макс. скорость', `${b.top_speed_kmh} км/ч`]);
  if (b.vin) rows.push(['VIN', b.vin]);
  return rows.slice(0, 7);
}

// ══════════════════════════ DOC 0: cover + TOC ══════════════════════════
async function makeCoverToc() {
  const doc = newDoc('VIP BIKE ELECTRO — каталог QR-кодов (аренда и продажа)');
  // ── cover (page 1) ──
  doc.rect(0, 0, PW, PH).fill(BG);
  goldBars(doc);
  doc.fillColor(GOLD_TEXT).font('FBold').fontSize(13)
    .text('VIP BIKE ELECTRO', CX, 80, { align: 'center', width: CW });
  doc.fillColor(INK).font('FBold').fontSize(30)
    .text('Каталог QR-кодов', CX, 112, { align: 'center', width: CW });
  doc.fillColor(MUTED).font('FReg').fontSize(13)
    .text('Аренда и продажа · каждый QR ведёт сразу в карточку конкретного мотоцикла', CX, 156, { align: 'center', width: CW });

  const demoUrl = `${BASE}rent-bike`;
  const demoQr = await makeQrBuf(demoUrl, 560);
  const dSize = 190, dX = (PW - dSize) / 2, dY = 205;
  doc.roundedRect(dX - 1, dY - 1, dSize + 2, dSize + 2, 10).lineWidth(1).fillAndStroke('#FFFFFF', HAIR);
  doc.image(demoQr, dX, dY, { width: dSize, height: dSize });
  doc.fillColor(MUTED).font('FReg').fontSize(10.5)
    .text('общий вход в каталог аренды', CX, dY + dSize + 10, { align: 'center', width: CW });

  // stats row
  const stats = [
    [`${total.ev}`, 'электро'], [`${total.ice}`, 'бензин'],
    [`${total.rent}`, 'в аренде'], [`${total.sale}`, 'в продаже'],
  ];
  const sw = (CW - 30) / 4;
  let sx = MARGIN;
  const sy = 490;
  for (const [num, label] of stats) {
    doc.roundedRect(sx, sy, sw, 64, 10).lineWidth(1).fillAndStroke('#FFFFFF', HAIR);
    doc.fillColor(INK).font('FBold').fontSize(20).text(num, sx, sy + 10, { width: sw, align: 'center' });
    doc.fillColor(MUTED).font('FReg').fontSize(9.5).text(label, sx, sy + 38, { width: sw, align: 'center' });
    sx += sw + 10;
  }
  doc.fillColor(MUTED).font('FReg').fontSize(11.5)
    .text(`Байков в документе: ${bikes.length}   ·   Бот: @${BOT}`, CX, 585, { align: 'center', width: CW });
  doc.fillColor(MUTED).font('FReg').fontSize(10)
    .text(`Сформировано ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · VibeRider`, CX, 604, { align: 'center', width: CW });
  doc.fillColor(GOLD_TEXT).font('FItal').fontSize(10.5)
    .text('Печатный вариант: белые страницы, тёмный текст — экономит тонер, контраст сохранён.', CX, 640, { align: 'center', width: CW });
  log('cover done');

  // ── TOC (page 2) ──
  doc.addPage();
  doc.rect(0, 0, PW, PH).fill(BG);
  goldBars(doc);
  doc.fillColor(INK).font('FBold').fontSize(22).text('Содержание', MARGIN, 60);
  let ty = 110;
  SECTIONS.forEach((s, i) => {
    const t = THEME[s.pw];
    doc.roundedRect(MARGIN, ty, CW, 92, 10).lineWidth(1).fillAndStroke('#FFFFFF', HAIR);
    doc.roundedRect(MARGIN, ty, 6, 92, 3).fill(t.accent);
    doc.fillColor(t.accent).font('FBold').fontSize(15).text(`${i + 1}. ${s.title}`, MARGIN + 24, ty + 14);
    doc.fillColor(MUTED).font('FReg').fontSize(10.5)
      .text(`${s.items.length} стр. · QR-поток: ${s.flowRu === 'АРЕНДА' ? 'rent_{bikeId} — сразу в форму аренды' : 'sale_{bikeId} — сразу в карточку покупки'}`, MARGIN + 24, ty + 40);
    doc.fillColor(INK).font('FBold').fontSize(11)
      .text(`стр. ${s.start}–${s.end}`, MARGIN + 24, ty + 62);
    ty += 104;
  });
  doc.fillColor(MUTED).font('FReg').fontSize(10.5)
    .text('Легенда: цвет заголовка — тип техники (зелёный = электро, бронзовый = бензин). Чип на странице — поток QR: АРЕНДА (залитый) или ПРОДАЖА (контурный).', MARGIN, ty + 8, { width: CW });
  doc.fillColor(MUTED).font('FItal').fontSize(9.5)
    .text('Как пользоваться: распечатай страницу нужного мотоцикла и приклей на байк / стенд. Камера телефона открывает Telegram-бот с уже выбранным байком и нужным потоком (аренда или покупка).', MARGIN, ty + 40, { width: CW });
  doc.end();
  const buf = await doc.done;
  write(`${OUT_DIR}/00-cover-toc.pdf`, buf, 'cover-toc');
}

// ══════════════════════════ SECTION DOCS ══════════════════════════
async function makeSection(s, i) {
  const t = THEME[s.pw];
  const doc = newDoc(`VIP BIKE — ${s.title}`);
  let pageNo = s.start; // divider page number (first bike page = s.start + 1)

  // ── divider page ──
  doc.rect(0, 0, PW, PH).fill(BG);
  goldBars(doc);
  doc.fillColor(t.accent).font('FBold').fontSize(64).text(`${i + 1}`, MARGIN, 170, { align: 'center', width: CW });
  doc.fillColor(INK).font('FBold').fontSize(28).text(s.title, MARGIN, 268, { align: 'center', width: CW });
  doc.fillColor(MUTED).font('FReg').fontSize(13)
    .text(`${s.items.length} мотоцикл(ов) · стр. ${s.start}–${s.end}`, MARGIN, 312, { align: 'center', width: CW });
  doc.roundedRect(MARGIN, 360, CW, 84, 10).fill(t.soft);
  doc.fillColor(INK).font('FReg').fontSize(11.5)
    .text(s.flow === 'rent'
      ? 'QR на каждой странице открывает форму аренды конкретного байка (payload rent_{bikeId}).'
      : 'QR на каждой странице открывает карточку покупки конкретного байка (payload sale_{bikeId}).',
      MARGIN + 20, 378, { width: CW - 40 });
  doc.fillColor(MUTED).font('FItal').fontSize(10)
    .text(s.flow === 'rent'
      ? 'Если байк ещё и в продаже — цена продажи указана на карточке вторым строком.'
      : 'Если байк сдаётся в аренду — суточная цена указана на карточке вторым строком.',
      MARGIN, 466, { align: 'center', width: CW });

  for (let k = 0; k < s.items.length; k++) {
    const b = s.items[k];
    pageNo += 1;
    const payload = `${s.flow}_${b.id}`;
    const url = `${BASE}${payload}`;
    const qr = await makeQrBuf(url);
    const photo = await fetchPhoto(b.image_url);
    log(`[${s.key} ${k + 1}/${s.items.length}] p${pageNo} ${b.id} photo:${photo ? 'ok' : '—'}`);

    doc.addPage();
    doc.rect(0, 0, PW, PH).fill(BG);
    doc.rect(0, 0, PW, 3).fill(GOLD);

    // header
    doc.fillColor(t.accent).font('FBold').fontSize(9)
      .text(`${s.title} · ${s.flowRu}`, MARGIN, 20, { width: 300, lineBreak: false });
    doc.fillColor(MUTED).font('FReg').fontSize(9)
      .text(`стр. ${pageNo} / ${TOTAL_PAGES}`, MARGIN, 20, { width: PW - MARGIN * 2, align: 'right', lineBreak: false });

    const name = `${b.make} ${b.model}`.trim();
    const nameSize = name.length > 30 ? 20 : name.length > 22 ? 23 : 26;
    doc.fillColor(INK).font('FBold').fontSize(nameSize)
      .text(name, MARGIN, 36, { width: PW - MARGIN * 2, lineBreak: true });
    let yHead = 36 + nameSize * 1.35 + 4;
    const subBits = [b.year, b.color, b.engine_cc ? `${b.engine_cc} см³` : '', b.power_hp ? `${b.power_hp} л.с.` : '',
      b.motor_peak_kw ? `${b.motor_peak_kw} кВт` : ''].filter(Boolean).join('  ·  ');
    if (subBits) {
      doc.fillColor(t.accent).font('FReg').fontSize(11)
        .text(subBits, MARGIN, yHead, { width: PW - MARGIN * 2, lineBreak: false });
    }

    // ── flow chip (over QR block top-left) ──
    const chipW = 78, chipH = 20;
    const qrOuter = 250, qrPad = 12, qrInner = qrOuter - qrPad * 2;
    const qrX = MARGIN, qrY = 122;
    doc.roundedRect(qrX, qrY - chipH - 8, chipW, chipH, 5).fill(t.accent);
    doc.fillColor('#FFFFFF').font('FBold').fontSize(9.5)
      .text(s.flowRu, qrX, qrY - chipH - 8 + 5.5, { width: chipW, align: 'center', lineBreak: false });

    // ── QR block (left) ──
    doc.roundedRect(qrX, qrY, qrOuter, qrOuter, 10).lineWidth(1).fillAndStroke('#FFFFFF', HAIR);
    doc.image(qr, qrX + qrPad, qrY + qrPad, { width: qrInner, height: qrInner });
    doc.fillColor(t.accent).font(existsSync(F_MONO) ? 'FMono' : 'FReg').fontSize(9)
      .text(`startapp=${payload}`, qrX, qrY + qrOuter + 12, { width: 268, lineBreak: false });

    // hidden badge
    let badgeY = qrY + qrOuter + 40;
    if (b.hidden) {
      doc.roundedRect(qrX, badgeY, 168, 20, 5).lineWidth(1).fillAndStroke('#FFFFFF', '#B3261E');
      doc.fillColor('#B3261E').font('FBold').fontSize(9)
        .text('СКРЫТ ИЗ КАТАЛОГА', qrX, badgeY + 5.5, { width: 168, align: 'center', lineBreak: false });
    }

    // ── Right column: photo + prices + specs ──
    const colX = MARGIN + qrOuter + 30;
    const colW = PW - MARGIN - colX;
    doc.roundedRect(colX - 2, qrY - 2, colW + 4, 220 + 4, 10).lineWidth(1).fillAndStroke('#FFFFFF', HAIR);
    if (photo) {
      doc.image(photo, colX, qrY, { fit: [colW, 220], align: 'center', valign: 'center' });
    } else {
      doc.fillColor(MUTED).font('FItal').fontSize(10)
        .text('фото появится позже', colX, qrY + 100, { width: colW, align: 'center' });
    }

    let sy = qrY + 240;
    if (s.flow === 'sale') {
      doc.fillColor(MUTED).font('FReg').fontSize(9).text('ЦЕНА ПРОДАЖИ', colX, sy, { width: colW, lineBreak: false });
      doc.fillColor(t.accent).font('FBold').fontSize(21).text(`${rub(b.sale_price)} ₽`, colX, sy + 13, { width: colW, lineBreak: false });
      sy += 47;
      if (b.for_rent) {
        doc.fillColor(MUTED).font('FReg').fontSize(10.5)
          .text(`также в аренде: от ${rub(b.daily_price)} ₽/сут`, colX, sy, { width: colW, lineBreak: false });
        sy += 20;
      }
    } else {
      doc.fillColor(MUTED).font('FReg').fontSize(9).text('АРЕНДА', colX, sy, { width: colW, lineBreak: false });
      doc.fillColor(t.accent).font('FBold').fontSize(21).text(`${rub(b.daily_price)} ₽ / сутки`, colX, sy + 13, { width: colW, lineBreak: false });
      sy += 47;
      if (b.for_sale) {
        doc.fillColor(MUTED).font('FReg').fontSize(10.5)
          .text(`также в продаже: ${rub(b.sale_price)} ₽`, colX, sy, { width: colW, lineBreak: false });
        sy += 20;
      }
    }

    for (const [label, value] of specRows(b)) {
      doc.fillColor(MUTED).font('FReg').fontSize(9).text(label.toUpperCase(), colX, sy, { width: colW, lineBreak: false });
      sy += 12;
      doc.fillColor(INK).font('FReg').fontSize(11.5).text(String(value), colX, sy, { width: colW, lineBreak: false });
      sy += 19;
    }

    // ── footer ──
    const footY = PH - BAR - 74;
    doc.rect(MARGIN, footY - 12, PW - MARGIN * 2, 0.5).fill(HAIR);
    doc.fillColor(MUTED).font('FReg').fontSize(8.5)
      .text(url, MARGIN, footY, { width: PW - MARGIN * 2, lineBreak: false, ellipsis: true });
    doc.fillColor(t.accent).font('FItal').fontSize(10)
      .text(s.flow === 'rent'
        ? 'Сканируй камерой → бот откроет аренду этого байка → пара тапов и поехал'
        : 'Сканируй камерой → откроется карточка покупки этого байка',
        MARGIN, footY + 16, { width: PW - MARGIN * 2, lineBreak: false });
  }

  doc.end();
  const buf = await doc.done;
  write(`${OUT_DIR}/${s.file}`, buf, s.key);
}

function write(path, buf, tag) {
  writeFileSync(path, buf);
  log(`✓ ${tag}: ${path} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
}

// ══════════════════════════ MAIN ══════════════════════════
log(`bikes: ${bikes.length} | pages: cover+toc=2, sections: ${SECTIONS.map(s => `${s.key}=${s.items.length + 1}`).join(', ')} | total=${TOTAL_PAGES}`);
await makeCoverToc();
let i = 0;
for (const s of SECTIONS) { await makeSection(s, i); i++; }
console.log(JSON.stringify({
  ok: true, out_dir: OUT_DIR, pages: TOTAL_PAGES,
  sections: SECTIONS.map(s => ({ key: s.key, bikes: s.items.length, start: s.start, end: s.end })),
}));
