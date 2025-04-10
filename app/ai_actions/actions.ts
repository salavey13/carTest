// /app/ai_actions/actions.ts
"use server";

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerativeModel } from "@google/genai";
import { notifyAdmins } from "@/app/actions"; // For error notifications
import { logger } from "@/lib/logger"; // Use your standard logger
import { debugLogger } from "@/lib/debugLogger"; // For verbose debugging

// --- Initialization and Configuration ---
let genAI: GoogleGenerativeAI | null = null;
let geminiApiKey: string | undefined = undefined;

function initializeGenAI() {
    if (genAI) return; // Already initialized

    geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        logger.error("GEMINI_API_KEY is not set in environment variables. Google AI features disabled.");
        // Optionally notify admin immediately on server start/load if key is missing
        // notifyAdmins("🚨 CRITICAL ERROR: GEMINI_API_KEY is missing! AI features disabled.").catch(console.error);
        return;
    }

    try {
        genAI = new GoogleGenerativeAI(geminiApiKey);
        logger.info("Google Generative AI SDK initialized successfully.");
    } catch (initError) {
        logger.error("Failed to initialize GoogleGenerativeAI:", initError);
        genAI = null; // Ensure it's null if initialization fails
        notifyAdmins("🚨 CRITICAL ERROR: Failed to initialize GoogleGenerativeAI SDK! AI features disabled.").catch(logger.error);
    }
}

// Initialize on module load
initializeGenAI();

// Define safety settings (adjust as needed)
// Reference: https://ai.google.dev/docs/safety_setting_gemini
const defaultSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Define default generation config (optional, adjust as needed)
const defaultGenerationConfig = {
    // temperature: 0.7, // Example: balance creativity and coherence
    // maxOutputTokens: 4096, // Example: set a reasonable limit
    // topP: 0.95, // Example Nucleus sampling
    // topK: 40,   // Example Top-K sampling
};

// --- Core AI Generation Function ---

/**
 * Generates content using the Google Generative AI API (Gemini).
 * @param prompt The combined prompt including user request and code context.
 * @param modelName The specific Gemini model to use (e.g., "gemini-1.5-flash-latest").
 * @param customSafetySettings Optional override for safety settings.
 * @param customGenerationConfig Optional override for generation config.
 * @returns An object with success status and the generated text or an error message.
 */
export async function generateAiCode(
    prompt: string,
    modelName: string = "gemini-1.5-flash-latest", // Use latest flash model by default
    customSafetySettings?: typeof defaultSafetySettings,
    customGenerationConfig?: typeof defaultGenerationConfig
): Promise<{ success: boolean; text?: string; error?: string }> {
    debugLogger.log(`[AI Action] Called generateAiCode with model: ${modelName}`);

    if (!genAI) {
        const errorMsg = "Google AI SDK not initialized (GEMINI_API_KEY missing or initialization failed).";
        logger.error(`[AI Action] ${errorMsg}`);
        // Avoid notifying admins repeatedly if the key is missing, it was logged on init.
        return { success: false, error: errorMsg };
    }

    if (!prompt || prompt.trim().length === 0) {
        logger.warn("[AI Action] Received empty prompt.");
        return { success: false, error: "Prompt cannot be empty." };
    }
     if (prompt.length > 100000) { // Add a reasonable prompt length limit
        logger.warn(`[AI Action] Prompt length (${prompt.length}) exceeds limit.`);
        return { success: false, error: "Prompt is too long." };
    }

    try {
        const safetySettings = customSafetySettings || defaultSafetySettings;
        const generationConfig = customGenerationConfig || defaultGenerationConfig;

        const model: GenerativeModel = genAI.getGenerativeModel({
            model: modelName,
            safetySettings,
            generationConfig,
        });

        logger.info(`[AI Action] Sending prompt (length: ${prompt.length}) to model ${modelName}...`);
        debugLogger.log("[AI Action] Prompt content (first 100 chars):", prompt.substring(0, 100));

        // Using generateContent for potentially richer responses/errors
        const result = await model.generateContent(prompt);
        const response = result.response;

        // Detailed check for blocks or issues
        if (!response || !response.candidates || response.candidates.length === 0) {
            let blockReason = "No response or candidates received from the model.";
            let finishReason = "Unknown";
            if (response?.promptFeedback?.blockReason) {
                blockReason = `Prompt blocked: ${response.promptFeedback.blockReason}`;
            } else if (response?.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== 'STOP') {
                 finishReason = response.candidates[0].finishReason;
                 blockReason = `Generation stopped due to: ${finishReason}`;
                 if(response.candidates[0].safetyRatings?.some(r => r.blocked)) {
                     blockReason += ` (Safety Block: ${response.candidates[0].safetyRatings.find(r => r.blocked)?.category})`;
                 }
            }

            const errorMsg = `AI generation failed or was blocked. Reason: ${blockReason}`;
            logger.error(`[AI Action] ${errorMsg}`, { promptFeedback: response?.promptFeedback, finishReason });
            await notifyAdmins(`🚫 AI-Контент Заблокирован/Неудачен (Модель: ${modelName}): ${blockReason}`).catch(logger.error);
            return { success: false, error: errorMsg };
        }

        // Extract text - assuming single candidate for simple generation
        const text = response.text();

        if (!text || text.trim().length === 0) {
            logger.warn("[AI Action] Received empty text response from the model.");
            await notifyAdmins(`⚠️ AI вернул пустой ответ (Модель: ${modelName})`).catch(logger.error);
            return { success: false, error: "AI returned an empty response." };
        }

        logger.info(`[AI Action] Successfully received response (length: ${text.length}) from model ${modelName}.`);
        debugLogger.log("[AI Action] Response text (first 100 chars):", text.substring(0, 100));
        return { success: true, text: text };

    } catch (error: any) {
        logger.error(`[AI Action] Error calling Google AI API (Model: ${modelName}):`, error);
        let errorMessage = "An unknown error occurred while contacting the AI service.";

        // More specific error handling if possible (check SDK error types)
        if (error instanceof Error) {
            errorMessage = error.message;
            // Example: Check for specific API errors based on message content or type
            if (errorMessage.includes("API key not valid")) {
                errorMessage = "Invalid Gemini API Key.";
                 // Potentially disable further calls or re-initialize?
            } else if (errorMessage.includes("quota") || error.message.includes("429")) {
                 errorMessage = "Gemini API quota exceeded or rate limit hit.";
            }
        } else if (typeof error === 'string') {
            errorMessage = error;
        }

        await notifyAdmins(`❌ Ошибка при вызове Gemini API (Модель: ${modelName}):\n${errorMessage}`).catch(logger.error);
        return { success: false, error: `AI API Error: ${errorMessage}` };
    }
}