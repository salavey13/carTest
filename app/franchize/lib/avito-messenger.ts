// /app/franchize/lib/avito-messenger.ts
//
// Avito Messenger API — исходящий клиент для ответов покупателям из CRM.
//
// ВХОДЯЩИЙ канал (webhook v3 + VPS-поллер scripts/avito-monitor) живёт в
// app/api/webhooks/avito/route.ts. ЭТОТ файл — ИСХОДЯЩИЙ: оператор жмёт
// «Отправить в Авито» на странице лидов, текст улетает в реальный чат
// покупателя через POST /messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/.
//
// Креды: client_credentials-пара приложения с developers.avito.ru. Для
// отправки приложению нужен скоуп `messenger:write` (для чтения —
// `messenger:read`, он уже используется поллером). Токен минтится на лету
// и кешируется в памяти инстанса до истечения (expires_in, обычно 24ч) —
// как в поллере: ~2 token-запроса в день на тёплый инстанс, холодный
// просто минтит новый. Никаких секретов в коде/репо — только env.
//
// Env (Vercel → Settings → Environment Variables):
//   AVITO_CLIENT_ID / AVITO_CLIENT_SECRET — пара приложения (те же, что на
//     VPS в /opt/vip-bike-avito/secrets.env, если скоупы расширены там);
//   AVITO_USER_ID — id профиля продавца, владельца объявлений
//     (аренда vip-bike: 167526519 — см. scripts/avito-monitor/config.json).
//
// Подписка: Messenger API требует активной подписки «API Мессенджера» на
// аккаунте Авито (иначе endpoint отвечает 402 Payment Required — это же
// ограничение ловит поллер при чтении истории).

const AVITO_API_BASE = "https://api.avito.ru";
const TOKEN_URL = `${AVITO_API_BASE}/token`;

/** Avito режет слишком длинные сообщения — страхуемся на своей стороне. */
export const AVITO_MESSAGE_MAX_LENGTH = 3000;

// ── Token cache (in-memory, per serverless instance) ────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Возвращает человекочитаемое описание НЕДОСТАЮЩЕЙ конфигурации или null,
 * если исходящая отправка настроена. Используется роутом, чтобы отдать
 * оператору понятную ошибку вместо сырости «500».
 */
export function avitoReplyConfigError(): string | null {
  const missing: string[] = [];
  if (!process.env.AVITO_CLIENT_ID) missing.push("AVITO_CLIENT_ID");
  if (!process.env.AVITO_CLIENT_SECRET) missing.push("AVITO_CLIENT_SECRET");
  if (!process.env.AVITO_USER_ID) missing.push("AVITO_USER_ID");
  if (missing.length === 0) return null;
  return (
    `Отправка в Авито не настроена: нет ${missing.join(", ")} в окружении. ` +
    "Добавьте client_id/client_secret приложения с developers.avito.ru " +
    "(скоп messenger:write) и user_id профиля продавца."
  );
}

/** Токен есть и не истечёт в ближайшие 60 секунд. */
function cachedToken(): string | null {
  if (!tokenCache) return null;
  if (Date.now() >= tokenCache.expiresAt - 60_000) return null;
  return tokenCache.token;
}

/**
 * client_credentials → access_token. force=true — перевыпустить, игнорируя
 * кеш (используется после 401: токен могли отозвать/перевыпустить скоупы).
 */
export async function getAvitoAccessToken(force = false): Promise<string> {
  if (!force) {
    const cached = cachedToken();
    if (cached) return cached;
  }
  const clientId = process.env.AVITO_CLIENT_ID;
  const clientSecret = process.env.AVITO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(avitoReplyConfigError() || "AVITO_CLIENT_ID/SECRET не настроены");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      `Avito token request failed: HTTP ${res.status} ${bodyText.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  const token = json.access_token;
  if (!token) throw new Error("Avito token response has no access_token");
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 86_400;
  tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

/** Только для тестов: сбросить кеш токена между кейсами. */
export function resetAvitoTokenCacheForTests(): void {
  tokenCache = null;
}

// ── Send message ────────────────────────────────────────────────────────────

export type AvitoSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; status?: number };

/**
 * Человекочитаемая расшифровка ошибок Авито для тоста оператору.
 * 402 — нет подписки «API Мессенджера»; 403 — нет скоопа messenger:write;
 * 401 — токен отозван (один автоматический retry с force-refresh уже сделан).
 */
function friendlySendError(status: number, bodyText: string): string {
  switch (status) {
    case 400:
      return "Авито отклонил сообщение (HTTP 400) — проверьте текст и попробуйте ещё раз";
    case 401:
      return "Avito не принял токен (HTTP 401) — проверьте AVITO_CLIENT_ID/SECRET";
    case 402:
      return "Нужна подписка «API Мессенджера» на аккаунте Авито (HTTP 402)";
    case 403:
      return "У приложения нет права messenger:write — включите скоуп на developers.avito.ru (HTTP 403)";
    case 404:
      return "Чат не найден в Авито (HTTP 404) — возможно, диалог удалён";
    case 429:
      return "Авито ограничил частоту отправки (HTTP 429) — попробуйте через минуту";
    default:
      return `Авито вернул ошибку HTTP ${status}: ${bodyText.slice(0, 160) || "без деталей"}`;
  }
}

/**
 * Отправить текст в реальный чат Авито от имени продавца.
 * Возвращает { ok:false } с понятной ошибкой вместо throw — решение о
 * повторе/показе принимает роут.
 */
export async function sendAvitoChatMessage(
  chatId: string,
  text: string,
): Promise<AvitoSendResult> {
  const userId = process.env.AVITO_USER_ID;
  const configError = avitoReplyConfigError();
  if (configError) return { ok: false, error: configError };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Пустой текст сообщения" };
  const payload = {
    text: trimmed.slice(0, AVITO_MESSAGE_MAX_LENGTH),
    type: "text" as const,
  };

  // Один автоматический retry после 401 (перевыпуск токена).
  for (let attempt = 0; attempt < 2; attempt++) {
    let token: string;
    try {
      token = await getAvitoAccessToken(attempt > 0);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Ошибка получения токена Avito" };
    }
    try {
      const res = await fetch(
        `${AVITO_API_BASE}/messenger/v3/accounts/${userId}/chats/${encodeURIComponent(chatId)}/messages/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
        },
      );
      if (res.ok) {
        // v3 отвечает { id: "...", ... } для созданного сообщения; некоторые
        // версии API возвращают uuid — тянем любой из известных id-полей.
        const json = (await res.json().catch(() => null)) as { id?: string; uuid?: string } | null;
        return { ok: true, messageId: json?.id ?? json?.uuid ?? null };
      }
      const bodyText = await res.text().catch(() => "");
      if (res.status === 401 && attempt === 0) continue; // refresh + retry once
      return { ok: false, error: friendlySendError(res.status, bodyText), status: res.status };
    } catch (error) {
      // Сетевой сбой — имеет смысл ретраить только второй попыткой.
      if (attempt === 0) continue;
      return {
        ok: false,
        error: `Сеть недоступна при отправке в Авито: ${error instanceof Error ? error.message : "unknown"}`,
      };
    }
  }
  return { ok: false, error: "Не удалось отправить сообщение в Авито" };
}
