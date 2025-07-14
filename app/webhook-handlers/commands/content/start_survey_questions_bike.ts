export interface SurveyQuestion {
  step: number;
  key: string;
  question: string;
  answers?: { text: string }[];
  free_answer?: boolean;
}

export const answerTexts: Record<string, string> = {
  city: "Город",
  rental_frequency: "Как часто планируете брать велосипед?",
  bike_type: "Какой тип велосипеда предпочитаете?",
  purpose: "Цель аренды",
  terms_agreement: "Согласие с условиями",
};

export const surveyQuestions: SurveyQuestion[] = [
  {
    step: 1,
    key: "city",
    question: "Привет! 👋  Начнем знакомство. В каком городе планируете кататься?",
    answers: [
      { text: "Н. Новгород" },
    ],
    free_answer: true,
  },
  {
    step: 2,
    key: "rental_frequency",
    question: "Как часто планируете брать велосипед в аренду?",
    answers: [
      { text: "Регулярно (несколько раз в неделю)" },
      { text: "Иногда (1-2 раза в месяц)" },
      { text: "Редко (пару раз за сезон)" },
      { text: "Пока присматриваюсь" },
    ],
  },
  {
    step: 3,
    key: "bike_type",
    question: "Какой тип велосипеда предпочитаете?",
    answers: [
      { text: "Городской" },
      { text: "Горный" },
      { text: "Электровелосипед" },
      { text: "Детский" },
    ],
  },
  {
    step: 4,
    key: "purpose",
    question: "Для чего вам нужен велосипед?",
    answers: [
      { text: "Для прогулок по городу" },
      { text: "Для фитнеса и тренировок" },
      { text: "Для поездок на работу/учебу" },
      { text: "Для активного отдыха за городом" },
    ],
    free_answer: true,
  },
    {
    step: 5,
    key: "terms_agreement",
    question: "Прежде чем продолжить, пожалуйста, подтвердите, что вы согласны с нашими условиями аренды (ссылка на условия).",
    answers: [
      { text: "Я согласен(а)" },
      { text: "Я не согласен(а)" },
    ],
  },
];

/*Explanation of Changes and Best Practices:

•  More Relevant Questions: The questions are now directly related to bike rentals: city, rental frequency, bike type preference, and purpose.
•  Clear and Concise Language: The questions are written in a friendly and accessible Russian style.
•  Use of Emojis: Emojis are used sparingly to add visual appeal without being distracting.
•  Free-Form and Predefined Answers: The survey mixes free-form answers (like city) with predefined options for ease of use.
•  Terms of Service Agreement: A crucial question to ensure users agree to your rental terms. This demonstrates responsible design. Important: Make sure to replace (ссылка на условия) with an actual URL to your terms of service.
•  Adaptive Questioning: Based on the user's city, you could potentially tailor later questions or offers (e.g., "We have a rental location near you in [City]!"). This is a more advanced feature, but possible with the current structure.
• Onboarding Principles:
  * Start with a welcome message and clear explanation of the survey's purpose.
  * Ask for easily answered and non-intrusive information first (e.g., City).
  * Use a conversational tone.
  * Provide clear and concise answer options.
  * Keep the number of questions reasonable. Too many questions can lead to abandonment.
  * Provide a clear summary of the user's responses at the end.
  * Include a call to action (e.g., "Browse our bikes!", "Visit our website!").*/
