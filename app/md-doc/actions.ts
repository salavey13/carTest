"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";
import { parseCellMarkers } from "@/lib/parseCellMarkers";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, ShadingType } = docx;

// Надёжная ширина таблицы (9638 DXA — стандартная рабочая область A4)
const FULL_TABLE_WIDTH = 9638;

async function generateDocxBytes(markdown: string): Promise<Uint8Array> {
  const children: any[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    if (line.startsWith("# ")) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith("### ")) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } 
    else if (line.startsWith("|")) {
      const tableRows: TableRow[] = [];
      let colCount = 0;
      let isHeaderRow = true;

      // Считаем количество колонок
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const rowLine = lines[i].trim();
        if (rowLine.includes("---")) { i++; continue; }

        const rawCells = rowLine.split("|").slice(1, -1);
        colCount = Math.max(colCount, rawCells.length);

        const rowCells = rawCells.map(raw => {
          const { text, bg, textColor } = parseCellMarkers(raw.trim());

          return new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ 
                text: text || " ", 
                color: textColor?.replace("#", ""), 
                bold: isHeaderRow 
              })] 
            })],
            shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
            width: { size: Math.floor(FULL_TABLE_WIDTH / colCount), type: WidthType.DXA },
            margins: { top: 160, bottom: 160, left: 180, right: 180 },
            borders: { top: { style: BorderStyle.SINGLE, size: 12 }, bottom: { style: BorderStyle.SINGLE, size: 12 }, left: { style: BorderStyle.SINGLE, size: 12 }, right: { style: BorderStyle.SINGLE, size: 12 } },
          });
        });

        while (rowCells.length < colCount) rowCells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: " " })] })] }));
        tableRows.push(new TableRow({ children: rowCells }));
        isHeaderRow = false;
        i++;
      }

      children.push(new Table({
        rows: tableRows,
        width: { size: FULL_TABLE_WIDTH, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: { top: { style: BorderStyle.SINGLE }, bottom: { style: BorderStyle.SINGLE }, left: { style: BorderStyle.SINGLE }, right: { style: BorderStyle.SINGLE }, insideH: { style: BorderStyle.SINGLE }, insideV: { style: BorderStyle.SINGLE } },
      }));
      continue;
    } 
    else {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
    i++;
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
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
      `📄 ${fileName}\nГотово из Markdown-редактора CyberVibe v7.0`
    );

    return result.success 
      ? { success: true, message: `✅ ${fileName} отправлен!` }
      : { success: false, error: result.error || "Ошибка отправки" };
  } catch (e: any) {
    logger.error("[md-doc] DOCX error:", e);
    return { success: false, error: e.message };
  }
}