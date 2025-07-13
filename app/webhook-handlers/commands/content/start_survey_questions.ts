export interface SurveyQuestion {
  step: number;
  key: string;
  question: string;
  answers?: { text: string }[]; // Optional predefined answers
  free_answer?: boolean; // Flag to allow free-form answers
}

export const answerTexts: Record<string, string> = {
  purpose: "Цель",
  experience: "Опыт",
  motive: "Мотивация",
}

export const surveyQuestions: SurveyQuestion[] = [
  {
    step: 1,
    key: "purpose",
    question: "👋 Привет, Агент! Рад видеть тебя в штабе CyberVibe. Чтобы я мог помочь тебе максимально эффективно, скажи, **какая твоя основная цель здесь?**",
    answers: [{ text: "👨‍💻 Хочу кодить/контрибьютить" }, { text: "🚀 У меня есть идея/проект" }, { text: "🤔 Просто изучаю, что за Vibe" }],
    free_answer: true, // Allow free-form answers
  },
  {
    step: 2,
    key: "experience",
    question: "Отлично! А какой у тебя **опыт в разработке**, если не секрет? Это поможет подобрать задачи по твоему скиллу.",
    answers: [{ text: "👶 Я нуб, но хочу учиться" }, { text: "😎 Кое-что умею (Junior/Middle)" }, { text: "🤖 Я и есть машина (Senior+)" }, { text: "💡 Я не кодер, я идеолог" }],
    free_answer: true, // Allow free-form answers
  },
  {
    step: 3,
    key: "motive",
    question: "Понял. И последний вопрос: **что для тебя самое важное в проекте?**",
    answers: [{ text: "💸 Заработать" }, { text: "🎓 Научиться новому" }, { text: "🕹️ Получить фан и погонять AI" }, { text: "🌍 Изменить мир, очевидно" }],
    free_answer: true, // Allow free-form answers
  },
];