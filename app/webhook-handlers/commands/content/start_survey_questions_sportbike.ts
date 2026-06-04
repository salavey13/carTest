/**
 * start_survey_questions_sportbike.ts
 * ====================================
 * Electro-enduro focused onboarding survey for VIP Bike franchise.
 *
 * 5 steps: experience → purpose → bike_style → priority → fz152_consent
 * All answers are electro-bike themed (no ICE sportbike references).
 *
 * Step 5 (fz152_consent) implements the ФЗ-152 personal data consent flow
 * inline — not as a link to an external document, but as a rich Telegram
 * message with the key processing purposes listed and explicit consent buttons.
 *
 * Used by: app/webhook-handlers/commands/start.ts
 * Normalized by: app/franchize/lib/onboarding/survey-normalizer.ts
 */

export interface SurveyQuestion {
  step: number;
  key: string;
  question: string;
  answers?: { text: string }[];
  free_answer?: boolean;
  /** If true, this step uses a multi-message flow (consent text + buttons) */
  isMultiMessage?: boolean;
  /** Pre-message sent before the question (e.g., consent text) */
  preMessage?: string;
}

// ─── ФЗ-152 Consent Text ─────────────────────────────────────────────────────
//
// Inline consent summary — all key data processing purposes stated clearly.
// This replaces a raw link to a GitHub-hosted document with an interactive,
// readable consent flow that the user can understand right in Telegram.
//
// Russian Federal Law No. 152-FZ "On Personal Data" requires:
// 1. Informed, specific, conscious consent
// 2. Clear listing of processing purposes
// 3. Right to withdraw consent at any time

const FZ152_CONSENT_PREMESSAGE = [
  "📋 *СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ*",
  "",
  "В соответствии с ФЗ-152 от 27.07.2006, даёте согласие _ИП Воробьеву Р.В._ на обработку ваших персональных данных:",
  "",
  "✅ _Цели обработки:_",
  "• Заключение и исполнение договора аренды транспорта",
  "• Идентификация личности арендатора",
  "• Формирование и подписание договоров аренды",
  "• Верификация водительского удостоверения",
  "• Уведомление о статусе аренды и напоминания",
  "",
  "📦 _Данные:_ ФИО, дата рождения, паспорт, ВУ, телефон, email",
  "",
  "🔒 _Способы:_ Бумажный и электронный учёт, облачные хранилища (РФ)",
  "",
  "⏳ _Срок:_ До отзыва согласия, но не менее 3 лет с момента аренды",
  "",
  "✋ Вы можете отозвать согласие в любой момент через /profile",
].join("\n");

export const surveyQuestions: SurveyQuestion[] = [
  {
    step: 1,
    key: "experience",
    question: "Какой у тебя опыт езды на электробайках?",
    answers: [
      { text: "Новичок (ещё не пробовал электро)" },
      { text: "Опытный (1-3 сезона на электротяге)" },
      { text: "Профи (3+ сезона, уверен в управлении)" },
      { text: "Только права получил" },
    ],
  },
  {
    step: 2,
    key: "purpose",
    question: "Зачем тебе электробайк?",
    answers: [
      { text: "Городские поездки и коммутика" },
      { text: "Эндуро и бездорожье" },
      { text: "Загородные маршруты и дальние поездки" },
      { text: "Прокатить и понять — стоит ли покупать" },
    ],
  },
  {
    step: 3,
    key: "bike_style",
    question: "Какой стиль электробайка тебе ближе?",
    answers: [
      { text: "Электроэндуро (лёгкий, внедорожный)" },
      { text: "Электроспорт (мощный, быстрый, обтекаемый)" },
      { text: "Электро-турист (комфорт, дальнобой, багаж)" },
      { text: "Нео-ретро электро (стиль, харизма, фотогеничный)" },
    ],
  },
  {
    step: 4,
    key: "priority",
    question: "Что для тебя важнее всего в электробайке?",
    answers: [
      { text: "Запас хода и автономность" },
      { text: "Динамика и ускорение" },
      { text: "Внешний вид и внимание на дороге" },
      { text: "Комфорт посадки и тишина хода" },
    ],
  },
  {
    step: 5,
    key: "fz152_consent",
    question: "Ознакомившись с условиями выше, даёте ли вы согласие на обработку персональных данных?",
    isMultiMessage: true,
    preMessage: FZ152_CONSENT_PREMESSAGE,
    answers: [
      { text: "✅ Да, даю согласие" },
      { text: "❌ Не даю согласие" },
    ],
  },
];

/** Map of question key → Russian label for admin notifications */
export const answerTexts: Record<string, string> = {
  experience: "Опыт",
  purpose: "Цель",
  bike_style: "Стиль байка",
  priority: "Приоритет",
  fz152_consent: "Согласие ФЗ-152",
};