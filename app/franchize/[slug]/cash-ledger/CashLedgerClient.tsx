// app/franchize/[slug]/cash-ledger/CashLedgerClient.tsx
"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, Plus, Filter } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";

interface CashTransaction {
  id: string;
  transactionType: string;
  flowDirection: string;
  amount: number;
  paymentMethod?: string;
  category?: string;
  description?: string;
  transactionDate: string;
}

interface Summary {
  totalIn: number;
  totalOut: number;
  net: number;
}

interface CashLedgerClientProps {
  slug: string;
  crew: any;
}

const TRANSACTION_TYPES = [
  { value: "", label: "Все типы" },
  { value: "income_rental", label: "Аренда (вход)" },
  { value: "income_sale", label: "Продажа (вход)" },
  { value: "income_equipment", label: "Экипировка (вход)" },
  { value: "expense_commission", label: "Комиссия (расход)" },
  { value: "expense_salary", label: "Зарплата (расход)" },
  { value: "manual_in", label: "Ручной вход" },
  { value: "manual_out", label: "Ручной расход" },
];

export function CashLedgerClient({ slug, crew }: CashLedgerClientProps) {
  const { dbUser, userCrewMemberships } = useAppContext();
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalIn: 0, totalOut: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [transactionType, setTransactionType] = useState("");

  // Manual form
  const [manualForm, setManualForm] = useState({
    transactionType: "manual_in",
    amount: "",
    category: "",
    description: "",
    paymentMethod: "cash",
  });

  const T = crew?.theme?.palette || {
    bg: "#0B0C10",
    bgCard: "#111217",
    borderSoft: "#24262E",
    text: "#F2F2F3",
    textMuted: "#A7ABB4",
    accent: "#D99A00",
    accentContrast: "#16130A",
  };

  const isOwner = userCrewMemberships.some(
    (m) => m.slug === slug && ["owner", "admin", "co_owner"].includes(m.role)
  );

  useEffect(() => {
    loadData();
  }, [slug, dbUser?.user_id, fromDate, toDate, transactionType]);

  const loadData = async () => {
    if (!dbUser?.user_id) return;

    try {
      const params = new URLSearchParams({
        actorUserId: dbUser.user_id,
        from: fromDate,
        to: toDate,
      });
      if (transactionType) params.set("transactionType", transactionType);

      const res = await fetch(`/api/franchize/${slug}/cash-transactions?${params}`);
      const result = await res.json();

      if (result.success) {
        setTransactions(result.data || []);
        setSummary(result.summary || { totalIn: 0, totalOut: 0, net: 0 });
      }
    } catch (err) {
      console.error("Failed to load cash ledger:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) return;

    const amount = Number(manualForm.amount);
    if (amount <= 0) {
      alert("Сумма должна быть больше 0");
      return;
    }

    try {
      const res = await fetch(`/api/franchize/${slug}/cash-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorUserId: dbUser.user_id,
          transactionType: manualForm.transactionType,
          amount,
          flowDirection: manualForm.transactionType === "manual_out" ? "out" : "in",
          category: manualForm.category,
          description: manualForm.description,
          paymentMethod: manualForm.paymentMethod,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setShowManualForm(false);
        setManualForm({ transactionType: "manual_in", amount: "", category: "", description: "", paymentMethod: "cash" });
        loadData();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTransactionLabel = (type: string) => {
    const found = TRANSACTION_TYPES.find((t) => t.value === type);
    return found?.label || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: T.text }}>Касса</h2>
          <p className="mt-1 text-sm" style={{ color: T.textMuted }}>Движение денежных средств</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors"
            style={{ background: T.accent, color: T.accentContrast }}
          >
            <Plus className="w-4 h-4" />
            Вручную
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full" style={{ background: "#22c55e20" }}>
              <TrendingUp className="w-5 h-5" style={{ color: "#22c55e" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: T.textMuted }}>Входящие</p>
              <p className="text-lg font-bold" style={{ color: T.text }}>{formatCurrency(summary.totalIn)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full" style={{ background: "#ef444420" }}>
              <TrendingDown className="w-5 h-5" style={{ color: "#ef4444" }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: T.textMuted }}>Исходящие</p>
              <p className="text-lg font-bold" style={{ color: T.text }}>{formatCurrency(summary.totalOut)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full" style={{ background: `${T.accent}20` }}>
              <DollarSign className="w-5 h-5" style={{ color: T.accent }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: T.textMuted }}>Чистый поток</p>
              <p className="text-lg font-bold" style={{ color: T.text }}>{formatCurrency(summary.net)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: T.textMuted }} />
          <span className="text-sm" style={{ color: T.textMuted }}>Фильтры:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ background: T.bgCard, borderColor: T.borderSoft, color: T.text }}
          />
          {/* 2026-08-19 review: unambiguous Russian-format display */}
          {fromDate && (
            <span className="text-[10px] tabular-nums" style={{ color: T.textMuted }}>
              ({formatDateRu(fromDate)})
            </span>
          )}
        </div>
        <span style={{ color: T.textMuted }}>—</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ background: T.bgCard, borderColor: T.borderSoft, color: T.text }}
          />
          {toDate && (
            <span className="text-[10px] tabular-nums" style={{ color: T.textMuted }}>
              ({formatDateRu(toDate)})
            </span>
          )}
        </div>
        <select
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ background: T.bgCard, borderColor: T.borderSoft, color: T.text }}
        >
          {TRANSACTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto" style={{ borderColor: T.accent }} />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
          <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: T.textMuted }} />
          <p className="text-lg font-medium" style={{ color: T.text }}>Нет транзакций</p>
          <p className="text-sm mt-1" style={{ color: T.textMuted }}>За выбранный период операций не было</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: `${T.borderSoft}20` }}>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Дата</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Тип</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Описание</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-t" style={{ borderColor: T.borderSoft }}>
                    <td className="px-4 py-3 text-sm" style={{ color: T.text }}>
                      {new Date(tx.transactionDate).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          background: tx.flowDirection === "in" ? "#22c55e20" : "#ef444420",
                          color: tx.flowDirection === "in" ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {getTransactionLabel(tx.transactionType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: T.text }}>
                      {tx.description || tx.category || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: tx.flowDirection === "in" ? "#22c55e" : "#ef4444" }}>
                      {tx.flowDirection === "in" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold" style={{ color: T.text }}>Ручная запись</h3>
                <button
                  onClick={() => setShowManualForm(false)}
                  className="p-2 rounded-full transition-colors hover:bg-white/10"
                  style={{ color: T.textMuted }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateManual} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Тип операции</label>
                  <select
                    value={manualForm.transactionType}
                    onChange={(e) => setManualForm({ ...manualForm, transactionType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  >
                    <option value="manual_in">Входящая</option>
                    <option value="manual_out">Исходящая</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Сумма (₽)</label>
                  <input
                    type="number"
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-xl border font-mono"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Категория</label>
                  <input
                    type="text"
                    value={manualForm.category}
                    onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                    placeholder="Например: Внесение, Выплата"
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Описание</label>
                  <input
                    type="text"
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    placeholder="Детали операции"
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Способ оплаты</label>
                  <select
                    value={manualForm.paymentMethod}
                    onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  >
                    <option value="cash">Наличные</option>
                    <option value="card">Карта</option>
                    <option value="tbank">Т-Банк</option>
                    <option value="sber">Сбер</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl font-semibold transition-colors"
                    style={{ background: T.accent, color: T.accentContrast }}
                  >
                    Создать
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="px-4 py-2 rounded-xl font-semibold border transition-colors"
                    style={{ borderColor: T.borderSoft, color: T.text, background: "transparent" }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
