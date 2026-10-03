// /app/franchize/lib/report-file-delivery.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared client-side delivery of generated report files (.md) — extracted
// from BikeReportButton (2026-10-03) so the subrenter month report button
// (profile / admin overview / admin page) reuses the EXACT same Telegram
// delivery chain instead of a diverging copy.
//
// WebView reality (see BikeReportButton for the full history): inside the
// Telegram Mini App the file is SENT TO THE USER'S CHAT by the bot via
// /api/forward-telegram (sendDocument, base64) — iOS WebView silently ignores
// blob-anchor downloads. Blob download + clipboard remain the non-Telegram
// fallbacks. Client-only: touches window/fetch — never import from a server
// action.
// ─────────────────────────────────────────────────────────────────────────────

/** True inside the Telegram Mini App WebView (iOS ignores blob downloads). */
export function isTelegramWebView(): boolean {
  try {
    const platform = (window as unknown as { Telegram?: { WebApp?: { platform?: string } } })
      .Telegram?.WebApp?.platform;
    return typeof platform === "string" && platform.length > 0 && platform !== "unknown";
  } catch {
    return false;
  }
}

/**
 * The signed-in user's own Telegram chat id — the delivery target for the
 * report document. initDataUnsafe is not HMAC-verified, but it only chooses
 * WHO receives a report the server action already produced for THIS actor;
 * worst case a spoofed id mails the (already authorized) report to the
 * spoofer's own chat with the bot.
 */
export function getTelegramChatId(): string | null {
  try {
    const id = (
      window as unknown as {
        Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number | string } } } };
      }
    ).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return id !== undefined && id !== null && String(id).length > 0 ? String(id) : null;
  } catch {
    return null;
  }
}

/** UTF-8-safe base64 in ~32k-byte chunks (no call-stack blowups on big md). */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function hapticLight(): void {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred?: (s: string) => void } } } })
      .Telegram?.WebApp?.HapticFeedback;
    tg?.impactOccurred?.("light");
  } catch {
    /* haptics are cosmetic */
  }
}

/**
 * Send the .md report INTO the user's own Telegram chat via the forward
 * API (same envelope as notify/QR flows): {chat_id, method, payload, files}.
 */
export async function forwardReportToTelegram(
  chatId: string,
  markdown: string,
  filename: string,
  captionHtml: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/forward-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        method: "sendDocument",
        payload: {
          caption: captionHtml,
          parse_mode: "HTML",
        },
        files: {
          document: {
            data: utf8ToBase64(markdown),
            filename,
            contentType: "text/markdown;charset=utf-8",
          },
        },
      }),
    });
    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;
    if (!response.ok || !json?.ok) {
      return { ok: false, error: json?.error || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "forward failed" };
  }
}

/** Blob-anchor download, same recipe as SalesAnalyticsClient's CSV export. */
export function downloadMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — Safari starts an async read of the blob URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A multi-hundred-KB payload can freeze the WebView clipboard — skip it. */
export const CLIPBOARD_MAX_CHARS = 256 * 1024;

/**
 * One-shot delivery used by every report button: Telegram sendDocument first,
 * download + clipboard fallback outside/broken Telegram. Returns a short
 * human toast line describing what actually happened.
 */
export async function deliverReportFile(
  markdown: string,
  filename: string,
  captionHtml: string,
): Promise<{ via: "telegram" | "download+clipboard" | "download"; ok: boolean }> {
  const chatId = isTelegramWebView() ? getTelegramChatId() : null;
  if (chatId) {
    const forward = await forwardReportToTelegram(chatId, markdown, filename, captionHtml);
    if (forward.ok) return { via: "telegram", ok: true };
  }
  downloadMarkdown(markdown, filename);
  const copied =
    chatId && markdown.length <= CLIPBOARD_MAX_CHARS ? await copyToClipboard(markdown) : false;
  return { via: copied ? "download+clipboard" : "download", ok: true };
}
