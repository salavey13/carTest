#!/usr/bin/env node
/**
 * Generate Russian parts catalogue from CSV files
 * Creates an Excel-compatible HTML file
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function createExcelHTML(allData) {
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta name=ProgId content=Excel.Sheet/>
<style>
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ccc;padding:4px 8px;font-size:11pt;font-family:Arial,sans-serif}
.cat{background:#4CAF50;color:white;font-weight:bold}
.hd{background:#E8E8E8;font-weight:bold}
</style>
</head>
<body><table>
`;

  for (const section of allData) {
    if (section.rows.length === 0) continue;

    html += `<tr class="cat"><td colspan="8">${section.category}</td></tr>`;
    html += `<tr class="hd"><th>Категория</th><th>№</th><th>Номер детали</th><th>Название</th><th></th><th>Описание</th><th>Базовая цена</th><th>Цена</th></tr>`;

    for (const row of section.rows) {
      html += '<tr>';
      for (let i = 0; i < row.length; i++) {
        let cell = row[i] || '';
        if (i === 0 && !cell) cell = section.category;
        html += `<td>${cell}</td>`;
      }
      html += '</tr>';
    }
  }

  html += '</table></body></html>';
  return html;
}

async function main() {
  const csvDir = join(__dirname, '..', 'docs', 'crewDocs', 'surge_parts_csv_ru');
  const outputFile = join(__dirname, '..', 'docs', 'crewDocs', 'Surge-V-Spare-Parts-List-Russian.xls');

  const files = (await readdir(csvDir)).filter(f => f.toLowerCase().endsWith('.csv')).sort();

  console.log('📁 Found CSV files:');
  const allData = [];
  let totalParts = 0;

  for (const file of files) {
    const content = await readFile(join(csvDir, file), 'utf-8');
    const rows = parseCSV(content);

    const category = rows[0]?.[0] || file.replace('.csv', '');
    const partCount = rows.filter(r => r[1] && !isNaN(parseInt(r[1]))).length;
    totalParts += partCount;

    allData.push({ file, category, rows: rows.slice(1) });
    console.log(`  ✓ ${file}: ${partCount} parts (${category})`);
  }

  const html = createExcelHTML(allData);

  // UTF-8 BOM + HTML
  const buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(html, 'utf-8')]);
  await writeFile(outputFile, buffer);

  console.log(`\n✅ Generated: ${outputFile}`);
  console.log(`   Sections: ${allData.length}, Parts: ${totalParts}`);
  console.log('\n💡 Open in Excel, then "Save As" → XLSX if needed');
}

main().catch(console.error);
