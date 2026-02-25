"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";
import { parseCellMarkers } from "@/lib/parseCellMarkers";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, ShadingType } = docx;

async function generateDocxBytes(markdown: string): Promise<Uint8Array> {
  const children: any[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  const TABLE_WIDTH_DXA = 9638; // Стандарт для A4 с учетом полей

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    if (line.startsWith("# ")) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } 
    else if (line.startsWith("|")) {
      const tableRows: TableRow[] = [];
      let colCount = 0;
      let isHeader = true;

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const rowLine = lines[i].trim();
        if (rowLine.includes("---")) { i++; continue; }

        const rawCells = rowLine.split("|").slice(1, -1);
        colCount = Math.max(colCount, rawCells.length);

        const rowCells = rawCells.map(raw => {
          const { text, bg, textColor } = parseCellMarkers(raw);

          return new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ 
                text: text || " ", 
                color: textColor?.replace("#", ""), 
                bold: isHeader // Первый ряд всегда жирный
              })] 
            })],
            shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
            width: { size: Math.floor(TABLE_WIDTH_DXA / colCount), type: WidthType.DXA },
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: "E2E8F0" },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: "E2E8F0" },
              left: { style: BorderStyle.SINGLE, size: 8, color: "E2E8F0" },
              right: { style: BorderStyle.SINGLE, size: 8, color: "E2E8F0" },
            },
          });
        });

        while (rowCells.length < colCount) rowCells.push(new TableCell({ children: [] }));
        tableRows.push(new TableRow({ children: rowCells }));
        isHeader = false; // Последующие ряды обычные
        i++;
      }

      children.push(new Table({
        rows: tableRows,
        width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
      }));
      continue;
    } 
    else {
      children.push(new Paragraph({ text: line, spacing: { after: 120 } }));
    }
    i++;
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function generateMarkdownDocxAndSend(markdown: string, chatId: string, fileName = "report") {
  if (!chatId) return { success: false, error: "Chat ID missing" };
  try {
    const bytes = await generateDocxBytes(markdown);
    const safeName = `${fileName.replace(/\s+/g, "_")}.docx`;
    const result = await sendTelegramDocument(chatId, new Blob([bytes]), safeName, `📄 *CyberVibe v8.0*\nГотовый отчет: \`${safeName}\``);
    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}