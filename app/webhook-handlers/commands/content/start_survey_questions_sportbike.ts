/**
 * start_survey_questions_sportbike.ts
 * ====================================
 * Electro-enduro focused onboarding survey for VIP Bike franchise.
 *
 * 5 steps: experience → purpose → bike_style → priority → terms_agreement
 * All answers are electro-bike themed (no ICE sportbike references).
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
}

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
    key: "terms_agreement",
    question: "Готов оформить аренду или покупку прямо сейчас?",
    answers: [
      { text: "Да, я готов(а)!" },
      { text: "Нужно подумать" },
    ],
  },
];

/** Map of question key → Russian label for admin notifications */
export const answerTexts: Record<string, string> = {
  experience: "Опыт",
  purpose: "Цель",
  bike_style: "Стиль байка",
  priority: "Приоритет",
  terms_agreement: "Готовность",
};