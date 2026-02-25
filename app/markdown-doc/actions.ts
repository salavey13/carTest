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
      let isHeaderRow = true;

      // Сначала узнаем макс. количество колонок в таблице
      let checkI = i;
      while (checkI < lines.length && lines[checkI].trim().startsWith("|")) {
        if (!lines[checkI].includes("---")) {
          const cells = lines[checkI].split("|").filter(Boolean);
          colCount = Math.max(colCount, cells.length);
        }
        checkI++;
      }

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const rowLine = lines[i].trim();
        if (rowLine.includes("---")) { i++; continue; }

        const rawCells = rowLine.split("|").slice(1, -1);
        const rowCells = rawCells.map(raw => {
          const { text, bg, textColor } = parseCellMarkers(raw);

          return new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ 
                text: text || " ", 
                color: textColor?.replace("#", ""),
                bold: isHeaderRow // Шапка всегда жирная
              })] 
            })],
            shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
            // ФИКС: Ширина в процентах, чтобы таблица была на весь лист
            width: { size: 100 / colCount, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            borders: { 
              top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, 
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, 
              left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, 
              right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" } 
            },
          });
        });

        while (rowCells.length < colCount) rowCells.push(new TableCell({ children: [] }));
        tableRows.push(new TableRow({ children: rowCells }));
        isHeaderRow = false; // Последующие строки обычные
        i++;
      }

      children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
      }));
      continue;
    } 
    else {
      children.push(new Paragraph({ children: [new TextRun(line)], spacing: { after: 100 } }));
    }
    i++;
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function sendMarkdownDoc(markdown: string, chatId: string, fileName = "Отчет") {
  try {
    const bytes = await generateDocxBytes(markdown);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const name = `${fileName.replace(/\s+/g, "_")}.docx`;

    return await sendTelegramDocument(chatId, blob, name, `📄 *CyberVibe Studio v8.0*\nДокумент готов: \`${name}\``);
  } catch (e: any) {
    logger.error("DOCX_GEN_ERROR", e);
    return { success: false, error: e.message };
  }
}