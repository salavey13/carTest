const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

type SendMessageOptions = {
  parse_mode?: "HTML" | "MarkdownV2" | "Markdown";
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_markup?: Record<string, unknown>;
  maxRetries?: number;
};

type TelegramSendMessageResponse = {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendMessage(chatId: string | number, text: string, opts: SendMessageOptions = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const {
    maxRetries = 2,
    parse_mode = "HTML",
    disable_notification,
    disable_web_page_preview,
    reply_markup,
  } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode,
        disable_notification,
        disable_web_page_preview,
        reply_markup,
      }),
    });

    // Parse body safely so non‑JSON responses don't bypass the retry loop
    const responseText = await response.text();
    let payload: TelegramSendMessageResponse;
    try {
      payload = JSON.parse(responseText) as TelegramSendMessageResponse;
    } catch {
      // Transient error with non‑JSON body → retry if possible
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(Math.max(250 * (attempt + 1), 500));
          continue;
        }
        throw new Error(`Telegram API returned non‑JSON error (status ${response.status})`);
      }
      throw new Error(`Unexpected Telegram response (status ${response.status}): ${responseText.slice(0, 200)}`);
    }

    if (response.ok && payload.ok) {
      return payload;
    }

    const retryAfterMs = (payload.parameters?.retry_after ?? 0) * 1000;
    const isRetryable = response.status === 429 || response.status >= 500;

    if (!isRetryable || attempt === maxRetries) {
      throw new Error(payload.description || `Failed to send telegram message (status ${response.status})`);
    }

    await sleep(Math.max(retryAfterMs, 250 * (attempt + 1)));
  }

  throw new Error("Failed to send telegram message after retries");
}