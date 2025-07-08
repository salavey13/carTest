import { notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";
import { howtoCommand } from "./howto";
import { sendComplexMessage, InlineButton } from "../actions/sendComplexMessage";

interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
  message_id?: number;
}

const surveyQuestions = [
  { step: 1, key: "purpose", question: "👋 Привет, Агент! Рад видеть тебя в штабе CyberVibe. Чтобы я мог помочь тебе максимально эффективно, скажи, **какая твоя основная цель здесь?**", answers: [ { text: "👨‍💻 Хочу кодить/контрибьютить", callback_data: "dev" }, { text: "🚀 У меня есть идея/проект", callback_data: "idea" }, { text: "🤔 Просто изучаю, что за Vibe", callback_data: "explore" } ]},
  { step: 2, key: "experience", question: "Отлично! А какой у тебя **опыт в разработке**, если не секрет? Это поможет подобрать задачи по твоему скиллу.", answers: [ { text: "👶 Я нуб, но хочу учиться", callback_data: "newbie" }, { text: "😎 Кое-что умею (Junior/Middle)", callback_data: "dev" }, { text: "🤖 Я и есть машина (Senior+)", callback_data: "senior" }, { text: "💡 Я не кодер, я идеолог", callback_data: "idea_only" } ]},
  { step: 3, key: "motive", question: "Понял. И последний вопрос: **что для тебя самое важное в проекте?**", answers: [ { text: "💸 Заработать", callback_data: "money" }, { text: "🎓 Научиться новому", callback_data: "learn" }, { text: "🕹️ Получить фан и погонять AI", callback_data: "fun" }, { text: "🌍 Изменить мир, очевидно", callback_data: "world" } ]},
];

const handleSurveyCompletion = async (chatId: number, state: SurveyState, messageId: number, username?: string) => {
  const { answers, user_id } = state;

  await supabaseAdmin.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);

  const adminSummary = `🚨 **Новый Агент прошел онбординг!**\n- **User:** @${username || user_id} (${user_id})\n- **Цель:** ${answers.purpose || 'не указана'}\n- **Опыт:** ${answers.experience || 'не указан'}\n- **Мотивация:** ${answers.motive || 'не указан'}`;
  await notifyAdmin(adminSummary);

  const summary = `✅ **Опрос Завершен!**\nТвои ответы записаны. Исходя из них, вот твои **рекомендованные точки входа:**`;
  const baseUrl = getBaseUrl();
  const buttons: InlineButton[][] = [];
  
  // ✅ Fixed: Comparison now includes the emoji, matching the button text exactly.
  if (answers.purpose === '👨‍💻 Хочу кодить/контрибьютить') {
    buttons.push([{ text: "🛠️ В SUPERVIBE Studio", url: `${baseUrl}/repo-xml` }]);
    buttons.push([{ text: "🚀 Начать Тренировку", url: `${baseUrl}/start-training` }]);
  } else {
    buttons.push([{ text: "🗺️ Карта Проекта", url: baseUrl }]);
    buttons.push([{ text: "🔥 Горячие Вайбы", url: `${baseUrl}/hotvibes` }]);
  }
  buttons.push([{ text: "📚 Все Инструктажи", callback_data: "request_howto" }]);

  await sendComplexMessage(chatId, summary, buttons, undefined, messageId);
};

export async function startCommand(chatId: number, userId: number, username?: string, callbackQuery?: any) {
  logger.info(`[StartCommand_FIXED] Triggered by user ${userId}. Is callback: ${!!callbackQuery}`);
  const userIdStr = String(userId);

  if (!callbackQuery) {
    // === Handle initial /start command ===
    const { data: completedSurvey } = await supabaseAdmin.from("user_surveys").select('id').eq('user_id', userIdStr).maybeSingle();
    if (completedSurvey) {
        await sendComplexMessage(chatId, `С возвращением, Агент! Ты уже проходил опрос. Твои гайды ждут тебя по команде /howto.`);
        return;
    }

    const { data: existingState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();
    
    const state: SurveyState = existingState || { user_id: userIdStr, current_step: 1, answers: {} };
    const questionData = surveyQuestions.find(q => q.step === state.current_step);
    if (!questionData) {
      await sendComplexMessage(chatId, "🚨 Ошибка в логике опроса. Попробуй /start еще раз.");
      await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
      return;
    }
    
    const text = questionData.question;
    const buttons = [questionData.answers.map(a => ({ ...a, callback_data: `survey_${questionData.step}_${a.callback_data}` }))];

    const result = await sendComplexMessage(chatId, text, buttons, undefined, state.message_id);

    // ✅ THE CRITICAL FIX: If a new message was sent, capture its ID and save it to the user's state.
    if (result.success && result.data?.result?.message_id && !state.message_id) {
        const newMessageId = result.data.result.message_id;
        await supabaseAdmin.from("user_survey_state").upsert({ ...state, message_id: newMessageId });
    }

  } else {
    // === Handle survey button presses (callback queries) ===
    const message = callbackQuery.message;
    const [prefix, stepStr, answer] = callbackQuery.data.split('_');
    if (prefix !== 'survey') return;

    const step = parseInt(stepStr);
    const { data: currentState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();
    
    if (!currentState || currentState.current_step !== step) {
      await sendComplexMessage(chatId, "Произошла ошибка состояния или вы ответили слишком быстро. Пожалуйста, начните заново с /start.");
      return;
    }
    
    const questionData = surveyQuestions.find(q => q.step === step)!;
    const answerText = questionData.answers.find(a => a.callback_data === answer)?.text;
    const newAnswers = { ...currentState.answers, [questionData.key]: answerText || answer };
    const nextStep = step + 1;
    const updatedState: SurveyState = { ...currentState, current_step: nextStep, answers: newAnswers };

    if (nextStep > surveyQuestions.length) {
      await handleSurveyCompletion(chatId, updatedState, message.message_id, username);
    } else {
      await supabaseAdmin.from("user_survey_state").upsert(updatedState);
      const nextQuestion = surveyQuestions.find(q => q.step === nextStep)!;
      const nextButtons = [nextQuestion.answers.map(a => ({ ...a, callback_data: `survey_${nextQuestion.step}_${a.callback_data}` }))];
      await sendComplexMessage(chatId, nextQuestion.question, nextButtons, undefined, message.message_id);
    }
  }
}

export async function handleStartCallback(chatId: number, userId: number, callbackData: string) {
    if (callbackData === 'request_howto') {
        await howtoCommand(chatId, userId);
    }
}