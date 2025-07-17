export interface SurveyQuestion {
  step: number;
  key: string;
  question: string;
  answers?: { text: string }[];
  free_answer?: boolean;
}

export const answerTexts: Record<string, string> = {
  experience: "Опыт вождения",
  purpose: "Цель поездок",
  bike_style: "Стиль байка",
  priority: "Главный приоритет",
  terms_agreement: "Согласие с условиями",
};

export const surveyQuestions: SurveyQuestion[] = [
  {
    step: 1,
    key: "experience",
    question: "Привет, райдер! 🏍️ Чтобы подобрать тебе идеальный спортбайк, нужно понять твой уровень. Какой у тебя опыт вождения?",
    answers: [
      { text: "Новичок (до 1 года)" },
      { text: "Опытный (1-3 года)" },
      { text: "Профи (3+ лет)" },
      { text: "Только что получил права" },
    ],
  },
  {
    step: 2,
    key: "purpose",
    question: "Где планируешь жечь резину?",
    answers: [
      { text: "В городе, между рядами" },
      { text: "На гоночном треке" },
      { text: "На извилистых загородных дорогах" },
      { text: "Для дальних поездок" },
    ],
  },
  {
    step: 3,
    key: "bike_style",
    question: "Какой тип байка тебе ближе по духу?",
    answers: [
      { text: "Агрессивный нейкед (стритфайтер)" },
      { text: "Суперспорт (обтекатели, поза эмбриона)" },
      { text: "Спорт-турист (мощность и комфорт)" },
      { text: "Нео-ретро (стиль и харизма)" },
    ],
  },
  {
    step: 4,
    key: "priority",
    question: "Что для тебя главное в байке?",
    answers: [
      { text: "Бешеное ускорение и адреналин" },
      { text: "Острая управляемость и маневренность" },
      { text: "Внешний вид и внимание на дороге" },
      { text: "Удобство посадки и технологии" },
    ],
  },
  {
    step: 5,
    key: "terms_agreement",
    question: "Последний шаг: ты осознаешь все риски и готов нести ответственность за управление мощным спортбайком? (Ознакомься с условиями по ссылке)[https://github.com/salavey13/cartest/blob/main/LICENSE]",
    answers: [
      { text: "Да, я готов(а)!" },
      { text: "Нужно подумать" },
    ],
  },
];
