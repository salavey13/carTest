"use server";

import { logger } from "@/lib/logger";

/**
 * Демонстрационный экшен для "парсинга" CSV.
 * В реальности здесь будет логика PapaParse или SheetJS.
 */
export async function importDemoCsvAction(csvSnippet: string): Promise<{ success: boolean; message?: string; error?: string }> {
  // Имитация задержки сервера (анализ данных)
  await new Promise(resolve => setTimeout(resolve, 1500));

  logger.info(`[DemoCSV] Received snippet length: ${csvSnippet.length}`);

  if (!csvSnippet || csvSnippet.length < 3) {
    return { success: false, error: "Пустые или слишком короткие данные." };
  }

  // В демо режиме мы всегда говорим "ОК", если данные есть
  return { 
      success: true, 
      message: "CSV structure detected: Generic Inventory Format" 
  };
}