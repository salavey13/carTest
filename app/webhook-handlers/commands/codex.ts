import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";

export async function codexCommand(chatId: number, userId: string, username: string | undefined, rawText: string) {
  const prompt = rawText.replace(/^\/codex(?:@[\w_]+)?\s*/i, "").trim();

  if (!prompt) {
    await sendComplexMessage(
      chatId,
      "Использование: `/codex <задача>` + следующим сообщением фото\nИли сразу фото с подписью `/codex <задача>`.\n\nПример: `/codex solve this homework equation from the photo`",
      [],
      { parseMode: "Markdown" },
    );
    return;
  }

  try {
    const { error: stateError } = await supabaseAdmin
      .from("user_states")
      .upsert(
        {
          user_id: userId,
          state: "awaiting_codex_homework_photo",
          context: {
            codex_prompt: prompt,
            source_command: rawText,
            chat_id: String(chatId),
            username: username || null,
            created_at: new Date().toISOString(),
          },
        },
        {
          onConflict: "user_id",
        },
      );

    if (stateError) {
      throw new Error(stateError.message);
    }

    await sendComplexMessage(
      chatId,
      `📝 Принял задачу для Codex.\n\n*Prompt:* ${prompt}\n\nТеперь отправь фото домашки следующим сообщением.\nЛибо можно сразу одним сообщением: фото + подпись \`/codex <задача>\`.`,
      [],
      { parseMode: "Markdown" },
    );
  } catch (error: any) {
    logger.error("[Codex Command] Unexpected error while storing two-step context", error);
    await sendComplexMessage(
      chatId,
      `⚠️ Не удалось сохранить задачу: ${error?.message || "Unknown error"}`,
      [],
      { parseMode: "Markdown" },
    );
  }
}
