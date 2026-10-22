"use client";

// /app/franchize/components/CommissionVerificationCard.tsx
//
// Task 126 — «Сверка комиссии»: ONE transparent card that shows the frozen
// commission math (the exact digits the Telegram сверка DM froze) + the
// verification state + the quick action buttons, everywhere a closed rental
// is looked at:
//   • rentals-analytics rental drawer (the overhauled modal),
//   • the rental page (replaces the bare «🤝 Сверка расчёта» strip).
//
// Design notes:
//   • Self-contained actions — the card owns its pending/fail state and
//     calls the SAME server actions the analytics page used
//     (adminVerifyRentalAction / resendVerificationDmsAction; both re-gate
//     the owner role server-side, so a hidden client button is not a hole).
//     The parent is notified via onChanged() to refetch fresh state.
//   • Numbers come from the verification snapshot (frozen at request time) —
//     NOT recomputed here. The card is a window into what both parties
//     already saw in the DM, which is exactly what «сверка» means.
//   • Theme is a flat token bag so both surfaces (analytics ThemeTokens and
//     the rental page palette) can feed it without coupling.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import type {
  RentalVerificationStatus,
  SplitParts,
  VerificationCommissionBrief,
} from "@/app/franchize/lib/rental-verify-core";
import {
  adminVerifyRentalAction,
  resendVerificationDmsAction,
} from "@/app/franchize/server-actions/rental-verify-actions";
// Task 126: pure math + status mapping live in the client-safe core.
import {
  buildCommissionLines,
  commissionStatusMeta,
  fmtRub,
  type CommissionCardStatus,
  type CommissionCardTheme,
} from "@/app/franchize/lib/commission-card-core";

// ── Pure helpers (exported for tests) ───────────────────────────────────────

// ── Component ───────────────────────────────────────────────────────────────

interface CommissionVerificationCardProps {
  slug: string;
  rentalId: string;
  /** completed / confirmed — actions only make sense on a closed rental. */
  rentalStatus: string | null | undefined;
  /** Frozen snapshot numbers (null = no row or a pre-money row). */
  commission: VerificationCommissionBrief | null | undefined;
  verificationStatus?: RentalVerificationStatus | null;
  /** Negotiated (corrected) split after an accepted proposal. */
  agreedSplit?: SplitParts | null;
  proposalOpen?: boolean;
  /** Task 114 audit verdict — WHY the numbers deserve a look. */
  audit?: { grade?: string; notes?: string[] } | null;
  /** Owner-tier gate for the manual «✓ подтвердить» button. */
  canVerify?: boolean;
  /** Parent refetch hook (analytics reload token / router.refresh). */
  onChanged?: () => void;
  T: CommissionCardTheme;
}

export function CommissionVerificationCard({
  slug,
  rentalId,
  rentalStatus,
  commission,
  verificationStatus,
  agreedSplit,
  proposalOpen,
  audit,
  canVerify = false,
  onChanged,
  T,
}: CommissionVerificationCardProps) {
  // Task 126 (codereview #4): when the parent gives no onChanged hook (the
  // rental page is a server component), refresh the route ourselves so the
  // chip/status never lies after a successful action.
  const router = useRouter();
  const notifyChanged = (opts?: { createdOnly?: boolean }) => {
    if (opts?.createdOnly) {
      // resend: an existing row just re-DMed — no state change, skip the churn
      return;
    }
    if (onChanged) onChanged();
    else router.refresh();
  };
  const [verifying, setVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  // Codereview fix #1: «confirmed» is a BOOKING awaiting pickup in this app,
  // not a closed deal — a сверка on it would be fiction (and resend rejects
  // non-completed rows server-side). Only «completed» is a closed rental.
  const isClosed = rentalStatus === "completed";
  const hasAnything = commission != null || verificationStatus != null;
  const cardStatus: CommissionCardStatus = verificationStatus ?? "none";
  const meta = commissionStatusMeta(cardStatus, { proposalOpen, adjusted: agreedSplit != null });
  const adjustedTotal = agreedSplit
    ? agreedSplit.base + agreedSplit.equipment + agreedSplit.overprice
    : null;

  const handleVerify = async () => {
    if (verifying) return;
    const disputed = verificationStatus === "disputed";
    const ok = window.confirm(
      disputed
        ? "Закрыть спор и пометить сверку подтверждённой?\n\nИспользуйте только после личного разбора с оператором — обе стороны получат отметку «проверено»."
        : "Подтвердить сверку по этой аренде?\n\nАренда будет помечена «проверено» для оператора и владельца (используйте после личной сверки).",
    );
    if (!ok) return;
    setVerifying(true);
    setVerifyFailed(false);
    try {
      const res = await adminVerifyRentalAction({ slug, rentalId });
      if (res.success) {
        toast.success(disputed ? "Спор закрыт — сверка подтверждена ✅" : "Сверка подтверждена ✅");
        notifyChanged();
      } else {
        setVerifyFailed(true);
        toast.error(res.error || "Не удалось подтвердить сверку");
      }
    } catch {
      setVerifyFailed(true);
      toast.error("Не удалось подтвердить сверку");
    } finally {
      setVerifying(false);
    }
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      const res = await resendVerificationDmsAction({ slug, rentalId });
      if (res.success) {
        // Honest delivery report (boss 2026-10-20): the parties are operator +
        // owner; the presser usually gets only the actor proof copy.
        const sent = res.data?.sentTo?.length ?? 0;
        const failed = res.data?.failed ?? [];
        const copied = res.data?.actorCopied === true;
        const failNote = failed.length ? ` ⚠️ Не доставлено: ${failed.map((f) => f.chatId).join(", ")}` : "";
        toast.success(
          `${res.data?.created ? "Сверка создана и отправлена" : "Сверка отправлена в Telegram"} (${sent} получено${copied ? " + копия вам" : ""}) ✅${failNote}`,
          { duration: 6000 },
        );
        // codereview #7: refetch only when the row was CREATED (a plain
        // re-send changed nothing — the old client did the same)
        notifyChanged({ createdOnly: !res.data?.created });
      } else {
        setSendFailed(true);
        toast.error(res.error || "Не удалось отправить сверку");
      }
    } catch {
      setSendFailed(true);
      toast.error("Не удалось отправить сверку");
    } finally {
      setSending(false);
    }
  };

  const lines = commission ? buildCommissionLines(commission) : [];

  return (
    <section
      className="rounded-2xl border"
      style={{
        borderColor: cardStatus === "disputed" ? "#ef444455" : T.border,
        backgroundColor: T.bgCard,
      }}
      aria-label="Сверка комиссии"
    >
      {/* Header: title + status chip */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: meta.color }} aria-hidden />
          <span className="truncate text-sm font-semibold" style={{ color: T.text }}>
            Сверка комиссии
          </span>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      {/* Transparent math — the frozen snapshot digits */}
      {commission ? (
        <div className="mt-2.5 space-y-1 px-3">
          {lines.map((l, i) => (
            <div key={i}>
              <div
                className="flex items-baseline justify-between gap-3"
                style={{ minHeight: "24px" }}
              >
                <span
                  className={l.strong ? "text-sm font-bold" : "text-xs"}
                  style={{ color: l.strong ? T.text : T.textMuted }}
                >
                  {l.label}
                </span>
                <span
                  className={`whitespace-nowrap tabular-nums ${l.strong ? "text-sm font-bold" : "text-xs font-medium"}`}
                  style={{
                    color: l.strong ? T.accent : T.text,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {l.value}
                </span>
              </div>
              {l.hint && (
                <p className="text-[10px] leading-tight" style={{ color: T.textFaint }}>
                  {l.hint}
                </p>
              )}
              {l.strong && <div className="mt-1 border-t" style={{ borderColor: T.borderSoft }} />}
            </div>
          ))}
          {/* Negotiated correction — what the dispute settled on */}
          {adjustedTotal != null && (
            <p className="pt-0.5 text-[11px] font-medium" style={{ color: "#22c55e" }}>
              скорректировано по договорённости → {fmtRub(adjustedTotal)}
            </p>
          )}
          {/* Verified banner */}
          {cardStatus === "verified" && (
            <p className="flex items-center gap-1.5 pb-0.5 pt-1 text-[11px] font-semibold" style={{ color: "#22c55e" }}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              расчёт подтверждён обеими сторонами
            </p>
          )}
        </div>
      ) : hasAnything ? (
        <p className="mt-2 px-3 text-xs" style={{ color: T.textMuted }}>
          Цифры сверки не записаны (аренда закрыта до обновления системы) — актуальный расчёт
          уйдёт в Telegram при повторной отправке.
        </p>
      ) : (
        <p className="mt-2 px-3 text-xs" style={{ color: T.textMuted }}>
          {isClosed
            ? "Сверки ещё нет. Заведите её — обе стороны получат полный расчёт комиссии с кнопками ✅/⚠️ в Telegram."
            : "Сверка появится после закрытия аренды."}
        </p>
      )}

      {/* Audit verdict — the WHY, never hidden behind a hover */}
      {audit?.grade && audit.grade !== "fine" && (
        <div
          className="mx-3 mt-2.5 rounded-xl border px-2.5 py-2"
          style={{
            borderColor: audit.grade === "sus" ? "#ef444455" : "#f59e0b55",
            backgroundColor: audit.grade === "sus" ? "#ef44440d" : "#f59e0b0d",
          }}
        >
          <p
            className="flex items-center gap-1.5 text-[11px] font-bold"
            style={{ color: audit.grade === "sus" ? "#ef4444" : "#f59e0b" }}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {audit.grade === "sus" ? "аудит: расхождение" : "аудит: почти ок"}
          </p>
          {(audit.notes?.length ?? 0) > 0 && (
            <ul className="mt-1 space-y-0.5">
              {audit.notes!.map((n, i) => (
                <li
                  key={i}
                  className="text-[11px] leading-snug"
                  style={{ color: audit.grade === "sus" ? "#ef4444" : "#f59e0b" }}
                >
                  • {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Quick actions */}
      {isClosed && (
        <div className="flex flex-wrap items-center gap-2 p-3">
          {canVerify && cardStatus !== "verified" && (
            verifyFailed ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold"
                style={{ backgroundColor: "#ef44441a", color: "#ef4444" }}
              >
                ✕ не сохранилось — попробуйте ещё раз
              </span>
            ) : (
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:opacity-85 focus:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60"
                style={{ backgroundColor: "#22c55e1f", color: "#22c55e" }}
                title={
                  cardStatus === "disputed"
                    ? "Закрыть спор после личного разбора — обе стороны получат отметку «проверено»"
                    : "Подтвердить расчёт вручную (после личной сверки с оператором)"
                }
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                {cardStatus === "disputed" ? "Закрыть спор" : "Подтвердить расчёт"}
              </button>
            )
          )}
          {sendFailed ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold"
              style={{ backgroundColor: "#ef44441a", color: "#ef4444" }}
            >
              ✕ не отправилось — попробуйте ещё раз
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:opacity-85 focus:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60"
              style={{ backgroundColor: `${T.accent}1f`, color: T.accent }}
              title={
                cardStatus === "none"
                  ? "Завести сверку и выслать сводку с кнопками ✅/⚠️ оператору и владельцу в Telegram"
                  : "Выслать сводку сверки повторно (если сообщение потерялось)"
              }
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : cardStatus === "none" ? <Plus className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {cardStatus === "none" ? "Завести сверку в TG" : "Выслать сверку"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
