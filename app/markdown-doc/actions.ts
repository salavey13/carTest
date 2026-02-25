"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, TableLayoutType } = docx;

const COLOR_MAP: Record<string, string> = {
  red: "EF4444", green: "22C55E", blue: "3B82F6", yellow: "EAB308",
  amber: "F59E0B", orange: "F97316", pink: "EC4899", purple: "A855F7",
  cyan: "06B6D4", lime: "84CC16", emerald: "10B981", teal: "14B8A6",
  rose: "F43F5E", sky: "0EA5E9", white: "FFFFFF", black: "000000", gray: "6B7280",
};

const RU_MAP: Record<string, string> = {
  "красный": "red", "зеленый": "green", "зелёный": "green", "синий": "blue",
  "желтый": "yellow", "жёлтый": "yellow", "оранжевый": "orange", 
  "фиолетовый": "purple", "голубой": "cyan", "изумрудный": "emerald"
};

// ФИКС: Обязательно async для серверного файла!
export async function parseCellData(raw: string) {
  let text = raw.trim();
  let bg: string | undefined;
  let fg: string | undefined;

  const matches = [...text.matchAll(/\((bg-|фон-)?([a-zа-яё#0-9-]+)\)/gi)];
  for (const m of matches) {
    const isBg = m[1] === "bg-" || m[1] === "фон-";
    let val = m[2].toLowerCase().replace(/ё/g, "е");
    const key = RU_MAP[val] || val;
    const hex = COLOR_MAP[key] || (val.startsWith("#") ? val.replace("#", "") : undefined);

    if (hex) {
      if (isBg) bg = hex; else fg = hex;
    }
  }
  return { 
    clean: text.replace(/\((bg-|фон-)?[a-zа-яё#0-9-]+\)\s*/gi, "").trim(), 
    bg, fg 
  };
}

export async function generateAndSendDoc(markdown: string, chatId: string, fileName = "Report") {
  if (!chatId) return { success: false, error: "No Chat ID" };
  
  try {
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
          spacing: { before: 300, after: 150 }
        }));
      } else if (line.startsWith("|")) {
        const rows: TableRow[] = [];

        while (i < lines.length && lines[i].trim().startsWith("|")) {
          const l = lines[i].trim();
          if (l.includes("---")) { i++; continue; }
          const cells = l.split("|").slice(1, -1);
          
          rows.push(new TableRow({
            children: await Promise.all(cells.map(async (c) => {
              const { clean, bg, fg } = await parseCellData(c);
              return new TableCell({
                children: [new Paragraph({ 
                  children: [new TextRun({ text: clean, color: fg, bold: !!fg })] 
                })],
                shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
                width: { size: 100 / cells.length, type: WidthType.PERCENTAGE }, // Растягиваем!
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
                borders: { 
                  top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
                }
              });
            }))
          }));
          i++;
        }
        children.push(new Table({ 
          rows, 
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED 
        }));
        continue;
      } else {
        children.push(new Paragraph({ text: line, spacing: { after: 120 } }));
      }
      i++;
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    return await sendTelegramDocument(chatId, new Blob([buffer]), `${fileName}.docx`, `📄 *CyberVibe Pro*\nReport created.`);
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}