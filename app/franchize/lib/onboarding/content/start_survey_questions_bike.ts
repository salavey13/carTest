export interface SurveyQuestion {
  step: number;
  key: string;
  question: string;
  answers?: { text: string }[];
  free_answer?: boolean;
}

export const answerTexts: Record<string, string> = {
  experience: "Опыт на электротяге",
  purpose: "Цель поездок",
  bike_style: "Формат электробайка",
  priority: "Главный приоритет",
  terms_agreement: "Согласие с условиями",
};

export const surveyQuestions: SurveyQuestion[] = [
  {
    step: 1,
    key: "experience",
    question: "Привет! 👋 Чтобы подобрать лучший электробайк под тебя, расскажи про свой опыт. Как давно катаешься?",
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
    question: "Для чего берёшь электробайк?",
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
    question: "Какой формат электробайка тебе ближе?",
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
    question: "Что для тебя главное в электробайке?",
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
    question: "Последний шаг: ты понимаешь правила аренды электробайка и готов нести ответственность за управление? (Ознакомься с условиями по ссылке)[https://github.com/salavey13/cartest/blob/main/LICENSE]",
    answers: [
      { text: "Да, готов(а)!" },
      { text: "Нужно подумать" },
    ],
  },
];