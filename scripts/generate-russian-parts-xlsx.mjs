#!/usr/bin/env node
/**
 * Generate Russian parts catalogue XLSX with embedded images
 * Uses ExcelJS to create proper XLSX with pictures
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const result = [];

  for (const line of lines) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.some(v => v)) result.push(values);
  }

  return result;
}

// Category folder mapping
const CATEGORY_FOLDERS = {
  'Электрика': 'electric',
  'electric': 'electric',
  'Колёса': 'wheel',
  'колёса': 'wheel',
  'колеса': 'wheel',
  'wheel': 'wheel',
  'Тормоза и цепь': 'braking',
  'тормоза и цепь': 'braking',
  'Пластик': 'plastic',
  'пластик': 'plastic',
  'Рама и крепёж': 'structural',
  'рама и крепёж': 'structural',
  'Подвеска': 'suspension',
  'подвеска': 'suspension',
  'Резиновые детали': 'rubber',
  'резиновые детали': 'rubber',
  'Седло': 'saddle',
  'седло': 'saddle',
  'Стандартные детали': 'standard',
  'стандартные детали': 'standard',
};

function getImageFolder(category) {
  const key = category.toLowerCase().trim();
  for (const [cat, folder] of Object.entries(CATEGORY_FOLDERS)) {
    if (cat.toLowerCase() === key) return folder;
  }
  return 'standard';
}

async function findImage(partNumber, category) {
  const sanitized = partNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitized) return null;

  const folder = getImageFolder(category);
  const basePath = join(__dirname, '..', 'public', 'supabase-mirror', 'parts-pics', folder);

  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
  for (const ext of extensions) {
    const imagePath = join(basePath, `${sanitized}.${ext}`);
    if (existsSync(imagePath)) {
      return imagePath;
    }
  }
  return null;
}

async function main() {
  const csvDir = join(__dirname, '..', 'docs', 'crewDocs', 'surge_parts_csv_ru');
  const outputFile = join(__dirname, '..', 'docs', 'crewDocs', 'Surge-V-Spare-Parts-List-Russian.xlsx');

  const files = (await readdir(csvDir)).filter(f => f.toLowerCase().endsWith('.csv')).sort();

  console.log('📁 Found CSV files:');

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VIP Bike Electro';
  workbook.lastModifiedBy = 'VIP Bike Electro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Запчасти Surgy (VIP Bike Electro)');

  // Define columns
  worksheet.columns = [
    { header: 'Категория', key: 'category', width: 20 },
    { header: '№', key: 'seq', width: 8 },
    { header: 'Номер детали', key: 'partNumber', width: 20 },
    { header: 'Название', key: 'name', width: 35 },
    { header: 'Описание', key: 'description', width: 40 },
    { header: 'Базовая цена', key: 'basePrice', width: 15 },
    { header: 'Цена (RUB)', key: 'finalPrice', width: 15 },
    { header: 'Изображение', key: 'image', width: 15 },
  ];

  // Header style
  worksheet.getRow(1).font = { bold: true, size: 11 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' }
  };

  const allData = [];
  let totalParts = 0;
  let imagesEmbedded = 0;

  for (const file of files) {
    const content = await readFile(join(csvDir, file), 'utf-8');
    const rows = parseCSV(content);

    const category = rows[0]?.[0] || file.replace('.csv', '');
    const partCount = rows.filter(r => r[1] && !isNaN(parseInt(r[1]))).length;
    totalParts += partCount;

    console.log(`  ✓ ${file}: ${partCount} parts (${category})`);

    allData.push({ file, category, rows: rows.slice(1) });
  }

  console.log('\n📝 Adding rows and embedding images...');

  let rowIndex = 2;
  let currentCategory = '';

  for (const section of allData) {
    if (section.rows.length === 0) continue;

    // Category header row
    const catRow = worksheet.addRow({
      category: section.category,
      seq: '',
      partNumber: '',
      name: '',
      description: '',
      basePrice: '',
      finalPrice: '',
      image: '',
    });
    catRow.font = { bold: true, size: 12 };
    catRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    rowIndex++;

    // Data rows
    for (const row of section.rows) {
      const [cat, seq, partNo, name, , description, basePrice, calcPrice] = row;

      // Skip non-part rows
      if (!seq || isNaN(parseInt(seq))) continue;

      const imagePath = await findImage(partNo, section.category);

      const dataRow = worksheet.addRow({
        category: section.category,
        seq: seq,
        partNumber: partNo,
        name: name,
        description: description,
        basePrice: basePrice || '0',
        finalPrice: Math.round((parseFloat(basePrice) || 0) * 250),
        image: imagePath ? '✓' : '',
      });

      // Embed image if found
      if (imagePath) {
        try {
          const imageBuffer = await readFile(imagePath);
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: imagePath.split('.').pop(),
          });

          worksheet.addImage(imageId, {
            tl: { col: 7, row: rowIndex - 1 },
            ext: { width: 80, height: 80 },
          });

          imagesEmbedded++;
          if (imagesEmbedded <= 5 || imagesEmbedded % 20 === 0) {
            console.log(`  🖼️  Embedded ${imagesEmbedded}: ${partNo}`);
          }
        } catch (err) {
          console.warn(`  ⚠️  Failed to embed image for ${partNo}:`, err.message);
        }
      }

      rowIndex++;
    }
  }

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const length = cell.value ? cell.value.toString().length : 10;
      if (length > maxLength) maxLength = length;
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });

  // Save workbook
  await workbook.xlsx.writeFile(outputFile);

  const stats = await readFile(outputFile);
  console.log(`\n✅ Generated: ${outputFile}`);
  console.log(`   Sections: ${allData.length}, Parts: ${totalParts}`);
  console.log(`   Images embedded: ${imagesEmbedded}`);
  console.log(`   File size: ${(stats.length / 1024).toFixed(1)} KB`);
  console.log('\n💡 Open in Excel to see images embedded in the "Изображение" column');
}

main().catch(console.error);
