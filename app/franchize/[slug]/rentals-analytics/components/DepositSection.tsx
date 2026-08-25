// /app/franchize/[slug]/rentals-analytics/components/DepositSection.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet, AlertTriangle, RefreshCw } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { DrawerSection, DrawerEmptyHint } from "./DrawerPrimitives";

interface DepositEntry {
  id: string;
  entry_type: string;
  amount: number;
  direction: string;
  destination: string;
  operator_chat_id: string | null;
  notes: string | null;
  created_at: string;
}

interface DepositSummary {
  totalCollected: number;
  totalReturned: number;
  totalPenalty: number;
  balance: number;
  destinations: Array<{ destination: string; collected: number; returned: number; penalty: number; net: number }>;
  entries: DepositEntry[];
}

interface DepositSectionProps {
  rentalId: string;
  rentalStatus: string;
  T: ThemeTokens;
  expanded: boolean;
  onToggle: () => void;
  /** FIX (F3): deposit info resolved from rental metadata / contract artifact
   *  (metadata.deposit_amount + deposit_method + deposit_returned). Used when
   *  there are no deposit_entries rows (typical for /doc-flow rentals). */
  metadataDeposit?: {
    amount: number | null;
    method: string | null;
    methodLabel: string | null;
    returned: boolean | null;
  } | null;
  /** FIX (F13): if the parent (RentalDetailDrawer) already fetched the
   *  deposit summary, accept it as the initial value to avoid a second
   *  network request. The component still owns the live refetch logic. */
  initialSummary?: DepositSummary | null;
}

const DEST_META: Record<string, { label: string; icon: string; color: string }> = {
  cash: { label: "Наличные", icon: "💵", color: "#22c55e" },
  tbank: { label: "Тинькофф", icon: "💳Т", color: "#3b82f6" },
  sber: { label: "Сбербанк", icon: "💳С", color: "#8b5cf6" },
};

const ENTRY_LABELS: Record<string, string> = {
  deposit_collected: "Получен",
  deposit_returned: "Возвращён",
  penalty: "Удержание",
};

/**
 * Deposit section for RentalDetailDrawer.
 *
 * Shows:
 * 1. Summary: total collected, returned, penalty, balance
 * 2. Per-destination breakdown (cash/tbank/sber)
 * 3. Entry timeline (each movement with timestamp)
 * 4. Penalty withholding UI (if rental is active/completed and balance > 0)
 *
 * Fetches from /api/franchize/deposit-summary?rentalId=<id>
 * Penalty POST to /api/franchize/deposit-penalty
 */
export function DepositSection({ rentalId, rentalStatus, T, expanded, onToggle, metadataDeposit, initialSummary }: DepositSectionProps) {
  // FIX (F13): seed with the parent's initial summary (if any) so we don't
  // show a loading flash when the drawer already has the data.
  const [summary, setSummary] = useState<DepositSummary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(!initialSummary);
  const [showPenaltyUI, setShowPenaltyUI] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyDest, setPenaltyDest] = useState("cash");
  const [penaltyNotes, setPenaltyNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDeposit = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/franchize/deposit-summary?rentalId=${rentalId}`);
      if (resp.ok) {
        const data = await resp.json();
        setSummary(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  useEffect(() => {
    // If the parent already gave us a summary, skip the initial fetch but
    // still allow a manual refresh via the loadDeposit callback.
    if (initialSummary) {
      setLoading(false);
      return;
    }
    void loadDeposit();
  }, [loadDeposit, initialSummary]);

  const handlePenalty = async () => {
    const amount = parseFloat(penaltyAmount.replace(/\D/g, ""));
    if (!amount || amount <= 0) return;

    const balance = summary?.balance || 0;
    if (amount > balance) {
      alert(`Сумма удержания (${amount}) больше остатка депозита (${balance})`);
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("/api/franchize/deposit-penalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rentalId,
          amount,
          destination: penaltyDest,
          notes: penaltyNotes || undefined,
        }),
      });
      if (resp.ok) {
        setShowPenaltyUI(false);
        setPenaltyAmount("");
        setPenaltyNotes("");
        await loadDeposit(); // refresh
      } else {
        const err = await resp.json();
        alert(err.error || "Не удалось применить удержание");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  const canWithhold = (rentalStatus === "active" || rentalStatus === "completed")
    && (summary?.balance || 0) > 0
    && !showPenaltyUI;

  return (
    <DrawerSection
      title="Депозит"
      icon={Wallet}
      count={summary?.entries.length}
      expanded={expanded}
      onToggle={onToggle}
      T={T}
      rightAction={
        summary && summary.balance > 0 ? (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#22c55e15", color: "#22c55e" }}>
            {summary.balance.toLocaleString("ru-RU")} ₽
          </span>
        ) : summary && summary.totalCollected > 0 ? (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#3b82f615", color: "#3b82f6" }}>
            Возвращён
          </span>
        ) : metadataDeposit && metadataDeposit.amount != null && metadataDeposit.amount > 0 ? (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: metadataDeposit.returned === false ? "#f59e0b15" : "#3b82f615", color: metadataDeposit.returned === false ? "#f59e0b" : "#3b82f6" }}>
            {metadataDeposit.returned === false ? "у держателя" : "возвращён"}
          </span>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs" style={{ color: T.textMuted }}>
          <RefreshCw className="h-3 w-3 animate-spin" />
          Загрузка...
        </div>
      ) : !summary || summary.totalCollected === 0 ? (
        metadataDeposit && metadataDeposit.amount != null && metadataDeposit.amount > 0 ? (
          // FIX (F3): no deposit_entries rows, but the /doc flow recorded the
          // deposit in rental metadata / contract artifact — show it instead
          // of the misleading "Депозит не записан".
          <div className="rounded-xl border p-2.5" style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: T.textMuted }}>Депозит по договору:</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: T.text }}>
                {metadataDeposit.amount.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: T.textFaint }}>
              <span>
                {metadataDeposit.methodLabel || metadataDeposit.method || "способ не указан"}
                {" · из данных договора"}
              </span>
              <span style={{ color: metadataDeposit.returned === false ? "#f59e0b" : "#3b82f6" }}>
                {metadataDeposit.returned === false ? "у держателя" : metadataDeposit.returned === true ? "возвращён" : ""}
              </span>
            </div>
          </div>
        ) : (
          <DrawerEmptyHint label="Депозит не записан" T={T} />
        )
      ) : (
        <div className="space-y-3">
          {/* Summary per destination */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {summary.destinations.map((d) => {
              const meta = DEST_META[d.destination] || { icon: "💳", color: "#64748b", label: d.destination };
              return (
                <div key={d.destination}
                     className="rounded-xl border p-2.5"
                     style={{ borderColor: `${meta.color}33`, backgroundColor: `${meta.color}08` }}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: meta.color }}>
                    <span>{meta.icon}</span>
                    {meta.label}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[10px]" style={{ color: T.textMuted }}>
                    <div className="flex justify-between">
                      <span>Получено:</span>
                      <span className="tabular-nums" style={{ color: "#22c55e" }}>+{d.collected.toLocaleString("ru-RU")}</span>
                    </div>
                    {d.returned > 0 && (
                      <div className="flex justify-between">
                        <span>Возвращено:</span>
                        <span className="tabular-nums" style={{ color: "#3b82f6" }}>-{d.returned.toLocaleString("ru-RU")}</span>
                      </div>
                    )}
                    {d.penalty > 0 && (
                      <div className="flex justify-between">
                        <span>Удержано:</span>
                        <span className="tabular-nums" style={{ color: "#ef4444" }}>-{d.penalty.toLocaleString("ru-RU")}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Balance + penalty button */}
          <div className="flex items-center justify-between rounded-xl border p-2.5"
               style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <div className="text-xs" style={{ color: T.textMuted }}>
              Остаток депозита:
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums" style={{ color: summary.balance > 0 ? "#22c55e" : T.text }}>
                {summary.balance.toLocaleString("ru-RU")} ₽
              </span>
              {canWithhold && (
                <button
                  onClick={() => setShowPenaltyUI(true)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition hover:opacity-80"
                  style={{ borderColor: "#ef444440", color: "#ef4444", backgroundColor: "#ef444408" }}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Удержать
                </button>
              )}
            </div>
          </div>

          {/* Penalty withholding UI */}
          {showPenaltyUI && (
            <div className="rounded-xl border p-3 space-y-2"
                 style={{ borderColor: "#ef444440", backgroundColor: "#ef444406" }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#ef4444" }}>
                <AlertTriangle className="h-3.5 w-3.5" />
                Удержание из депозита
              </div>
              <input
                type="text"
                value={penaltyAmount}
                onChange={(e) => setPenaltyAmount(e.target.value)}
                placeholder={`Сумма (макс. ${summary.balance.toLocaleString("ru-RU")})`}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "#ef444440", backgroundColor: T.inputBg, color: T.text }}
              />
              <select
                value={penaltyDest}
                onChange={(e) => setPenaltyDest(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "#ef444440", backgroundColor: T.inputBg, color: T.text }}
              >
                <option value="cash">💵 Наличные</option>
                {summary.destinations.find(d => d.destination === "tbank") && (
                  <option value="tbank">💳 Тинькофф</option>
                )}
                {summary.destinations.find(d => d.destination === "sber") && (
                  <option value="sber">💳 Сбербанк</option>
                )}
              </select>
              <input
                type="text"
                value={penaltyNotes}
                onChange={(e) => setPenaltyNotes(e.target.value)}
                placeholder="Причина (царапина, нет топлива...)"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "#ef444440", backgroundColor: T.inputBg, color: T.text }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handlePenalty}
                  disabled={!penaltyAmount || submitting}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold transition disabled:opacity-40"
                  style={{ backgroundColor: "#ef4444", color: "#fff" }}
                >
                  {submitting ? "..." : "Удержать"}
                </button>
                <button
                  onClick={() => { setShowPenaltyUI(false); setPenaltyAmount(""); setPenaltyNotes(""); }}
                  className="rounded-lg border px-3 py-2 text-sm transition hover:opacity-80"
                  style={{ borderColor: T.border, color: T.textMuted }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Entry timeline */}
          <div className="space-y-1.5">
            {summary.entries.map((e) => {
              const meta = DEST_META[e.destination] || { icon: "💳", color: "#64748b" };
              const isIn = e.direction === "in";
              return (
                <div key={e.id}
                     className="flex items-center justify-between rounded-lg border px-2.5 py-1.5"
                     style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium" style={{ color: T.text }}>
                        {ENTRY_LABELS[e.entry_type] || e.entry_type}
                      </div>
                      <div className="text-[9px]" style={{ color: T.textFaint }}>
                        {new Date(e.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {e.notes ? ` · ${e.notes.slice(0, 40)}` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums"
                        style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                    {isIn ? "+" : "-"}{Number(e.amount).toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DrawerSection>
  );
}
