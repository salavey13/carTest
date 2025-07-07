import { sendTelegramMessage, notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

interface SurveyState {
  user_id: number;
  current_step: number;
  answers: Record<string, string>;
}

const surveyQuestions = [
  {
    step: 1,
    key: "purpose",
    question: "👋 Привет, Агент! Рад видеть тебя в штабе CyberVibe. Чтобы я мог помочь тебе максимально эффективно, скажи, **какая твоя основная цель здесь?**",
    answers: [
      { text: "👨‍💻 Я хочу кодить/контрибьютить", callback_data: "dev" },
      { text: "🚀 У меня есть идея/проект", callback_data: "idea" },
      { text: "🤔 Просто изучаю, что за Vibe", callback_data: "explore" },
    ],
  },
  {
    step: 2,
    key: "experience",
    question: "Отлично! А какой у тебя **опыт в разработке**, если не секрет? Это поможет подобрать задачи по твоему скиллу.",
    answers: [
      { text: "👶 Я нуб, но хочу учиться", callback_data: "newbie" },
      { text: "😎 Кое-что умею (Junior/Middle)", callback_data: "dev" },
      { text: "🤖 Я и есть машина (Senior+)", callback_data: "senior" },
      { text: "💡 Я не кодер, я идеолог", callback_data: "idea_only" },
    ],
  },
  {
    step: 3,
    key: "motive",
    question: "Понял. И последний вопрос: **что для тебя самое важное в проекте?**",
    answers: [
      { text: "💸 Заработать", callback_data: "money" },
      { text: "🎓 Научиться новому", callback_data: "learn" },
      { text: "🕹️ Получить фан и погонять AI", callback_data: "fun" },
      { text: "🌍 Изменить мир, очевидно", callback_data: "world" },
    ],
  },
];

const sendOrEditQuestion = async (chatId: string, state: SurveyState, messageId?: number) => {
  const questionData = surveyQuestions.find(q => q.step === state.current_step);
  if (!questionData) return; // Should not happen

  const text = questionData.question;
  const inline_keyboard = [questionData.answers.map(a => ({ ...a, callback_data: `survey_${questionData.step}_${a.callback_data}` }))];

  const payload = {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard },
    parse_mode: 'Markdown',
  };

  const url = messageId
    ? `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`
    : `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  if (messageId) {
    (payload as any).message_id = messageId;
  }
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

const handleSurveyCompletion = async (chatId: string, state: SurveyState, messageId: number, username?: string) => {
  const { answers, user_id } = state;

  // 1. Save final results
  const { error: insertError } = await supabaseAdmin.from("user_surveys").insert({
    user_id,
    username: username || "unknown",
    survey_data: answers,
  });
  if (insertError) logger.error(`[StartCommand] Failed to save final survey for user ${user_id}:`, insertError);

  // 2. Delete temporary state
  const { error: deleteError } = await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);
  if (deleteError) logger.error(`[StartCommand] Failed to delete survey state for user ${user_id}:`, deleteError);

  // 3. Notify admin
  const adminSummary = `🚨 **Новый Агент прошел онбординг!**\n- **User:** @${username || user_id} (${user_id})\n- **Цель:** ${answers.purpose || 'не указана'}\n- **Опыт:** ${answers.experience || 'не указан'}\n- **Мотивация:** ${answers.motive || 'не указан'}`;
  await notifyAdmin(adminSummary);

  // 4. Send final message to user
  const summary = `✅ **Опрос Завершен!**\nТвои ответы записаны. Исходя из них, вот твои **рекомендованные точки входа:**`;
  const baseUrl = getBaseUrl();
  let buttons = [];
  if (answers.purpose === 'Я хочу кодить/контрибьютить') {
    buttons.push([{ text: "🛠️ В SUPERVIBE Studio", url: `${baseUrl}/repo-xml` }]);
    buttons.push([{ text: "🚀 Начать Тренировку", url: `${baseUrl}/start-training` }]);
  } else {
    buttons.push([{ text: "🗺️ Карта Проекта", url: baseUrl }]);
    buttons.push([{ text: "🔥 Горячие Вайбы", url: `${baseUrl}/hotvibes` }]);
  }
  buttons.push([{ text: "📚 Все Инструктажи", callback_data: "request_howto" }]);

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: summary, reply_markup: { inline_keyboard: buttons }, parse_mode: 'Markdown' }),
  });
};

export async function startCommand(chatId: number, userId: number, username?: string, callbackQuery?: any) {
  logger.info(`[StartCommandV2] Triggered by user ${userId}. Is callback: ${!!callbackQuery}`);

  if (!callbackQuery) {
    // === NEW SURVEY START ===
    const { data: completedSurvey, error: completedError } = await supabaseAdmin.from("user_surveys").select('id').eq('user_id', userId).maybeSingle();
    if (completedError) logger.error(`[StartCommandV2] Error checking for completed survey for user ${userId}`, completedError);
    if (completedSurvey) {
        await sendTelegramMessage(`С возвращением, Агент! Ты уже проходил опрос. Твои гайды ждут тебя по команде /howto`, [], undefined, String(chatId));
        return;
    }

    const { data: existingState, error: stateError } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userId).maybeSingle();
    if (stateError) logger.error(`[StartCommandV2] Error fetching existing state for user ${userId}`, stateError);
    
    const state = existingState || { user_id: userId, current_step: 1, answers: {} };
    await sendOrEditQuestion(String(chatId), state);
  } else {
    // === SURVEY IN PROGRESS (CALLBACK) ===
    const message = callbackQuery.message;
    const [prefix, stepStr, answer] = callbackQuery.data.split('_');
    if (prefix !== 'survey') return; // Not a survey callback
    const step = parseInt(stepStr);

    const { data: currentState, error: fetchError } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userId).maybeSingle();
    if (fetchError || !currentState) {
      logger.error(`[StartCommandV2] Could not fetch state for user ${userId} on callback.`, fetchError);
      await sendTelegramMessage("Произошла ошибка состояния. Пожалуйста, начни заново с /start.", [], undefined, String(chatId));
      return;
    }
    
    const questionData = surveyQuestions.find(q => q.step === step);
    if (!questionData) return; // Invalid step

    const answerText = questionData.answers.find(a => a.callback_data === answer)?.text;
    const newAnswers = { ...currentState.answers, [questionData.key]: answerText || answer };
    const nextStep = step + 1;

    const updatedState: SurveyState = { ...currentState, current_step: nextStep, answers: newAnswers };

    if (nextStep > surveyQuestions.length) {
      await handleSurveyCompletion(String(chatId), updatedState, message.message_id, username);
    } else {
      const { error: updateError } = await supabaseAdmin.from("user_survey_state").upsert(updatedState);
      if (updateError) {
        logger.error(`[StartCommandV2] Failed to update state for user ${userId}`, updateError);
        return;
      }
      await sendOrEditQuestion(String(chatId), updatedState, message.message_id);
    }
  }
}

// Separate handler for non-survey callbacks that might be on the final message
export async function handleStartCallback(chatId: number, userId: number, callbackData: string) {
    if (callbackData === 'request_howto') {
        await howtoCommand(chatId, userId);
    }
}