"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import type { LeadRow } from "@/app/franchize/server-actions/leads";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

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
 * - Reason dropdown (from DISMISS_REASONS)
 * - Note textarea (required if reason.requiresNote)
 * - Analytics impact preview (conversion -1, revenue -X, source, stage)
 * - Cancel + destructive red "Закрыть лид" button
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

  const expectedRevenue =
    lead?.rentals?.reduce((s, r) => s + (Number(r.totalCost) || 0), 0) || 0;
  const source = lead?.source || "—";
  const stage = (lead as { stageKey?: string }).stageKey || "new";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="w-full max-w-3xl rounded-[28px] border p-5"
            style={{
              background: "#111113",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: "#ef444420" }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: "#f87171" }} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold" style={{ color: T.text }}>
                    Закрыть лид
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: T.textMuted }}>
                    {lead?.full_name || "Без имени"} — выберите причину закрытия и
                    добавьте комментарий.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg p-1.5 transition hover:bg-white/5"
                style={{ color: T.textFaint }}
                aria-label="Закрыть окно"
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
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "rgba(255,255,255,0.1)",
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
                      background: "rgba(255,255,255,0.05)",
                      borderColor:
                        requiresNote && !note.trim()
                          ? "#ef444460"
                          : "rgba(255,255,255,0.1)",
                      color: T.text,
                    }}
                  />
                  {requiresNote && !note.trim() && (
                    <span className="mt-1 block text-xs" style={{ color: "#f87171" }}>
                      Комментарий обязателен для этой причины
                    </span>
                  )}
                </label>
              </div>

              <div
                className="space-y-3 rounded-2xl border p-4"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.2)",
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
                className="rounded-2xl border px-5 py-3 text-sm font-medium transition hover:bg-white/5"
                style={{ borderColor: "rgba(255,255,255,0.1)", color: T.text }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onSubmit(reason, note.trim())}
                className="rounded-2xl px-5 py-3 text-sm font-semibold transition enabled:hover:brightness-110 disabled:opacity-40"
                style={{ background: "#dc2626", color: "#ffffff" }}
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
  const color = tone === "danger" ? "#fca5a5" : "#fde68a";
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: T.textMuted }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}
