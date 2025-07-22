"use server";

import { notifyAdmin, updateUserSettings } from "@/app/actions";
import { supabaseAdmin, createOrUpdateUser } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";
import { howtoCommand } from "./howto";
import { sendComplexMessage, deleteTelegramMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { surveyQuestions, SurveyQuestion, answerTexts } from "./content/start_survey_questions_sportbike";

interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
  message_id?: number | null;
}

const handleSurveyCompletion = async (chatId: number, state: SurveyState, username?: string) => {
  const { answers, user_id } = state;

  // Save to survey-specific table
  await supabaseAdmin.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  // Delete the temporary state
  await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);
  // NEW: Save results to user's metadata for personalization
  await updateUserSettings(user_id, { survey_results: answers });

  let adminSummary = `🚨 *Новый Райдер прошел онбординг!*\n- *User:* @${username || user_id} (${user_id})\n`;
  for (const key in answers) {
    adminSummary += `- *${answerTexts[key] || key}:* ${answers[key] || 'не указана'}\n`;
  }
  await notifyAdmin(adminSummary);

  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
  let summary = `✅ *Опрос Завершен!*\nТвои предпочтения записаны. Спасибо!\n`;
  for (const key in answers) {
    summary += `- *${answerTexts[key] || key}:* ${answers[key] || 'не указана'}\n`;
  }
  summary += `\n\nТеперь клавиатура убрана. Используй /howto, чтобы получить рекомендованные гайды, или /help для списка всех команд.`;
  summary += `\n\n👉 Готов выбрать байк? Посети наш мото-гараж: ${botUrl}`;
  await sendComplexMessage(chatId, summary, [], { removeKeyboard: true });
};

export async function startCommand(chatId: number, userId: number, from_user: any, text?: string) {
  logger.info(`[StartCommand V5] User: ${userId}, Text: "${text}"`);
  const userIdStr = String(userId);
  const username = from_user.username;

  // --- CRITICAL FIX: Ensure user exists before starting survey ---
  const user = await createOrUpdateUser(userIdStr, {
    username: from_user.username,
    first_name: from_user.first_name,
    last_name: from_user.last_name,
    language_code: from_user.language_code
  });

  if (!user) {
    logger.error(`[StartCommand V5] Failed to create or find user ${userIdStr}. Aborting survey.`);
    await sendComplexMessage(chatId, "Произошла ошибка при регистрации. Не могу начать опрос.", [], { removeKeyboard: true });
    return;
  }
  // --- END FIX ---

  if (text === '/start') {
    await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
    await supabaseAdmin.from("user_surveys").delete().eq('user_id', userIdStr);

    const { data: newState, error } = await supabaseAdmin
      .from("user_survey_state")
      .insert({ user_id: userIdStr, current_step: 1, answers: {} })
      .select().single();

    if (error || !newState) {
      logger.error('[StartCommand V5] Failed to create new survey state', error);
      return;
    }

    const question = surveyQuestions.find(q => q.step === newState.current_step)!;
    const buttons = question.answers ? question.answers.map(a => ([{ text: a.text }])) : [];

    await sendComplexMessage(chatId, question.question, buttons, { keyboardType: question.answers ? 'reply' : 'remove' });

  } else {
    const { data: currentState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();

    if (!currentState) {
      logger.warn(`[StartCommand V5] Received text "${text}" from user ${userId} but no active survey found.`);
      return;
    }

    const currentQuestion = surveyQuestions.find(q => q.step === currentState.current_step)!;

    if (currentQuestion.answers && !currentQuestion.free_answer) {
      const isValidAnswer = currentQuestion.answers.some(a => a.text === text);

      if (!isValidAnswer) {
        logger.warn(`[StartCommand V5] Invalid answer "${text}" for step ${currentState.current_step}. Resending question.`);
        const buttons = currentQuestion.answers.map(a => ([{ text: a.text }]));
        await sendComplexMessage(chatId, `Неверный ответ. Пожалуйста, выбери один из вариантов или введи свой ответ.\n\n${currentQuestion.question}`, buttons, { keyboardType: 'reply' });
        return;
      }
    }

    const newAnswers = { ...currentState.answers, [currentQuestion.key]: text };
    const nextStep = currentState.current_step + 1;

    if (nextStep > surveyQuestions.length) {
      await handleSurveyCompletion(chatId, { ...currentState, answers: newAnswers }, username);
    } else {
      await supabaseAdmin.from("user_survey_state").update({ current_step: nextStep, answers: newAnswers }).eq('user_id', userIdStr);
      const nextQuestion = surveyQuestions.find(q => q.step === nextStep)!;
      const buttons = nextQuestion.answers ? nextQuestion.answers.map(a => ([{ text: a.text }])) : [];
      await sendComplexMessage(chatId, nextQuestion.question, buttons, { keyboardType: nextQuestion.answers ? 'reply' : 'remove' });
    }
  }
}