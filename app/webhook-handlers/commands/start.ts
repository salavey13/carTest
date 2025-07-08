import { notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";
import { howtoCommand } from "./howto";
import { sendComplexMessage, deleteTelegramMessage, KeyboardButton } from "../actions/sendComplexMessage";

interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
  message_id?: number | null;
}

const surveyQuestions = [
  { step: 1, key: "purpose", question: "👋 Привет, Агент! Рад видеть тебя в штабе CyberVibe. Чтобы я мог помочь тебе максимально эффективно, скажи, **какая твоя основная цель здесь?**", answers: [ { text: "👨‍💻 Хочу кодить/контрибьютить" }, { text: "🚀 У меня есть идея/проект" }, { text: "🤔 Просто изучаю, что за Vibe" } ]},
  { step: 2, key: "experience", question: "Отлично! А какой у тебя **опыт в разработке**, если не секрет? Это поможет подобрать задачи по твоему скиллу.", answers: [ { text: "👶 Я нуб, но хочу учиться" }, { text: "😎 Кое-что умею (Junior/Middle)" }, { text: "🤖 Я и есть машина (Senior+)" }, { text: "💡 Я не кодер, я идеолог" } ]},
  { step: 3, key: "motive", question: "Понял. И последний вопрос: **что для тебя самое важное в проекте?**", answers: [ { text: "💸 Заработать" }, { text: "🎓 Научиться новому" }, { text: "🕹️ Получить фан и погонять AI" }, { text: "🌍 Изменить мир, очевидно" } ]},
];

const handleSurveyCompletion = async (chatId: number, state: SurveyState, username?: string) => {
  const { answers, user_id } = state;

  await supabaseAdmin.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);

  const adminSummary = `🚨 **Новый Агент прошел онбординг!**\n- **User:** @${username || user_id} (${user_id})\n- **Цель:** ${answers.purpose || 'не указана'}\n- **Опыт:** ${answers.experience || 'не указан'}\n- **Мотивация:** ${answers.motive || 'не указан'}`;
  await notifyAdmin(adminSummary);

  const summary = `✅ **Опрос Завершен!**\nТвои ответы записаны. Спасибо! Теперь клавиатура убрана. Используй /howto, чтобы получить рекомендованные гайды, или /help для списка всех команд.`;
  
  await sendComplexMessage(chatId, summary, [], { removeKeyboard: true });
};

export async function startCommand(chatId: number, userId: number, username?: string, text?: string) {
  logger.info(`[StartCommand V4 - ReplyKeyboard] User: ${userId}, Text: "${text}"`);
  const userIdStr = String(userId);

  if (text === '/start') {
    await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
    await supabaseAdmin.from("user_surveys").delete().eq('user_id', userIdStr);

    const { data: newState, error } = await supabaseAdmin
        .from("user_survey_state")
        .insert({ user_id: userIdStr, current_step: 1, answers: {} })
        .select().single();
    
    if (error || !newState) {
        logger.error('[StartCommand V4] Failed to create new survey state', error);
        return;
    }

    const question = surveyQuestions.find(q => q.step === newState.current_step)!;
    const buttons = question.answers.map(a => ([{ text: a.text }]));

    await sendComplexMessage(chatId, question.question, buttons, { keyboardType: 'reply' });

  } else {
    // This is not a /start command, so it must be an answer to a question.
    const { data: currentState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();

    if (!currentState) {
      // No active survey for this user. The command handler will show the "unknown command" message.
      logger.warn(`[StartCommand V4] Received text "${text}" from user ${userId} but no active survey found.`);
      return;
    }

    const currentQuestion = surveyQuestions.find(q => q.step === currentState.current_step)!;
    const isValidAnswer = currentQuestion.answers.some(a => a.text === text);

    if (!isValidAnswer) {
      logger.warn(`[StartCommand V4] Invalid answer "${text}" for step ${currentState.current_step}. Resending question.`);
      const buttons = currentQuestion.answers.map(a => ([{ text: a.text }]));
      await sendComplexMessage(chatId, `Неверный ответ. Пожалуйста, выбери один из вариантов на клавиатуре.\n\n${currentQuestion.question}`, buttons, { keyboardType: 'reply' });
      return;
    }

    const newAnswers = { ...currentState.answers, [currentQuestion.key]: text };
    const nextStep = currentState.current_step + 1;
    
    if (nextStep > surveyQuestions.length) {
      // Survey is complete
      await handleSurveyCompletion(chatId, { ...currentState, answers: newAnswers }, username);
    } else {
      // Move to the next question
      await supabaseAdmin.from("user_survey_state").update({ current_step: nextStep, answers: newAnswers }).eq('user_id', userIdStr);
      const nextQuestion = surveyQuestions.find(q => q.step === nextStep)!;
      const buttons = nextQuestion.answers.map(a => ([{ text: a.text }]));
      await sendComplexMessage(chatId, nextQuestion.question, buttons, { keyboardType: 'reply' });
    }
  }
}