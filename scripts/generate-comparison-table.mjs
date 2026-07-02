#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// generate-comparison-table.mjs — Bike comparison table PDF generator
// ═══════════════════════════════════════════════════════════════════════════
//
// Generates a comprehensive comparison table PDF for all sale bikes.
// Each bike is a row, each spec is a column. Perfect for spotting inconsistencies!
//
// USAGE:
//   node generate-comparison-table.mjs --slug vip-bike
//   node generate-comparison-table.mjs --slug vip-bike --output ./tmp/comparison.pdf
//
// ─── SUPPORTED CLI FLAGS ───────────────────────────────────────────────────
//   --slug            (REQUIRED) Franchize slug
//   --output          Output PDF path (default: ./tmp/bikes-comparison.pdf)
//   --fontSize        Font size for table cells (default: 6, use 5 for many bikes)
//   --siteUrl         Next.js site URL (default: NEXT_PUBLIC_SITE_URL or localhost:3000)
//
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

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
const outputPath = arg('output', './tmp/bikes-comparison.pdf');
const fontSize = parseInt(arg('fontSize', '6'), 10) || 6;
const siteUrl = arg('siteUrl') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// ── Validation ───────────────────────────────────────────────────────────
if (!slug) {
  console.error(JSON.stringify({ ok: false, error: 'Missing --slug' }, null, 2));
  process.exit(2);
}

// ── Supabase client ─────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(JSON.stringify({ ok: false, error: 'Missing Supabase credentials' }, null, 2));
  process.exit(2);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Color Palette ────────────────────────────────────────────────────────
const COLORS = {
  pageBg: rgb(0.07, 0.08, 0.10),
  header: rgb(0.04, 0.05, 0.07),
  text: rgb(0.92, 0.93, 0.95),
  muted: rgb(0.55, 0.57, 0.60),
  accent: rgb(0.04, 0.745, 0.94),
  line: rgb(0.18, 0.19, 0.22),
  white: rgb(1, 1, 1),
  highlight: rgb(0.2, 0.25, 0.35),
};

// ── Spec priority order (for column ordering) ───────────────────────────────
// These specs will appear first in the table, in this order
const SPEC_PRIORITY = [
  'bike_subtype', 'Тип',
  'year', 'Год',
  'power_kw', 'motor_peak_kw', 'Пиковая мощность',
  'motor_nominal_kw', 'Номинальная мощность',
  'torque_nm', 'torque_motor_nm', 'Крутящий момент',
  'battery', 'Батарея',
  'range_km', 'range_120ah_km', 'range_100ah_km', 'Запас хода',
  'top_speed_kmh', 'Макс. скорость',
  'acceleration_0_100_s', 'Разгон 0-100',
  'weight_kg', 'Вес',
  'brake_type', 'Тормоза',
  'suspension_type', 'suspension_front', 'Подвеска',
  'frame_type', 'Рама',
  'charge_time_h', 'Зарядка',
  'license_class', 'Класс прав',
  'removable_battery', 'Съемный аккумулятор',
];

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
    .select('id, make, model, description, image_url, daily_price, type, specs')
    .eq('crew_id', crew.id)
    .eq('type', 'bike');

  if (carsError) {
    throw new Error(`Failed to fetch bikes: ${carsError.message}`);
  }

  return { crew, bikes: cars || [] };
}

// ── Filter sale bikes ─────────────────────────────────────────────────────
function filterSaleBikes(bikes) {
  return bikes
    .filter(bike => {
      const specs = bike.specs || {};
      const hasSale = specs.sale === true || specs.sale === 1 || String(specs.sale).toLowerCase() === 'true';
      return hasSale && (bike.make || bike.model);
    })
    .map(bike => {
      const specs = bike.specs || {};
      return {
        ...bike,
        title: `${bike.make || ''} ${bike.model || ''}`.trim(),
        salePrice: specs.sale_price || specs.purchase_price || null,
      };
    })
    .sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0)); // Sort by price ascending
}

// ── Normalize spec key to readable label ─────────────────────────────────────
function normalizeSpecKey(key) {
  const niceLabel = key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return niceLabel;
}

// ── Get all unique spec keys across all bikes ───────────────────────────────────
function getAllSpecKeys(bikes) {
  const keySet = new Set();

  bikes.forEach(bike => {
    const specs = bike.specs || {};
    Object.keys(specs).forEach(key => {
      // Exclude internal fields
      if (!['gallery', 'features', 'buy_colors', 'buy_options', 'spec_labels', 'sale'].includes(key)) {
        keySet.add(key);
      }
    });
  });

  // Sort by priority first, then alphabetically
  const keys = Array.from(keySet);
  keys.sort((a, b) => {
    const aPriority = SPEC_PRIORITY.indexOf(a);
    const bPriority = SPEC_PRIORITY.indexOf(b);

    // If both have priority positions, sort by priority
    if (aPriority >= 0 && bPriority >= 0) {
      return aPriority - bPriority;
    }
    // If only a has priority, a comes first
    if (aPriority >= 0) return -1;
    // If only b has priority, b comes first
    if (bPriority >= 0) return 1;
    // Otherwise, alphabetical
    return a.localeCompare(b);
  });

  return keys;
}

// ── Format spec value for display ────────────────────────────────────────────
function formatSpecValue(key, value) {
  if (value === null || value === undefined) return '';

  // Boolean values
  if (value === true) return 'Да';
  if (value === false) return 'Нет';

  // Number values with units
  const numValue = Number(value);
  if (!isNaN(numValue) && value !== '') {
    const unitMap = {
      power_kw: ' кВт',
      motor_peak_kw: ' кВт',
      motor_nominal_kw: ' кВт',
      torque_nm: ' Н·м',
      torque_motor_nm: ' Н·м',
      range_km: ' км',
      range_120ah_km: ' км',
      range_100ah_km: ' км',
      top_speed_kmh: ' км/ч',
      weight_kg: ' кг',
      charge_time_h: ' ч',
      acceleration_0_100_s: ' с',
    };

    if (unitMap[key]) {
      return numValue + unitMap[key];
    }
  }

  return String(value);
}

// ── Truncate text to fit width ───────────────────────────────────────────────
function truncateText(text, maxWidth, font, fontSize) {
  if (!text) return '';

  let width = font.widthOfTextAtSize(text, fontSize);
  if (width <= maxWidth) return text;

  // Binary search for max length
  let left = 0;
  let right = text.length;
  let result = text;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    const truncated = text.slice(0, mid);
    width = font.widthOfTextAtSize(truncated + '...', fontSize);

    if (width <= maxWidth) {
      result = truncated + '...';
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

// ── Generate comparison PDF ─────────────────────────────────────────────────
async function generateComparisonPdf(bikes, crew, outputPath) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load DejaVuSans font (supports Cyrillic)
  const fontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans.ttf');
  const boldFontPath = path.join(process.cwd(), 'server-assets', 'fonts', 'DejaVuSans-Bold.ttf');

  let font, boldFont;
  try {
    const fontBytes = fs.readFileSync(fontPath);
    const boldFontBytes = fs.readFileSync(boldFontPath);
    font = await pdfDoc.embedFont(fontBytes);
    boldFont = await pdfDoc.embedFont(boldFontBytes);
  } catch (err) {
    console.error('Failed to load fonts:', err);
    throw new Error('DejaVuSans fonts not found. Make sure server-assets/fonts/DejaVuSans.ttf exists.');
  }

  const page = pdfDoc.addPage([842, 595]); // A4 landscape

  // Page settings
  const margin = 40;
  const headerHeight = 50;
  const rowHeight = Math.max(18, fontSize + 6);
  const tableTop = page.getHeight() - margin - headerHeight;
  const tableWidth = page.getWidth() - 2 * margin;

  // Get all spec keys (columns)
  const specKeys = getAllSpecKeys(bikes);

  // Calculate column widths
  // First column: bike name (wider)
  const bikeNameWidth = Math.min(180, tableWidth / (specKeys.length + 1));
  const remainingWidth = tableWidth - bikeNameWidth;
  const specColumnWidth = remainingWidth / specKeys.length;

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
    color: COLORS.pageBg,
  });

  // Header
  page.drawRectangle({
    x: 0,
    y: page.getHeight() - headerHeight,
    width: page.getWidth(),
    height: headerHeight,
    color: COLORS.header,
  });

  const headerTitle = `${(crew.header?.brandName || crew.name || 'VIP BIKE').toUpperCase()} — Сравнение моделей`;
  const titleWidth = boldFont.widthOfTextAtSize(headerTitle, 16);

  page.drawText(headerTitle, {
    x: margin,
    y: page.getHeight() - 30,
    size: 16,
    font: boldFont,
    color: COLORS.accent,
  });

  // Subtitle with bike count
  page.drawText(`Всего моделей: ${bikes.length}`, {
    x: margin,
    y: page.getHeight() - 45,
    size: 10,
    font: font,
    color: COLORS.muted,
  });

  // Draw table header row
  let currentX = margin;
  let currentY = tableTop;

  // Alternating row highlight
  const drawRowBackground = (rowIndex) => {
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: margin - 5,
        y: currentY - rowHeight,
        width: tableWidth + 10,
        height: rowHeight,
        color: COLORS.highlight,
      });
    }
  };

  // Header row background
  page.drawRectangle({
    x: margin - 5,
    y: currentY - rowHeight,
    width: tableWidth + 10,
    height: rowHeight,
    color: COLORS.accent,
    opacity: 0.2,
  });

  // Draw header cells
  const headers = ['Модель', ...specKeys.map(k => normalizeSpecKey(k))];
  const columnWidths = [bikeNameWidth, ...specKeys.map(() => specColumnWidth)];

  headers.forEach((header, i) => {
    const colWidth = columnWidths[i];
    const text = truncateText(header, colWidth - 8, boldFont, 8);

    page.drawText(text, {
      x: currentX + 4,
      y: currentY - rowHeight / 2 - 3,
      size: 8,
      font: boldFont,
      color: COLORS.white,
    });

    // Vertical line
    page.drawLine({
      start: { x: currentX + colWidth, y: currentY },
      end: { x: currentX + colWidth, y: currentY - rowHeight },
      thickness: 0.5,
      color: COLORS.line,
    });

    currentX += colWidth;
  });

  currentY -= rowHeight;

  // Draw data rows
  bikes.forEach((bike, bikeIndex) => {
    drawRowBackground(bikeIndex);

    currentX = margin;
    const specs = bike.specs || {};

    // Bike name and price
    const bikeName = bike.title || 'Без названия';
    const price = bike.salePrice ? `${bike.salePrice.toLocaleString('ru-RU')} ₽` : 'по запросу';

    // First column: bike name with price
    page.drawText(truncateText(bikeName, bikeNameWidth / 2, boldFont, fontSize), {
      x: currentX + 4,
      y: currentY - rowHeight / 2 + 2,
      size: fontSize + 1,
      font: boldFont,
      color: COLORS.text,
    });

    page.drawText(truncateText(price, bikeNameWidth / 2 - 8, font, fontSize - 1), {
      x: currentX + 4,
      y: currentY - rowHeight / 2 - 6,
      size: fontSize - 1,
      font: font,
      color: COLORS.accent,
    });

    currentX += bikeNameWidth;

    // Spec columns
    specKeys.forEach((key) => {
      const value = formatSpecValue(key, specs[key]);
      const text = truncateText(value, specColumnWidth - 8, font, fontSize);

      page.drawText(text, {
        x: currentX + 4,
        y: currentY - rowHeight / 2 - 2,
        size: fontSize,
        font: font,
        color: COLORS.text,
      });

      // Vertical line
      page.drawLine({
        start: { x: currentX + specColumnWidth, y: currentY },
        end: { x: currentX + specColumnWidth, y: currentY - rowHeight },
        thickness: 0.5,
        color: COLORS.line,
      });

      currentX += specColumnWidth;
    });

    // Horizontal line
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: margin + tableWidth, y: currentY },
      thickness: 0.5,
      color: COLORS.line,
    });

    currentY -= rowHeight;

    // Check if we need a new page
    if (currentY < margin + rowHeight) {
      // Add new page
      const newPage = pdfDoc.addPage([842, 595]);

      // Draw header on new page
      newPage.drawRectangle({
        x: 0,
        y: newPage.getHeight() - headerHeight,
        width: newPage.getWidth(),
        height: headerHeight,
        color: COLORS.header,
      });

      newPage.drawText(headerTitle, {
        x: margin,
        y: newPage.getHeight() - 30,
        size: 16,
        font: boldFont,
        color: COLORS.accent,
      });

      // Draw table header on new page
      currentY = newPage.getHeight() - margin - headerHeight;

      newPage.drawRectangle({
        x: margin - 5,
        y: currentY - rowHeight,
        width: tableWidth + 10,
        height: rowHeight,
        color: COLORS.accent,
        opacity: 0.2,
      });

      currentX = margin;
      headers.forEach((header, i) => {
        const colWidth = columnWidths[i];
        const text = truncateText(header, colWidth - 8, boldFont, 8);

        newPage.drawText(text, {
          x: currentX + 4,
          y: currentY - rowHeight / 2 - 3,
          size: 8,
          font: boldFont,
          color: COLORS.white,
        });

        newPage.drawLine({
          start: { x: currentX + colWidth, y: currentY },
          end: { x: currentX + colWidth, y: currentY - rowHeight },
          thickness: 0.5,
          color: COLORS.line,
        });

        currentX += colWidth;
      });

      currentY -= rowHeight;
    }
  });

  // Bottom border
  page.drawLine({
    start: { x: margin, y: currentY },
    end: { x: margin + tableWidth, y: currentY },
    thickness: 0.5,
    color: COLORS.line,
  });

  // Footer with generation info
  const footerY = 20;
  page.drawText(`Generated: ${new Date().toLocaleString('ru-RU')}`, {
    x: margin,
    y: footerY,
    size: 8,
    font: font,
    color: COLORS.muted,
  });

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
}

// ── Main flow ─────────────────────────────────────────────────────────────
async function main() {
  console.error(`Fetching bikes for slug: ${slug}`);

  const { crew, bikes } = await getFranchizeBySlug(slug);
  const saleBikes = filterSaleBikes(bikes);

  if (saleBikes.length === 0) {
    console.error(JSON.stringify({ ok: false, error: 'No sale bikes found' }, null, 2));
    process.exit(2);
  }

  console.error(`Found ${saleBikes.length} sale bikes`);

  // Get all unique spec keys
  const specKeys = getAllSpecKeys(saleBikes);
  console.error(`Total unique spec columns: ${specKeys.length}`);
  console.error(`Spec columns: ${specKeys.slice(0, 10).join(', ')}${specKeys.length > 10 ? '...' : ''}`);

  // Generate PDF
  const outputPathResolved = path.resolve(process.cwd(), outputPath);
  await generateComparisonPdf(saleBikes, crew, outputPathResolved);

  console.error(`\n✓ Comparison table saved to: ${outputPathResolved}`);

  console.log(JSON.stringify({
    ok: true,
    bikesCount: saleBikes.length,
    specColumns: specKeys.length,
    outputPath: outputPathResolved,
    bikes: saleBikes.map(b => ({
      id: b.id,
      title: b.title,
      price: b.salePrice,
    })),
  }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(2);
});
