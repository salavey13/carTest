"use server";

import { notifyAdmin, updateUserSettings } from "@/app/actions";
import { supabaseAdmin, createOrUpdateUser } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "../actions/sendComplexMessage";
// CHANGED IMPORT: Now using warehouse questions
import { surveyQuestions, answerTexts } from "./content/start_survey_questions_warehouse";

interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
}

const handleSurveyCompletion = async (chatId: number, state: SurveyState, username?: string) => {
  const { answers, user_id } = state;

  // Save to survey-specific table
  await supabaseAdmin.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  // Delete the temporary state
  await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);
  // Save results to user's metadata
  await updateUserSettings(user_id, { survey_results: answers });

  // Admin Notification (Warehouse Style)
  let adminSummary = `🏭 *Новый Оператор в Системе!*\n- *User:* @${username || user_id} (${user_id})\n`;
  for (const key in answers) {
    adminSummary += `- *${answerTexts[key] || key}:* ${answers[key] || '—'}\n`;
  }
  await notifyAdmin(adminSummary);

  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
  
  // User Summary (Warehouse Style)
  let summary = `✅ *Профиль настроен.*\nМы зафиксировали параметры твоего склада:\n`;
  for (const key in answers) {
    summary += `- *${answerTexts[key] || key}:* ${answers[key] || '—'}\n`;
  }
  
  summary += `\n\n⌨️ Клавиатура скрыта. \n\nИспользуй /howto для инструкций или открывай приложение, чтобы начать работу.`;
  summary += `\n\n👇 *Твой центр управления:*`;

  // Send summary with a direct button to the App
  await sendComplexMessage(chatId, summary, [
      [{ text: "🚀 Открыть Склад (Web App)", url: botUrl }]
  ], { removeKeyboard: true });
};

export async function startCommand(chatId: number, userId: number, from_user: any, text?: string) {
  logger.info(`[StartCommand Warehouse] User: ${userId}, Text: "${text}"`);
  const userIdStr = String(userId);
  const username = from_user.username;

  // Ensure user exists
  const user = await createOrUpdateUser(userIdStr, {
    username: from_user.username,
    first_name: from_user.first_name,
    last_name: from_user.last_name,
    language_code: from_user.language_code
  });

  if (!user) {
    logger.error(`[StartCommand] Failed to create/find user ${userIdStr}.`);
    await sendComplexMessage(chatId, "⚠️ Ошибка доступа к базе данных. Попробуйте позже.", [], { removeKeyboard: true });
    return;
  }

  if (text === '/start') {
    // Reset previous state
    await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
    await supabaseAdmin.from("user_surveys").delete().eq('user_id', userIdStr);

    const { data: newState, error } = await supabaseAdmin
      .from("user_survey_state")
      .insert({ user_id: userIdStr, current_step: 1, answers: {} })
      .select().single();

    if (error || !newState) {
      logger.error('[StartCommand] Failed to init survey state', error);
      return;
    }

    const question = surveyQuestions.find(q => q.step === newState.current_step)!;
    const buttons = question.answers ? question.answers.map(a => ([{ text: a.text }])) : [];

    await sendComplexMessage(chatId, question.question, buttons, { keyboardType: question.answers ? 'reply' : 'remove' });

  } else {
    // Handle Answer
    const { data: currentState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();

    if (!currentState) {
      // User sent text without an active survey -> redirect to app or restart
      if (text !== '/start') {
         await sendComplexMessage(chatId, "Система в режиме ожидания. Нажми /start, чтобы начать заново, или открой меню.", [], { removeKeyboard: true });
      }
      return;
    }

    const currentQuestion = surveyQuestions.find(q => q.step === currentState.current_step)!;

    // Validation
    if (currentQuestion.answers && !currentQuestion.free_answer) {
      const isValidAnswer = currentQuestion.answers.some(a => a.text === text);
      if (!isValidAnswer) {
        const buttons = currentQuestion.answers.map(a => ([{ text: a.text }]));
        await sendComplexMessage(chatId, `⛔ Некорректный ввод.\nПожалуйста, выбери вариант из меню:\n\n${currentQuestion.question}`, buttons, { keyboardType: 'reply' });
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