/**
 * start-enhanced.ts
 * =================
 * Enhanced /start command handler with:
 *   - Structured payload parsing (entry.electro, promo.NEON2026, buy.surron)
 *   - Raw signal persistence ONLY (no ui_profile cache)
 *   - onboarding_context with timestamps (for intent decay)
 *   - Behavioral signal initialization
 *   - Payload hints available for pre-survey landing personalization
 *
 * CRITICAL CHANGE vs v1:
 *   We do NOT persist a derived ui_profile to metadata.
 *   The profile is ALWAYS derived at runtime by resolve-profile.ts.
 *   This ensures that resolver logic improvements apply immediately
 *   to all users, and stale profiles don't persist outdated segments.
 *
 * MIGRATION NOTES:
 *   - Old payloads (VIPSTART, ref_CODE) still work — parser handles them
 *   - metadata.ui_profile is NO LONGER WRITTEN — safe to ignore old values
 *   - Components should use resolve-profile.ts, never read ui_profile directly
 */

"use server";

import { notifyAdmin, updateUserSettings } from "@/app/actions";
import { supabaseAnon, createOrUpdateUser } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { grantFranchizeAchievementAction } from "@/app/franchize/profile-actions";
import { surveyQuestions, answerTexts } from "./content/start_survey_questions_bike";

// ── Import from onboarding pipeline ──
import { parseStartPayload, extractPromoCode } from "@/app/franchize/lib/onboarding/payload-parser";
import { normalizeSurveyToProfile } from "@/app/franchize/lib/onboarding/survey-normalizer";
import type { VipBikeUserMetadata, BehaviorSignals } from "@/app/franchize/lib/onboarding/experience-types";
import { PROFILE_RESOLVER_VERSION } from "@/app/franchize/lib/onboarding/resolve-profile";
import { EXPERIENCE_RESOLVER_VERSION } from "@/app/franchize/lib/onboarding/resolve-experience";

// ─────────────────────────────────────────────────────
// Survey state type
// ─────────────────────────────────────────────────────

interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
}

// ─────────────────────────────────────────────────────
// Survey version — bump when questions change
// ─────────────────────────────────────────────────────

const SURVEY_VERSION = "bike-v1";

// ─────────────────────────────────────────────────────
// ENHANCED: Survey completion — persist raw signals only
// ─────────────────────────────────────────────────────

const handleSurveyCompletion = async (
  chatId: number,
  state: SurveyState,
  username?: string,
  payloadRaw?: string,
) => {
  const { answers, user_id } = state;

  // Save to survey-specific table
  await supabaseAnon.from("user_surveys").insert({
    user_id,
    username: username || "unknown",
    survey_data: answers,
  });

  // Delete the temporary state
  await supabaseAnon.from("user_survey_state").delete().eq("user_id", user_id);

  // ── Compute profile at runtime for admin logging ──
  // NOTE: We do NOT persist this profile. It's for logging only.
  // The client re-derives it at runtime from raw signals.
  const parsedPayload = payloadRaw ? parseStartPayload(`/start ${payloadRaw}`) : null;
  const onboardingContext = {
    completedAt: new Date().toISOString(),
    version: SURVEY_VERSION,
    entryPoint: "telegram:start" as const,
    profileResolverVersion: PROFILE_RESOLVER_VERSION,
    experienceResolverVersion: EXPERIENCE_RESOLVER_VERSION,
  };

  const profile = normalizeSurveyToProfile(
    answers,
    null, // no behavior signals yet at survey completion time
    parsedPayload,
    true,
    onboardingContext,
  );

  logger.info(
    `[SurveyCompletion] user=${user_id} segment=${profile.segment} intent=${profile.intent} experience=${profile.experience} confidence=${profile.confidence.toFixed(2)}`,
  );

  // ── PERSIST RAW SIGNALS ONLY ──
  // No derived ui_profile. No cached segment/intent.
  // The client derives profile at runtime from these raw signals.
  //
  // Resolver versions are persisted for OBSERVABILITY only.
  // They do NOT control logic — the client always runs latest code.
  //
  // behavior_signals: FULL initialization with all counters at 0.
  // This ensures a consistent data shape (fix for C3 type lie).
  // The client resolver uses ?? 0 everywhere, but consistency matters.
  await updateUserSettings(user_id, {
    survey_results: answers,
    onboarding_context: onboardingContext,
    behavior_signals: {
      viewedElectroCount: 0,
      viewedSportCount: 0,
      viewedRetroCount: 0,
      openedMapCount: 0,
      buyIntentClickCount: 0,
      rentIntentClickCount: 0,
      lastMapInteractionAt: undefined,
      lastBuyInteractionAt: undefined,
      lastRentInteractionAt: undefined,
      scannedQrModels: [],
      investSectionViewSeconds: 0,
      lastActiveAt: new Date().toISOString(),
    } satisfies BehaviorSignals,
    // Initialize experience_lock for anti-thrashing.
    // Stores RAW profile signals (not derived preset name).
    // The client updates this after resolving the experience.
    experience_lock: {
      lastChangedAt: new Date().toISOString(),
      lastResolvedSegment: profile.segment,
      lastResolvedIntent: profile.intent,
      lastResolvedExperience: profile.experience,
      stabilityCount: 0,
    },
  });

  // Franchize achievement
  await grantFranchizeAchievementAction({
    slug: "vip-bike",
    userId: user_id,
    achievementId: "onboarding_survey_completed",
    source: "telegram:/start",
    context: { survey: "bike", via: "start_command", version: SURVEY_VERSION },
    incrementCounters: { onboardingCompletions: 1 },
  });

  // Admin notification with profile info (derived at runtime, not persisted)
  let adminSummary = `🚲 *Новый Райдер в Системе!*\n- *User:* @${username || user_id} (${user_id})\n`;
  for (const key in answers) {
    adminSummary += `- *${answerTexts[key] || key}:* ${answers[key] || "—"}\n`;
  }
  adminSummary += `\n📊 *Профиль (runtime):* ${profile.segment}/${profile.intent}/${profile.experience} (confidence: ${profile.confidence.toFixed(2)})`;
  await notifyAdmin(adminSummary);

  // User summary with personalized next-step
  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";

  let summary = `✅ *Профиль настроен.*\nМы зафиксировали параметры твоей вело-анкеты:\n`;
  for (const key in answers) {
    summary += `- *${answerTexts[key] || key}:* ${answers[key] || "—"}\n`;
  }

  const nextStepHint = deriveNextStepHint(profile);
  summary += `\n${nextStepHint}`;
  summary += `\n\n⌨️ Клавиатура скрыта. \n\nИспользуй /howto для инструкций или открывай приложение, чтобы начать работу.`;
  summary += `\n\n👇 *Твой центр управления:*`;

  await sendComplexMessage(chatId, summary, [
    [{ text: "🚀 Открыть VIP Bike (Web App)", url: botUrl }],
  ], { removeKeyboard: true });
};

/**
 * Derives a personalized hint for what the user should do next.
 */
function deriveNextStepHint(profile: {
  segment: string;
  intent: string;
  experience: string;
}): string {
  if (profile.intent === "buy") {
    return "🎯 Следующий шаг: подбери байк в каталоге — система уже настроила фильтры под твой запрос.";
  }
  if (profile.intent === "community") {
    return "🗺️ Следующий шаг: загляни на карту — рядом райдеры и точки встреч.";
  }
  if (profile.experience === "beginner") {
    return "🛡️ Следующий шаг: безопасный первый выезд с экипировкой и сопровождением.";
  }
  if (profile.segment === "electro") {
    return "⚡ Следующий шаг: изучи электро-эндуро — тихая мощь нового поколения.";
  }
  return "🏍️ Следующий шаг: открой приложение — всё уже настроено под тебя.";
}

// ─────────────────────────────────────────────────────
// MAIN: startCommand handler
// ─────────────────────────────────────────────────────

export async function startCommand(chatId: number, userId: number, from_user: any, text?: string) {
  const parsed = parseStartPayload(text);
  const promoCode = extractPromoCode(parsed.raw);
  const onboardingBranch = parsed.raw
    ? `start_with_payload:${parsed.type}`
    : "plain_start:vip-bike";

  logger.info(`[StartCommand Bike] User: ${userId}, Text: "${text}"`);
  logger.info(
    `[StartCommand Audit] user=${userId} payload_type=${parsed.type} code=${parsed.code} promo=${promoCode ?? "none"} onboarding_branch=${onboardingBranch}`,
  );

  const userIdStr = String(userId);
  const username = from_user.username;

  // Ensure user exists
  const user = await createOrUpdateUser(userIdStr, {
    username: from_user.username,
    first_name: from_user.first_name,
    last_name: from_user.last_name,
    language_code: from_user.language_code,
  });

  if (!user) {
    logger.error(`[StartCommand] Failed to create/find user ${userIdStr}.`);
    await sendComplexMessage(chatId, "⚠️ Ошибка доступа к базе данных. Попробуйте позже.", [], { removeKeyboard: true });
    return;
  }

  // ── Persist raw signals EARLY for pre-survey personalization ──
  // The landing page can use these hints to show relevant content
  // even BEFORE the user answers a single survey question.
  // ⚠️ NO derived profile is persisted. Only raw signals.
  const earlyMetadata: Partial<VipBikeUserMetadata> = {};

  if (promoCode) {
    earlyMetadata.onboarding_promo_code = promoCode;
  }

  if (parsed.raw) {
    earlyMetadata.onboarding_start_payload = parsed.raw;
  }

  // Initialize behavior_signals with consistent shape (fix for C3).
  // Only set when there's early metadata to persist.
  // This ensures the client resolver sees a consistent BehaviorSignals shape.
  if (Object.keys(earlyMetadata).length > 0) {
    earlyMetadata.behavior_signals = {
      viewedElectroCount: 0,
      viewedSportCount: 0,
      viewedRetroCount: 0,
      openedMapCount: 0,
      buyIntentClickCount: 0,
      rentIntentClickCount: 0,
      scannedQrModels: [],
      investSectionViewSeconds: 0,
      lastActiveAt: new Date().toISOString(),
    } satisfies BehaviorSignals;

    const updateResult = await updateUserSettings(userIdStr, earlyMetadata);
    if (!updateResult.success) {
      logger.warn(`[StartCommand] Failed to persist early signals for ${userIdStr}: ${updateResult.error ?? "unknown"}`);
    }
  }

  // ── Route based on parsed payload ──
  // FIX for C1: Use parsed.command (now properly typed) instead of
  // non-existent parsed.command from before.
  // parsed.command === "/start" means user typed /start (with or without payload).
  // parsed.type === "bare" && !parsed.code means plain /start with no payload.
  const isPlainStart = parsed.command === "/start" && parsed.type === "bare" && !parsed.code;

  if (isPlainStart) {
    // Reset previous survey state (re-onboarding)
    await supabaseAnon.from("user_survey_state").delete().eq("user_id", userIdStr);
    await supabaseAnon.from("user_surveys").delete().eq("user_id", userIdStr);

    const { data: newState, error } = await supabaseAnon
      .from("user_survey_state")
      .insert({ user_id: userIdStr, current_step: 1, answers: {} })
      .select()
      .single();

    if (error || !newState) {
      logger.error("[StartCommand] Failed to init survey state", error);
      return;
    }

    const question = surveyQuestions.find((q) => q.step === newState.current_step)!;
    const buttons = question.answers ? question.answers.map((a) => [{ text: a.text }]) : [];

    await sendComplexMessage(chatId, question.question, buttons, {
      keyboardType: question.answers ? "reply" : "remove",
    });
  } else {
    // Handle Answer (user is in the middle of a survey)
    const { data: currentState } = await supabaseAnon
      .from("user_survey_state")
      .select("*")
      .eq("user_id", userIdStr)
      .maybeSingle();

    if (!currentState) {
      // No active survey — if user sent text that's not a /start command,
      // redirect them to /start
      if (!parsed.command) {
        await sendComplexMessage(
          chatId,
          "Система в режиме ожидания. Нажми /start, чтобы начать заново, или открой меню.",
          [],
          { removeKeyboard: true },
        );
      }
      return;
    }

    const currentQuestion = surveyQuestions.find((q) => q.step === currentState.current_step)!;

    // Validation
    if (currentQuestion.answers && !currentQuestion.free_answer) {
      const isValidAnswer = currentQuestion.answers.some((a) => a.text === text);
      if (!isValidAnswer) {
        const buttons = currentQuestion.answers.map((a) => [{ text: a.text }]);
        await sendComplexMessage(
          chatId,
          `⛔ Некорректный ввод.\nПожалуйста, выбери вариант из меню:\n\n${currentQuestion.question}`,
          buttons,
          { keyboardType: "reply" },
        );
        return;
      }
    }

    const newAnswers = { ...currentState.answers, [currentQuestion.key]: text };
    const nextStep = currentState.current_step + 1;

    if (nextStep > surveyQuestions.length) {
      await handleSurveyCompletion(chatId, { ...currentState, answers: newAnswers }, username, parsed.raw);
    } else {
      await supabaseAnon
        .from("user_survey_state")
        .update({ current_step: nextStep, answers: newAnswers })
        .eq("user_id", userIdStr);
      const nextQuestion = surveyQuestions.find((q) => q.step === nextStep)!;
      const buttons = nextQuestion.answers ? nextQuestion.answers.map((a) => [{ text: a.text }]) : [];
      await sendComplexMessage(chatId, nextQuestion.question, buttons, {
        keyboardType: nextQuestion.answers ? "reply" : "remove",
      });
    }
  }
}