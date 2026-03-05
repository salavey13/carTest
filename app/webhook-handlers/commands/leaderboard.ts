import { logger } from "@/lib/logger";
import { supabaseAnon } from "@/hooks/supabase";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import type { GodModeDeck } from "@/app/elon/arbitrage_scanner_types";

interface LeaderboardEntry {
  rank: number;
  username: string;
  totalProfit: number;
  usdtBalance: number;
  isCurrentUser: boolean;
}

export async function leaderboardCommand(chatId: number, userId: string) {
  logger.info(`[Leaderboard] User ${userId} requested leaderboard.`);
  await sendComplexMessage(chatId, "🏆 *Загружаю доску почета...* Анализирую виртуальные состояния трейдеров вселенной...", []);

  try {
    // --- ИСПРАВЛЕНИЕ: Запрашиваем данные из кастомной таблицы 'users' ---
    const { data: users, error } = await supabaseAnon
      .from('users')
      .select('user_id, username, metadata')
      .neq('metadata', null); // Отсеиваем профили без метаданных

    if (error) {
      throw new Error(`Ошибка Supabase при загрузке данных из 'users': ${error.message}`);
    }

    if (!users || users.length === 0) {
      await sendComplexMessage(chatId, "🕳️ *Пустота...* Пока никто не участвовал в симуляции. Будь первым, используй `/sim_go`!", []);
      return;
    }

    const leaderboardData: Omit<LeaderboardEntry, 'rank'>[] = users
      .map(user => {
        const deck = user.metadata?.god_mode_deck as GodModeDeck | undefined;
        if (!deck || typeof deck.total_profit_usd !== 'number') {
          return null;
        }
        return {
          username: user.username || `Агент_${user.user_id.substring(0, 5)}`,
          totalProfit: deck.total_profit_usd,
          usdtBalance: deck.balances?.USDT || 0,
          // --- ИСПРАВЛЕНИЕ: Сравниваем с 'user_id' ---
          isCurrentUser: user.user_id === userId,
        };
      })
      .filter((entry): entry is Omit<LeaderboardEntry, 'rank'> => entry !== null)
      .sort((a, b) => b.totalProfit - a.totalProfit);

    if (leaderboardData.length === 0) {
        await sendComplexMessage(chatId, "🕳️ *Пустота...* Пока никто не получил виртуальный профит. Будь первым, используй `/sim_go`!", []);
        return;
    }

    let userRank: number | null = null;
    const rankedData: LeaderboardEntry[] = leaderboardData.map((entry, index) => {
        const rank = index + 1;
        if (entry.isCurrentUser) {
            userRank = rank;
        }
        return { ...entry, rank };
    });

    const top10 = rankedData.slice(0, 10);

    let message = "🏆 *Доска Лидеров God-Mode (по общему профиту)*\n\n";
    top10.forEach(entry => {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `*${entry.rank}.*`;
        const marker = entry.isCurrentUser ? ' 🎯' : '';
        message += `${medal} *@${entry.username}*${marker}\n` +
                   `   └─ Профит: *$${entry.totalProfit.toFixed(2)}* | Баланс: ${entry.usdtBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n`;
    });
    
    if (userRank && userRank > 10) {
        const currentUserEntry = rankedData.find(e => e.isCurrentUser)!;
        message += `\n...\n` +
                   `*${currentUserEntry.rank}.* *@${currentUserEntry.username}* 🎯\n` +
                   `   └─ Профит: *$${currentUserEntry.totalProfit.toFixed(2)}* | Баланс: ${currentUserEntry.usdtBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
    } else if (!userRank) {
        message += `\n*Твой ранг пока не определен. Соверши сделку с помощью /sim_go, чтобы попасть в список!*`;
    }

    await sendComplexMessage(chatId, message, []);

  } catch (err) {
    const error = err as Error;
    logger.error("[Leaderboard] Error fetching leaderboard data:", error);
    await sendComplexMessage(chatId, `🚨 Ошибка загрузки лидерборда: ${error.message}`, []);
  }
}