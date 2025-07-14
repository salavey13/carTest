export interface SurveyQuestion {
  step: number;
  key: string;
  question: string;
  answers?: { text: string }[];
  free_answer?: boolean;
}

export const answerTexts: Record<string, string> = {
  purpose: "Цель",
  driving_style: "Стиль вождения",
  priority: "Приоритет",
  engine_sound: "Звук мотора",
  terms_agreement: "Согласие",
};

export const surveyQuestions: SurveyQuestion[] = [
  {
    step: 1,
    key: "purpose",
    question: "Привет, будущий пилот! 🚀 Чтобы подобрать твою идеальную кибер-тачку, ответь на пару вопросов. Для чего тебе машина?",
    answers: [
      { text: "Для ежедневных поездок по городу" },
      { text: "Для гонок на треке" },
      { text: "Для дальних путешествий" },
      { text: "Чтобы произвести впечатление" },
    ],
  },
  {
    step: 2,
    key: "driving_style",
    question: "Какой стиль вождения предпочитаешь?",
    answers: [
      { text: "Агрессивный и быстрый" },
      { text: "Спокойный и размеренный" },
      { text: "Эффективный и технологичный" },
      { text: "Максимально комфортный" },
    ],
  },
  {
    step: 3,
    key: "priority",
    question: "Что для тебя важнее в машине?",
    answers: [
      { text: "Запредельная скорость" },
      { text: "Футуристичный дизайн" },
      { text: "Роскошный комфорт" },
      { text: "Передовые технологии и ИИ" },
    ],
  },
  {
    step: 4,
    key: "engine_sound",
    question: "Какой звук мотора тебе по душе?",
    answers: [
      { text: "Рёв V12" },
      { text: "Свист турбины" },
      { text: "Бесшумность электротяги" },
      { text: "Сбалансированный звук спорткара" },
    ],
  },
    {
    step: 5,
    key: "terms_agreement",
    question: "Последний шаг: ты готов принять риски и ответственность, связанные с управлением кибер-зверем? (Ознакомься с условиями по ссылке)",
    answers: [
      { text: "Я готов(а) к скорости!" },
      { text: "Пока не уверен(а)" },
    ],
  },
];