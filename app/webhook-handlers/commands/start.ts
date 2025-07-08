import { sendTelegramMessage, notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";
import { howtoCommand } from "./howto"; // Import the howto command to call it directly

// Defines the structure of our survey state in the database
interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
  message_id?: number; // To keep track of the message to edit
}

// The questions for our onboarding survey. Emojis added for Vibe.
const surveyQuestions = [
  {
    step: 1,
    key: "purpose",
    question: "👋 Привет, Агент! Рад видеть тебя в штабе CyberVibe. Чтобы я мог помочь тебе максимально эффективно, скажи, **какая твоя основная цель здесь?**",
    answers: [
      { text: "👨‍💻 Хочу кодить/контрибьютить", callback_data: "dev" },
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

// Sends a new question or edits the existing one.
const sendOrEditQuestion = async (chatId: string, state: SurveyState, messageId?: number) => {
  const questionData = surveyQuestions.find(q => q.step === state.current_step);
  if (!questionData) return null; // No more questions

  const text = questionData.question;
  const inline_keyboard = [questionData.answers.map(a => ({ ...a, callback_data: `survey_${questionData.step}_${a.callback_data}` }))];

  const payload: any = { chat_id: chatId, text, reply_markup: { inline_keyboard }, parse_mode: 'Markdown' };
  const endpoint = messageId ? `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText` : `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  if (messageId) payload.message_id = messageId;
  
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  return data.ok ? data.result : null;
};

// Handles the final step of the survey.
const handleSurveyCompletion = async (chatId: string, state: SurveyState, messageId: number, username?: string) => {
  const { answers, user_id } = state;

  // 1. Save final results to the main survey table
  await supabaseAdmin.from("user_surveys").upsert({
    user_id,
    username: username || "unknown",
    survey_data: answers,
  }, { onConflict: 'user_id' });

  // 2. Delete the temporary state
  await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);

  // 3. Notify admin
  const adminSummary = `🚨 **Новый Агент прошел онбординг!**\n- **User:** @${username || user_id} (${user_id})\n- **Цель:** ${answers.purpose || 'не указана'}\n- **Опыт:** ${answers.experience || 'не указан'}\n- **Мотивация:** ${answers.motive || 'не указан'}`;
  await notifyAdmin(adminSummary);

  // 4. Send final message to user, editing the last question message
  const summary = `✅ **Опрос Завершен!**\nТвои ответы записаны. Исходя из них, вот твои **рекомендованные точки входа:**`;
  const baseUrl = getBaseUrl();
  const buttons = [];
  if (answers.purpose === 'Я хочу кодить/контрибьютить') {
    buttons.push([{ text: "🛠️ В SUPERVIBE Studio", url: `${baseUrl}/repo-xml` }]);
    buttons.push([{ text: "🚀 Начать Тренировку", url: `${baseUrl}/start-training` }]);
  } else {
    buttons.push([{ text: "🗺️ Карта Проекта", url: baseUrl }]);
    buttons.push([{ text: "🔥 Горячие Вайбы", url: `${baseUrl}/hotvibes` }]);
  }
  buttons.push([{ text: "📚 Все Инструктажи (Команда /howto)", callback_data: "request_howto" }]);

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: summary, reply_markup: { inline_keyboard: buttons }, parse_mode: 'Markdown' }),
  });
};

// Main command handler for /start and survey callbacks
export async function startCommand(chatId: number, userId: number, username?: string, callbackQuery?: any) {
  logger.info(`[StartCommandV4] Triggered by user ${userId}. Is callback: ${!!callbackQuery}`);
  const userIdStr = String(userId);

  if (!callbackQuery) {
    const { data: completedSurvey } = await supabaseAdmin.from("user_surveys").select('id').eq('user_id', userIdStr).maybeSingle();
    if (completedSurvey) {
        await sendTelegramMessage(`С возвращением, Агент! Ты уже проходил опрос. Твои гайды ждут тебя по команде /howto`, [], undefined, String(chatId));
        return;
    }

    const initialMessage = await sendOrEditQuestion(String(chatId), { user_id: userIdStr, current_step: 1, answers: {} });
    if (initialMessage?.message_id) {
        await supabaseAdmin.from("user_survey_state").upsert({ user_id: userIdStr, current_step: 1, answers: {}, message_id: initialMessage.message_id });
    }
  } else {
    const message = callbackQuery.message;
    const [prefix, stepStr, answer] = callbackQuery.data.split('_');
    if (prefix !== 'survey') return;
    const step = parseInt(stepStr);

    const { data: currentState, error: fetchError } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();
    if (fetchError || !currentState) {
      await sendTelegramMessage("Произошла ошибка состояния. Пожалуйста, начни заново с /start.", [], undefined, String(chatId));
      return;
    }
    
    const questionData = surveyQuestions.find(q => q.step === step);
    if (!questionData) return;

    const answerText = questionData.answers.find(a => a.callback_data === answer)?.text;
    const newAnswers = { ...currentState.answers as object, [questionData.key]: answerText || answer };
    const nextStep = step + 1;

    const updatedState: SurveyState = { ...currentState, current_step: nextStep, answers: newAnswers };

    if (nextStep > surveyQuestions.length) {
      await handleSurveyCompletion(String(chatId), updatedState, message.message_id, username);
    } else {
      await supabaseAdmin.from("user_survey_state").upsert(updatedState);
      await sendOrEditQuestion(String(chatId), updatedState, message.message_id);
    }
  }
}

// Handles callbacks that are NOT part of the survey itself
export async function handleStartCallback(chatId: number, userId: number, callbackData: string) {
    if (callbackData === 'request_howto') {
        // Now it calls the command directly, which sends the rich message
        await howtoCommand(chatId, userId);
    }
}