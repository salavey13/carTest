import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const SOURCE_FILE = 'C:/Users/SLY13/carTest/docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx';
const OUTPUT_DIR = 'C:/Users/SLY13/carTest/docs/crewDocs/surge_parts_chunks';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'Surge_Saddle.xlsx');
const SECTION_NAME = 'Saddle';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`Reading Excel file: ${SOURCE_FILE}`);

try {
  // Read the workbook
  const workbook = XLSX.readFile(SOURCE_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (raw data)
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log(`Total rows in file: ${jsonData.length}`);

  // First, let's see what's around where we expect to find "Saddle"
  console.log('\nSearching for section structure...');
  const knownSections = [];
  for (let i = 0; i < jsonData.length; i++) {
    const firstCol = String(jsonData[i][0] || '').trim();
    // Collect potential section headers (non-empty, short text)
    if (firstCol && firstCol.length > 0 && firstCol.length < 30 &&
        !/^\d/.test(firstCol) && /^[A-Za-z&\s]+$/.test(firstCol)) {
      knownSections.push({ index: i, name: firstCol });
    }
  }
  console.log('Potential section headers found:', knownSections.map(s => `${s.index + 1}: "${s.name}"`).join(', '));

  // Find the section start
  let sectionStartIndex = -1;
  let sectionEndIndex = jsonData.length;

  for (let i = 0; i < jsonData.length; i++) {
    const firstCol = String(jsonData[i][0] || '').trim();

    // Check if we found our section
    if (sectionStartIndex === -1) {
      if (firstCol === SECTION_NAME) {
        sectionStartIndex = i;
        console.log(`Found "${SECTION_NAME}" section at row ${i + 1}`);
        // Show what's around this row
        console.log('Context:');
        for (let j = Math.max(0, i - 2); j < Math.min(jsonData.length, i + 5); j++) {
          const marker = j === i ? '>>> ' : '    ';
          console.log(`${marker}Row ${j + 1}:`, jsonData[j].slice(0, 5).join(' | '));
        }
      }
    } else {
      // We already found the section, now look for the next section
      // A new section starts when the first column has content and isn't empty/just whitespace
      // and it's not a sub-item of the current section
      if (firstCol && firstCol.length > 0 && !firstCol.startsWith(' ') && firstCol !== SECTION_NAME) {
        // Check if this is one of our known sections
        const isKnownSection = knownSections.some(s => s.index === i && s.name !== SECTION_NAME);
        if (isKnownSection) {
          sectionEndIndex = i;
          console.log(`Found next section "${firstCol}" at row ${i + 1}`);
          break;
        }
      }
    }
  }

  if (sectionStartIndex === -1) {
    console.error(`Could not find section "${SECTION_NAME}"`);
    process.exit(1);
  }

  // Extract the section rows
  const extractedRows = jsonData.slice(sectionStartIndex, sectionEndIndex);

  console.log(`Extracted ${extractedRows.length} rows from "${SECTION_NAME}" section`);

  // Create a new workbook with the extracted data
  const newWorkbook = XLSX.utils.book_new();
  const newWorksheet = XLSX.utils.aoa_to_sheet(extractedRows);
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Saddle');

  // Write the output file
  XLSX.writeFile(newWorkbook, OUTPUT_FILE);

  // Get file size
  const stats = fs.statSync(OUTPUT_FILE);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\nSuccessfully saved to: ${OUTPUT_FILE}`);
  console.log(`Rows extracted: ${extractedRows.length}`);
  console.log(`File size: ${fileSizeMB} MB`);

  // Show a preview of the first few rows
  console.log('\nPreview of first 5 rows:');
  for (let i = 0; i < Math.min(5, extractedRows.length); i++) {
    console.log(`Row ${i + 1}:`, extractedRows[i].slice(0, 3).join(' | '));
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
