#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// generate-comparison-table.mjs — Bike comparison table PDF generator
// ═══════════════════════════════════════════════════════════════════════════
//
// Generates a comprehensive comparison table PDF for all sale bikes.
// Each bike is a row, each spec is a column. Splits across multiple pages!
//
// USAGE:
//   node generate-comparison-table.mjs --slug vip-bike
//   node generate-comparison-table.mjs --slug vip-bike --output ./tmp/comparison.pdf
//
// ─── SUPPORTED CLI FLAGS ───────────────────────────────────────────────────
//   --slug            (REQUIRED) Franchize slug
//   --output          Output PDF path (default: ./tmp/bikes-comparison.pdf)
//   --fontSize        Font size for table cells (default: 7)
//   --columnsPerPage  Max columns per page (default: 15)
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
const fontSize = parseInt(arg('fontSize', '7'), 10) || 7;
const columnsPerPage = parseInt(arg('columnsPerPage', '20'), 10) || 20;
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
  // Data quality highlight colors
  warning: rgb(0.8, 0.5, 0.1),     // Orange - missing required field
  info: rgb(0.1, 0.5, 0.7),        // Blue - potentially missing but OK for some types
  critical: rgb(0.8, 0.15, 0.15),  // Red - definitely missing
};

// ── Spec priority order (for column ordering) ───────────────────────────────
const SPEC_PRIORITY = [
  'bike_subtype', 'Тип',
  'year', 'Год',
  'power_kw', 'motor_peak_kw', 'Пиковая мощность',
  'motor_nominal_kw', 'Номинальная мощность',
  'torque_nm', 'torque_motor_nm', 'Крутящий момент',
  'battery', 'Батарея',
  'removable_battery', 'Съемный аккумулятор',
  'range_km', 'range_120ah_km', 'range_100ah_km', 'Запас хода',
  'top_speed_kmh', 'Макс. скорость',
  'acceleration_0_100_s', 'Разгон 0-100',
  'weight_kg', 'Вес',
  'brake_type', 'Тормоза',
  'suspension_type', 'suspension_front', 'Подвеска',
  'frame_type', 'Рама',
  'charge_time_h', 'Зарядка',
  'license_class', 'Класс прав',
  'price_per_hour', '1 час',
  'price_per_3h', '3 часа',
  'price_per_6h', '6 часов',
  'price_per_12h', '12 часов',
  'rent_weekday', 'Будни',
  'rent_weekend', 'Выходные',
  'dailyPrice', 'daily_price', 'Цена/день',
  'access_type', 'Тип доступа',
  'rent_5_10d', 'Rent 5 10d',
  'rent_price_label', 'Rent Price Label',
];

// ── Column type classification ──────────────────────────────────────────────
const TEXT_COLUMNS = new Set([
  'bike_subtype', 'Тип',
  'brake_type', 'Тормоза',
  'suspension_type', 'suspension_front', 'Подвеска',
  'frame_type', 'Рама',
  'license_class', 'Класс прав',
  'battery', 'Батарея',
  'access_type', 'Тип доступа',
  'rent_price_label', 'Rent Price Label',
  'description',
]);

// ── Bike type classification ─────────────────────────────────────────────────
// Fields that are expected for each bike type
const EXPECTED_FIELDS = {
  electro: ['battery', 'range_km', 'charge_time_h', 'removable_battery', 'power_kw'],
  ice: ['motor_peak_kw', 'motor_nominal_kw', 'torque_nm'],
  both: ['weight_kg', 'brake_type', 'suspension_type', 'top_speed_kmh'],
  required: ['sale_price', 'purchase_price', 'price_per_hour', 'rent_weekday', 'rent_weekend', 'access_type'],
};

// Price-related fields that should have values
const PRICE_FIELDS = [
  'sale_price', 'purchase_price', 'price_per_hour', 'price_per_3h',
  'price_per_6h', 'price_per_12h', 'rent_weekday', 'rent_weekend', 'rent_5_10d',
  'dailyPrice', 'daily_price',
];

// ── Detect if column is text-based or numeric ─────────────────────────────────
function isTextColumn(key, values) {
  // Check explicit list
  if (TEXT_COLUMNS.has(key)) return true;
  if (TEXT_COLUMNS.has(normalizeSpecKey(key))) return true;

  // Check if majority of non-empty values are text (not numeric)
  let numericCount = 0;
  let textCount = 0;

  values.forEach(v => {
    if (v === null || v === undefined || v === '') return;
    if (typeof v === 'number') {
      numericCount++;
    } else if (typeof v === 'string') {
      // Check if string is a number
      const num = parseFloat(v);
      if (!isNaN(num) && v.trim() !== '' && !isNaN(Number(v))) {
        numericCount++;
      } else {
        textCount++;
      }
    }
  });

  // If >50% are numeric, it's a number column
  const total = numericCount + textCount;
  if (total === 0) return false; // Empty column - treat as number by default
  return textCount > numericCount;
}

// ── Classify bike as electro or ICE based on specs ─────────────────────────────
function classifyBikeType(bike) {
  const specs = bike.specs || {};

  // Check for electro indicators
  const hasBattery = specs.battery || specs.range_km || specs.charge_time_h;
  const hasElectricMotor = specs.power_kw && !specs.motor_peak_kw;

  // Check for ICE indicators
  const hasEngine = specs.motor_peak_kw || specs.motor_nominal_kw || specs.torque_motor_nm;

  if (hasBattery && !hasEngine) return 'electro';
  if (hasEngine && !hasBattery) return 'ice';
  if (hasBattery && hasEngine) return 'hybrid';
  return 'unknown';
}

// ── Data quality analysis ─────────────────────────────────────────────────────
function analyzeDataQuality(bikes, specKeys) {
  const issues = [];
  const stats = {
    totalCells: 0,
    emptyCells: 0,
    criticalMissing: 0,
    warningMissing: 0,
    infoMissing: 0,
  };

  bikes.forEach(bike => {
    const specs = bike.specs || {};
    const bikeType = classifyBikeType(bike);
    const bikeIssues = [];

    // Check expected fields per bike type
    if (bikeType === 'electro') {
      EXPECTED_FIELDS.electro.forEach(field => {
        const value = specs[field];
        if (value === null || value === undefined || value === '') {
          bikeIssues.push({ field, severity: 'warning', reason: `Electro bike missing ${field}` });
          stats.warningMissing++;
        }
      });
    } else if (bikeType === 'ice') {
      EXPECTED_FIELDS.ice.forEach(field => {
        const value = specs[field];
        if (value === null || value === undefined || value === '') {
          bikeIssues.push({ field, severity: 'warning', reason: `ICE bike missing ${field}` });
          stats.warningMissing++;
        }
      });
    }

    // Check required fields (prices, access type)
    EXPECTED_FIELDS.required.forEach(field => {
      const value = specs[field];
      if (value === null || value === undefined || value === '') {
        bikeIssues.push({ field, severity: 'critical', reason: `Missing required ${field}` });
        stats.criticalMissing++;
      }
    });

    // Check price fields specifically
    PRICE_FIELDS.forEach(field => {
      if (specKeys.includes(field)) {
        const value = specs[field];
        if (value === null || value === undefined || value === '') {
          bikeIssues.push({ field, severity: 'info', reason: `Price field ${field} is empty` });
          stats.infoMissing++;
        }
      }
    });

    issues.push({
      bikeId: bike.id,
      bikeTitle: bike.title,
      bikeType,
      issues: bikeIssues,
    });
  });

  // Calculate cell stats
  stats.totalCells = bikes.length * specKeys.length;
  bikes.forEach(bike => {
    specKeys.forEach(key => {
      const value = bike.specs?.[key];
      if (value === null || value === undefined || value === '') {
        stats.emptyCells++;
      }
    });
  });

  return { issues, stats };
}

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
    .sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
}

// ── Normalize spec key to readable label ─────────────────────────────────────
function normalizeSpecKey(key) {
  const niceLabel = key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return niceLabel;
}

// ── Get all unique spec keys across all bikes with type info ───────────────────
function getAllSpecKeysWithTypes(bikes) {
  const keySet = new Set();
  const excludedKeys = new Set([
    'gallery', 'features', 'buy_colors', 'buy_options', 'spec_labels', 'sale',
  ]);

  // First collect all keys
  bikes.forEach(bike => {
    const specs = bike.specs || {};
    Object.keys(specs).forEach(key => {
      if (!excludedKeys.has(key)) {
        keySet.add(key);
      }
    });
  });

  const keys = Array.from(keySet);

  // Sort by priority, then alphabetically
  keys.sort((a, b) => {
    const aPriority = SPEC_PRIORITY.indexOf(a);
    const bPriority = SPEC_PRIORITY.indexOf(b);

    if (aPriority >= 0 && bPriority >= 0) {
      return aPriority - bPriority;
    }
    if (aPriority >= 0) return -1;
    if (bPriority >= 0) return 1;
    return a.localeCompare(b);
  });

  // Determine column types
  const columnTypes = {};
  keys.forEach(key => {
    const values = bikes.map(bike => bike.specs?.[key]);
    columnTypes[key] = isTextColumn(key, values);
  });

  return { keys, columnTypes };
}

// ── Format spec value for display ────────────────────────────────────────────
function formatSpecValue(key, value) {
  if (value === null || value === undefined) return '';

  if (value === true) return 'Да';
  if (value === false) return 'Нет';

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
      price_per_hour: ' ₽/ч',
      price_per_3h: ' ₽',
      price_per_6h: ' ₽',
      price_per_12h: ' ₽',
      rent_weekday: ' ₽/сут',
      rent_weekend: ' ₽/сут',
    };

    if (unitMap[key]) {
      return numValue.toLocaleString('ru-RU') + unitMap[key];
    }
  }

  return String(value);
}

// ── Calculate column width based on content ───────────────────────────────────
function calculateColumnWidth(header, values, font, headerFont, fontSize, isTextColumn, minWidth = 50) {
  // Base width from header
  let maxWidth = headerFont.widthOfTextAtSize(header, fontSize + 1) + 16;

  // Sample a few values to get an idea (not all, for performance)
  values.slice(0, 5).forEach(value => {
    // Truncate long values for width calculation
    const displayValue = value.length > 20 ? value.slice(0, 17) + '...' : value;
    const width = font.widthOfTextAtSize(displayValue, fontSize) + 16;
    if (width > maxWidth) {
      maxWidth = width;
    }
  });

  // Text columns get 2x width, number columns get base width
  if (isTextColumn) {
    maxWidth = maxWidth * 2;
  }

  // Use reasonable min/max bounds
  const effectiveMin = isTextColumn ? 100 : 50;
  const effectiveMax = isTextColumn ? 200 : 100;

  return Math.max(effectiveMin, Math.min(maxWidth, effectiveMax));
}

// ── Generate comparison PDF ─────────────────────────────────────────────────
async function generateComparisonPdf(bikes, crew, outputPath, columnTypes, dataQuality) {
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
    throw new Error('DejaVuSans fonts not found.');
  }

  // Page settings - A4 landscape for each page
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 50;
  const headerHeight = 70;
  const rowHeight = Math.max(32, fontSize + 16);
  const tableTop = pageHeight - margin - headerHeight;
  const tableWidth = pageWidth - 2 * margin;

  // Get all spec keys
  const { keys: specKeys } = getAllSpecKeysWithTypes(bikes);

  // Calculate column widths for each spec column (with type info)
  const columnWidths = specKeys.map(key => {
    const header = normalizeSpecKey(key);
    const values = bikes.map(bike => formatSpecValue(key, bike.specs?.[key]));
    const isText = columnTypes[key] || false;
    return calculateColumnWidth(header, values, font, boldFont, fontSize, isText);
  });

  // Build a lookup map for quick issue checking: { bikeId_key: { severity, reason } }
  const issueMap = {};
  dataQuality.issues.forEach(bikeIssue => {
    bikeIssue.issues.forEach(issue => {
      const key = `${bikeIssue.bikeId}_${issue.field}`;
      issueMap[key] = issue;
    });
  });

  // Bike name column (fixed width, appears on every page)
  const bikeNameWidth = 180;

  // Split columns into pages
  const pages = [];
  let currentPage = [];
  let currentWidth = bikeNameWidth;

  columnWidths.forEach((width, index) => {
    // Check if adding this column would exceed page width
    if (currentWidth + width > tableWidth && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [index];
      currentWidth = bikeNameWidth + width;
    } else {
      currentPage.push(index);
      currentWidth += width;
    }
  });

  // Add last page
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  console.error(`Split into ${pages.length} pages with columns per page: ${pages.map(p => p.length).join(', ')}`);

  // Draw each page
  pages.forEach((pageColumnIndices, pageIndex) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: COLORS.pageBg,
    });

    // Header
    page.drawRectangle({
      x: 0,
      y: pageHeight - headerHeight,
      width: pageWidth,
      height: headerHeight,
      color: COLORS.header,
    });

    const headerTitle = `${(crew.header?.brandName || crew.name || 'VIP BIKE').toUpperCase()} — Сравнение моделей`;
    page.drawText(headerTitle, {
      x: margin,
      y: pageHeight - 40,
      size: 18,
      font: boldFont,
      color: COLORS.accent,
    });

    const pageInfo = `Страница ${pageIndex + 1} из ${pages.length} | Моделей: ${bikes.length} | Колонок: ${pageColumnIndices.length}`;
    page.drawText(pageInfo, {
      x: margin,
      y: pageHeight - 58,
      size: 10,
      font: font,
      color: COLORS.muted,
    });

    // Get column widths for this page
    const pageColumnWidths = pageColumnIndices.map(i => columnWidths[i]);
    const totalContentWidth = bikeNameWidth + pageColumnWidths.reduce((a, b) => a + b, 0);
    const startX = margin + (tableWidth - totalContentWidth) / 2; // Center the table

    // Draw table header
    let currentX = startX;
    let currentY = tableTop;

    // Alternating row highlight + data quality cell highlight
    const drawRowBackground = (rowIndex) => {
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: startX - 5,
          y: currentY - rowHeight,
          width: totalContentWidth + 10,
          height: rowHeight,
          color: COLORS.highlight,
        });
      }
    };

    // Get highlight color for a specific cell
    const getCellHighlightColor = (bikeId, specKey) => {
      const issueKey = `${bikeId}_${specKey}`;
      const issue = issueMap[issueKey];
      if (!issue) return null;

      switch (issue.severity) {
        case 'critical': return COLORS.critical;
        case 'warning': return COLORS.warning;
        case 'info': return COLORS.info;
        default: return null;
      }
    };

    // Header row background
    page.drawRectangle({
      x: currentX - 5,
      y: currentY - rowHeight,
      width: totalContentWidth + 10,
      height: rowHeight,
      color: COLORS.accent,
      opacity: 0.2,
    });

    // Draw bike name header
    page.drawText('Модель / Цена', {
      x: currentX + 8,
      y: currentY - rowHeight / 2 - 5,
      size: fontSize + 2,
      font: boldFont,
      color: COLORS.white,
    });

    currentX += bikeNameWidth;

    // Draw spec headers
    pageColumnIndices.forEach((specIndex) => {
      const header = normalizeSpecKey(specKeys[specIndex]);
      const colWidth = pageColumnWidths[pageColumnIndices.indexOf(specIndex)];

      page.drawText(header, {
        x: currentX + 8,
        y: currentY - rowHeight / 2 - 5,
        size: fontSize + 2,
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

      currentX = startX;
      const specs = bike.specs || {};

      // Bike name and sale price (repeated on every page)
      const bikeName = bike.title || 'Без названия';
      const price = bike.salePrice ? `${bike.salePrice.toLocaleString('ru-RU')} ₽` : '—';

      page.drawText(bikeName.slice(0, 22), {
        x: currentX + 8,
        y: currentY - rowHeight / 2 + 4,
        size: fontSize + 1,
        font: boldFont,
        color: COLORS.text,
      });

      page.drawText(price, {
        x: currentX + 8,
        y: currentY - rowHeight / 2 - 8,
        size: fontSize - 1,
        font: font,
        color: COLORS.accent,
      });

      currentX += bikeNameWidth;

      // Draw spec values
      pageColumnIndices.forEach((specIndex) => {
        const key = specKeys[specIndex];
        const value = formatSpecValue(key, specs[key]);
        const colWidth = pageColumnWidths[pageColumnIndices.indexOf(specIndex)];

        // Highlight cell if there's a data quality issue
        const highlightColor = getCellHighlightColor(bike.id, key);
        if (highlightColor && value === '') {
          // Only highlight empty cells with issues
          page.drawRectangle({
            x: currentX + 1,
            y: currentY - rowHeight + 1,
            width: colWidth - 2,
            height: rowHeight - 2,
            color: highlightColor,
            opacity: 0.25,
          });
        }

        page.drawText(value, {
          x: currentX + 8,
          y: currentY - rowHeight / 2 - 3,
          size: fontSize,
          font: font,
          color: COLORS.text,
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

      // Horizontal line
      page.drawLine({
        start: { x: startX, y: currentY },
        end: { x: startX + totalContentWidth, y: currentY },
        thickness: 0.5,
        color: COLORS.line,
      });

      currentY -= rowHeight;
    });

    // Bottom border
    page.drawLine({
      start: { x: startX, y: currentY },
      end: { x: startX + totalContentWidth, y: currentY },
      thickness: 0.5,
      color: COLORS.line,
    });

    // Footer
    page.drawText(`Generated: ${new Date().toLocaleString('ru-RU')}`, {
      x: margin,
      y: 20,
      size: 8,
      font: font,
      color: COLORS.muted,
    });
  });

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

  const { keys: specKeys, columnTypes } = getAllSpecKeysWithTypes(saleBikes);
  console.error(`Total unique spec columns: ${specKeys.length}`);
  console.error(`Text columns: ${Object.values(columnTypes).filter(v => v).length}, Number columns: ${Object.values(columnTypes).filter(v => !v).length}`);

  // Analyze data quality
  console.error(`\n🔍 Analyzing data quality...`);
  const dataQuality = analyzeDataQuality(saleBikes, specKeys);

  // Print data quality summary
  console.error(`\n📊 Data Quality Report:`);
  console.error(`   Total cells: ${dataQuality.stats.totalCells}`);
  console.error(`   Empty cells: ${dataQuality.stats.emptyCells} (${((dataQuality.stats.emptyCells / dataQuality.stats.totalCells) * 100).toFixed(1)}%)`);
  console.error(`   Critical missing (required): ${dataQuality.stats.criticalMissing}`);
  console.error(`   Warning missing (type-specific): ${dataQuality.stats.warningMissing}`);
  console.error(`   Info missing (price fields): ${dataQuality.stats.infoMissing}`);

  // Group issues by bike for cleaner output
  const bikesWithIssues = dataQuality.issues.filter(b => b.issues.length > 0);
  if (bikesWithIssues.length > 0) {
    console.error(`\n⚠️  Bikes with issues (${bikesWithIssues.length}):`);
    bikesWithIssues.forEach(bikeIssue => {
      console.error(`   • ${bikeIssue.bikeTitle} (${bikeIssue.bikeType}):`);
      bikeIssue.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        console.error(`      ${icon} ${issue.field}: ${issue.reason}`);
      });
    });
  }

  // Generate PDF
  const outputPathResolved = path.resolve(process.cwd(), outputPath);
  await generateComparisonPdf(saleBikes, crew, outputPathResolved, columnTypes, dataQuality);

  console.error(`\n✓ Comparison table saved to: ${outputPathResolved}`);
  console.error(`✓ Missing cells highlighted in PDF (Red=critical, Orange=warning, Blue=info)`);

  console.log(JSON.stringify({
    ok: true,
    bikesCount: saleBikes.length,
    specColumns: specKeys.length,
    columnsPerPage,
    outputPath: outputPathResolved,
    dataQuality: {
      totalCells: dataQuality.stats.totalCells,
      emptyCells: dataQuality.stats.emptyCells,
      criticalMissing: dataQuality.stats.criticalMissing,
      warningMissing: dataQuality.stats.warningMissing,
      infoMissing: dataQuality.stats.infoMissing,
      bikesWithIssues: bikesWithIssues.length,
    },
    bikes: saleBikes.map(b => ({
      id: b.id,
      title: b.title,
      price: b.salePrice,
      type: classifyBikeType(b),
      issuesCount: dataQuality.issues.find(i => i.bikeId === b.id)?.issues.length || 0,
    })),
  }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(2);
});
