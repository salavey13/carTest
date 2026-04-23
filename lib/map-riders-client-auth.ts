import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

let cachedAppToken: string | null = null;
let pendingAppTokenPromise: Promise<string | null> | null = null;

async function getTelegramAppJwt(): Promise<string | null> {
  if (cachedAppToken) return cachedAppToken;
  if (pendingAppTokenPromise) return pendingAppTokenPromise;

  pendingAppTokenPromise = (async () => {
    if (typeof window === "undefined") return null;
    const chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
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
