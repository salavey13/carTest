import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

const questions = [
  "Вопрос 1: Вам нравится наш сервис?",
  "Вопрос 2: Как вы оцениваете удобство использования?",
  "Вопрос 3: Как вы оцениваете скорость работы сервиса?",
  "Вопрос 4: Вы порекомендуете наш сервис друзьям?",
  "Вопрос 5: Вы планируете использовать наш сервис в будущем?",
];

interface UserState {
  questionIndex: number;
  answers: string[];
}

const userStates: Map<number, UserState> = new Map();

export async function startCommand(chatId: number, userId: number, username:string) {
  logger.info(`[Start Command] User ${userId} (${username}) started the bot.`);
  userStates.set(userId, { questionIndex: 0, answers: [] });

  const greeting = "Здравствуйте! Спасибо, что решили воспользоваться нашим сервисом.\nДля улучшения качества работы сервиса, пожалуйста, пройдите небольшой опрос из 5 вопросов.";
  await sendTelegramMessage(greeting, [], undefined, chatId.toString());

  askQuestion(chatId, userId);
}

async function askQuestion(chatId: number, userId: number) {
  const state = userStates.get(userId);
  if (!state) {
    logger.error(`[Start Command] No state found for user ${userId}.`);
    return;
  }

  const questionIndex = state.questionIndex;

  if (questionIndex < questions.length) {
    const question = questions[questionIndex];
    const keyboard = [
      [{ text: "Да", callback_data: `q${questionIndex + 1}_yes` }, { text: "Нет", callback_data: `q${questionIndex + 1}_no` }],
    ];
    await sendTelegramMessage(question, keyboard, undefined, chatId.toString());
  } else {
    // Survey Complete
    const answers = state.answers;
    const summary = `Спасибо за участие в опросе!\nВаши ответы:\n${answers.map((a, i) => ${questions[i]}: ${a}).join("\n")}`;
    await sendTelegramMessage(summary, [], undefined, chatId.toString());
    userStates.delete(userId); // Clean up state
    logger.info(`[Start Command] Survey complete for user ${userId}.`);

    // OPTIONAL: Update Supabase
    try {
      const { supabaseAdmin } = await import("@/hooks/supabase"); // Dynamic import
      const metadata = { surveyAnswers: answers }; // Store answers in metadata
      const { data, error } = await supabaseAdmin
        .from("users")
        .upsert({ user_id: userId.toString(), metadata: metadata }, { onConflict: 'user_id' })  // Use upsert
        .select();


      if (error) {
        logger.error(`[Start Command] Error updating Supabase for user ${userId}: ${error.message}`);
      } else {
        logger.info([`Start Command] Supabase updated successfully for user ${userId}: ${data}`);
      }
    } catch (supabaseError: any) {
      logger.error(`[Start Command] Error importing or using Supabase: ${supabaseError.message}`);
    }
  }
}

// Handle Callback Queries (Answer submissions)
export async function handleAnswer(chatId: number, userId: number, data: string) {
  const state = userStates.get(userId);
  if (!state) {
    logger.warn(`[Start Command] No state found for user ${userId} when handling answer.`);
    return;
  }

  const questionIndex = state.questionIndex;

  if (data === q${questionIndex + 1}_yes) {
    state.answers.push("Да");
  } else if (data === q${questionIndex + 1}_no) {
    state.answers.push("Нет");
  } else {
    logger.warn([Start Command] Unknown callback data: ${data});
    return;
  }

  state.questionIndex++;
  userStates.set(userId, state); // Update state
  askQuestion(chatId, userId);
}
