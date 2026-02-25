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

// Стандартная ширина области печати A4 в DXA (без полей)
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

      // 1. Предварительный расчёт количества колонок
      let checkI = i;
      while (checkI < lines.length && lines[checkI].trim().startsWith("|")) {
        if (!lines[checkI].includes("---")) {
          const cells = lines[checkI].split("|").filter(Boolean);
          if (cells.length > colCount) colCount = cells.length;
        }
        checkI++;
      }

      if (colCount === 0) { i++; continue; }

      // Жёсткая ширина ячейки в DXA
      const cellWidth = Math.floor(FULL_TABLE_WIDTH / colCount);
      let isHeader = true;

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (lines[i].includes("---")) { i++; continue; }
        const rawCells = lines[i].split("|").slice(1, -1);
        
        tableRows.push(new TableRow({
          children: rawCells.map(raw => {
            const { text, bg, textColor } = parseCellMarkers(raw);
            return new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ 
                  text: text || " ", 
                  color: textColor?.replace("#", ""), 
                  bold: isHeader 
                })],
                alignment: AlignmentType.LEFT
              })],
              shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
              width: { size: cellWidth, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              borders: { 
                top: { style: BorderStyle.SINGLE, size: 4, color: "444444" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "444444" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "444444" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "444444" }
              }
            });
          })
        }));
        isHeader = false;
        i++;
      }

      children.push(new Table({ 
        rows: tableRows,
        width: { size: FULL_TABLE_WIDTH, type: WidthType.DXA },
        layout: TableLayoutType.FIXED
      }));
      continue;
    } 
    else {
      children.push(new Paragraph({ 
        children: [new TextRun(line)], 
        spacing: { after: 100 } 
      }));
    }
    i++;
  }

  const doc = new Document({ 
    sections: [{ 
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 2.54 см поля
        }
      },
      children 
    }] 
  });
  return Packer.toBuffer(doc);
}

export async function generateMarkdownDocxAndSend(
  markdownContent: string,
  chatId: string,
  originalFileName = "document"
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!chatId) return { success: false, error: "Chat ID не передан" };
  if (!markdownContent?.trim()) return { success: false, error: "Нет содержимого" };

  try {
    const docxBytes = await generateDocxBytes(markdownContent);
    
    const safeName = originalFileName
      .replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s_-]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 60);

    const fileName = `${safeName}.docx`;

    const blob = new Blob([docxBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    const result = await sendTelegramDocument(
      chatId,
      blob,
      fileName,
      `📄 ${fileName}\nГотово из Markdown-редактора CyberVibe v8.1`
    );

    return result.success 
      ? { success: true, message: `✅ ${fileName} отправлен!` }
      : { success: false, error: result.error || "Ошибка отправки" };
  } catch (e: any) {
    logger.error("[md-doc] DOCX error:", e);
    return { success: false, error: e.message };
  }
}