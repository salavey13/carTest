"use server";

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, BorderStyle } from "docx";
import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Мапа цветов для Word (Hex)
const COLOR_MAP: Record<string, string> = {
  red: "FF4444",
  green: "00C851",
  blue: "33B5E5",
  yellow: "FFBB33",
  orange: "FF8800",
  purple: "AA66CC"
};

export async function sendMarkdownAsDocx(markdown: string, chatId: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return { success: false, error: "Config missing" };

  try {
    const lines = markdown.split("\n");
    const children: any[] = [];

    // Базовая логика парсинга для DOCX
    let currentTableRows: TableRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 1. Обработка заголовков
      if (line.startsWith("#")) {
        const level = (line.match(/^#+/) || ["#"])[0].length;
        children.push(new Paragraph({
          text: line.replace(/^#+\s*/, ""),
          heading: level === 1 ? "Heading1" : "Heading2",
          spacing: { before: 400, after: 200 },
        }));
        continue;
      }

      // 2. Обработка таблиц (упрощенный парсер)
      if (line.startsWith("|")) {
        if (line.includes("---")) continue; // Пропускаем разделитель

        const cells = line.split("|").filter(c => c.trim() !== "").map(c => c.trim());
        
        const tableRow = new TableRow({
          children: cells.map(cellText => {
            // Извлекаем цвет фона из (bg-color)
            const bgMatch = cellText.match(/^\((bg-)?(\w+)\)/);
            const colorName = bgMatch ? bgMatch[2] : null;
            const cleanText = cellText.replace(/^\((bg-)?\w+\)\s*/, "");
            const bgColor = colorName ? COLOR_MAP[colorName] || "F0F0F0" : undefined;

            return new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: cleanText, color: bgColor ? "FFFFFF" : "000000" })] 
              })],
              shading: bgColor ? { fill: bgColor, type: ShadingType.CLEAR, color: "auto" } : undefined,
              width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
              verticalAlign: AlignmentType.CENTER,
            });
          }),
        });

        currentTableRows.push(tableRow);

        // Если следующая строка не таблица или это конец - сбрасываем таблицу в документ
        if (i === lines.length - 1 || !lines[i + 1].trim().startsWith("|")) {
          children.push(new Table({
            rows: currentTableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }));
          currentTableRows = [];
        }
        continue;
      }

      // 3. Обычный текст
      if (line !== "") {
        children.push(new Paragraph({
          children: [new TextRun(line)],
          spacing: { after: 120 }
        }));
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    const formData = new FormData();
    formData.append("chat_id", chatId);
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    
    // ВАЖНО: Фикс имени файла
    formData.append("document", blob, `Report_${Date.now()}.docx`);
    formData.append("caption", "📄 Ваш кастомный отчет готов!");

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!result.ok) throw new Error(result.description);

    return { success: true };
  } catch (error: any) {
    logger.error("Docx generation error:", error);
    return { success: false, error: error.message };
  }
}