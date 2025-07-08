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
  message_id?: number | null; // Now explicitly allows null
}

const surveyQuestions = [
  { step: 1, key: "purpose", question: "👋 Привет, Агент! Рад видеть тебя в штабе CyberVibe. Чтобы я мог помочь тебе максимально эффективно, скажи, **какая твоя основная цель здесь?**", answers: [ { text: "👨‍💻 Хочу кодить/контрибьютить", callback_data: "dev" }, { text: "🚀 У меня есть идея/проект", callback_data: "idea" }, { text: "🤔 Просто изучаю, что за Vibe", callback_data: "explore" } ]},
  { step: 2, key: "experience", question: "Отлично! А какой у тебя **опыт в разработке**, если не секрет? Это поможет подобрать задачи по твоему скиллу.", answers: [ { text: "👶 Я нуб, но хочу учиться", callback_data: "newbie" }, { text: "😎 Кое-что умею (Junior/Middle)", callback_data: "dev" }, { text: "🤖 Я и есть машина (Senior+)", callback_data: "senior" }, { text: "💡 Я не кодер, я идеолог", callback_data: "idea_only" } ]},
  { step: 3, key: "motive", question: "Понял. И последний вопрос: **что для тебя самое важное в проекте?**", answers: [ { text: "💸 Заработать", callback_data: "money" }, { text: "🎓 Научиться новому", callback_data: "learn" }, { text: "🕹️ Получить фан и погонять AI", callback_data: "fun" }, { text: "🌍 Изменить мир, очевидно", callback_data: "world" } ]},
];

const handleSurveyCompletion = async (chatId: number, state: SurveyState, messageId: number, username?: string) => {
  const { answers, user_id } = state;

  await supabaseAdmin.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  // Do not delete the state here, it will be cleaned up on next /start or automatically.

  const adminSummary = `🚨 **Новый Агент прошел онбординг!**\n- **User:** @${username || user_id} (${user_id})\n- **Цель:** ${answers.purpose || 'не указана'}\n- **Опыт:** ${answers.experience || 'не указан'}\n- **Мотивация:** ${answers.motive || 'не указан'}`;
  await notifyAdmin(adminSummary);

  const summary = `✅ **Опрос Завершен!**\nТвои ответы записаны. Исходя из них, вот твои **рекомендованные точки входа:**`;
  const baseUrl = getBaseUrl();
  const buttons: InlineButton[][] = [];
  
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

export async function startCommand(chatId: number, userId: number, username?: string, callbackQuery?: any, isReset: boolean = false) {
  logger.info(`[StartCommand] Triggered by user ${userId}. Is callback: ${!!callbackQuery}. Is reset: ${isReset}`);
  const userIdStr = String(userId);

  if (isReset) {
      logger.info(`[StartCommand] Resetting survey state for user ${userIdStr}.`);
      await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
      await supabaseAdmin.from("user_surveys").delete().eq('user_id', userIdStr);
  }

  if (!callbackQuery) {
    // === Handle initial /start command with robust state handling ===
    const { data: completedSurvey } = await supabaseAdmin.from("user_surveys").select('id').eq('user_id', userIdStr).maybeSingle();
    if (completedSurvey && !isReset) {
        await sendComplexMessage(chatId, `С возвращением, Агент! Ты уже проходил опрос. Твои гайды ждут тебя по команде /howto. \n\nЧтобы начать опрос заново, используй команду /start reset`);
        return;
    }
    
    let { data: state, error: stateError } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();
    if (stateError) {
        logger.error(`[StartCommand] Error fetching user state for ${userIdStr}:`, stateError);
        await sendComplexMessage(chatId, "🚨 Произошла ошибка базы данных. Попробуйте позже.");
        return;
    }

    if (!state) {
        const { data: newState, error: insertError } = await supabaseAdmin
            .from("user_survey_state")
            .insert({ user_id: userIdStr, current_step: 1, answers: {}, message_id: null })
            .select()
            .single();
        if (insertError || !newState) {
            logger.error(`[StartCommand] Error creating initial state for ${userIdStr}:`, insertError);
            await sendComplexMessage(chatId, "🚨 Не удалось начать опрос. Попробуйте /start еще раз.");
            return;
        }
        state = newState;
    }

    const questionData = surveyQuestions.find(q => q.step === state!.current_step);
    if (!questionData) {
      await sendComplexMessage(chatId, "🚨 Ошибка в логике опроса. Сбрасываю состояние. Попробуй /start reset.");
      await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
      return;
    }
    
    const text = questionData.question;
    const buttons = [questionData.answers.map(a => ({ ...a, callback_data: `survey_${questionData.step}_${a.callback_data}` }))];

    const result = await sendComplexMessage(chatId, text, buttons, undefined, state.message_id || undefined);

    if (result.success && result.data?.result?.message_id && !state.message_id) {
        const newMessageId = result.data.result.message_id;
        await supabaseAdmin.from("user_survey_state").update({ message_id: newMessageId }).eq('user_id', userIdStr);
    }

  } else {
    // === Handle survey button presses (callback queries) ===
    const message = callbackQuery.message;
    const [prefix, stepStr, answer] = callbackQuery.data.split('_');
    if (prefix !== 'survey') return;

    const step = parseInt(stepStr);
    const { data: currentState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();
    
    if (!currentState) {
      await sendComplexMessage(chatId, "Не могу найти твою сессию опроса. Возможно, она устарела. Начни заново с /start reset.", [], undefined, message.message_id);
      return;
    }

    if (currentState.current_step !== step) {
      await sendComplexMessage(chatId, "Произошла ошибка состояния или вы ответили на старое сообщение. Пожалуйста, начните заново с /start reset.", [], undefined, message.message_id);
      await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
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
      await supabaseAdmin.from("user_survey_state").update(updatedState).eq('user_id', userIdStr);
      const nextQuestion = surveyQuestions.find(q => q.step === nextStep)!;
      const nextButtons = [nextQuestion.answers.map(a => ({ ...a, callback_data: `survey_${nextQuestion.step}_${a.callback_data}` }))];
      await sendComplexMessage(chatId, nextQuestion.question, nextButtons, undefined, message.message_id);
    }
  }
}

export async function handleStartCallback(chatId: number, userId: number, callbackQuery: any) {
    if (callbackQuery.data === 'request_howto') {
        const messageId = callbackQuery.message?.message_id;
        await howtoCommand(chatId, userId, messageId);
    }
}