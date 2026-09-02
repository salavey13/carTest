"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Phone, PhoneCall, Clock, MoreVertical, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type {LeadRow} from "../leads-types";
import type { LeadSignal, StageKey } from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";
import type { LeadPriority } from "../lib/lead-priority";
import type { LeadHandling } from "../lib/lead-handling";
import { formatCallbackTime, isCallbackOverdue, callbackInMinutes } from "../lib/lead-handling";
import {
  STAGE_LABELS,
  STAGE_COLORS,
  getVerificationStatus,
  VERIFICATION_LABELS,
  getStageBottleneck,
  getFlowType,
} from "../lib/pipeline-stages";
import { SOURCE_META } from "../leads-constants";
import {
  getInitials,
  relativeTime,
  fmtMoney,
  formatDate,
} from "../leads-utils";

interface Props {
  lead: LeadRow;
  signals: LeadSignal[];
  selected: boolean;
  onSelect: () => void;
  onDismiss: (id: string) => void;
  /** Priority Score 0–100 (ТЗ): питает лайбочки ⚡ свежий / 🔥 счёт. */
  priority?: LeadPriority;
  /** «Отработан» / «Перезвонить в ...» — заметка-напоминание о перезвоне
   * должна быть КРУПНО видна прямо в списке лидов. */
  handling?: LeadHandling;
  T: ThemeTokens;
}

const TONE_COLOR: Record<LeadSignal["tone"], string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  neutral: "#64748b",
  good: "#22c55e",
};

/**
 * Type guard for LeadRow validation at runtime.
 * Provides type safety while maintaining defensive programming.
 */
function isValidLeadRow(lead: unknown): lead is LeadRow {
  return (
    typeof lead === "object" &&
    lead !== null &&
    "user_id" in lead &&
    typeof (lead as LeadRow).user_id === "string"
  );
}

/**
 * Lead card v2 — operational dashboard card.
 * - Left edge color stripe (3px wide, stage color)
 * - Avatar (40px mobile / 48px desktop) + name + verified check + task count badge
 * - Stage badge (right-aligned)
 * - Phone + time-ago
 * - Source / temperature tags
 * - Bike title + rental count + revenue + return date
 * - SLA block (right-aligned, compact)
 * - Chevron + overflow menu
 *
 * Mobile sizing: padding p-3 (12px) / md:p-4 (16px); name 14px / md:16px;
 * metadata 11px / md:13px. Left stripe is 3px (w-[3px]) so it reads as an
 * accent indicator without eating into the card content.
 */
export function LeadCard({ lead, signals, selected, onSelect, onDismiss, priority, handling, T }: Props) {
  // Type guard provides both runtime safety and type narrowing
  if (!isValidLeadRow(lead)) {
    return null;
  }
  const stageKey = lead.stageKey || "new";
  const stageColor = STAGE_COLORS[stageKey] || "#64748b";
  const stageLabel = STAGE_LABELS[stageKey] || stageKey;
  const displayName = lead.full_name || "Без имени";
  const initials = getInitials(lead.full_name);
  const rel = relativeTime(lead.lastSeenAt || lead.createdAt);
  const topSignal = signals[0];
  const slaColor = topSignal ? TONE_COLOR[topSignal.tone] : T.textFaint;

  const rental = lead.rentals[0] ?? null; // safe — may be undefined for leads with no rentals
  const rentalCount = lead.rentals.length;
  const revenue = lead.totalSpent || (rental?.totalCost ?? 0);
  const returnDate = rental?.endDate ? formatDate(rental.endDate) : null;
  const pending = signals.filter((s) => s.tone === "warning" || s.tone === "danger").length;

  // Next Step pill — flow-aware bottleneck for this stage.
  // Different flows (/doc vs web-app) have different bottlenecks at the same stage:
  // - /doc flow: QR stages apply (renter needs to scan QR), no photo upload needed
  // - Web-app flow: QR stages don't apply (chat_id auto-shared), photo upload is bottleneck
  const bottleneck = getStageBottleneck(lead);
  const flowType = getFlowType(lead);

  // Verification status — different for /doc flow vs web-app flow
  const verifStatus = getVerificationStatus(lead);
  const verifMeta = VERIFICATION_LABELS[verifStatus];

  // «Перезвонить в ...» — ПРИМАРНАЯ заметка лида (просьба босса: видна
  // сразу в списке, без открытия карточки). Просроченный — красный.
  const cb = handling?.callback ?? null;
  const cbOverdue = isCallbackOverdue(cb);
  const cbSoon = callbackInMinutes(cb);
  const cbLabel = cb ? formatCallbackTime(cb.dueAt) : "";

  return (
    <motion.article
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", damping: 22, stiffness: 320 }}
      onClick={onSelect}
      // pl-[18px] reserves space for the 3px left color stripe + breathing room.
      // p-3 (12px) on mobile, md:p-4 (16px) on desktop.
      className="relative cursor-pointer overflow-hidden rounded-[24px] p-3 pl-[18px] md:p-4 md:pl-[22px]"
      style={{
        background: T.bgCard,
        border: `1px solid ${selected ? stageColor : T.border}`,
        boxShadow: selected
          ? `0 0 0 2px ${stageColor}40, ${T.shadow}`
          : T.shadow,
        backdropFilter: "blur(12px)",
      }}
      aria-label={`Лид: ${displayName}${lead.phone ? `, ${lead.phone}` : ""}`}
    >
      {/* Left edge color stripe — 3px wide */}
      <div
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: stageColor }}
        aria-hidden
      />

      <div className="flex min-w-0 gap-3">
        {/* Avatar — 40px mobile, 48px desktop */}
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold md:h-12 md:w-12 md:text-base"
          style={{ background: `${stageColor}26`, color: stageColor }}
          aria-hidden
        >
          {initials}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Name + stage badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* FIX: name row — name gets flex-1 + min-w-0 so it truncates instead of
                  being squeezed by badges/buttons on mobile */}
              <div className="flex items-center gap-2">
                <h3
                  className="min-w-0 flex-1 truncate text-sm font-semibold md:text-base"
                  style={{ color: T.text }}
                >
                  {displayName}
                </h3>
                {/* ⚡ «Свежий» (ТЗ п.2, LIFO) — обратили внимание ≤ 60 мин назад.
                    Сопроводительная плашка, чтобы менеджер сразу считывал
                    «этого человека только что» и брал трубку первым. */}
                {priority?.isFresh && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: "#3b82f620", color: "#3b82f6" }}
                    title="Обращение поступило меньше часа назад — обработать первым"
                  >
                    ⚡ Свежий
                  </span>
                )}
                {/* 🔥 Priority Score (ТЗ п.1 + п.4) — итоговый индекс 0–100;
                    показывается только для «горячих» (score ≥ 70), чтобы плашки
                    не обесценивались спамом на каждой карточке. */}
                {priority?.isHot && (
                  <span
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
                    title={`Индекс приоритета ${priority.score}/100${priority.channelMultiplier > 1 ? ` (канал ×${priority.channelMultiplier})` : ""}`}
                  >
                    🔥 {priority.score}
                  </span>
                )}
                {lead.verified && (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: "#22c55e" }}
                    aria-label="Подтверждён"
                  />
                )}
                {pending > 0 && (
                  <span
                    className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold"
                    style={{ background: "#f59e0b26", color: "#f59e0b" }}
                    aria-label={`${pending} активных сигналов`}
                  >
                    {pending}
                  </span>
                )}
              </div>
              {/* Metadata: 11px mobile / 13px desktop */}
              <div
                className="mt-1 flex flex-wrap items-center gap-2 text-[11px] md:text-[13px]"
                style={{ color: T.textMuted }}
              >
                {lead.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" aria-hidden />
                    {lead.phone}
                  </span>
                )}
                {rel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {rel}
                  </span>
                )}
              </div>
            </div>
            {/* Stage badge — right-aligned, compact */}
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium md:px-3 md:text-[11px]"
              style={{ background: `${stageColor}1a`, color: stageColor }}
            >
              {stageLabel}
            </span>
            {/* Overflow menu — wraps the "more options" three-dots icon in a
                proper dropdown so a click opens a menu instead of immediately
                dismissing the lead (which was destructive and irreversible).
                Previously the ⋮ icon called onDismiss() directly with no
                confirmation, which led users to accidentally delete leads. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    // Prevent the parent motion.article's onSelect from firing
                    // when the user clicks the overflow trigger.
                    e.stopPropagation();
                  }}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-black/5"
                  style={{ color: T.textFaint, minHeight: "28px", minWidth: "28px" }}
                  aria-label="Действия с лидом"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56"
                // Stop click propagation so menu-item clicks don't bubble up
                // to the parent motion.article's onSelect handler.
                onClick={(e) => e.stopPropagation()}
              >
                {lead.phone && (
                  <DropdownMenuItem
                    onSelect={() => {
                      try {
                        navigator.clipboard?.writeText(lead.phone as string);
                      } catch {}
                    }}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Скопировать телефон
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    onSelect();
                  }}
                >
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Открыть детали
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  // Destructive — red text. onSelect fires AFTER the menu
                  // closes (radix pattern), so we don't need to manage open
                  // state ourselves.
                  className="text-red-600 focus:text-red-700 focus:bg-red-50"
                  onSelect={() => {
                    // Defer to next tick so the menu can close first
                    setTimeout(() => onDismiss(lead.user_id), 0);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Закрыть лид
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 📞 «Перезвонить в ...» — ГЛАВНАЯ заметка лида: полная ширина,
              жирная, заметная издалека (просьба босса — «prominently visible
              right in leads list»). Просроченный перезвон — красный,
              подоспевший — янтарный. */}
          {cb && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold md:text-sm"
              style={{
                backgroundColor: cbOverdue ? "#ef44441a" : "#f59e0b1a",
                color: cbOverdue ? "#ef4444" : "#f59e0b",
                border: `1px solid ${cbOverdue ? "#ef444440" : "#f59e0b40"}`,
              }}
              role="status"
              title={cb.note || "Назначен перезвон"}
            >
              <PhoneCall className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {cbOverdue ? "⏰ Перезвон просрочен: " : "Перезвонить: "}
                <span className="tabular-nums">{cbLabel}</span>
                {cbSoon !== null && cbSoon > 0 && (
                  <span className="font-medium opacity-80">
                    {" "}({cbSoon < 60 ? `${cbSoon} мин` : `${Math.floor(cbSoon / 60)} ч ${cbSoon % 60} мин`})
                  </span>
                )}
                {cb.note ? <span className="font-medium opacity-80"> · {cb.note}</span> : null}
              </span>
            </div>
          )}

          {/* ✅ Отработан — спокойная зелёная отметка (не перекрикивает перезвон) */}
          {handling?.handled && (
            <span
              className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{ backgroundColor: "#22c55e1a", color: "#22c55e" }}
              title={handling.handledAt ? `Отработан: ${formatCallbackTime(handling.handledAt)}` : "Лид отработан"}
            >
              ✅ Обработан
            </span>
          )}

          {/* Source + temperature tags */}
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{ background: "#3b82f620", color: "#3b82f6" }}
            >
              {SOURCE_META[lead.source]?.label || lead.source}
            </span>
            {/* Avito channel badge + deep link into the buyer chat/listing.
                Cold Avito leads (segment «Заявки») have no phone and no TG —
                the ONLY way to answer them is this link. */}
            {lead.contactChannel === "avito" && (
              lead.avito?.itemUrl ? (
                <a
                  href={lead.avito.itemUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition hover:brightness-110"
                  style={{ background: "#0af1331f", color: "#0a8f2a" }}
                  aria-label="Открыть чат Авито"
                >
                  Avito · чат ↗{priority?.channelMultiplier === 2 ? " ×2" : ""}
                </a>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{ background: "#0af1331f", color: "#0a8f2a" }}
                  title="Лид с Авито: приоритет ×2 — максимально горячий канал"
                >
                  Авито{priority?.channelMultiplier === 2 ? " ×2" : ""}
                </span>
              )
            )}
            {topSignal && (
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                style={{ background: `${slaColor}26`, color: slaColor }}
              >
                {topSignal.label}
              </span>
            )}
          </div>

          {/* Bike + rental summary */}
          {(lead.bikeTitle || rental) && (
            <div
              className="rounded-2xl border p-2.5 text-sm md:p-3"
              style={{
                borderColor: T.border,
                background: T.bgElevated,
                color: T.textMuted,
              }}
            >
              {lead.bikeTitle && (
                <>
                  Байк: <span style={{ color: T.text }}>{lead.bikeTitle}</span>
                </>
              )}
              <div
                className="mt-1.5 flex flex-wrap gap-3 text-[11px]"
                style={{ color: T.textFaint }}
              >
                {rentalCount > 0 && <span>{rentalCount} аренд</span>}
                {revenue > 0 && <span>{fmtMoney(revenue)}</span>}
                {returnDate && <span>Возврат: {returnDate}</span>}
              </div>
            </div>
          )}

          {/* SLA block — right aligned, compact */}
          {topSignal && (
            <div className="flex justify-end">
              <div
                className="rounded-xl border p-2.5 text-right md:rounded-2xl md:p-3"
                style={{
                  borderColor: `${slaColor}40`,
                  background: `${slaColor}1a`,
                  minWidth: 0,
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: slaColor }}
                >
                  SLA
                </div>
                <div
                  className="mt-0.5 text-base font-bold md:text-xl"
                  style={{ color: slaColor }}
                >
                  {topSignal.value}
                </div>
                <div className="text-[11px]" style={{ color: T.textMuted }}>
                  {topSignal.detail || topSignal.label}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chevron only — dismiss moved to title row for better mobile UX */}
        <div className="flex shrink-0 items-start">
          <ChevronRight className="mt-1 h-5 w-5" style={{ color: T.accent }} aria-hidden />
        </div>
      </div>
      {/* Next Step pill — the bottleneck for this stage.
          Tells the operator exactly what to do next without thinking. */}
      {bottleneck.label && (
        <div
          className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold md:text-xs"
          style={{
            backgroundColor: `${bottleneck.color}15`,
            color: bottleneck.color,
          }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bottleneck.color }} />
          {bottleneck.label}
        </div>
      )}

      {/* Verification badge — shows whether docs are verified.
          /doc flow = verified (operator saw physical docs during /doc command).
          Web-app flow = unverified/pending (needs photo upload + OCR + operator check). */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {/* Flow type badge — shows how this lead was created */}
        {flowType === "doc" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: "#06b6d415", color: "#06b6d4" }}
          >
            📋 /doc
          </span>
        )}
        {flowType === "webapp" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: "#8b5cf615", color: "#8b5cf6" }}
          >
            🌐 Веб
          </span>
        )}
        {verifMeta.label && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${verifMeta.color}15`,
              color: verifMeta.color,
            }}
          >
            {verifMeta.icon} {verifMeta.label}
          </span>
        )}
      </div>
    </motion.article>
  );
}
