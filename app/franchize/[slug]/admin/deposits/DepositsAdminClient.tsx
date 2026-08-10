// /app/franchize/[slug]/admin/deposits/DepositsAdminClient.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

interface DepositEntry {
  id: string;
  rental_id: string;
  entry_type: string;
  amount: number;
  direction: string;
  destination: string;
  operator_chat_id: string | null;
  notes: string | null;
  created_at: string;
}

interface DestSummary {
  destination: string;
  collected: number;
  returned: number;
  penalty: number;
  net: number;
}

const DEST_META: Record<string, { label: string; icon: string; color: string }> = {
  cash: { label: "Наличные", icon: "💵", color: "#22c55e" },
  tbank: { label: "Тинькофф", icon: "💳Т", color: "#3b82f6" },
  sber: { label: "Сбербанк", icon: "💳С", color: "#8b5cf6" },
};

const ENTRY_LABELS: Record<string, string> = {
  deposit_collected: "💰 Получен",
  deposit_returned: "↩️ Возвращён",
  penalty: "⚠️ Удержание",
};

export function DepositsAdminClient({ slug }: { slug: string }) {
  const { dbUser } = useAppContext();
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [filterDest, setFilterDest] = useState<string>("all");
  const [entries, setEntries] = useState<DepositEntry[]>([]);
  const [summaries, setSummaries] = useState<DestSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/franchize/deposit-list?date=${date}&slug=${slug}`);
      if (resp.ok) {
        const data = await resp.json();
        setEntries(data.entries || []);
        setSummaries(data.summaries || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [date, slug]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filterDest === "all" ? entries : entries.filter((e) => e.destination === filterDest);
  const formatRub = (n: number) => n.toLocaleString("ru-RU") + " ₽";
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mt-4 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--franchize-border-soft, #333)", backgroundColor: "var(--franchize-bg-base, #0a0a0a)", color: "var(--franchize-text-primary, #fff)" }}
        />
        <select
          value={filterDest}
          onChange={(e) => setFilterDest(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: "var(--franchize-border-soft, #333)", backgroundColor: "var(--franchize-bg-base, #0a0a0a)", color: "var(--franchize-text-primary, #fff)" }}
        >
          <option value="all">Все</option>
          <option value="cash">💵 Наличные</option>
          <option value="tbank">💳 Тинькофф</option>
          <option value="sber">💳 Сбербанк</option>
        </select>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition hover:opacity-80"
          style={{ borderColor: "var(--franchize-border-soft, #333)", color: "var(--franchize-text-secondary, #999)" }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["cash", "tbank", "sber"] as const).map((dest) => {
          const meta = DEST_META[dest];
          const s = summaries.find((x) => x.destination === dest);
          const collected = s?.collected || 0;
          const returned = s?.returned || 0;
          const penalty = s?.penalty || 0;
          const net = collected - returned - penalty;
          return (
            <div
              key={dest}
              className="rounded-2xl border p-4"
              style={{ borderColor: `${meta.color}33`, backgroundColor: `${meta.color}08` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{meta.icon}</span>
                <span className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                <div className="flex justify-between">
                  <span>Получено:</span>
                  <span className="font-semibold tabular-nums" style={{ color: "#22c55e" }}>+{formatRub(collected)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Возвращено:</span>
                  <span className="font-semibold tabular-nums" style={{ color: "#3b82f6" }}>-{formatRub(returned)}</span>
                </div>
                {penalty > 0 && (
                  <div className="flex justify-between">
                    <span>Удержания:</span>
                    <span className="font-semibold tabular-nums" style={{ color: "#ef4444" }}>-{formatRub(penalty)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t pt-1" style={{ borderColor: "var(--franchize-border-soft, #222)" }}>
                  <span className="font-bold">Итого:</span>
                  <span className="font-bold tabular-nums" style={{ color: net >= 0 ? "#22c55e" : "#ef4444" }}>{formatRub(net)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center text-sm" style={{ borderColor: "var(--franchize-border-soft, #333)", color: "var(--franchize-text-secondary, #999)" }}>
          <Wallet className="mx-auto mb-2 h-8 w-8 opacity-30" />
          Нет депозитов за {date}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--franchize-border-soft, #333)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs" style={{ borderColor: "var(--franchize-border-soft, #333)", color: "var(--franchize-text-secondary, #999)" }}>
                <th className="px-3 py-2">Время</th>
                <th className="px-3 py-2">Аренда</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2 text-right">Сумма</th>
                <th className="px-3 py-2">Куда</th>
                <th className="px-3 py-2">Оператор</th>
                <th className="px-3 py-2">Заметки</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = DEST_META[e.destination] || { icon: "❓", color: "#64748b" };
                const isIn = e.direction === "in";
                return (
                  <tr key={e.id} className="border-b" style={{ borderColor: "var(--franchize-border-soft, #1a1a1a)" }}>
                    <td className="px-3 py-2 text-xs tabular-nums" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                      {formatTime(e.created_at)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <a
                        href={`/franchize/${slug}/rental/${e.rental_id}`}
                        className="hover:underline"
                        style={{ color: "var(--franchize-accent-main, #D99A00)" }}
                      >
                        {e.rental_id.slice(0, 8)}...
                      </a>
                    </td>
                    <td className="px-3 py-2 text-xs">{ENTRY_LABELS[e.entry_type] || e.entry_type}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                      {isIn ? "+" : "-"}{formatRub(Number(e.amount))}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                      {e.operator_chat_id || "система"}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                      {e.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
