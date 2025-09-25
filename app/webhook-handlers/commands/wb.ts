import { sendComplexMessage } from "../actions/sendComplexMessage";
import { getWarehouseItems, exportCurrentStock } from "@/app/wb/actions";
import { logger } from "@/lib/logger";
import { escapeTelegramMarkdown } from "@/lib/utils"; // Assuming utils has escape

export async function wbCommand(chatId: number, userId: string) {
  try {
    // Fetch current items
    const res = await getWarehouseItems();
    if (!res.success || !res.data) {
      await sendComplexMessage(chatId, "Не удалось получить данные склада.", []);
      return;
    }
    const items = res.data;

    // Summarize by make
    const summaryByMake: { [make: string]: number } = {};
    items.forEach(i => {
      const make = i.make || "Unknown Make";
      const qty = i.specs?.warehouse_locations?.reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0) || 0;
      summaryByMake[make] = (summaryByMake[make] || 0) + qty;
    });

    // Format summary as Markdown
    const summaryText = [
      `Склад: ${items.length} позиций.`,
      `Сумма по make:`,
      ...Object.entries(summaryByMake).map(([make, qty]) => `*${escapeTelegramMarkdown(make)}*: ${qty}`)
    ].join("\n");

    // Generate summarized CSV
    const summarized = true;
    const csvRes = await exportCurrentStock(items, true, summarized);
    if (csvRes.success && csvRes.csv) {
      // Send summary text + CSV
      await sendComplexMessage(chatId, summaryText, [], {
        attachment: { type: 'document', content: csvRes.csv, filename: 'warehouse_stock_summary.csv' },
        parseMode: 'MarkdownV2'
      });
      return;
    } else {
      // Fallback: send summary text only
      await sendComplexMessage(chatId, summaryText, [], { parseMode: 'MarkdownV2' });
      return;
    }
  } catch (err: any) {
    logger.error('[wbCommand] Error:', err);
    await sendComplexMessage(chatId, 'Произошла ошибка при формировании отчёта склада.', []);
  }
}