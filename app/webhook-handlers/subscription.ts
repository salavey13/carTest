import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger"; 
import { updateUserSubscription } from "@/hooks/supabase";

export const subscriptionHandler: WebhookHandler = {
  canHandle: (invoice) => 
    invoice.type === "subscription_cyberfitness" || 
    invoice.type === "subscription_warehouse" ||
    invoice.type === "service_setup" ||
    invoice.type === "service_training",

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, _baseUrl) => {
    logger.log(`[SubscriptionHandler] Processing for user ${userId}, invoice ID: ${invoice.id}, type: ${invoice.type}`);

    const purchasedSubscriptionId = invoice.metadata?.subscription_id as string | undefined;
    const purchasedSubscriptionName = invoice.metadata?.subscription_name as string | undefined;
    const serviceType = invoice.metadata?.service_type as string | undefined;
    const expectedPriceXTR = invoice.metadata?.subscription_price_stars as number | undefined;

    // Handle service payments (one-time setup/training)
    if (invoice.type === "service_setup" || invoice.type === "service_training") {
      await handleServicePayment(invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, serviceType);
      return;
    }

    // Handle subscription payments
    if (!purchasedSubscriptionId || !purchasedSubscriptionName) {
      logger.error(`[SubscriptionHandler] Critical: subscription_id or subscription_name missing in invoice metadata for invoice ${invoice.id}. Metadata:`, invoice.metadata);
      await sendTelegramMessage(
        `🚨 ОШИБКА ОБРАБОТКИ ПОДПИСКИ для ${userData.username || userId}! ID подписки не найден в метаданных инвойса ${invoice.id}. Свяжитесь с поддержкой.`,
        [], undefined, userId
      );
      await sendTelegramMessage(
        `🚫 КРИТИЧЕСКАЯ ОШИБКА: ID/Имя подписки не найдены в метаданных инвойса ${invoice.id} для пользователя ${userId}. Сумма: ${totalAmount} XTR. Metadata: ${JSON.stringify(invoice.metadata)}`,
        [], undefined, adminChatId
      );
      return; 
    }

    if (expectedPriceXTR !== undefined && totalAmount !== expectedPriceXTR) {
        logger.warn(`[SubscriptionHandler] Price mismatch for invoice ${invoice.id}! Expected ${expectedPriceXTR} XTR, got ${totalAmount} XTR. Proceeding with ID: ${purchasedSubscriptionId}`);
    }

    // Update user's subscription_id using the hook
    const updateResult = await updateUserSubscription(userId, purchasedSubscriptionId);

    if (!updateResult.success || !updateResult.data) {
      logger.error(`[SubscriptionHandler] Failed to update user ${userId} with subscription ${purchasedSubscriptionId}:`, updateResult.error);
      await sendTelegramMessage(
        `⚠️ Произошла ошибка при обновлении вашего плана до "${purchasedSubscriptionName}". Пожалуйста, свяжитесь с поддержкой, указав ID транзакции: ${invoice.id}`,
        [], undefined, userId
      );
      await sendTelegramMessage(
        `🚫 ОШИБКА ОБНОВЛЕНИЯ ПОЛЬЗОВАТЕЛЯ ${userId} после оплаты подписки ${purchasedSubscriptionId} (${purchasedSubscriptionName}). Инвойс: ${invoice.id}. Ошибка: ${updateResult.error}`,
        [], undefined, adminChatId
      );
      return; 
    }
    
    // Set appropriate role and status based on subscription type and ID
    let userStatusUpdatePayload: { role?: string; status?: string; metadata?: any } = {};
    
    if (invoice.type === "subscription_warehouse") {
      // Warehouse management subscriptions
      switch (purchasedSubscriptionId) {
        case "warehouse_free":
          userStatusUpdatePayload.role = "warehouse_user";
          userStatusUpdatePayload.status = "active";
          userStatusUpdatePayload.metadata = { 
            ...userData.metadata,
            plan_limits: { 
              max_articles: 100, 
              max_warehouses: 1, 
              max_employees: 3,
              features: ['basic_sync', 'telegram_ui', 'csv_reports']
            }
          };
          break;
        case "warehouse_pro":
          userStatusUpdatePayload.role = "warehouse_pro";
          userStatusUpdatePayload.status = "active_paid";
          userStatusUpdatePayload.metadata = { 
            ...userData.metadata,
            plan_limits: { 
              max_articles: 500, 
              max_warehouses: 3, 
              max_employees: 10,
              features: ['full_sync', 'shift_management', 'advanced_reports', 'warehouse_visualization', 'priority_support']
            }
          };
          break;
        case "warehouse_enterprise":
          userStatusUpdatePayload.role = "warehouse_enterprise";
          userStatusUpdatePayload.status = "active_premium";
          userStatusUpdatePayload.metadata = { 
            ...userData.metadata,
            plan_limits: { 
              max_articles: -1, // unlimited
              max_warehouses: -1, // unlimited
              max_employees: -1, // unlimited
              features: ['all_features', 'ai_analytics', 'custom_integrations', 'dedicated_manager', 'custom_development']
            }
          };
          break;
      }
    } else if (invoice.type === "subscription_cyberfitness") {
      // Cyberfitness subscriptions (existing logic)
      if (purchasedSubscriptionId === "vibe_launch_co_pilot_intro") {
        userStatusUpdatePayload.role = "co_pilot_subscriber";
        userStatusUpdatePayload.status = "active_paid";
      } else if (purchasedSubscriptionId === "qbi_matrix_mastery_wowtro") {
        userStatusUpdatePayload.role = "qbi_master";
        userStatusUpdatePayload.status = "active_premium";
      }
      
      // Admin override for testing
      if (totalAmount === 420 && purchasedSubscriptionId === "qbi_matrix_mastery_wowtro") {
        logger.warn(`[SubscriptionHandler] Admin override triggered for user ${userId} with amount 420 XTR on QBI plan.`);
        userStatusUpdatePayload.role = "admin";
        userStatusUpdatePayload.status = "admin";
      }
    }

    // Update user role/status if needed
    if (Object.keys(userStatusUpdatePayload).length > 0) {
        const updateData: any = {};
        if (userStatusUpdatePayload.role) updateData.role = userStatusUpdatePayload.role;
        if (userStatusUpdatePayload.status) updateData.status = userStatusUpdatePayload.status;
        if (userStatusUpdatePayload.metadata) updateData.metadata = userStatusUpdatePayload.metadata;

        const { error: updateStatusError } = await supabase
            .from("users")
            .update(updateData)
            .eq("user_id", userId);
            
        if (updateStatusError) {
             logger.error(`[SubscriptionHandler] Failed to update user ${userId} role/status for subscription ${purchasedSubscriptionId}:`, updateStatusError);
        } else {
            logger.log(`[SubscriptionHandler] User ${userId} role/status updated for subscription ${purchasedSubscriptionId}.`);
        }
    }

    // Send success messages
    let userMessage = "";
    let adminMessage = "";

    if (invoice.type === "subscription_warehouse") {
      userMessage = `🎉 Отлично! Ваш тариф "${purchasedSubscriptionName}" успешно активирован! Теперь у вас есть доступ ко всем функциям плана. Начните работу с вашим складом прямо сейчас!`;
      adminMessage = `🔔 Новый клиент склада! Пользователь ${userData.username || userId} (${userId}) активировал тариф: "${purchasedSubscriptionName}" (Сумма: ${totalAmount} XTR).`;
    } else {
      userMessage = `🎉 VIBE Активирован! Ваша CyberVibe OS успешно обновлена до уровня: "${purchasedSubscriptionName}"! Погружайтесь в новые возможности, Агент!`;
      adminMessage = `🔔 Апгрейд! Пользователь ${userData.username || userId} (${userId}) успешно обновил CyberVibe OS до: "${purchasedSubscriptionName}" (Сумма: ${totalAmount} XTR).`;
    }

    logger.log(`[SubscriptionHandler] User ${userId} successfully upgraded to subscription: ${purchasedSubscriptionName} (ID: ${purchasedSubscriptionId}).`);

    await sendTelegramMessage(
      userMessage,
      [],
      undefined,
      userId
    );

    await sendTelegramMessage(
      adminMessage,
      [],
      undefined,
      adminChatId
    );

    // For warehouse subscriptions, send additional onboarding information
    if (invoice.type === "subscription_warehouse" && purchasedSubscriptionId !== "warehouse_free") {
      setTimeout(async () => {
        const onboardingMessage = `📦 *Добро пожаловать в систему управления складом!*

Чтобы начать работу:
1. Создайте свой первый склад в разделе "Экипажи"
2. Добавьте товары через CSV-импорт или вручную
3. Настройте интеграции с маркетплейсами
4. Пригласите сотрудников в систему

Нужна помощь с настройкой? Мы предлагаем услугу быстрой настройки за 20 000₽ - напишите "настройка" для подробностей.`;
        
        await sendTelegramMessage(
          onboardingMessage,
          [],
          undefined,
          userId
        );
      }, 2000);
    }
  },
};

// Handle one-time service payments (setup, training)
async function handleServicePayment(
  invoice: any, 
  userId: string, 
  userData: any, 
  totalAmount: number, 
  supabase: any, 
  telegramToken: string, 
  adminChatId: string, 
  serviceType?: string
) {
  const serviceName = invoice.metadata?.service_name as string || "Услуга";
  const serviceDetails = invoice.metadata?.service_details as string || "";

  logger.log(`[ServiceHandler] Processing service payment for user ${userId}, service: ${serviceType}, amount: ${totalAmount} XTR`);

  // Update user metadata to track purchased services
  const currentMetadata = userData.metadata || {};
  const purchasedServices = currentMetadata.purchased_services || [];
  
  const newService = {
    id: invoice.id,
    type: serviceType,
    name: serviceName,
    amount: totalAmount,
    purchased_at: new Date().toISOString(),
    details: serviceDetails,
    status: 'pending_activation'
  };

  purchasedServices.push(newService);

  const { error: updateError } = await supabase
    .from("users")
    .update({
      metadata: {
        ...currentMetadata,
        purchased_services: purchasedServices
      }
    })
    .eq("user_id", userId);

  if (updateError) {
    logger.error(`[ServiceHandler] Failed to update user ${userId} with service purchase:`, updateError);
    await sendTelegramMessage(
      `⚠️ Произошла ошибка при обработке вашей оплаты за услугу "${serviceName}". Свяжитесь с поддержкой, указав ID транзакции: ${invoice.id}`,
      [], undefined, userId
    );
    return;
  }

  // Send confirmation messages
  let userServiceMessage = "";
  let adminServiceMessage = "";

  switch (serviceType) {
    case "quick_setup":
      userServiceMessage = `🚀 Отлично! Вы приобрели услугу "Быстрая настройка" за ${totalAmount} XTR. Наш специалист свяжется с вами в течение 24 часов для согласования деталей настройки вашего склада.`;
      adminServiceMessage = `🔔 Новая заявка на настройку! Пользователь ${userData.username || userId} (${userId}) оплатил быструю настройку. Сумма: ${totalAmount} XTR.`;
      break;
    case "team_training":
      userServiceMessage = `👨‍🏫 Прекрасно! Вы приобрели услугу "Обучение команды" за ${totalAmount} XTR. Наш тренер свяжется с вами для согласования времени проведения обучения.`;
      adminServiceMessage = `🔔 Новая заявка на обучение! Пользователь ${userData.username || userId} (${userId}) оплатил обучение команды. Сумма: ${totalAmount} XTR.`;
      break;
    default:
      userServiceMessage = `✅ Спасибо за оплату услуги "${serviceName}"! Наша команда свяжется с вами в ближайшее время.`;
      adminServiceMessage = `🔔 Новая оплата услуги! Пользователь ${userData.username || userId} (${userId}) оплатил услугу "${serviceName}". Сумма: ${totalAmount} XTR.`;
  }

  await sendTelegramMessage(
    userServiceMessage,
    [],
    undefined,
    userId
  );

  await sendTelegramMessage(
    adminServiceMessage,
    [],
    undefined,
    adminChatId
  );

  logger.log(`[ServiceHandler] Service payment processed successfully for user ${userId}, service: ${serviceType}`);
}