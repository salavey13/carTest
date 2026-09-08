// /app/franchize/lib/avito-messenger.ts
//
// Avito Messenger API — исходящий клиент для ответов покупателям из CRM.
//
// ВХОДЯЩИЙ канал (webhook v3 + VPS-поллер scripts/avito-monitor) живёт в
// app/api/webhooks/avito/route.ts. ЭТОТ файл — ИСХОДЯЩИЙ: оператор жмёт
// «Отправить в Авито» на странице лидов, текст улетает в реальный чат
// покупателя через POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/messages/.
// ВАЖНО: отправка — только v1! У v3 нет POST-роута (405, живая проба
// 2026-09-09), тело — {"type":"text","message":{"text":…}} (вложенное
// message; плоский {"text":…} даёт 400).
//
// Креды: client_credentials-пара приложения (developers.avito.ru ИЛИ новые
// «API-ключи» из кабинета: Настройки → Для профессионалов). Права (scopes)
// в кабинете НЕ настраиваются — они запрашиваются в token-запросе (см.
// AVITO_TOKEN_SCOPE ниже). Токен минтится на лету и кешируется в памяти
// инстанса до истечения (expires_in, обычно 24ч) — как в поллере: ~2
// token-запроса в день на тёплый инстанс, холодный просто минтит новый.
// Никаких секретов в коде/репо — только env.
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

/**
 * Скоупы запрашиваются В ТОКЕН-ЗАПРОСЕ (в кабинете Авито галочек для прав
 * нет — подтверждено владельцем и живой пробой 2026-09-09): новые «API-ключи»
 * без явного scope выдают токен БЕЗ мессенджер-прав, и все вызовы отвечают
 * 403 permission denied. Старым приложениям (developers.avito.ru) параметр
 * безвреден; если Авито вдруг отвергнет scope — ретраим без него.
 */
const AVITO_TOKEN_SCOPE = "messenger:read messenger:write";

/** Avito режет слишком длинные сообщения — страхуемся на своей стороне. */
export const AVITO_MESSAGE_MAX_LENGTH = 3000;

// ── Multi-account (несколько кабинетов Авито) ───────────────────────────────
//
// Сегодняшний аккаунт аренды (rental) — дефолт: AVITO_CLIENT_ID/SECRET/USER_ID.
// Когда подключится второй аккаунт (например продажи, «sale»), webhook начнёт
// помечать лиды metadata.avitoAccount=<key> (ключ берётся из ?acc=<key> в URL
// вебхука), а в env добавляются ТРИ переменные на аккаунт:
//   AVITO_ACCOUNT_<KEY>_CLIENT_ID / _CLIENT_SECRET / _USER_ID
// (например AVITO_ACCOUNT_SALE_USER_ID). Ответ в чат уходит от имени того
// аккаунта, которому принадлежит чат, — фолбэка на дефолт нет сознательно:
// чужой аккаунт всё равно фейлится на стороне Авито, а явная ошибка конфига
// быстрее приведёт к правильным env.

const DEFAULT_AVITO_ACCOUNT = "rental";

export interface AvitoAccountCreds {
  /** Нормализованный ключ аккаунта ("rental", "sale", …). */
  key: string;
  clientId: string;
  clientSecret: string;
  userId: string;
  /** Имена ОТСУТСТВУЮЩИХ env-переменных для этого аккаунта. */
  missing: string[];
}

export function normalizeAvitoAccountKey(raw?: string | null): string {
  const key = (raw || "").trim().toLowerCase();
  return key || DEFAULT_AVITO_ACCOUNT;
}

function accountEnvNames(key: string): [string, string, string] {
  const upper = key.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return [
    `AVITO_ACCOUNT_${upper}_CLIENT_ID`,
    `AVITO_ACCOUNT_${upper}_CLIENT_SECRET`,
    `AVITO_ACCOUNT_${upper}_USER_ID`,
  ];
}

/**
 * Креды для аккаунта: "rental" (или пусто — старые лиды без метки) →
 * дефолтные AVITO_*; любой другой ключ → AVITO_ACCOUNT_<KEY>_*. missing
 * перечисляет, каких env не хватает (роут отдаст понятную 503).
 */
export function resolveAvitoAccountCreds(rawKey?: string | null): AvitoAccountCreds {
  const key = normalizeAvitoAccountKey(rawKey);
  if (key === DEFAULT_AVITO_ACCOUNT) {
    const missing: string[] = [];
    if (!process.env.AVITO_CLIENT_ID) missing.push("AVITO_CLIENT_ID");
    if (!process.env.AVITO_CLIENT_SECRET) missing.push("AVITO_CLIENT_SECRET");
    if (!process.env.AVITO_USER_ID) missing.push("AVITO_USER_ID");
    return {
      key,
      clientId: process.env.AVITO_CLIENT_ID || "",
      clientSecret: process.env.AVITO_CLIENT_SECRET || "",
      userId: process.env.AVITO_USER_ID || "",
      missing,
    };
  }
  const [idEnv, secretEnv, userEnv] = accountEnvNames(key);
  const clientId = process.env[idEnv] || "";
  const clientSecret = process.env[secretEnv] || "";
  const userId = process.env[userEnv] || "";
  const missing: string[] = [];
  if (!clientId) missing.push(idEnv);
  if (!clientSecret) missing.push(secretEnv);
  if (!userId) missing.push(userEnv);
  return { key, clientId, clientSecret, userId, missing };
}

// ── Token cache (in-memory, per serverless instance, per account) ──────────

const tokenCacheByAccount = new Map<string, { token: string; expiresAt: number }>();

/**
 * Возвращает человекочитаемое описание НЕДОСТАЮЩЕЙ конфигурации или null,
 * если исходящая отправка настроена. Используется роутом, чтобы отдать
 * оператору понятную ошибку вместо сырости «500». accountKey — метка
 * аккаунта из metadata лида (см. resolveAvitoAccountCreds).
 */
export function avitoReplyConfigError(accountKey?: string | null): string | null {
  const creds = resolveAvitoAccountCreds(accountKey);
  if (creds.missing.length === 0) return null;
  const suffix =
    creds.key === DEFAULT_AVITO_ACCOUNT ? "" : ` для аккаунта «${creds.key}»`;
  return (
    `Отправка в Авито не настроена${suffix}: нет ${creds.missing.join(", ")} в окружении. ` +
    "Добавьте client_id/client_secret приложения с нужным скоупом " +
    "messenger:write и user_id профиля продавца — владельца чата."
  );
}

/** Токен есть и не истечёт в ближайшие 60 секунд. */
function cachedToken(accountKey: string): string | null {
  const entry = tokenCacheByAccount.get(accountKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt - 60_000) return null;
  return entry.token;
}

/**
 * client_credentials → access_token. force=true — перевыпустить, игнорируя
 * кеш (используется после 401: токен могли отозвать/перевыпустить скоупы).
 */
export async function getAvitoAccessToken(
  force = false,
  accountKey?: string | null,
): Promise<string> {
  const creds = resolveAvitoAccountCreds(accountKey);
  if (!force) {
    const cached = cachedToken(creds.key);
    if (cached) return cached;
  }
  if (!creds.clientId || !creds.clientSecret) {
    throw new Error(
      avitoReplyConfigError(creds.key) || "AVITO_CLIENT_ID/SECRET не настроены",
    );
  }
  const credentials = {
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  };
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  // Попытка 1 — со скоупами (обязательно для новых API-ключей из кабинета).
  let res = await fetch(TOKEN_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams({ ...credentials, scope: AVITO_TOKEN_SCOPE }),
    cache: "no-store",
  });
  // Попытка 2 (фолбэк для старых приложений) — без scope.
  if (!res.ok) {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers,
      body: new URLSearchParams(credentials),
      cache: "no-store",
    });
  }
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
  tokenCacheByAccount.set(creds.key, { token, expiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

/** Только для тестов: сбросить кеш токена между кейсами. */
export function resetAvitoTokenCacheForTests(): void {
  tokenCacheByAccount.clear();
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
      return (
        "У приложения нет права messenger:write, либо оно зарегистрировано " +
        "не под тем аккаунтом Авито (нужен профиль продавца, владеющий чатами) — HTTP 403"
      );
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
  accountKey?: string | null,
): Promise<AvitoSendResult> {
  const userId = resolveAvitoAccountCreds(accountKey).userId;
  const configError = avitoReplyConfigError(accountKey);
  if (configError) return { ok: false, error: configError };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Пустой текст сообщения" };
  // v1-схема: type на верхнем уровне, текст внутри вложенного message.
  const payload = {
    type: "text" as const,
    message: { text: trimmed.slice(0, AVITO_MESSAGE_MAX_LENGTH) },
  };

  // Один автоматический retry после 401 (перевыпуск токена).
  for (let attempt = 0; attempt < 2; attempt++) {
    let token: string;
    try {
      token = await getAvitoAccessToken(attempt > 0, accountKey);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Ошибка получения токена Avito",
      };
    }
    try {
      const res = await fetch(
        `${AVITO_API_BASE}/messenger/v1/accounts/${userId}/chats/${encodeURIComponent(chatId)}/messages/`,
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
        // v1 отвечает { id: "…", … } для созданного сообщения; некоторые
        // версии API возвращают uuid — тянем любой из известных id-полей.
        const json = (await res.json().catch(() => null)) as
          | { id?: string; uuid?: string; message?: { id?: string } }
          | null;
        return { ok: true, messageId: json?.id ?? json?.uuid ?? json?.message?.id ?? null };
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
