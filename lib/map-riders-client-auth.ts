import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isAllowedMockContext } from "@/lib/telegram-mock-context";

let cachedAppToken: string | null = null;
let pendingAppTokenPromise: Promise<string | null> | null = null;

async function getTelegramAppJwt(): Promise<string | null> {
  if (cachedAppToken) return cachedAppToken;
  if (pendingAppTokenPromise) return pendingAppTokenPromise;

  pendingAppTokenPromise = (async () => {
    if (typeof window === "undefined") return null;
    const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const mockUserId = process.env.NEXT_PUBLIC_USE_MOCK_USER === "true" && isAllowedMockContext()
      ? process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377"
      : null;
    const chatId = telegramUserId || mockUserId;
    if (!chatId) return null;

    const response = await fetch("/api/auth/jwt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId) }),
    });
    if (!response.ok) return null;

    const json = (await response.json()) as { token?: string };
    cachedAppToken = json.token || null;
    return cachedAppToken;
  })()
    .catch(() => null)
    .finally(() => {
      pendingAppTokenPromise = null;
    });

  return pendingAppTokenPromise;
}

export async function getMapRidersWriteHeaders(contentType = true): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "X-Requested-With": "XMLHttpRequest",
  };
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  let token = data?.session?.access_token || null;
  if (!token) {
    token = await getTelegramAppJwt();
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
