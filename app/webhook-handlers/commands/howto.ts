import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";

export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_WAREHOUSE] User ${userId} triggered /howto.`);

  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";

  const message = `📡 **СПРАВОЧНЫЙ ТЕРМИНАЛ**

Здесь ты можешь управлять хаосом или строить новый порядок.

--- 🏭 **ОПЕРАТОР СКЛАДА** ---
Управляй остатками, сканируй товары, исключай штрафы и следи за KPI сотрудников. Твой склад в твоем кармане.

--- 👨‍💻 **АРХИТЕКТОР VIBE** ---
Используй инструменты разработки, создавай свои сценарии автоматизации и клонируй лучшие практики.

👇 *Доступные модули:*`;

  const buttons = [
    // Warehouse Ops
    [
      { text: "📦 Мой Склад (Dashboard)", url: `${botUrl}?startapp=wb_dashboard` },
      { text: "⚡ Быстрый Аудит", url: `${botUrl}?startapp=audit-tool` },
    ],
    [
      { text: "👥 Управление Командой", url: `${botUrl}?startapp=crews` },
      { text: "📊 Отчеты и CSV", url: `${botUrl}?startapp=reports` },
    ],
    // Dev Ops
    [
      { text: "💻 VIBE Studio (IDE)", url: `${botUrl}?startapp=repo-xml` },
      { text: "🛠️ Настройки Профиля", url: `${botUrl}?startapp=settings` },
    ]
  ];

  try {
    const result = await sendComplexMessage(
      chatId,
      message,
      buttons,
      { imageQuery: "cyberpunk warehouse automation holographic interface" }
    );
    
    if (!result.success) {
      throw new Error(result.error || "Unknown error sending message.");
    }
    
    logger.info(`[HOWTO_WAREHOUSE] Guide sent to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_WAREHOUSE] Failed to send guide:", error);
    await sendComplexMessage(
        chatId,
        "🚨 Ошибка терминала. Связь прервана. Попробуйте позже."
    );
  }
}