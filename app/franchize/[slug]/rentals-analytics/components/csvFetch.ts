// Shared helper for the CSV table-view modal (rentals + sales analytics).
//
// FIX (iter6, user request): when the table fails to load, the modal used to
// show a generic "Не удалось загрузить данные" with no clue about the cause.
// This helper extracts the REAL error from the API response (JSON `{error}` or
// raw body text, or the browser network error) so the modal can display it:
//   "Не удалось загрузить данные — HTTP 500: Internal error".

export async function fetchCsvTextWithError(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(url, { headers });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "network error";
    throw new Error(`нет соединения (${reason})`);
  }
  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.text();
      try {
        const parsed = JSON.parse(body) as { error?: string; message?: string };
        if (parsed && typeof parsed.error === "string" && parsed.error) {
          detail = parsed.error;
        } else if (parsed && typeof parsed.message === "string" && parsed.message) {
          detail = parsed.message;
        }
      } catch {
        // Not JSON — use the raw body (truncated).
        detail = body.trim().slice(0, 200);
      }
    } catch {
      // Body unreadable — fall back to the status code only.
    }
    throw new Error(`HTTP ${resp.status}${detail ? `: ${detail}` : ""}`);
  }
  return await resp.text();
}
