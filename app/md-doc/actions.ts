"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = docx;

async function generateDocxBytes(markdown: string, title = "Document"): Promise<Uint8Array> {
  const children: any[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Заголовки
    if (line.startsWith("# ")) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith("### ")) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } 
    // Таблицы (с поддержкой раскраски!)
    else if (line.startsWith("|")) {
      const tableRows: docx.TableRow[] = [];
      let headerCells: string[] = [];

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const rowLine = lines[i].trim();
        if (rowLine.includes("---")) { i++; continue; } // разделитель

        const cells = rowLine.split("|").slice(1, -1).map(c => c.trim());

        if (tableRows.length === 0) {
          headerCells = cells;
        }

        const rowCells: docx.TableCell[] = cells.map(cell => {
          let text = cell;
          let fill = "FFFFFF";

          // Парсим цвет: {bg-red-500} или {bg:#ef4444;text-white} или {red}
          const colorMatch = cell.match(/\{(bg-?[^;]+)?(?:; ?text-?([^}]+))?\}/);
          if (colorMatch) {
            text = cell.replace(/\{.*\}/, "").trim();
            const bgPart = colorMatch[1];
            if (bgPart) {
              const colorMap: Record<string, string> = {
                red: "#ef4444", green: "#22c55e", blue: "#3b82f6",
                yellow: "#eab308", purple: "#a855f7", orange: "#f97316",
                pink: "#ec4899", cyan: "#06b6d4",
              };
              let colorKey = bgPart.replace("bg-", "");
              fill = colorMap[colorKey] || (colorKey.startsWith("#") ? colorKey : "#FFFFFF");
            }
          }

          return new TableCell({
            children: [new Paragraph({ children: [new TextRun(text)] })],
            shading: { fill, type: ShadingType.CLEAR },
            borders: { top: { style: BorderStyle.SINGLE }, bottom: { style: BorderStyle.SINGLE }, left: { style: BorderStyle.SINGLE }, right: { style: BorderStyle.SINGLE } },
          });
        });

        tableRows.push(new TableRow({ children: rowCells }));
        i++;
      }

      children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.SINGLE }, bottom: { style: BorderStyle.SINGLE }, left: { style: BorderStyle.SINGLE }, right: { style: BorderStyle.SINGLE }, insideH: { style: BorderStyle.SINGLE }, insideV: { style: BorderStyle.SINGLE } },
      }));
      continue;
    } 
    // Обычный текст
    else if (line) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
    i++;
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
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
    const docxBytes = await generateDocxBytes(markdownContent, originalFileName);
    const fileName = `${originalFileName.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;

    const blob = new Blob([docxBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    const result = await sendTelegramDocument(
      chatId,
      blob,
      fileName,
      `📄 Ваш DOCX готов: ${fileName}\n\nОтправлено из Markdown-редактора`
    );

    if (result.success) {
      return { success: true, message: `✅ ${fileName} отправлен в Telegram!` };
    }
    return { success: false, error: result.error || "Не удалось отправить" };
  } catch (e: any) {
    logger.error("[md-doc] Ошибка генерации/отправки DOCX:", e);
    return { success: false, error: e.message || "Неизвестная ошибка" };
  }
}