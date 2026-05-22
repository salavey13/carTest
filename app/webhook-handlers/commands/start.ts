"use server";

import { notifyAdmin, updateUserSettings } from "@/app/actions";
import { supabaseAnon, createOrUpdateUser } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { grantFranchizeAchievementAction } from "@/app/franchize/profile-actions";
// CHANGED IMPORT: Now using warehouse questions
import { surveyQuestions, answerTexts } from "./content/start_survey_questions_bike";


const parseStartPayload = (text?: string) => {
  if (!text) return { command: "/start", payload: "" };
  const trimmed = text.trim();
  if (!trimmed.startsWith('/start')) return { command: trimmed, payload: "" };

  const [command, ...rest] = trimmed.split(/\s+/);
  return { command, payload: rest.join(' ').trim() };
};

const extractPromoCode = (payload: string): string | null => {
  if (!payload) return null;

  const decodedPayload = decodeURIComponent(payload);
  const token = decodedPayload
    .split(/[^a-zA-Z0-9_-]+/)
    .map((part) => part.trim())
    .find((part) => /^(promo|ref|invite|code)[:=_-]?/i.test(part)) || decodedPayload;

  const normalized = token
    .replace(/^(promo|ref|invite|code)[:=_-]?/i, '')
    .trim()
    .toUpperCase();

  if (!normalized) return null;
  return normalized.slice(0, 64);
};

interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
}

const handleSurveyCompletion = async (chatId: number, state: SurveyState, username?: string) => {
  const { answers, user_id } = state;

  // Save to survey-specific table
  await supabaseAnon.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  // Delete the temporary state
  await supabaseAnon.from("user_survey_state").delete().eq('user_id', user_id);
  // Save results to user's metadata
  await updateUserSettings(user_id, { survey_results: answers });

  /**
   * Franchize capability trigger:
   * - onboarding_survey_completed
   * Source of truth lives in app/franchize/profile-actions.ts (slug-filtered achievements).
   */
  await grantFranchizeAchievementAction({
    slug: "vip-bike",
    userId: user_id,
    achievementId: "onboarding_survey_completed",
    source: "telegram:/start",
    context: { survey: "bike", via: "start_command" },
    incrementCounters: { onboardingCompletions: 1 },
  });

  // Admin Notification (Warehouse Style)
  let adminSummary = `🚲 *Новый Райдер в Системе!*\n- *User:* @${username || user_id} (${user_id})\n`;
  for (const key in answers) {
    adminSummary += `- *${answerTexts[key] || key}:* ${answers[key] || '—'}\n`;
  }
  await notifyAdmin(adminSummary);

  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
  
  // User Summary (Warehouse Style)
  let summary = `✅ *Профиль настроен.*\nМы зафиксировали параметры твоей вело-анкеты:\n`;
  for (const key in answers) {
    summary += `- *${answerTexts[key] || key}:* ${answers[key] || '—'}\n`;
  }
  
  summary += `\n\n⌨️ Клавиатура скрыта. \n\nИспользуй /howto для инструкций или открывай приложение, чтобы начать работу.`;
  summary += `\n\n👇 *Твой центр управления:*`;

  // Send summary with a direct button to the App
  await sendComplexMessage(chatId, summary, [
      [{ text: "🚀 Открыть VIP Bike (Web App)", url: botUrl }]
  ], { removeKeyboard: true });
};

export async function startCommand(chatId: number, userId: number, from_user: any, text?: string) {
  const { command, payload } = parseStartPayload(text);
  const promoCode = extractPromoCode(payload);
  const onboardingBranch = payload ? "start_with_payload:bicycle" : "plain_start:bicycle";

  logger.info(`[StartCommand Bike] User: ${userId}, Text: "${text}"`);
  logger.info(`[StartCommand Audit] user=${userId} promo=${promoCode ?? "none"} onboarding_branch=${onboardingBranch}`);
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

  if (command === '/start') {
    if (promoCode) {
      const promoUpdate = await updateUserSettings(userIdStr, {
        onboarding_promo_code: promoCode,
        onboarding_start_payload: payload,
      });

      if (!promoUpdate.success) {
        logger.warn(`[StartCommand] Failed to persist promo token for ${userIdStr}: ${promoUpdate.error ?? "unknown"}`);
      }
    }
    // Reset previous state
    await supabaseAnon.from("user_survey_state").delete().eq('user_id', userIdStr);
    await supabaseAnon.from("user_surveys").delete().eq('user_id', userIdStr);

    const { data: newState, error } = await supabaseAnon
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
    const { data: currentState } = await supabaseAnon.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();

    if (!currentState) {
      // User sent text without an active survey -> redirect to app or restart
      if (command !== '/start') {
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
      await supabaseAnon.from("user_survey_state").update({ current_step: nextStep, answers: newAnswers }).eq('user_id', userIdStr);
      const nextQuestion = surveyQuestions.find(q => q.step === nextStep)!;
      const buttons = nextQuestion.answers ? nextQuestion.answers.map(a => ([{ text: a.text }])) : [];
      await sendComplexMessage(chatId, nextQuestion.question, buttons, { keyboardType: nextQuestion.answers ? 'reply' : 'remove' });
    }
  }
}
