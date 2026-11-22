"use client";

// /app/franchize/components/SubrenterReportButton.tsx
// «Отчёт партнёру» action (2026-10-03, boss: «add "total for subrenter
// excluding equipment" report in subrenter's profile, subrenter's section in
// admin franchize page and in motopark»): fetches the partner's month
// one-pager from getSubrenterMonthReportAction and delivers the .md through
// the SAME chain as the Мотопарк bike report (bot sendDocument inside
// Telegram, blob download + clipboard fallback outside).
//
// Two modes of getSubrenterMonthReportAction:
//   • SELF  — omit chatId: the verified actor IS the partner (his profile);
//   • ADMIN — pass chatId: actor must manage subrenters (admin surfaces).
//
// The headline of every report: «Итого партнёру (N% от мото, без экипировки)».

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";

import { getSubrenterMonthReportAction } from "@/app/franchize/server-actions/subrenter-monitoring";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { monthKeyToLabelRu } from "@/app/franchize/lib/subrenter-economics";
import {
  deliverReportFile,
  escapeHtml,
  hapticLight,
} from "@/app/franchize/lib/report-file-delivery";

interface SubrenterReportButtonProps {
  slug: string;
  /** "YYYY-MM" (MSK) — report scope (follows the surface's month switcher). */
  month: string;
  /** ADMIN mode: partner chat id. Omit for SELF mode (own profile). */
  chatId?: string;
  /** Verified actor id (server re-verifies — cookie/initData). */
  actorUserId?: string | null;
  /** Button label; defaults to «Отчёт партнёру». */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

type ButtonState = "idle" | "loading" | "done" | "failed";

export function SubrenterReportButton({
  slug,
  month,
  chatId,
  actorUserId,
  label = "Отчёт партнёру",
  className = "",
  style,
}: SubrenterReportButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");

  const handleClick = async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const result = await getSubrenterMonthReportAction({
        slug,
        month,
        ...(chatId ? { chatId } : {}),
        actorUserId: actorUserId || undefined,
        initData: getTelegramInitData(),
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || "Не удалось собрать отчёт");
      }
      const { markdown, filename, stats } = result.data;
      const scope = monthKeyToLabelRu(month);
      const delivered = await deliverReportFile(
        markdown,
        filename,
        `Отчёт партнёру — <b>${escapeHtml(scope)}</b> · итого без экипировки <b>${escapeHtml(
          `${stats.partnerRub.toLocaleString("ru-RU")} ₽`,
        )}</b>`,
      );
      const headline = `Итого партнёру (без экипировки): ${stats.partnerRub.toLocaleString("ru-RU")} ₽`;
      if (delivered.via === "telegram") {
        hapticLight();
        toast.success(`${label}: ${scope}`, { description: headline + " · файл в чате с ботом" });
      } else {
        toast.success(`${label}: ${scope}`, {
          description: `${headline}${delivered.via === "download+clipboard" ? " · копия в буфере обмена" : ` · ${filename}`}`,
          duration: 6000,
        });
      }
      setState("done");
    } catch (err) {
      setState("failed");
      toast.error(`${label}: месяц ${month}`, {
        description: err instanceof Error ? err.message : "Не удалось собрать отчёт",
      });
    } finally {
      setTimeout(() => setState("idle"), 2600);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={state === "loading"}
      aria-label={`${label} — ${month}`}
      title={`Итого партнёру за месяц (без экипировки) — файлом в чат/на устройство`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-85 active:scale-[0.98] disabled:opacity-60 ${className}`}
      style={style}
    >
      {state === "loading" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <FileDown className="h-3 w-3" />
      )}
      {state === "loading" ? "Готовим…" : state === "failed" ? "Ещё раз?" : label}
    </button>
  );
}
