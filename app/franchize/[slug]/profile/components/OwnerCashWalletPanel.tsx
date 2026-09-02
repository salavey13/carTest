"use client";

// OwnerCashWalletPanel — «Кошелёк владельца»: personal cash ledger for the
// crew owner (cash in/out, subrenter payouts, anything bypassing the till).
// The month + data live in the parent (shared with the payout actions);
// the quick-add form state is local to this panel.
//
// iter31: split out of ProfileClient; entries list + totals unchanged.

import { useState } from "react";
import { motion } from "framer-motion";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { MonthPickerBar } from "@/app/franchize/components/FranchizeMonthPicker";
import type { OwnerCashMonthData } from "@/app/franchize/server-actions/owner-cash";
import {
  formatCurrency,
  monthLabel,
  itemVariants,
  type CrewTokens,
  type OwnerCashFormValues,
} from "./profile-shared";

const MONEY_GREEN = "#22c55e";
const MONEY_RED = "#ef4444";

const EMPTY_FORM: OwnerCashFormValues = {
  direction: "out",
  kind: "personal",
  amount: "",
  title: "",
  person: "",
};

export function OwnerCashWalletPanel({
  data,
  loading,
  busy,
  month,
  onMonthChange,
  onSubmit,
  onRemove,
  removingId,
  T,
}: {
  data: OwnerCashMonthData;
  loading: boolean;
  busy: boolean;
  month: string;
  onMonthChange: (next: string) => void;
  /** Validates + persists; returns false to keep the form filled. */
  onSubmit: (form: OwnerCashFormValues) => Promise<boolean>;
  onRemove: (id: string) => void;
  /** iter35: id of the entry currently being deleted — disables its «Удалить». */
  removingId?: string | null;
  T: CrewTokens;
}) {
  const [form, setForm] = useState<OwnerCashFormValues>(EMPTY_FORM);
  // n7 fix: during a month switch the totals/entries used to keep showing the
  // PREVIOUS month's payload — show a neutral loading state instead.
  const showingStaleMonth = data.month !== month;
  // n2 fix: irreversible money-ledger delete now confirms first.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const submit = async () => {
    const ok = await onSubmit(form);
    if (ok) {
      // Keep the chosen direction/kind — repeat entries are common.
      setForm((f) => ({ ...f, amount: "", title: "", person: "" }));
    }
  };

  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
              <Landmark className="h-4 w-4" /> Кошелёк владельца
            </h2>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              Личные движения денег мимо кассы: пришло / ушло на все подряд.
              Выплаты субарендаторам записываются туда же.
            </p>
          </div>
        </div>

        <div className="mt-3">
          <MonthPickerBar
            value={month}
            onChange={onMonthChange}
            accent={T.accent}
            accentContrast={T.accentContrast}
            bgCard={T.bgCard}
            bgElevated={T.bgElevated}
            border={T.borderSoft}
            text={T.text}
            textMuted={T.textMuted}
          />
        </div>

        {/* Totals */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border p-2.5 text-center" style={T.styles.card}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: T.textMuted }}>Пришло</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: MONEY_GREEN }}>
              {showingStaleMonth ? "…" : `+${formatCurrency(data.totalIn)}`}
            </p>
          </div>
          <div className="rounded-xl border p-2.5 text-center" style={T.styles.card}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: T.textMuted }}>Ушло</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: MONEY_RED }}>
              {showingStaleMonth ? "…" : `−${formatCurrency(data.totalOut)}`}
            </p>
          </div>
          <div className="rounded-xl border p-2.5 text-center" style={T.styles.card}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: T.textMuted }}>Итог</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: data.net >= 0 ? MONEY_GREEN : MONEY_RED }}>
              {showingStaleMonth ? "…" : `${data.net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(data.net))}`}
            </p>
          </div>
        </div>

        {/* Quick add form */}
        <div className="mt-3 rounded-xl border p-3" style={T.styles.card}>
          <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>
            <Plus className="h-3.5 w-3.5" /> Новая запись
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: T.borderSoft }}>
              {(["in", "out"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, direction: d }))}
                  className="px-3 py-2 text-xs font-semibold transition"
                  style={{
                    backgroundColor: form.direction === d ? (d === "in" ? "#22c55e22" : "#ef444422") : "transparent",
                    color: form.direction === d ? (d === "in" ? MONEY_GREEN : MONEY_RED) : T.textMuted,
                  }}
                >
                  {d === "in" ? "Пришло" : "Ушло"}
                </button>
              ))}
            </div>
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as typeof f.kind }))}
              className="rounded-lg border px-2 py-2 text-xs outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard, color: T.text }}
            >
              <option value="personal">Личное</option>
              <option value="subrenter_payout">Выплата субарендатору</option>
              <option value="other">Прочее</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              inputMode="numeric"
              placeholder="Сумма ₽"
              className="w-24 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard, color: T.text }}
            />
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="За что / от кого (напр. CBR 600RR Влад)"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard, color: T.text }}
            />
            <input
              value={form.person}
              onChange={(e) => setForm((f) => ({ ...f, person: e.target.value }))}
              placeholder="Кто (опционально)"
              className="w-36 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard, color: T.text }}
            />
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void submit()}
              className="shrink-0"
            >
              {busy ? "Пишу…" : "Записать"}
            </Button>
          </div>
        </div>

        {/* Entries list */}
        {loading || showingStaleMonth ? (
          <p className="mt-3 animate-pulse text-sm" style={{ color: T.textMuted }}>Загружаю…</p>
        ) : data.entries.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: T.textMuted }}>
            Записей за {monthLabel(data.month).toLowerCase()} пока нет.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {data.entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                style={T.styles.card}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: e.direction === "in" ? MONEY_GREEN : MONEY_RED }}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium" style={{ color: T.text }}>
                      {e.title}
                      {e.kind === "subrenter_payout" && (
                        <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "#f59e0b22", color: "#f59e0b" }}>
                          выплата
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: T.textMuted }}>
                      {new Date(e.entryDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      {e.person ? ` · ${e.person}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className="whitespace-nowrap font-bold tabular-nums"
                    style={{ color: e.direction === "in" ? MONEY_GREEN : MONEY_RED }}
                  >
                    {e.direction === "in" ? "+" : "−"}{formatCurrency(e.amount)}
                  </span>
                  {confirmDeleteId === e.id ? (
                    // n2 fix: two-tap confirm for the irreversible delete.
                    <span className="flex flex-shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={removingId !== null}
                        onClick={() => {
                          onRemove(e.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded px-1.5 py-0.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: "#ef444422", color: MONEY_RED }}
                      >
                        {removingId === e.id ? "Удаляем..." : "Удалить"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded px-1.5 py-0.5 text-[11px]"
                        style={{ color: T.textMuted }}
                      >
                        Отмена
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(e.id)}
                      title="Удалить запись"
                      className="rounded p-1 transition hover:opacity-70"
                      style={{ color: T.textMuted }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </FranchizeOperatorPanel>
    </motion.div>
  );
}
