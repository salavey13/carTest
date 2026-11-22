/**
 * docx_xml_probe.mjs — probe what docx@8.5 emits for tables built by
 * lib/htmlToDocx.mjs buildTable(): does <w:tblGrid>/<w:gridCol> exist?
 * Usage: node docx_xml_probe.mjs <before|after>
 */
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { htmlToDocxElements } from '/home/z/cartest/lib/htmlToDocx.mjs';

const mode = process.argv[2] || 'before';

const html = `
<p style="text-align: justify;">Обычный абзац договора.</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr>
    <td style="border: 1px solid #000; width: 30%; text-align: center;"><b>Пункт</b></td>
    <td style="border: 1px solid #000; width: 40%; text-align: center;">Наименование ТС</td>
    <td style="border: 1px solid #000; width: 30%; text-align: center;">Стоимость</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000;">1.1</td>
    <td style="border: 1px solid #000;">Aprilia Shiver 750, г/н А123ВС77</td>
    <td style="border: 1px solid #000;">10 500 ₽ / сутки</td>
  </tr>
</table>
<table style="border-collapse: collapse; width: 100%;">
  <tr>
    <td style="border: 1px solid #000;" colspan="2">Единая ячейка на всю ширину (подписи сторон)</td>
  </tr>
</table>
<p>Конец.</p>
`;

const children = htmlToDocxElements(html);
const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    children: [...children, new Paragraph({ children: [new TextRun({ text: '', size: 2 })] })],
  }],
});

const out = `/home/z/my-project/scripts/probe_${mode}.docx`;
const buf = await Packer.toBuffer(doc);
writeFileSync(out, buf);

const xml = execSync(`cd /tmp && rm -rf probe_x && mkdir probe_x && cd probe_x && unzip -o -q "${out}" word/document.xml && cat word/document.xml`).toString();

const gridCount = (xml.match(/<w:tblGrid>/g) || []).length;
const gridColCount = (xml.match(/<w:gridCol/g) || []).length;
const layoutFixed = (xml.match(/w:tblLayout w:type="fixed"/g) || []).length;
const tblW = (xml.match(/<w:tblW\s[^>]*>/g) || []);
const tcW = (xml.match(/<w:tcW\s[^>]*>/g) || []);
const gridSpan = (xml.match(/<w:gridSpan\s[^>]*>/g) || []).length;
const tblPr = xml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/);

console.log(`=== ${mode} ===`);
console.log('tblGrid blocks:', gridCount, '(tables: 2)');
console.log('gridCol cells :', gridColCount);
console.log('fixed layout  :', layoutFixed);
console.log('tblW          :', tblW.slice(0, 3).join(' | '));
console.log('tcW sample    :', tcW.slice(0, 4).join(' | '));
console.log('gridSpan      :', gridSpan);
console.log('first tblPr   :', tblPr ? tblPr[0].replace(/\s+/g, ' ').slice(0, 500) : 'NONE');
