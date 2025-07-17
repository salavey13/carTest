import { notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";
import { howtoCommand } from "./howto";
import { sendComplexMessage, deleteTelegramMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { surveyQuestions, SurveyQuestion, answerTexts } from "./content/start_survey_questions_sportbike"; // Import the SPORTBIKE questions


interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
  message_id?: number | null;
}


const handleSurveyCompletion = async (chatId: number, state: SurveyState, username?: string) => {
  const { answers, user_id } = state;


  await supabaseAdmin.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);


  let adminSummary = `🚨 **Новый Райдер прошел онбординг!**\n- **User:** @${username || user_id} (${user_id})\n`;
  for (const key in answers) {
    adminSummary += `- **${answerTexts[key] || key}:** ${answers[key] || 'не указана'}\n`;
  }
  await notifyAdmin(adminSummary);


  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneSitePlsBot/app";
  let summary = `✅ **Опрос Завершен!**\nТвои предпочтения записаны. Спасибо!\n`;
  for (const key in answers) {
    summary += `- **${answerTexts[key] || key}:** ${answers[key] || 'не указана'}\n`;
  }
  summary += `\n\nТеперь клавиатура убрана. Используй /howto, чтобы получить рекомендованные гайды, или /help для списка всех команд.`;
  summary += `\n\n👉 Готов выбрать байк?  Посети наш мото-гараж: ${botUrl}`;  // Add call to action
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
    const buttons = question.answers ? question.answers.map(a => ([{ text: a.text }])) : [];  // Handle no predefined answers


    await sendComplexMessage(chatId, question.question, buttons, { keyboardType: question.answers ? 'reply' : 'remove' }); // Conditionally show keyboard


  } else {
    // This is not a /start command, so it must be an answer to a question.
    const { data: currentState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();


    if (!currentState) {
      // No active survey for this user. The command handler will show the "unknown command" message.
      logger.warn(`[StartCommand V4] Received text "${text}" from user ${userId} but no active survey found.`);
      return;
    }


    const currentQuestion = surveyQuestions.find(q => q.step === currentState.current_step)!;


    if (currentQuestion.answers && !currentQuestion.free_answer) { // Validate only if predefined answers exist AND free answer is not allowed
      const isValidAnswer = currentQuestion.answers.some(a => a.text === text);


      if (!isValidAnswer) {
        logger.warn(`[StartCommand V4] Invalid answer "${text}" for step ${currentState.current_step}. Resending question.`);
        const buttons = currentQuestion.answers.map(a => ([{ text: a.text }]));