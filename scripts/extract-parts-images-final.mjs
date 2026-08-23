// Extract embedded part images from the Surge-V spare parts workbook.
// DATA TASK ONLY — does not modify app code. Writes to public/supabase-mirror/parts-pics/**.
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAIN_XLSX = path.join(ROOT, 'docs', 'crewDocs', 'Surge-V-Spare-Parts-List-0425 .xlsx');
const CHUNKS_DIR = path.join(ROOT, 'docs', 'crewDocs', 'surge_parts_chunks');
const OUT_BASE = path.join(ROOT, 'public', 'supabase-mirror', 'parts-pics');

const CATEGORY_MAP = new Map(Object.entries({
  'electric parts': 'electric',
  'wheel sets': 'wheel',
  'saddle': 'saddle',
  'braking&chain sets': 'braking',
  'plastic parts': 'plastic',
  'structural part': 'structural',
  'fronet &rear suspension part': 'suspension',
  'rubber part': 'rubber',
  'standard parts': 'standard',
}));

const stats = {
  sourceUsed: null,
  imagesFound: 0,
  saved: 0,
  perFolder: {},
  skipped: [], // { ws, imageId, anchor, reason }
  collisions: [],
};

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return cellText(v.result);
    if (v.hyperlink) return String(v.text ?? v.hyperlink);
  }
  return String(v);
}

const normalizeCat = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function sanitizePart(raw) {
  const firstLine = String(raw).split(/\r?\n/)[0].replace(/["']/g, '').trim();
  return firstLine.replace(/[^A-Za-z0-9_-]/g, '');
}

function isSeq(v) {
  const t = cellText(v).trim();
  return t !== '' && Number.isFinite(Number(t));
}

// rowNumber(1-based) -> { partNumber, folder }
function buildRowMap(ws) {
  const map = new Map();
  let currentFolder = null;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const catKey = normalizeCat(cellText(row.getCell(1).value));
    if (catKey && CATEGORY_MAP.has(catKey)) currentFolder = CATEGORY_MAP.get(catKey);
    const partNumber = sanitizePart(cellText(row.getCell(3).value));
    if (currentFolder && partNumber && isSeq(row.getCell(2).value)) {
      map.set(rowNumber, { partNumber, folder: currentFolder });
    }
  });
  return map;
}

function skip(wsName, imageId, anchor, reason) {
  stats.skipped.push({ ws: wsName, imageId, anchor, reason });
  console.log(`SKIP  ws=${wsName} imageId=${imageId} anchor=${anchor} reason=${reason}`);
}

function processWorkbook(wb, sourceLabel) {
  for (const ws of wb.worksheets) {
    const rowMap = buildRowMap(ws);
    let images = [];
    try { images = ws.getImages() || []; } catch { images = []; }
    stats.imagesFound += images.length;
    for (const img of images) {
      const { imageId } = img;
      const tl = img.range && img.range.tl;
      if (!tl || tl.row == null) {
        skip(ws.name, imageId, 'n/a', 'no top-left anchor');
        continue;
      }
      const anchorRow = Math.round(Number(tl.row)) + 1; // 0-based -> 1-based
      let target = null;
      let usedRow = null;
      for (const off of [0, -1, 1, -2, 2]) {
        const r = anchorRow + off;
        if (rowMap.has(r)) { target = rowMap.get(r); usedRow = r; break; }
      }
      if (!target) {
        skip(ws.name, imageId, `row=${anchorRow} col=${Math.round(Number(tl.col)) + 1}`, 'no data row with part number+seq within +/-2 rows');
        continue;
      }
      const meta = wb.getImage(Number(imageId));
      if (!meta || meta.buffer == null) {
        skip(ws.name, imageId, `row=${anchorRow}`, 'workbook has no binary for imageId');
        continue;
      }
      let ext = String(meta.extension || 'png').toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      const buf = Buffer.isBuffer(meta.buffer) ? meta.buffer : Buffer.from(meta.buffer, 'base64');
      const outDir = path.join(OUT_BASE, target.folder);
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${target.partNumber}.${ext}`);
      if (fs.existsSync(outPath)) {
        stats.collisions.push(path.relative(ROOT, outPath));
        console.log(`COLLISION overwrite: ${path.relative(ROOT, outPath)} (ws=${ws.name} imageId=${imageId})`);
      }
      fs.writeFileSync(outPath, buf);
      stats.saved += 1;
      stats.perFolder[target.folder] = (stats.perFolder[target.folder] || 0) + 1;
      console.log(`SAVED ${path.relative(ROOT, outPath)} (ws=${ws.name} imageId=${imageId} anchorRow=${anchorRow} usedRow=${usedRow})`);
    }
  }
}

function printSummary() {
  console.log('\n===== SUMMARY =====');
  console.log(`source used      : ${stats.sourceUsed}`);
  console.log(`images found     : ${stats.imagesFound}`);
  console.log(`files saved      : ${stats.saved}`);
  console.log(`images skipped   : ${stats.skipped.length}`);
  console.log('per folder:');
  for (const f of Object.keys(stats.perFolder).sort()) {
    console.log(`  ${f.padEnd(12)} ${stats.perFolder[f]}`);
  }
  if (stats.collisions.length) {
    console.log(`collisions (overwritten same-name files): ${stats.collisions.length}`);
    for (const c of stats.collisions) console.log(`  ${c}`);
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(MAIN_XLSX);
  } catch (err) {
    console.error(`Main workbook read failed: ${err.message}. Falling back to chunks...`);
    const chunkFiles = fs.readdirSync(CHUNKS_DIR).filter((f) => f.toLowerCase().endsWith('.xlsx'));
    let readAny = false;
    for (const f of chunkFiles) {
      const p = path.join(CHUNKS_DIR, f);
      const cwb = new ExcelJS.Workbook();
      try {
        await cwb.xlsx.readFile(p);
        readAny = true;
        stats.sourceUsed = `chunk:${f}`;
        console.log(`--- processing chunk ${f} ---`);
        processWorkbook(cwb, f);
      } catch (e2) {
        console.error(`Chunk ${f} read failed: ${e2.message}`);
      }
    }
    if (!readAny) {
      console.error('STOP: no readable xlsx source (main + all chunks failed). No files created.');
      process.exit(1);
    }
    if (stats.imagesFound === 0) {
      console.log('STOP: chunk workbooks contain zero images. No files created.');
      process.exit(0);
    }
    printSummary();
    return;
  }

  stats.sourceUsed = path.basename(MAIN_XLSX);
  let totalImages = 0;
  for (const ws of wb.worksheets) {
    try { totalImages += (ws.getImages() || []).length; } catch { /* ignore */ }
  }
  if (totalImages === 0) {
    console.log('STOP: main workbook contains zero images. No files created.');
    process.exit(0);
  }
  processWorkbook(wb, path.basename(MAIN_XLSX));
  printSummary();
}

main().catch((e) => {
  console.error(`FATAL: ${e.stack || e.message}`);
  process.exit(1);
});
