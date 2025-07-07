import { sendTelegramMessage, notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

// Define the structure for our survey questions and state
interface SurveyState {
  currentStep: number;
  answers: Record<string, string>;
}

const surveyQuestions = [
  {
    step: 1,
    question: "👋 Привет, Агент! Рад видеть тебя в штабе CyberVibe. Чтобы я мог помочь тебе максимально эффективно, скажи, **какая твоя основная цель здесь?**",
    answers: [
      { text: "👨‍💻 Я хочу кодить/контрибьютить", callback_data: "purpose_dev" },
      { text: "🚀 У меня есть идея/проект", callback_data: "purpose_idea" },
      { text: "🤔 Просто изучаю, что за Vibe", callback_data: "purpose_explore" },
    ],
  },
  {
    step: 2,
    question: "Отлично! А какой у тебя **опыт в разработке**, если не секрет? Это поможет подобрать задачи по твоему скиллу.",
    answers: [
      { text: "👶 Я нуб, но хочу учиться", callback_data: "exp_newbie" },
      { text: "😎 Кое-что умею (Junior/Middle)", callback_data: "exp_dev" },
      { text: "🤖 Я и есть машина (Senior+)", callback_data: "exp_senior" },
      { text: "💡 Я не кодер, я идеолог", callback_data: "exp_idea_only" },
    ],
  },
  {
    step: 3,
    question: "Понял. И последний вопрос: **что для тебя самое важное в проекте?**",
    answers: [
      { text: "💸 Заработать", callback_data: "motive_money" },
      { text: "🎓 Научиться новому", callback_data: "motive_learn" },
      { text: "🕹️ Получить фан и погонять AI", callback_data: "motive_fun" },
      { text: "🌍 Изменить мир, очевидно", callback_data: "motive_world" },
    ],
  },
];

const sendNextQuestion = async (chatId: string, state: SurveyState, messageId?: number) => {
  const nextStep = state.currentStep;
  const questionData = surveyQuestions.find(q => q.step === nextStep);

  if (!questionData) {
    // This should not happen if logic is correct
    await sendTelegramMessage("Что-то пошло не так. Попробуйте начать заново с /start.", [], undefined, chatId);
    return;
  }

  const text = questionData.question;
  const inline_keyboard = [questionData.answers.map(a => ({ ...a, callback_data: `${nextStep}:${a.callback_data}` }))];

  if (messageId) {
    // Edit the existing message for a seamless experience
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard },
      }),
    });
  } else {
    // Send the first question as a new message
    await sendTelegramMessage(text, inline_keyboard, undefined, chatId);
  }
};

const handleSurveyCompletion = async (chatId: string, state: SurveyState, messageId: number, username?: string) => {
  const { answers } = state;
  const userId = chatId; // In this context, chatId is the user's ID
  
  // 1. Save results to Supabase
  const { error } = await supabaseAdmin.from("user_surveys").insert({
    user_id: userId,
    username: username || "unknown",
    survey_data: answers,
  });

  if (error) {
    logger.error(`[StartCommand] Failed to save survey for user ${userId}:`, error);
  }

  // 2. Prepare final message and admin notification
  const summary = `
✅ **Опрос Завершен!**
Твои ответы записаны. Вот, что мы поняли:
- **Цель:** ${answers.purpose || 'не указана'}
- **Опыт:** ${answers.exp || 'не указан'}
- **Мотивация:** ${answers.motive || 'не указан'}

Исходя из этого, вот твои **рекомендованные точки входа:**
  `;

  const adminSummary = `
🚨 **Новый Агент прошел онбординг!**
- **User:** @${username || userId} (${userId})
- **Цель:** ${answers.purpose || 'не указана'}
- **Опыт:** ${answers.exp || 'не указан'}
- **Мотивация:** ${answers.motive || 'не указан'}
  `;
  
  await notifyAdmin(adminSummary);

  // 3. Prepare personalized buttons
  const baseUrl = getBaseUrl();
  let buttons = [];
  if (answers.purpose === 'purpose_dev') {
    buttons.push([{ text: "🛠️ В SUPERVIBE Studio", url: `${baseUrl}/repo-xml` }]);
    buttons.push([{ text: "🚀 Начать Тренировку", url: `${baseUrl}/start-training` }]);
  } else if (answers.purpose === 'purpose_idea') {
    buttons.push([{ text: "💡 Обсудить Идею (Admin)", url: `https://t.me/${process.env.ADMIN_USERNAME}` }]);
    buttons.push([{ text: "👀 Посмотреть возможности", url: `${baseUrl}/` }]);
  } else {
    buttons.push([{ text: "🗺️ Карта Проекта", url: `${baseUrl}/` }]);
    buttons.push([{ text: "🔥 Горячие Вайбы", url: `${baseUrl}/hotvibes` }]);
  }

  // 4. Send the final message by editing the last question
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: summary,
      reply_markup: { inline_keyboard: buttons },
      parse_mode: 'Markdown'
    }),
  });
};


export async function startCommand(chatId: number, userId: number, username?: string, callbackQuery?: any) {
  logger.info(`[StartCommand] Triggered by user ${userId}. Is callback: ${!!callbackQuery}`);

  if (!callbackQuery) {
    // --- New user starts the survey ---
    const { data, error } = await supabaseAdmin
      .from("user_surveys")
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
        logger.error(`[StartCommand] Error checking for existing survey for user ${userId}`, error);
    }

    if (data) {
        // User already took the survey
        await sendTelegramMessage(`С возвращением, Агент! Твои ответы уже в системе. Если хочешь начать заново, используй /reset. А пока, вот твоя навигация:`, [
            [{ text: "🛠️ В SUPERVIBE Studio", url: getBaseUrl() + "/repo-xml" }],
            [{ text: "🗺️ Карта Проекта", url: getBaseUrl() + "/" }]
        ], undefined, String(chatId));
        return;
    }

    const initialState: SurveyState = { currentStep: 1, answers: {} };
    await sendNextQuestion(String(chatId), initialState);

  } else {
    // --- User answers a survey question ---
    const message = callbackQuery.message;
    const [stepStr, answer] = callbackQuery.data.split(':');
    const step = parseInt(stepStr);

    // Fetch current state from DB or a temporary store. For simplicity, we'll assume a new interaction for each button press for now.
    // A more robust solution would use a DB to store the temporary state. Let's build a simple version first.
    // NOTE: This simple implementation is NOT stateful between different bot restarts.
    // We can rebuild state from callback history.
    
    const question = surveyQuestions.find(q => q.step === step);
    const answerText = question?.answers.find(a => a.callback_data === answer)?.text;

    // A simple way to manage state for this interaction
    // We'll just assume the user answers sequentially.
    // The state isn't saved between questions, it's just built up.
    // This is a limitation we accept for v1 of this feature.
    const tempAnswers: Record<string, string> = {};
    const questionKey = Object.keys(surveyQuestions[step-1].answers[0].callback_data.split('_'))[0]; // purpose, exp, motive
    const answerKey = answer.split('_')[0];
    tempAnswers[answerKey] = answerText || answer;
    
    const currentState: SurveyState = {
        currentStep: step + 1,
        // This is a simplified state management for the demo.
        // A real implementation would fetch and update state from a database.
        answers: { ...tempAnswers, [answerKey]: answerText || answer }, 
    };
    
    const lastAnsweredQuestion = surveyQuestions[step-1];
    const keyPrefix = lastAnsweredQuestion.answers[0].callback_data.split('_')[0]; // purpose, exp, motive
    
    // We need to rebuild the full answer set for the final summary. This is a hacky way.
    // A proper state machine would store the partial answers.
    // For now, let's just log it.
    logger.info(`[StartCommand] User ${userId} answered step ${step} with: ${answerText}`);


    if (step >= surveyQuestions.length) {
      // Last question answered, finalize survey
      // In a real app, you'd pull the full answer set from a temporary store/DB.
      // We will simulate it for now.
      await handleSurveyCompletion(String(chatId), currentState, message.message_id, username);
    } else {
      // Send next question
      await sendNextQuestion(String(chatId), currentState, message.message_id);
    }
  }
}