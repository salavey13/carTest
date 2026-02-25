"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";
import { parseCellMarkers } from "@/lib/parseCellMarkers";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, ShadingType } = docx;

// МАГИЧЕСКАЯ КОНСТАНТА: Ширина листа A4 в единицах DXA (за вычетом стандартных полей)
const FULL_TABLE_WIDTH_DXA = 9638;

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

      // 1. Сначала определяем максимальное количество колонок во всей таблице
      let checkI = i;
      while (checkI < lines.length && lines[checkI].trim().startsWith("|")) {
        if (!lines[checkI].includes("---")) {
          const cells = lines[checkI].split("|").filter(Boolean);
          colCount = Math.max(colCount, cells.length);
        }
        checkI++;
      }

      // 2. Рассчитываем фиксированную ширину одной колонки в DXA
      const columnWidthDxa = Math.floor(FULL_TABLE_WIDTH_DXA / colCount);

      let isHeaderRow = true;

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const rowLine = lines[i].trim();
        if (rowLine.includes("---")) { i++; continue; }

        const rawCells = rowLine.split("|").slice(1, -1);
        const rowCells = rawCells.map(raw => {
          const { text, bg, textColor } = parseCellMarkers(raw);

          return new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ 
                text: text || " ", // Фикс пустых строк
                color: textColor?.replace("#", ""),
                bold: isHeaderRow 
              })] 
            })],
            shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
            // МАГИЯ ТУТ: Указываем ширину в DXA для каждой ячейки
            width: { size: columnWidthDxa, type: WidthType.DXA },
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            borders: { 
              top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, 
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, 
              left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, 
              right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" } 
            },
          });
        });

        // Дозаполняем ячейки, если строка короче заголовка
        while (rowCells.length < colCount) {
          rowCells.push(new TableCell({ 
            children: [], 
            width: { size: columnWidthDxa, type: WidthType.DXA } 
          }));
        }
        
        tableRows.push(new TableRow({ children: rowCells }));
        isHeaderRow = false;
        i++;
      }

      // 3. Создаем таблицу с фиксированной раскладкой
      children.push(new Table({
        rows: tableRows,
        width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
        layout: TableLayoutType.FIXED, // ОБЯЗАТЕЛЬНО для соблюдения ширины колонок
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

    return await sendTelegramDocument(chatId, blob, name, `📄 *CyberVibe Studio v8.1*\nШирина таблиц: *DXA MAGIC*`);
  } catch (e: any) {
    logger.error("DOCX_GEN_ERROR", e);
    return { success: false, error: e.message };
  }
}