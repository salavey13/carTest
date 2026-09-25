"use client";

// /app/franchize/[slug]/bikes/BikeReportButton.tsx
// «Отчёт» button on every Мотопарк card (2026-09-26): fetches the bike's
// rentals one-pager from getBikeRentalsReportAction and saves it as a .md
// file (boss format: summary + table + deep links). Scope follows the wall's
// month selector — all-time by default («Аренды за всё время», the boss
// samples), the selected month when paged («Аренды за сентябрь 2026») — so
// the report never contradicts the numbers on screen.
//
// WebView reality: blob-anchor download is the established in-app pattern
// (SalesAnalyticsClient CSV export). Telegram iOS can silently ignore the
// download AND reject the clipboard after the awaited action (transient
// activation expiry), so the toast wording stays honest about both paths.
// The clipboard fallback only runs inside Telegram — on desktop browsers the
// download already worked and clobbering the clipboard is rude.
//
// The button is a SIBLING of the card Link (never nested inside <a>) — valid
// HTML, clicks stay unambiguous; the invisible padded span inside the button
// widens the hit area to ~44px because a mis-tap here lands on the card Link
// underneath.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, FileDown, Loader2, X } from "lucide-react";

import { getBikeRentalsReportAction } from "@/app/franchize/server-actions/bike-wall";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { monthLabelRu } from "@/app/franchize/lib/bike-wall";

interface BikeReportButtonProps {
  slug: string;
  bikeId: string;
  bikeLabel: string;
  /** Server-verified actor id from the wall (dbUser or password owner). */
  actorUserId?: string | null;
  isPasswordAuth: boolean;
  /** "YYYY-MM" (MSK) — the wall's selected month; null = all-time report. */
  month?: string | null;
  className?: string;
}

/** True inside the Telegram Mini App WebView (iOS ignores blob downloads). */
function isTelegramWebView(): boolean {
  try {
    const platform = (window as unknown as { Telegram?: { WebApp?: { platform?: string } } })
      .Telegram?.WebApp?.platform;
    return typeof platform === "string" && platform.length > 0 && platform !== "unknown";
  } catch {
    return false;
  }
}

function hapticLight(): void {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred?: (s: string) => void } } } })
      .Telegram?.WebApp?.HapticFeedback;
    tg?.impactOccurred?.("light");
  } catch {
    /* haptics are cosmetic */
  }
}

/** Blob-anchor download, same recipe as SalesAnalyticsClient's CSV export. */
function downloadMarkdown(markdown: string, filename: string): void {
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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A multi-hundred-KB payload can freeze the WebView clipboard — skip it. */
const CLIPBOARD_MAX_CHARS = 256 * 1024;

type ButtonState = "idle" | "loading" | "done" | "failed";

export function BikeReportButton({
  slug,
  bikeId,
  bikeLabel,
  actorUserId,
  isPasswordAuth,
  month,
  className = "",
}: BikeReportButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  // Reset «done»/«failed» visuals after a beat; ref avoids stacking timers.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // unmount cleanup — bikes refetch / month switch can drop the card
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);
  const flashThenReset = useCallback((s: Exclude<ButtonState, "idle" | "loading">) => {
    setState(s);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState("idle"), 2600);
  }, []);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      // preventDefault/stopPropagation are future-proofing: the button is a
      // sibling of the card Link today, but it must survive being moved
      // inside one without silently starting a navigation.
      e.preventDefault();
      e.stopPropagation();
      if (state === "loading") return;

      // Re-entering loading must disarm a pending done/failed flash —
      // otherwise it fires mid-request and re-enables the button early.
      if (resetTimer.current) clearTimeout(resetTimer.current);
      setState("loading");
      try {
        const result = await getBikeRentalsReportAction({
          slug,
          bikeId,
          actorUserId: actorUserId || undefined,
          isPasswordAuth,
          month,
          initData: getTelegramInitData(),
        });
        if (!result.success || !result.data) {
          throw new Error(result.error || "Не удалось собрать отчёт");
        }
        const { markdown, filename } = result.data;
        downloadMarkdown(markdown, filename);
        hapticLight();
        const copied =
          isTelegramWebView() && markdown.length <= CLIPBOARD_MAX_CHARS
            ? await copyToClipboard(markdown)
            : false;
        const scope = month ? monthLabelRu(month) : "за всё время";
        if (copied) {
          toast.success(`Отчёт готов: ${bikeLabel}`, {
            description: `${scope} · файл сохранён, копия — в буфере обмена`,
          });
        } else {
          toast.success(`Отчёт готов: ${bikeLabel}`, {
            description: `${scope} · ${filename}. Если файл не появился — попробуйте ещё раз`,
            duration: 6000,
          });
        }
        flashThenReset("done");
      } catch (err) {
        flashThenReset("failed");
        const message = err instanceof Error ? err.message : "Не удалось собрать отчёт";
        toast.error(`Отчёт: ${bikeLabel}`, { description: message });
      }
    },
    [state, slug, bikeId, actorUserId, isPasswordAuth, month, bikeLabel, flashThenReset],
  );

  const failed = state === "failed";
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      aria-label={`Сохранить отчёт по арендам — ${bikeLabel}${month ? `, ${monthLabelRu(month)}` : ", за всё время"}`}
      title={`Отчёт по арендам — ${bikeLabel}`}
      className={`relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-sm transition active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
      style={{
        backgroundColor: "rgba(15, 18, 22, 0.72)",
        borderColor: failed ? "rgba(248, 113, 113, 0.65)" : "rgba(255, 255, 255, 0.22)",
        color: "#ffffff",
      }}
    >
      {/* invisible hit-area pad — visual pill stays small, taps forgive ~10px */}
      <span aria-hidden="true" className="absolute -inset-x-3 -inset-y-2.5 rounded-full" />
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="h-3.5 w-3.5" />
      ) : failed ? (
        <X className="h-3.5 w-3.5" />
      ) : (
        <FileDown className="h-3.5 w-3.5" />
      )}
      <span>{state === "loading" ? "Готовим…" : "Отчёт"}</span>
    </button>
  );
}
