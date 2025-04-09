"use server";

    import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
    import { notifyAdmins } from "@/app/actions"; // For error notifications
    import { logger } from "@/lib/logger"; // Optional: For more detailed server logs

    // Initialize the Google AI Client
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("GEMINI_API_KEY is not set in environment variables.");
      // Optionally notify admin immediately on server start/load if key is missing
      // notifyAdmins("🚨 CRITICAL ERROR: GEMINI_API_KEY is missing! AI features disabled.").catch(console.error);
    }

    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

    // Define safety settings (adjust as needed)
    // Refer to: https://ai.google.dev/docs/safety_setting_gemini
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, },
    ];

    // Define generation config (optional, adjust as needed)
    const generationConfig = {
        // temperature: 0.9, // Controls randomness (0.0 - 1.0)
        // topK: 1,          // Selects the next token from the top K most likely tokens
        // topP: 1,          // Selects the next token from the smallest set whose probability sums to P
        // maxOutputTokens: 2048, // Limit response size (check model limits)
    };

    /**
     * Generates content using the Google Generative AI API (Gemini).
     * @param prompt The combined prompt including user request and code context.
     * @param modelName The specific Gemini model to use (e.g., "gemini-1.5-flash-latest").
     * @returns An object with success status and the generated text or an error message.
     */
    export async function generateAiCode(
      prompt: string,
      modelName: string = "gemini-1.5-flash-latest" // Use latest flash model by default
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
        const model = genAI.getGenerativeModel({
            model: modelName,
            safetySettings,
            generationConfig,
        });

        logger.info(`[AI Action] Sending prompt (length: ${prompt.length}) to model ${modelName}...`);
        // Simple text-only generation for now
        const result = await model.generateContent(prompt);

        // Handle potential safety blocks or other issues in the response
        if (!result.response) {
            logger.error("[AI Action] No response received from the model.", result);
             // Try to get more details if available
             let blockReason = "Unknown reason";
             try {
                 // Accessing potentially private or non-standard properties, use with caution
                 // @ts-ignore // Suppress TS error for potential non-standard access
                 const candidate = result?.promptFeedback ?? result?.response?.candidates?.[0];
                 if (candidate?.blockReason) {
                     blockReason = candidate.blockReason;
                 } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                     blockReason = `Finish Reason: ${candidate.finishReason}`;
                 }
             } catch (e) { /* ignore potential errors accessing details */ }

            const errorMsg = `AI generation failed or was blocked. Reason: ${blockReason}`;
            logger.error(`[AI Action] ${errorMsg}`);
            await notifyAdmins(`🚫 AI-Контент Заблокирован или Неудачен (Модель: ${modelName}): ${blockReason}`).catch(logger.error);
            return { success: false, error: errorMsg };
        }

        const response = result.response;
        const text = response.text(); // Get the text content

        if (!text || text.trim().length === 0) {
             logger.warn("[AI Action] Received empty text response from the model.");
             await notifyAdmins(`⚠️ AI вернул пустой ответ (Модель: ${modelName})`).catch(logger.error);
             return { success: false, error: "AI returned an empty response." };
        }

        logger.info(`[AI Action] Successfully received response (length: ${text.length}) from model ${modelName}.`);
        return { success: true, text: text };

      } catch (error: any) {
        logger.error(`[AI Action] Error calling Google AI API (Model: ${modelName}):`, error);
        let errorMessage = "An unknown error occurred while contacting the AI service.";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }

        // Check for specific error types if the SDK provides them (e.g., API key issues, rate limits)
        // Example (pseudo-code, check actual SDK error structure):
        // if (error?.code === 'API_KEY_INVALID') { errorMessage = "Invalid Gemini API Key."; }
        // else if (error?.status === 429) { errorMessage = "Gemini API rate limit exceeded."; }

        await notifyAdmins(`❌ Ошибка при вызове Gemini API (Модель: ${modelName}):\n${errorMessage}`).catch(logger.error);
        return { success: false, error: `AI API Error: ${errorMessage}` };
      }
    }