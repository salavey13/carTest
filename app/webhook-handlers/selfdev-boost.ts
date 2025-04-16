import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger"; // Added logger

export const selfDevBoostHandler: WebhookHandler = {
    // Check invoice type specifically
    canHandle: (invoice, payload) => invoice.type === "selfdev_boost",

    handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
        logger.log(`[SelfDevBoostHandler] Handling selfdev_boost purchase for user ${userId}. Invoice:`, invoice);

        // Extract boost_type safely from metadata
        const boostType = invoice?.metadata?.boost_type;
        logger.log(`[SelfDevBoostHandler] Extracted boost_type: ${boostType}`);

        if (!boostType) {
            logger.error(`[SelfDevBoostHandler] Missing boost_type in metadata for invoice ID ${invoice.id}, user ${userId}. Metadata:`, invoice?.metadata);
            // Notify admin about the missing data
            await sendTelegramMessage(
                telegramToken,
                `🚨 ОШИБКА: Не найден boost_type в metadata для selfdev_boost! Invoice ID: ${invoice.id}, User: ${userId}`,
                [],
                undefined,
                adminChatId
            );
            // Throw an error to indicate failure in the proxy
            throw new Error(`Missing boost_type in metadata for invoice ${invoice.id}`);
        }

        // Define boost effects based on boost_type
        const boostEffects: { [key: string]: { dbField: string; message: string } } = {
            priority_review: { dbField: "has_priority_review", message: "PR влетает в прод за 24 часа!" },
            cyber_extractor_pro: { dbField: "has_cyber_extractor_pro", message: "Дерево файлов и AI-подсказки твои!" },
            custom_command: { dbField: "has_custom_command", message: "Напиши мне, что добавить в бота!" },
            ai_code_review: { dbField: "has_ai_code_review", message: "Grok теперь твой ревьюер!" },
            neon_avatar: { dbField: "has_neon_avatar", message: "Твой аватар теперь светится неоном!" },
            vibe_session: { dbField: "has_vibe_session", message: "Скоро созвонимся по VIBE!" },
            ar_tour_generator: { dbField: "has_ar_tour_generator", message: "AR-туры для тачек в деле!" },
            code_warp_drive: { dbField: "has_code_warp_drive", message: "Бот пишет фичу за 12 часов!" },
            cyber_garage_key: { dbField: "has_cyber_garage_key", message: "VIP-доступ к гаражу открыт!" },
            tsunami_rider: { dbField: "has_tsunami_rider", message: "Ты теперь Tsunami Rider, элита!" },
            bot_overclock: { dbField: "has_bot_overclock", message: "Бот на двойной скорости 30 дней!" },
            neural_tuner: { dbField: "has_neural_tuner", message: "Нейросеть подбирает тачки по вайбу!" },
            repo_stealth_mode: { dbField: "has_repo_stealth_mode", message: "Твои PR теперь в стелс-режиме!" },
            glitch_fx_pack: { dbField: "has_glitch_fx_pack", message: "Глитч-эффекты для UI в кармане!" },
            infinite_extract: { dbField: "has_infinite_extract", message: "Экстракция без лимитов!" },
        };

        const effect = boostEffects[boostType];

        if (!effect) {
             logger.error(`[SelfDevBoostHandler] Unknown boost type: ${boostType} for user ${userId}, invoice ${invoice.id}.`);
             await sendTelegramMessage(
                 telegramToken,
                 `⚠️ ПРЕДУПРЕЖДЕНИЕ: Неизвестный boost_type '${boostType}'! Invoice ID: ${invoice.id}, User: ${userId}`,
                 [],
                 undefined,
                 adminChatId
             );
             // Don't throw an error, maybe log and proceed or handle gracefully
             // For now, let's just log and not update anything specific for this unknown boost
             return;
             // throw new Error(`Unknown boost type: ${boostType}`);
        }

        // Prepare the update object for the metadata field
        const metadataUpdate = {
             ...userData.metadata, // Keep existing metadata
             [effect.dbField]: true, // Add or update the specific boost flag
        };
        logger.log(`[SelfDevBoostHandler] Prepared metadata update for user ${userId}:`, metadataUpdate);

        try {
            // Update user metadata using 'upsert' might be safer if user row might not exist?
            // But since payment happened, user *should* exist. Let's stick to update.
            const { error: updateError } = await supabase
                .from("users")
                .update({ metadata: metadataUpdate })
                .eq("user_id", userId);

             if (updateError) {
                 logger.error(`[SelfDevBoostHandler] Error updating metadata for user ${userId} with boost ${boostType}:`, updateError);
                 throw updateError; // Re-throw to be caught by the proxy
             }
             logger.log(`[SelfDevBoostHandler] Successfully updated metadata for user ${userId} with boost ${boostType}.`);


             // Notify user
             await sendTelegramMessage(
                telegramToken,
                `🔥 ${effect.message} Ты в игре, ${userData.first_name || 'братан'}!`, // Personalized greeting
                [],
                undefined,
                userId
             );
             logger.log(`[SelfDevBoostHandler] Sent boost confirmation to user ${userId}.`);

             // Notify admin
             await sendTelegramMessage(
                telegramToken,
                `🤑 ${userData.username || userId} купил буст "${boostType}" за ${totalAmount} XTR!`,
                [],
                undefined,
                adminChatId
             );
             logger.log(`[SelfDevBoostHandler] Notified admin about boost purchase for user ${userId}.`);

        } catch (error) {
            logger.error(`[SelfDevBoostHandler] Error processing boost ${boostType} for user ${userId}:`, error);
            // Re-throw error to be handled by the main proxy handler
            throw error;
        }
    },
};