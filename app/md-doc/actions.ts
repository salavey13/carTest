"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, ShadingType, AlignmentType } = docx;

// Расширенная палитра с поддержкой яркости для читаемости
const COLOR_MAP: Record<string, string> = {
  red: "FF4136", green: "2ECC40", blue: "0074D9", yellow: "FFDC00",
  orange: "FF851B", purple: "B10DC9", cyan: "7FDBFF", lime: "01FF70",
  emerald: "27AE60", rose: "FF4136", dark: "111111", silver: "DDDDDD"
};

const RUSSIAN_TO_ENGLISH: Record<string, string> = {
  "красный": "red", "зеленый": "green", "синий": "blue", "желтый": "yellow",
  "оранжевый": "orange", "фиолетовый": "purple", "черный": "dark"
};

// Функция для создания форматированного текста (Bold/Italic) внутри ячеек
function createFormattedRuns(text: string, color?: string): TextRun[] {
  const runs: TextRun[] = [];
  // Упрощенный парсинг: ищем **жирный**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  parts.forEach(part => {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, color: color?.replace("#", "") }));
    } else {
      runs.push(new TextRun({ text: part, color: color?.replace("#", "") }));
    }
  });
  return runs;
}

function parseCell(raw: string) {
  let text = raw.trim();
  let bg: string | undefined;
  let textColor: string | undefined;

  const markerRegex = /\((bg-)?([a-zа-я0-9#]+)\)/gi;
  let match;
  while ((match = markerRegex.exec(text)) !== null) {
    let type = match[1]; // "bg-" или undefined
    let value = match[2].toLowerCase();
    if (RUSSIAN_TO_ENGLISH[value]) value = RUSSIAN_TO_ENGLISH[value];
    const hex = COLOR_MAP[value] || (value.startsWith("#") ? value : undefined);

    if (type === "bg-") bg = hex;
    else textColor = hex;
  }
  return { 
    cleanText: text.replace(markerRegex, "").trim(), 
    bg, 
    textColor 
  };
}

export async function generateMarkdownDocxAndSend(
  markdown: string,
  chatId: string,
  fileName = "CyberVibe_Report"
) {
  try {
    const children: any[] = [];
    const lines = markdown.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) { i++; continue; }

      if (line.startsWith("#")) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, "");
        children.push(new Paragraph({
          text,
          heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }));
      } 
      else if (line.startsWith("|")) {
        const rows: TableRow[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          const rowLine = lines[i].trim();
          if (rowLine.includes("---")) { i++; continue; }
          
          const cells = rowLine.split("|").slice(1, -1);
          rows.push(new TableRow({
            children: cells.map(c => {
              const { cleanText, bg, textColor } = parseCell(c);
              return new TableCell({
                children: [new Paragraph({ children: createFormattedRuns(cleanText, textColor) })],
                shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
                verticalAlign: AlignmentType.CENTER,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                borders: { 
                  top: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" }
                }
              });
            })
          }));
          i++;
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        continue;
      } else {
        children.push(new Paragraph({ children: createFormattedRuns(line), spacing: { after: 150 } }));
      }
      i++;
    }

    const doc = new Document({ 
      sections: [{ 
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, 
        children 
      }] 
    });
    
    const buffer = await Packer.toBuffer(doc);
    const finalName = `${fileName.replace(/\s+/g, "_")}.docx`;
    
    return await sendTelegramDocument(
      chatId, 
      new Blob([buffer]), 
      finalName, 
      `🚀 *CyberVibe Pro Engine*\nДокумент: \`${finalName}\` успешно сформирован.`
    );
  } catch (e: any) {
    logger.error("DOCX_GEN_ERROR", e);
    return { success: false, error: e.message };
  }
}