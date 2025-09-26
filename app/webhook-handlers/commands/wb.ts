// /app/webhook-handlers/commands/wb.ts
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { getWarehouseItems, exportCurrentStock } from "@/app/wb/actions";
import { logger } from "@/lib/logger";
import { escapeTelegramMarkdown } from "@/lib/utils"; // Assuming utils has escape
import Papa from "papaparse";

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

    // Generate WB CSV: "баркод","количество"
    const wbData = items
      .filter(i => i.specs?.wb_sku)
      .map(i => ({
        "баркод": i.specs.wb_sku,
        "количество": i.specs?.warehouse_locations?.reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0) || 0
      }));
    const wbCsv = Papa.unparse(wbData, { header: true, delimiter: ';', quotes: true });

    // Generate Ozon CSV: "артикул","количество","склад"
    const ozonWarehouse = `Магазин Нижний Новгород (${process.env.OZON_WAREHOUSE_ID})`;
    const ozonData = items
      .filter(i => i.specs?.ozon_sku)
      .map(i => ({
        "артикул": i.specs.ozon_sku,
        "количество": i.specs?.warehouse_locations?.reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0) || 0,
        "склад": ozonWarehouse
      }));
    const ozonCsv = Papa.unparse(ozonData, { header: true, delimiter: ';', quotes: true });

    // Send summary + WB CSV + Ozon CSV
    await sendComplexMessage(chatId, summaryText, [], { parseMode: 'MarkdownV2' });
    if (wbCsv) {
      await sendComplexMessage(chatId, "WB stocks CSV:", [], {
        attachment: { type: 'document', content: wbCsv, filename: 'wb_stocks.csv' }
      });
    }
    if (ozonCsv) {
      await sendComplexMessage(chatId, "Ozon stocks CSV:", [], {
        attachment: { type: 'document', content: ozonCsv, filename: 'ozon_stocks.csv' }
      });
    }

  } catch (err: any) {
    logger.error('[wbCommand] Error:', err);
    await sendComplexMessage(chatId, 'Произошла ошибка при формировании отчёта склада.', []);
  }
}