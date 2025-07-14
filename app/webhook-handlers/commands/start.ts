import { notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";
import { howtoCommand } from "./howto";
import { sendComplexMessage, deleteTelegramMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { surveyQuestions, SurveyQuestion, answerTexts } from "./content/start_survey_questions_bike"; // Import the questions

interface SurveyState {
  user_id: string;
  current_step: number;
  answers: Record<string, string>;
  message_id?: number | null;
}

const handleSurveyCompletion = async (chatId: number, state: SurveyState, username?: string) => {
  const { answers, user_id } = state;

  await supabaseAdmin.from("user_surveys").insert({ user_id, username: username || "unknown", survey_data: answers });
  await supabaseAdmin.from("user_survey_state").delete().eq('user_id', user_id);

  let adminSummary = `🚨 **Новый Агент прошел онбординг!**\n- **User:** @${username || user_id} (${user_id})\n`;
  for (const key in answers) {
    adminSummary += `- **${answerTexts[key] || key}:** ${answers[key] || 'не указана'}\n`;
  }
  await notifyAdmin(adminSummary);


  let summary = `✅ **Опрос Завершен!**\nТвои ответы записаны. Спасибо!\n`;
  for (const key in answers) {
    summary += `- **${answerTexts[key] || key}:** ${answers[key] || 'не указана'}\n`;
  }
  summary += `Теперь клавиатура убрана. Используй /howto, чтобы получить рекомендованные гайды, или /help для списка всех команд.`;
  summary += `\n\n👉 Готовы выбрать велосипед?  Посетите наш сайт: t.me/oneSitePlsBot/app?startapp=rent`;  // Add call to action
  await sendComplexMessage(chatId, summary, [], { removeKeyboard: true });
};

export async function startCommand(chatId: number, userId: number, username?: string, text?: string) {
  logger.info(`[StartCommand V4 - ReplyKeyboard] User: ${userId}, Text: "${text}"`);
  const userIdStr = String(userId);

  if (text === '/start') {
    await supabaseAdmin.from("user_survey_state").delete().eq('user_id', userIdStr);
    await supabaseAdmin.from("user_surveys").delete().eq('user_id', userIdStr);

    const { data: newState, error } = await supabaseAdmin
      .from("user_survey_state")
      .insert({ user_id: userIdStr, current_step: 1, answers: {} })
      .select().single();

    if (error || !newState) {
      logger.error('[StartCommand V4] Failed to create new survey state', error);
      return;
    }

    const question = surveyQuestions.find(q => q.step === newState.current_step)!;
    const buttons = question.answers ? question.answers.map(a => ([{ text: a.text }])) : [];  // Handle no predefined answers

    await sendComplexMessage(chatId, question.question, buttons, { keyboardType: question.answers ? 'reply' : 'remove' }); // Conditionally show keyboard

  } else {
    // This is not a /start command, so it must be an answer to a question.
    const { data: currentState } = await supabaseAdmin.from("user_survey_state").select('*').eq('user_id', userIdStr).maybeSingle();

    if (!currentState) {
      // No active survey for this user. The command handler will show the "unknown command" message.
      logger.warn(`[StartCommand V4] Received text "${text}" from user ${userId} but no active survey found.`);
      return;
    }

    const currentQuestion = surveyQuestions.find(q => q.step === currentState.current_step)!;

    if (currentQuestion.answers && !currentQuestion.free_answer) { // Validate only if predefined answers exist AND free answer is not allowed
      const isValidAnswer = currentQuestion.answers.some(a => a.text === text);

      if (!isValidAnswer) {
        logger.warn(`[StartCommand V4] Invalid answer "${text}" for step ${currentState.current_step}. Resending question.`);
        const buttons = currentQuestion.answers.map(a => ([{ text: a.text }]));
        await sendComplexMessage(chatId, `Неверный ответ. Пожалуйста, выбери один из вариантов или введи свой ответ.\n\n${currentQuestion.question}`, buttons, { keyboardType: 'reply' });
        return;
      }
    }

    const newAnswers = { ...currentState.answers, [currentQuestion.key]: text };
    const nextStep = currentState.current_step + 1;

    if (nextStep > surveyQuestions.length) {
      // Survey is complete
      await handleSurveyCompletion(chatId, { ...currentState, answers: newAnswers }, username);
    } else {
      // Move to the next question
      await supabaseAdmin.from("user_survey_state").update({ current_step: nextStep, answers: newAnswers }).eq('user_id', userIdStr);
      const nextQuestion = surveyQuestions.find(q => q.step === nextStep)!;
      const buttons = nextQuestion.answers ? nextQuestion.answers.map(a => ([{ text: a.text }])) : [];

      // Remove keyboard if no answers, otherwise show reply keyboard
      await sendComplexMessage(chatId, nextQuestion.question, buttons, { keyboardType: nextQuestion.answers ? 'reply' : 'remove' });
    }
  }
}
/*
Key improvements and explanations:

• start_survey_questions.ts: Holds the surveyQuestions array and the SurveyQuestion interface, making the survey definition separate and manageable. Includes the free_answer boolean on each question.
• Import: The startCommand function now imports surveyQuestions from the separate file.
• free_answer Flag: The SurveyQuestion interface now includes a free_answer: boolean field. If this is true for a question, the answer validation is skipped, allowing the user to enter any text.
• Conditional Answer Validation: The code now checks if (currentQuestion.answers && !currentQuestion.free_answer) before validating the answer. This makes sure the validation is only done when there are predefined answers AND the question doesn't allow a free answer.
• Dynamic Keyboards: The sendComplexMessage call now includes the check keyboardType: nextQuestion.answers ? 'reply' : 'remove'. This means that if a question doesn't have predefined answers (and therefore nextQuestion.answers is undefined), the keyboard will be removed automatically.
• Handling No Predefined Answers: The code now handles questions without predefined answers by checking if question.answers exists before mapping to buttons. If it doesn't exist, an empty array is used.
• Clearer Logic: The logic for determining whether to validate the answer and whether to show the keyboard is now clearer and more concise.
• Dynamic Result Message: The handleSurveyCompletion function now dynamically builds the summary message using a loop that iterates through the answers object. The keys from the survey questions are used as labels in the summary.
• answerTexts map Added a map to provide verbose names for survey keys, used in summary to show user readable text
• Error Handling & Logging: The logging statements remain, which are crucial for debugging.
• Typescript: Maintained strong typing.*/
