"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType } = docx;

// Карта HEX-цветов для Word
const HEX_MAP: Record<string, string> = {
  red: "FF4136", green: "2ECC40", blue: "0074D9", yellow: "FFDC00",
  orange: "FF851B", purple: "B10DC9", cyan: "7FDBFF", lime: "01FF70",
  emerald: "27AE60", amber: "FF851B", pink: "F012BE", gray: "AAAAAA",
  white: "FFFFFF", black: "111111"
};

const LANG_MAP: Record<string, string> = {
  "красный": "red", "красн": "red",
  "зеленый": "green", "зеленый": "green", "зелен": "green", "зелёный": "green",
  "синий": "blue", "син": "blue",
  "желтый": "yellow", "желт": "yellow", "жёлтый": "yellow",
  "оранжевый": "orange", "оранж": "orange",
  "фиолетовый": "purple", "фиолет": "purple",
  "изумрудный": "emerald", "изумруд": "emerald",
  "белый": "white", "черный": "black", "чёрный": "black"
};

function processCell(rawText: string) {
  let text = rawText.trim();
  let bg: string | undefined;
  let fg: string | undefined;

  // Регулярка ловит (bg-цвет), (фон-цвет) или просто (цвет)
  const markerRegex = /\((bg-|фон-)?([a-zа-яё0-9#]+)\)/gi;
  let match;
  
  while ((match = markerRegex.exec(text)) !== null) {
    const isBg = !!match[1]; 
    let val = match[2].toLowerCase().replace(/ё/g, "е");
    
    // Превращаем русский в английский ключ или оставляем hex
    const key = LANG_MAP[val] || val;
    const hex = HEX_MAP[key] || (val.startsWith("#") ? val.replace("#", "") : undefined);

    if (hex) {
      if (isBg) bg = hex; else fg = hex;
    }
  }

  return {
    cleanText: text.replace(markerRegex, "").trim(),
    bg,
    fg
  };
}

export async function generateMarkdownDocxAndSend(markdown: string, chatId: string, title = "Report") {
  try {
    const children: any[] = [];
    const lines = markdown.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) { i++; continue; }

      if (line.startsWith("#")) {
        const level = (line.match(/^#+/)?.[0].length || 1) as 1 | 2 | 3;
        children.push(new Paragraph({
          text: line.replace(/^#+\s*/, ""),
          heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 }
        }));
      } else if (line.startsWith("|")) {
        const rows: TableRow[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          const l = lines[i].trim();
          if (l.includes("---")) { i++; continue; }
          const cells = l.split("|").slice(1, -1);
          
          rows.push(new TableRow({
            children: cells.map(c => {
              const { cleanText, bg, fg } = processCell(c);
              return new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cleanText, color: fg, bold: !!fg })] })],
                shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
                verticalAlign: AlignmentType.CENTER,
                margins: { top: 80, bottom: 80, left: 80, right: 80 },
                borders: { 
                    top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                    bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                    left: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                    right: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                }
              });
            })
          }));
          i++;
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        continue;
      } else {
        children.push(new Paragraph({ children: [new TextRun(line)], spacing: { after: 100 } }));
      }
      i++;
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    const safeName = `${title.replace(/[^a-zа-я0-9]/gi, "_")}.docx`;

    return await sendTelegramDocument(chatId, new Blob([buffer]), safeName, `📄 *CyberVibe Engine v3.1*\nФайл: \`${safeName}\``);
  } catch (e: any) {
    logger.error("DOCX_SEND_FAIL", e);
    return { success: false, error: e.message };
  }
}