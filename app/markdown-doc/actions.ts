"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";
import { parseCellMarkers } from "@/lib/parseCellMarkers";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = docx;

// Общая ширина листа A4 без полей в единицах DXA
const MAX_WIDTH = 9638;

async function generateDocxBytes(markdown: string): Promise<Uint8Array> {
  const children: any[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    if (line.startsWith("#")) {
      const level = (line.match(/^#+/)?.[0].length || 1) as 1 | 2;
      children.push(new Paragraph({ 
        text: line.replace(/^#+\s*/, ""), 
        heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 }
      }));
    } 
    else if (line.startsWith("|")) {
      const tableRows: TableRow[] = [];
      let colCount = 0;

      // Считаем колонки
      let checkI = i;
      while (checkI < lines.length && lines[checkI].trim().startsWith("|")) {
        if (!lines[checkI].includes("---")) {
          const cells = lines[checkI].split("|").filter(Boolean);
          colCount = Math.max(colCount, cells.length);
        }
        checkI++;
      }

      const cellWidth = Math.floor(MAX_WIDTH / colCount);
      let isHeader = true;

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (lines[i].includes("---")) { i++; continue; }
        const rawCells = lines[i].split("|").slice(1, -1);
        
        tableRows.push(new TableRow({
          children: rawCells.map(raw => {
            const { text, bg, textColor } = parseCellMarkers(raw);
            return new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: text || " ", color: textColor?.replace("#", ""), bold: isHeader })] 
              })],
              shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
              width: { size: cellWidth, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              borders: { 
                top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }
              }
            });
          })
        }));
        isHeader = false;
        i++;
      }
      children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      continue;
    } 
    else {
      children.push(new Paragraph({ text: line, spacing: { after: 100 } }));
    }
    i++;
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function sendMarkdownDoc(markdown: string, chatId: string) {
  try {
    const bytes = await generateDocxBytes(markdown);
    return await sendTelegramDocument(chatId, new Blob([bytes]), "Report.docx", "🚀 CyberVibe v8.2");
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}