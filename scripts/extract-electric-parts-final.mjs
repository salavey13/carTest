import pkg from 'xlsx';
const { readFile, writeFile, utils } = pkg;
import { resolve } from 'path';
import { statSync } from 'fs';

const inputFile = resolve('docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx');
const outputFile = resolve('docs/crewDocs/surge_parts_chunks/Surge_Electric_Parts.xlsx');

// Read the workbook
const workbook = readFile(inputFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to array of arrays (including header row)
const data = utils.sheet_to_json(worksheet, { header: 1 });

console.log(`Total rows in file: ${data.length}`);

// First, identify all section headers
// A section header is when:
// - Column 0 has meaningful text (not empty, not just spaces)
// - Column 1 is either empty or a number (1, 2, 21, etc.)
// - Column 2 is either empty or looks like a SKU code

const sections = [];
const electricPatterns = ['electric', 'electro', 'электрические', 'электро'];

for (let i = 0; i < data.length; i++) {
  const col0 = String(data[i][0] || '').trim();
  const col1 = String(data[i][1] || '').trim();
  const col2 = String(data[i][2] || '').trim();

  // Section headers have descriptive text in col0
  if (col0.length > 3 && col0.length < 100) {
    // col1 is usually empty or a number
    // col2 is usually empty or starts with a code pattern

    // Check if this looks like a section header
    // Data rows typically have col0 empty and col1 as a number, col2 as a code
    // Section headers have col0 as the section name
    const looksLikeSection = col0.length > 5 &&
                            !col0.match(/^\d+$/) &&
                            (col1 === '' || col1.match(/^\d+$/));

    if (looksLikeSection) {
      sections.push({
        row: i,
        name: col0,
        col1: col1,
        col2: col2
      });
    }
  }
}

console.log('\n=== Identified Sections ===');
sections.forEach((s, i) => {
  console.log(`${i + 1}. Row ${s.row}: "${s.name}" (col1="${s.col1}", col2="${s.col2}")`);
});

// Find the Electric parts section
let electricSectionIndex = -1;
for (let i = 0; i < sections.length; i++) {
  const sectionNameLower = sections[i].name.toLowerCase();
  if (electricPatterns.some(p => sectionNameLower.includes(p))) {
    electricSectionIndex = i;
    break;
  }
}

if (electricSectionIndex === -1) {
  console.error('Could not find "Electric parts" section');
  process.exit(1);
}

const electricSection = sections[electricSectionIndex];
console.log(`\nFound Electric parts section at row ${electricSection.row}: "${electricSection.name}"`);

// Find the next section
let nextSectionRow = data.length;
if (electricSectionIndex + 1 < sections.length) {
  nextSectionRow = sections[electricSectionIndex + 1].row;
  console.log(`Next section is at row ${nextSectionRow}: "${sections[electricSectionIndex + 1].name}"`);
} else {
  console.log('Electric parts is the last section');
}

// Extract the rows from Electric parts to the next section
const electricPartsData = data.slice(electricSection.row, nextSectionRow);

console.log(`\nExtracted ${electricPartsData.length} rows (from row ${electricSection.row} to ${nextSectionRow - 1})`);

// Create new workbook with the extracted data
const newWorkbook = utils.book_new();
const newWorksheet = utils.aoa_to_sheet(electricPartsData);
utils.book_append_sheet(newWorkbook, newWorksheet, 'Electric Parts');

// Write the output file
writeFile(newWorkbook, outputFile);

// Get file size
const fileSize = statSync(outputFile).size;
const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

console.log(`\n=== Results ===`);
console.log(`Rows extracted: ${electricPartsData.length}`);
console.log(`Output file: ${outputFile}`);
console.log(`File size: ${fileSizeMB} MB (${fileSize} bytes)`);
