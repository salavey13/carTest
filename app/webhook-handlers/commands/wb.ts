import { sendComplexMessage } from "../actions/sendComplexMessage";
import { getWarehouseItems, exportCurrentStock } from "@/app/wb/actions";
import { logger } from "@/lib/logger";

export async function wbCommand(chatId: number, userId: string) {
  try {
    // Получаем текущие товары
    const res = await getWarehouseItems();
    if (!res.success || !res.data) {
      await sendComplexMessage(chatId, "Не удалось получить данные склада.", []);
      return;
    }
    const items = res.data;

    // Генерируем CSV (суммированный + подробный)
    const summarized = true;
    const csvRes = await exportCurrentStock(items, true, summarized); // если нужно отправлять в Telegram, функция вернёт csv
    if (csvRes.success && csvRes.csv) {
      // Мини-анализ: топ 10 по количеству
      const sorted = items
        .map(i => ({ id: i.id, qty: (i.specs?.warehouse_locations || []).reduce((a:any,b:any)=>a + (b.quantity||0), 0) }))
        .sort((a,b) => b.qty - a.qty)
        .slice(0, 10);
      const analysisText = [
        `Склад: ${items.length} позиций.`,
        `Топ-10 по кол-ву:`,
        ...sorted.map(x => `${x.id}: ${x.qty}`)
      ].join("\n");

      // Отправить CSV как документ (sendComplexMessage поддерживает attachment)
      await sendComplexMessage(chatId, analysisText, [], {
        attachment: { type: 'document', content: csvRes.csv, filename: 'warehouse_stock.csv' }
      });
      return;
    } else {
      // fallback: отправим короткое summary + попытка отправить через sendComplexMessage
      const short = `Склад: ${items.length} позиций. Не удалось сгенерировать CSV.`;
      await sendComplexMessage(chatId, short, []);
      return;
    }
  } catch (err:any) {
    logger.error('[wbCommand] Error:', err);
    await sendComplexMessage(chatId, 'Произошла ошибка при формировании отчёта склада.', []);
  }
}