"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import type { LeadRow } from "@/app/franchize/server-actions/leads";
import type { ThemeTokens } from "../hooks/useTheme";
import { STAGE_LABELS } from "../lib/pipeline-stages";

export interface DismissReason {
  value: string;
  label: string;
  requiresNote: boolean;
}

interface Props {
  open: boolean;
  lead: LeadRow | null;
  reasons: DismissReason[];
  T: ThemeTokens;
  onSubmit: (reason: string, note: string) => void;
  onCancel: () => void;
}

/**
 * Close-lead confirmation dialog.
 *
 * Layout:
 *   - Desktop (sm+): centered modal with backdrop scrim.
 *   - Mobile: slides up as a bottom sheet, anchored to the bottom of the
 *     viewport with safe-area padding at the bottom.
 *
 * Contents:
 *   - Reason dropdown (from DISMISS_REASONS).
 *   - Note textarea (required if reason.requiresNote).
 *   - Analytics impact preview panel with a subtle red tint (T.bgElevated +
 *     `#ef444408` overlay) so the operator notices the consequences.
 *   - Cancel + destructive red "Закрыть лид" button.
 *
 * z-index: z-[60] — above the mobile sheet (z-50) and drawer (z-40), below
 * toasts (z-[70]).
 */
export function DismissLeadDialog({ open, lead, reasons, T, onSubmit, onCancel }: Props) {
  const [reason, setReason] = useState(reasons[0]?.value || "");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setReason(reasons[0]?.value || "");
      setNote("");
    }
  }, [open, reasons]);

  const selected = reasons.find((r) => r.value === reason);
  const requiresNote = selected?.requiresNote ?? false;
  const canSubmit = !!reason && (!requiresNote || note.trim().length > 0);

  if (!lead) return null;

  const expectedRevenue =
    lead.rentals?.reduce((s, r) => s + (Number(r.totalCost) || 0), 0) || 0;
  const source = lead.source || "—";
  const stageKey = (lead as { stageKey?: string }).stageKey || "new";
  const stage = STAGE_LABELS[stageKey] || stageKey;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          // z-[60]: above mobile sheet (z-50) + drawer (z-40), below toast (z-[70]).
          // On mobile the dialog anchors to the bottom; on desktop it's centered.
          className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ background: "color-mix(in srgb, #000000 70%, transparent)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            // Mobile: full-width, rounded top corners only (bottom-sheet feel).
            // Desktop: max-w-3xl, all corners rounded.
            className="w-full max-w-3xl rounded-t-[28px] border p-5 sm:rounded-[28px]"
            style={{
              background: T.bg,
              borderColor: T.border,
              boxShadow: T.shadow,
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Закрыть лид"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: "#ef444420" }}
                  aria-hidden
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: "#ef4444" }} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold" style={{ color: T.text }}>
                    Закрыть лид
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: T.textMuted }}>
                    {lead?.full_name || "Без имени"} — выберите причину закрытия
                    и добавьте комментарий.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="cursor-pointer rounded-lg p-1.5 transition"
                style={{ color: T.textFaint }}
                aria-label="Закрыть окно"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.bgCardHover;
                  e.currentTarget.style.color = T.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = T.textFaint;
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm" style={{ color: T.textMuted }}>
                    Причина закрытия
                  </span>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[44px] w-full cursor-pointer rounded-2xl border px-4 py-3 outline-none"
                    style={{
                      background: T.inputBg,
                      borderColor: T.inputBorder,
                      color: T.text,
                    }}
                  >
                    {reasons.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm" style={{ color: T.textMuted }}>
                    Комментарий {requiresNote ? "(обязательно)" : "(необязательно)"}
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Клиент выбрал другого поставщика..."
                    className="min-h-32 w-full resize-none rounded-2xl border px-4 py-3 outline-none"
                    style={{
                      background: T.inputBg,
                      borderColor:
                        requiresNote && !note.trim()
                          ? "#ef444460"
                          : T.inputBorder,
                      color: T.text,
                    }}
                  />
                  {requiresNote && !note.trim() && (
                    <span className="mt-1 block text-xs" style={{ color: "#ef4444" }}>
                      Комментарий обязателен для этой причины
                    </span>
                  )}
                </label>
              </div>

              {/* Analytics impact preview — subtle red tint */}
              <div
                className="space-y-3 rounded-2xl border p-4"
                style={{
                  borderColor: `${T.border}`,
                  background: `color-mix(in srgb, #ef4444 5%, ${T.bgElevated})`,
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: T.textFaint }}
                >
                  Влияние на аналитику
                </p>
                <Row label="Конверсия" value="-1 лид" tone="danger" T={T} />
                <Row
                  label="Выручка (ожидаемая)"
                  value={`-${expectedRevenue.toLocaleString("ru-RU")} ₽`}
                  tone="danger"
                  T={T}
                />
                <Row label="Источник" value={source} tone="accent" T={T} />
                <Row label="Стадия" value={stage} tone="accent" T={T} />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] cursor-pointer rounded-2xl border px-5 py-3 text-sm font-medium transition"
                style={{ borderColor: T.border, color: T.text }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.bgCardHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onSubmit(reason, note.trim())}
                className="min-h-[44px] cursor-pointer rounded-2xl px-5 py-3 text-sm font-semibold transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "#ef4444", color: T.accentContrast }}
              >
                Закрыть лид
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({
  label,
  value,
  tone,
  T,
}: {
  label: string;
  value: string;
  tone: "danger" | "accent";
  T: ThemeTokens;
}) {
  // Semantic tone colors: danger uses red-300, accent uses yellow-200.
  const color = tone === "danger" ? "#ef4444" : T.accent;
  return (
    <div className="flex min-h-[28px] items-center justify-between text-sm">
      <span style={{ color: T.textMuted }}>{label}</span>
      <span className="font-medium" style={{ color }}>{value}</span>
    </div>
  );
}
