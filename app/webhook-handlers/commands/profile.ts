import { logger } from "@/lib/logger";
import { fetchUserCyberFitnessProfile } from "@/app/cyberfitness/actions"; // CORRECTED IMPORT
import type { CyberFitnessProfile } from "@/app/cyberfitness/actions";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";

function formatProfileStats(profile: CyberFitnessProfile): string {
    const stats = [
        `⚡️ *KiloVibes:* ${profile.kiloVibes.toLocaleString()}`,
        `📈 *Уровень:* ${profile.level}`,
        `🧠 *Deep Work:* ${profile.focusTimeHours.toFixed(1)} ч.`,
        `🏆 *Достижения:* ${profile.achievements.length}`
    ];
    return stats.join('\n');
}

export async function profileCommand(chatId: number, userId: number, username:string | undefined) {
  logger.info(`[Profile Command] User ${userId} (${username}) triggered the /profile command.`);
  
  const botUsername = process.env.BOT_USERNAME || 'oneSitePlsBot';
  const profileLink = `https://t.me/${botUsername}/app?startapp=profile`;
  const settingsLink = `https://t.me/${botUsername}/app?startapp=settings`;

  try {
    // Using the new, safe, server-side function
    const { success, data: profile, error } = await fetchUserCyberFitnessProfile(String(userId));

    if (!success || !profile) {
        logger.warn(`[Profile Command] Could not fetch profile for user ${userId}. Error: ${error}. Sending default message.`);
        const defaultMessage = `Агент, твой кибернетический профиль готов к просмотру. Здесь ты найдешь свою статистику, достижения и перки.`;
        const buttons: KeyboardButton[][] = [[{ text: "📊 Открыть Профиль", url: profileLink }]];
        await sendComplexMessage(chatId, defaultMessage, buttons, { keyboardType: 'inline' });
        return;
    }

    const statsMessage = formatProfileStats(profile);
    const fullMessage = `*Профиль Агента: @${username || userId}*\n\n` +
                        `${statsMessage}\n\n` +
                        `Получи полный доступ к своему арсеналу и настройкам через веб-интерфейс.`;

    const buttons: KeyboardButton[][] = [
        [
            { text: "📊 Открыть Профиль", url: profileLink },
            { text: "⚙️ К Настройкам", url: settingsLink }
        ]
    ];
    
    await sendComplexMessage(chatId, fullMessage, buttons, { keyboardType: 'inline' });

  } catch (e) {
      logger.error(`[Profile Command] Critical error for user ${userId}:`, e);
      const errorMessage = `🚨 Произошел сбой при доступе к вашему профилю. Попробуйте позже.`;
      const buttons: KeyboardButton[][] = [[{ text: "Открыть Профиль (аварийно)", url: profileLink }]];
      await sendComplexMessage(chatId, errorMessage, buttons, { keyboardType: 'inline' });
  }
}