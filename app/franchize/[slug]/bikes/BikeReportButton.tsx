"use client";

// /app/franchize/[slug]/bikes/BikeReportButton.tsx
// «Отчёт» action row on the BIKE STORY page (2026-09-27): fetches the bike's
// rentals one-pager from getBikeRentalsReportAction and delivers it as a .md
// file (boss format: summary + table + deep links). Scope follows the story
// page's month selector — all-time by default («Вся история»), the selected
// month when paged («Аренды за сентябрь 2026») — so the report never
// contradicts the numbers on screen.
//
// HISTORY: it used to be a small overlay pill on every Мотопарк wall card —
// absolutely positioned over the photo it was nearly cropped away on mobile
// (boss: "barely partially visible, almost missed it"), and the wall's own
// month selector made it look month-scoped while the report silently stayed
// all-time. Moving it into the story page fixed both: full-width row below
// the month selector (impossible to miss, native tap target) and month
// wiring straight from the same selector that scopes the KPI band.
//
// WebView reality (2026-09-26 refine): inside Telegram the .md file is SENT
// TO THE USER'S CHAT by the bot via /api/forward-telegram (sendDocument,
// base64) — iOS WebView silently ignores blob-anchor downloads, and a file
// in the chat can be opened/saved/forwarded from any phone. The blob
// download remains the non-Telegram path (SalesAnalyticsClient CSV recipe)
// and the fallback if the forward API fails; the clipboard copy stays as a
// second fallback inside Telegram (transient-activation aware).

// 2026-10-03 refine: the delivery helpers (TG forward / download / clipboard)
// moved to lib/report-file-delivery.ts — the subrenter month report button
// reuses the same chain instead of a diverging copy.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, FileDown, Loader2, X } from "lucide-react";

import { getBikeRentalsReportAction } from "@/app/franchize/server-actions/bike-wall";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { monthLabelRu } from "@/app/franchize/lib/bike-wall";
import {
  deliverReportFile,
  escapeHtml,
  hapticLight,
} from "@/app/franchize/lib/report-file-delivery";

interface BikeReportButtonProps {
  slug: string;
  bikeId: string;
  bikeLabel: string;
  /** Server-verified actor id from the wall (dbUser or password owner). */
  actorUserId?: string | null;
  isPasswordAuth: boolean;
  /** "YYYY-MM" (MSK) — the story's selected month; null = all-time report. */
  month?: string | null;
  /** Crew-theme tokens (useCrewTokens) — on-page row must follow the theme. */
  bgColor?: string;
  borderColor?: string;
  textColor?: string;
  /** Scope-chip face — defaults fit the legacy dark-glass fallback look. */
  chipBg?: string;
  chipText?: string;
  className?: string;
}

type ButtonState = "idle" | "loading" | "done" | "failed";

export function BikeReportButton({
  slug,
  bikeId,
  bikeLabel,
  actorUserId,
  isPasswordAuth,
  month,
  bgColor = "rgba(15, 18, 22, 0.72)",
  borderColor,
  textColor = "#ffffff",
  chipBg,
  chipText,
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
        const scope = month ? monthLabelRu(month) : "за всё время";

        // In Telegram the chat IS the delivery channel — a document lands in
        // the user's own chat, openable/savable on any phone (iOS WebView
        // ignores blob downloads). Download remains the fallback when the
        // forward API is unavailable.
        const delivered = await deliverReportFile(
          markdown,
          filename,
          `Отчёт по арендам — <b>${escapeHtml(bikeLabel)}</b> (${escapeHtml(scope)})`,
        );

        if (delivered.via === "telegram") {
          hapticLight();
          toast.success(`Отчёт готов: ${bikeLabel}`, {
            description: `${scope} · отправлен файлом в чат с ботом`,
          });
        } else {
          const copied = delivered.via === "download+clipboard";
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
  const scope = month ? monthLabelRu(month) : "за всё время";
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      aria-label={`Сохранить отчёт по арендам — ${bikeLabel}${month ? `, ${monthLabelRu(month)}` : ", за всё время"}`}
      title={`Отчёт по арендам — ${bikeLabel}`}
      className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      style={{
        backgroundColor: bgColor,
        borderColor: failed ? "rgba(248, 113, 113, 0.65)" : borderColor ?? "rgba(255, 255, 255, 0.22)",
        color: textColor,
      }}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : state === "done" ? (
          <Check className="h-4 w-4 shrink-0" />
        ) : failed ? (
          <X className="h-4 w-4 shrink-0" />
        ) : (
          <FileDown className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{state === "loading" ? "Готовим отчёт…" : state === "done" ? "Отчёт отправлен" : state === "failed" ? "Не удалось — повторить?" : "Отчёт по арендам"}</span>
      </span>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
        style={{
          backgroundColor: chipBg ?? "rgba(255, 255, 255, 0.08)",
          color: chipText ?? textColor,
        }}
      >
        {scope}
      </span>
    </button>
  );
}
