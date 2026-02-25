"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";
import { parseCellMarkers } from "@/lib/parseCellMarkers";

const { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  Table, TableRow, TableCell, WidthType, TableLayoutType, 
  BorderStyle, ShadingType, AlignmentType 
} = docx;

// Константа ширины листа А4 (минус стандартные поля) в единицах DXA
const FULL_TABLE_WIDTH = 9638;

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
      
      // 1. Предварительный расчет максимального количества колонок
      let checkI = i;
      while (checkI < lines.length && lines[checkI].trim().startsWith("|")) {
        if (!lines[checkI].includes("---")) {
          const cells = lines[checkI].split("|").filter(Boolean);
          if (cells.length > colCount) colCount = cells.length;
        }
        checkI++;
      }

      // Если колонок нет, пропускаем
      if (colCount === 0) { i++; continue; }

      // Вычисляем жесткую ширину ячейки в DXA
      const cellWidth = Math.floor(FULL_TABLE_WIDTH / colCount);

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
                text: text || " ", 
                color: textColor?.replace("#", ""),
                bold: isHeaderRow 
              })],
              alignment: AlignmentType.LEFT // Выравнивание текста
            })],
            shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
            // ФИКС: Используем DXA вместо PERCENTAGE для совместимости с Google Docs/Mobile
            width: { size: cellWidth, type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            borders: { 
              top: { style: BorderStyle.SINGLE, size: 6, color: "444444" }, 
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "444444" }, 
              left: { style: BorderStyle.SINGLE, size: 6, color: "444444" }, 
              right: { style: BorderStyle.SINGLE, size: 6, color: "444444" } 
            },
          });
        });

        // Дозаполняем ячейки, если строка короче заголовка
        while (rowCells.length < colCount) {
          rowCells.push(new TableCell({ 
            children: [], 
            width: { size: cellWidth, type: WidthType.DXA } 
          }));
        }
        
        tableRows.push(new TableRow({ children: rowCells }));
        isHeaderRow = false;
        i++;
      }

      children.push(new Table({
        rows: tableRows,
        // ФИКС: Явно задаем общую ширину таблицы в DXA
        width: { size: FULL_TABLE_WIDTH, type: WidthType.DXA },
        // ФИКС: TableLayoutType.FIXED заставляет Word соблюдать заданные размеры колонок
        layout: TableLayoutType.FIXED,
      }));
      continue;
    } 
    else {
      children.push(new Paragraph({ 
        children: [new TextRun(line)], 
        spacing: { after: 120 } 
      }));
    }
    i++;
  }

  const doc = new Document({ 
    sections: [{ 
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // Стандартные поля 2.54см
        }
      },
      children 
    }] 
  });
  return Packer.toBuffer(doc);
}

export async function sendMarkdownDoc(markdown: string, chatId: string, fileName = "Отчет") {
  try {
    const bytes = await generateDocxBytes(markdown);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const name = `${fileName.replace(/\s+/g, "_")}.docx`;

    return await sendTelegramDocument(chatId, blob, name, `🚀 *CyberVibe Engine v8.5*\nШирина таблиц: *Оптимизирована*`);
  } catch (e: any) {
    logger.error("DOCX_GEN_ERROR", e);
    return { success: false, error: e.message };
  }
}