import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function getMapRidersWriteHeaders(contentType = true): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "X-Requested-With": "XMLHttpRequest",
  };
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
