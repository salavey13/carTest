"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, ShadingType } = docx;

const COLOR_MAP: Record<string, string> = {
  red: "#ef4444", green: "#22c55e", blue: "#3b82f6", yellow: "#eab308",
  amber: "#f59e0b", orange: "#f97316", pink: "#ec4899", purple: "#a855f7",
  cyan: "#06b6d4", lime: "#84cc16", emerald: "#10b981", teal: "#14b8a6",
  rose: "#f43f5e", violet: "#8b5cf6", indigo: "#6366f1", sky: "#0ea5e9",
  white: "#ffffff", black: "#000000", gray: "#6b7280",
};

const RUSSIAN_TO_ENGLISH: Record<string, string> = {
  "красный": "red", "красн": "red",
  "зелёный": "green", "зеленый": "green", "зелен": "green",
  "синий": "blue", "син": "blue",
  "желтый": "yellow", "жёлтый": "yellow", "желт": "yellow",
  "оранжевый": "orange", "оранж": "orange",
  "розовый": "pink", "розов": "pink",
  "фиолетовый": "purple", "фиолет": "purple",
  "голубой": "cyan", "голуб": "cyan",
  "лаймовый": "lime", "лайм": "lime",
  "изумрудный": "emerald", "изумруд": "emerald",
  "бирюзовый": "teal", "бирюз": "teal",
};

export function parseCellMarkers(raw: string) {
  let text = raw.trim();
  let bg: string | undefined;
  let textColor: string | undefined;

  const matches = [...text.matchAll(/\((bg-|фон-)?([a-zа-яё#0-9-]+)\)/gi)];

  for (const m of matches) {
    const prefix = m[1] || "";
    let token = m[2].toLowerCase().replace(/ё/g, "е");
    const key = RUSSIAN_TO_ENGLISH[token] || token;

    if (prefix === "bg-" || prefix === "фон-") {
      bg = COLOR_MAP[key] || (key.startsWith("#") ? key : undefined);
    } else {
      textColor = COLOR_MAP[key] || (key.startsWith("#") ? key : undefined);
    }
  }

  text = text.replace(/\((bg-|фон-)?[a-zа-яё#0-9-]+\)\s*/gi, "").trim();
  return { text, bg, textColor };
}

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

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const rowLine = lines[i].trim();
        if (rowLine.includes("---")) { i++; continue; }

        const rawCells = rowLine.split("|").slice(1, -1);
        colCount = Math.max(colCount, rawCells.length);

        const rowCells = rawCells.map(raw => {
          const { text, bg, textColor } = parseCellMarkers(raw.trim());

          return new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, color: textColor?.replace("#", "") })] })],
            shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
            width: { size: Math.floor(10000 / colCount), type: WidthType.DXA },
            margins: { top: 140, bottom: 140, left: 160, right: 160 },
            borders: { top: { style: BorderStyle.SINGLE, size: 12 }, bottom: { style: BorderStyle.SINGLE, size: 12 }, left: { style: BorderStyle.SINGLE, size: 12 }, right: { style: BorderStyle.SINGLE, size: 12 } },
          });
        });

        while (rowCells.length < colCount) rowCells.push(new TableCell({ children: [] }));
        tableRows.push(new TableRow({ children: rowCells }));
        i++;
      }

      children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: Array(colCount).fill(Math.floor(10000 / colCount)),
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
      `📄 ${fileName}\nГотово из Markdown-редактора CyberVibe v5.0`
    );

    return result.success 
      ? { success: true, message: `✅ ${fileName} отправлен!` }
      : { success: false, error: result.error || "Ошибка отправки" };
  } catch (e: any) {
    logger.error("[md-doc] DOCX error:", e);
    return { success: false, error: e.message };
  }
}