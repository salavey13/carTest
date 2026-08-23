import pkg from 'xlsx';
const { readFile, writeFile, utils } = pkg;
import fs from 'fs';
import path from 'path';

const sourceFile = 'C:/Users/SLY13/carTest/docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx';
const outputFile = 'C:/Users/SLY13/carTest/docs/crewDocs/surge_parts_chunks/Surge_Structural_Part.xlsx';

// Read the workbook
const workbook = readFile(sourceFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to array of arrays for easier processing
const data = utils.sheet_to_json(worksheet, { header: 1, defval: '' });

// First, let's see all rows with anything in first column
console.log('All rows with non-empty first column:');
for (let i = 0; i < data.length; i++) {
    const firstCol = String(data[i][0] || '').trim();
    if (firstCol) {
        const restOfRow = data[i].slice(1).filter(cell => String(cell || '').trim() !== '');
        console.log(`  Row ${i + 1}: "${firstCol.substring(0, 40)}${firstCol.length > 40 ? '...' : ''}" (${restOfRow.length} other cells)`);
    }
}

// Now find potential section headers
console.log('\nPotential section headers:');
for (let i = 0; i < data.length; i++) {
    const firstCol = String(data[i][0] || '').trim();
    if (firstCol && firstCol.length < 60 && !firstCol.match(/^[\d\s\-\.]+$/)) {
        const restOfRow = data[i].slice(1).filter(cell => String(cell || '').trim() !== '');
        if (restOfRow.length <= 2) {
            console.log(`  Row ${i + 1}: "${firstCol}" (row has ${restOfRow.length} other non-empty cells)`);
        }
    }
}

// Find the "Structural Part" section
let structuralPartStart = -1;
let nextSectionStart = data.length;

console.log(`\nTotal rows in source file: ${data.length}`);

for (let i = 0; i < data.length; i++) {
    const firstCol = String(data[i][0] || '').trim().toLowerCase();
    if (firstCol === 'structural part' || firstCol.includes('structural')) {
        structuralPartStart = i;
        console.log(`Found "Structural Part" section at row ${i + 1}`);
        break;
    }
}

if (structuralPartStart === -1) {
    console.error('Could not find "Structural Part" section');
    process.exit(1);
}

// Find where the next section starts
// Section headers are typically rows where:
// 1. First column has text
// 2. Row is relatively "clean" (empty or minimal data in other columns)
// 3. Not immediately after the structural part start

for (let i = structuralPartStart + 1; i < data.length; i++) {
    const firstCol = String(data[i][0] || '').trim();

    if (!firstCol) continue;  // Skip empty first column

    // Get the rest of the row
    const restOfRow = data[i].slice(1);

    // Count non-empty cells in the rest of the row
    const nonEmptyCount = restOfRow.filter(cell => String(cell || '').trim() !== '').length;

    // Also check total columns in this row vs typical data row
    const rowLength = data[i].length;

    // A section header typically:
    // - Has text in first column
    // - Has fewer non-empty cells than a typical data row (which usually has data in multiple columns)
    // - Is not just a continuation number (like 1, 2, 3 in first column)

    const looksLikeNumber = firstCol.match(/^[\d\s\-\.]+$/);

    // If first column is substantial text and row has minimal data in other columns,
    // it's likely a new section header
    if (!looksLikeNumber && firstCol.length > 3 && firstCol.length < 60) {
        // Check if most of the row is empty (except first column)
        if (nonEmptyCount <= 2 && i > structuralPartStart + 5) {
            nextSectionStart = i;
            console.log(`Found next section starting at row ${i + 1}: "${firstCol}"`);
            console.log(`  (Row has ${nonEmptyCount} non-empty cells beyond first column)`);
            break;
        }
    }
}

// Extract rows belonging to Structural Part section
const structuralPartRows = data.slice(structuralPartStart, nextSectionStart);
console.log(`Extracted ${structuralPartRows.length} rows from "${data[structuralPartStart][0]}" section`);

// Create new workbook with extracted data
const newWorksheet = utils.aoa_to_sheet(structuralPartRows);
const newWorkbook = utils.book_new();
utils.book_append_sheet(newWorkbook, newWorksheet, 'Structural Part');

// Write to file
writeFile(newWorkbook, outputFile);

// Get file size
const stats = fs.statSync(outputFile);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`\nExtraction complete:`);
console.log(`  - Rows extracted: ${structuralPartRows.length}`);
console.log(`  - Output file: ${outputFile}`);
console.log(`  - File size: ${fileSizeMB} MB`);
