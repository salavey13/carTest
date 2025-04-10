// /app/ai_actions/actions.ts
"use server";

// Corrected import based on previous fix
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { notifyAdmins } from "@/app/actions"; // For error notifications
import { logger } from "@/lib/logger"; // Optional: For more detailed server logs

// Initialize the Google AI Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  logger.error("GEMINI_API_KEY is not set in environment variables.");
  // notifyAdmins("🚨 CRITICAL ERROR: GEMINI_API_KEY is missing! AI features disabled.").catch(console.error);
}

// Corrected instantiation based on previous fix
const genAI = apiKey ? new GoogleGenAI(apiKey) : null;

// Define safety settings (adjust as needed)
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
];

// Define generation config (optional, adjust as needed)
// Note: Check model documentation for specific limits (e.g., output tokens)
const generationConfig = {
    // temperature: 0.9,
    // topK: 1,
    // topP: 1,
    // maxOutputTokens: 65536, // Example for gemini-2.5-pro-exp-03-25
    // responseMimeType: "application/json",
};

/**
 * Generates content using the Google Generative AI API (Gemini).
 * @param prompt The combined prompt including user request and code context.
 * @param modelName The specific Gemini model to use. Defaults to the experimental 2.5 Pro model.
 * @returns An object with success status and the generated text or an error message.
 */
export async function generateAiCode(
  prompt: string,
  // Using the requested experimental model as default
  modelName: string = "gemini-2.5-pro-exp-03-25"
): Promise<{ success: boolean; text?: string; error?: string }> {
  logger.info(`[AI Action] Attempting to generate content with model: ${modelName}`);

  if (!genAI) {
    const errorMsg = "Google AI SDK not initialized (GEMINI_API_KEY missing).";
    logger.error(`[AI Action] ${errorMsg}`);
    await notifyAdmins(`❌ Ошибка AI: ${errorMsg}`).catch(logger.error);
    return { success: false, error: errorMsg };
  }

  if (!prompt || prompt.trim().length === 0) {
      logger.warn("[AI Action] Received empty prompt.");
      return { success: false, error: "Prompt cannot be empty." };
  }

  try {
    // ---------------------------------------------------------------------
    // --- CORE FIX: Call generateContent directly on genAI.models ---
    // ---------------------------------------------------------------------
    logger.info(`[AI Action] Sending prompt (length: ${prompt.length}) to model ${modelName} via genAI.models.generateContent...`);

    const result = await genAI.models.generateContent({
        model: modelName,
        // Structure the prompt according to the 'contents' format
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings: safetySettings,
        generationConfig: generationConfig,
    });
    // ---------------------------------------------------------------------

    // --- Robustness Checks (Remain the same) ---

    const response = result.response; // Get the response object

    // 1. Check for explicit safety blocking first
    const promptFeedback = response.promptFeedback;
    if (promptFeedback?.blockReason) {
        const blockReason = promptFeedback.blockReason;
        const safetyRatings = promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'N/A';
        const errorMsg = `AI generation blocked due to safety settings. Reason: ${blockReason}. Ratings: [${safetyRatings}]`;
        logger.error(`[AI Action] ${errorMsg}`);
        await notifyAdmins(`🚫 AI-Контент Заблокирован (Модель: ${modelName}): ${blockReason}`).catch(logger.error);
        return { success: false, error: errorMsg };
    }

    // 2. Check if generation finished unexpectedly
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
         const errorMsg = `AI generation stopped unexpectedly. Reason: ${finishReason}`;
         logger.warn(`[AI Action] ${errorMsg} (Model: ${modelName})`);
         await notifyAdmins(`⚠️ AI генерация остановлена (Модель: ${modelName}): ${finishReason}`).catch(logger.error);
         return { success: false, error: errorMsg };
    }

    // 3. Attempt to get the response text
    let text = "";
    try {
        if (response.candidates && response.candidates.length > 0) {
           text = response.text();
        } else {
             logger.warn(`[AI Action] No candidates found in the response from model ${modelName}. Finish Reason: ${finishReason ?? 'N/A'}`);
             await notifyAdmins(`⚠️ AI не вернул кандидатов в ответе (Модель: ${modelName})`).catch(logger.error);
             return { success: false, error: "AI returned no response candidates." };
        }
    } catch (e: any) {
         logger.error(`[AI Action] Error calling response.text() (Model: ${modelName}):`, e);
         const errorMsg = `AI response format error: Could not extract text. ${e.message || ''}`.trim();
         await notifyAdmins(`❌ Ошибка формата ответа AI (Модель: ${modelName})`).catch(logger.error);
         return { success: false, error: errorMsg };
    }

    // 4. Check for empty text response (after other checks)
    if (!text || text.trim().length === 0) {
         if (promptFeedback?.blockReason) {
             const errorMsg = `AI generation blocked (reason found after empty text check): ${promptFeedback.blockReason}`;
             logger.error(`[AI Action] ${errorMsg}`);
             return { success: false, error: errorMsg };
         }
         logger.warn(`[AI Action] Received empty text response from the model ${modelName}.`);
         await notifyAdmins(`⚠️ AI вернул пустой ответ (Модель: ${modelName})`).catch(logger.error);
         return { success: false, error: "AI returned an empty response." };
    }

    // --- Success ---
    logger.info(`[AI Action] Successfully received response (length: ${text.length}) from model ${modelName}.`);
    return { success: true, text: text };

  } catch (error: any) {
    // --- Catch external API errors ---
    logger.error(`[AI Action] Error calling Google AI API (Model: ${modelName}):`, error);
    let errorMessage = "An unknown error occurred while contacting the AI service.";
    if (error instanceof Error) {
      errorMessage = error.message; // This will now contain "c.getGenerativeModel is not a function" if the old code was run
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    if (error?.status) { errorMessage += ` (Status: ${error.status})`; }
    // Add details if the error object has them (check GoogleGenerativeAIError structure if available)
    if (error?.cause) { errorMessage += ` Cause: ${JSON.stringify(error.cause)}`; }
    if (error?.details) { errorMessage += ` Details: ${error.details}`; }


    await notifyAdmins(`❌ Ошибка при вызове Gemini API (Модель: ${modelName}):\n${errorMessage}`).catch(logger.error);
    return { success: false, error: `AI API Error: ${errorMessage}` };
  }
}
