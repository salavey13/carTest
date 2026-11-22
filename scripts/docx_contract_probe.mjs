/**
 * docx_contract_probe.mjs — end-to-end: real RENTAL_DEAL_TEMPLATE.html
 * → htmlToDocxElements → Document → .docx → verify every table's grid.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';

const tplPath = process.argv[2] || 'docs/RENTAL_DEAL_TEMPLATE.html';
const outPath = process.argv[3] || '/tmp/contract_probe.docx';

let html = readFileSync(tplPath, 'utf8');
// Stub every {{var}} with a readable placeholder so the converter sees real content
html = html.replace(/\{\{([^}]+)\}\}/g, (_, v) => `[${v.trim().slice(0, 28)}]`);
// Strip {%...%} control blocks crudely (keep inner content if simple if/endif → just drop tags)
html = html.replace(/\{%[^%]*%\}/g, '');

const children = htmlToDocxElements(html);
const tables = children.filter((e) => e.constructor.name === 'Table');
console.log('elements total:', children.length, '| tables:', tables.length);

const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 },
      },
    },
    children: [...children, new Paragraph({ children: [new TextRun({ text: ' ', size: 2 })] })],
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(outPath, buf);

const xml = execSync(`cd /tmp && rm -rf cpx && mkdir cpx && cd cpx && unzip -o -q "${outPath}" word/document.xml && cat word/document.xml`).toString();

// Verify per-table grid
const tableXml = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
let allOk = true;
tableXml.forEach((t, i) => {
  const grid = (t.match(/<w:gridCol w:w="(\d+)"\/>/g) || []).map((s) => parseInt(s.match(/\d+/)[0], 10));
  const gridSum = grid.reduce((a, b) => a + b, 0);
  const tblW = parseInt((t.match(/<w:tblW w:type="dxa" w:w="(\d+)"\/>/) || [])[1] || '0', 10);
  const fixed = /<w:tblLayout w:type="fixed"\/>/.test(t);
  const minCol = Math.min(...grid);
  const ok = fixed && grid.length > 0 && Math.abs(gridSum - tblW) <= 2 && minCol >= 240;
  if (!ok) allOk = false;
  console.log(`table ${i + 1}: cols=${grid.length} grid=[${grid.join(',')}] sum=${gridSum} tblW=${tblW} fixed=${fixed} ${ok ? 'OK' : '*** FAIL ***'}`);
});
console.log(allOk ? 'ALL TABLES PASS' : 'SOME TABLES FAILED');
