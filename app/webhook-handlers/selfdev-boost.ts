import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const selfDevBoostHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "selfdev_boost",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    const boostType = invoice.metadata?.boost_type;
    const updates: Record<string, any> = {};

    const boostEffects = {
      priority_review: { has_priority_review: true, message: "PR влетает в прод за 24 часа!" },
      cyber_extractor_pro: { has_cyber_extractor_pro: true, message: "Дерево файлов и AI-подсказки твои!" },
      custom_command: { has_custom_command: true, message: "Напиши мне, что добавить в бота!" },
      ai_code_review: { has_ai_code_review: true, message: "Grok теперь твой ревьюер!" },
      neon_avatar: { has_neon_avatar: true, message: "Твой аватар теперь светится неоном!" },
      vibe_session: { has_vibe_session: true, message: "Скоро созвонимся по VIBE!" },
      ar_tour_generator: { has_ar_tour_generator: true, message: "AR-туры для тачек в деле!" },
      code_warp_drive: { has_code_warp_drive: true, message: "Бот пишет фичу за 12 часов!" },
      cyber_garage_key: { has_cyber_garage_key: true, message: "VIP-доступ к гаражу открыт!" },
      tsunami_rider: { has_tsunami_rider: true, message: "Ты теперь Tsunami Rider, элита!" },
      bot_overclock: { has_bot_overclock: true, message: "Бот на двойной скорости 30 дней!" },
      neural_tuner: { has_neural_tuner: true, message: "Нейросеть подбирает тачки по вайбу!" },
      repo_stealth_mode: { has_repo_stealth_mode: true, message: "Твои PR теперь в стелс-режиме!" },
      glitch_fx_pack: { has_glitch_fx_pack: true, message: "Глитч-эффекты для UI в кармане!" },
      infinite_extract: { has_infinite_extract: true, message: "Экстракция без лимитов!" },
    };

    const effect = boostEffects[boostType];
    if (!effect) throw new Error(`Unknown boost type: ${boostType}`);

    // Update user metadata
    await supabase
      .from("users")
      .update({
        metadata: {
          ...userData.metadata,
          ...effect,
        },
      })
      .eq("user_id", userId);

    // Notify user
    await sendTelegramMessage(telegramToken, `🔥 ${effect.message} Ты в игре, братан!`, [], undefined, userId);

    // Notify admin
    await sendTelegramMessage(
      telegramToken,
      `🤑 ${userData.username || userId} купил ${boostType} за ${totalAmount} XTR!`,
      [],
      undefined,
      adminChatId
    );
  },
};