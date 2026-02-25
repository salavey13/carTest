"use server";

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType } from "docx";
import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendMarkdownAsDocx(markdown: string, chatId: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    return { success: false, error: "Настройки Telegram не найдены" };
  }

  try {
    // 1. Генерируем простой DOCX (упрощенная версия для примера)
    // В реальном проекте тут можно использовать парсеры, но для MVP сделаем чистый текст
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Markdown Export Report",
                bold: true,
                size: 32,
              }),
            ],
          }),
          ...markdown.split('\n').map(line => new Paragraph({
            children: [new TextRun(line)],
            spacing: { before: 200 }
          }))
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    // 2. Отправка в Telegram
    const formData = new FormData();
    formData.append("chat_id", chatId);
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    formData.append("document", blob, "report.docx");
    formData.append("caption", "📄 Ваш документ .docx готов!");

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!result.ok) throw new Error(result.description);

    return { success: true };
  } catch (error: any) {
    logger.error("Docx sending failed:", error);
    return { success: false, error: error.message };
  }
}