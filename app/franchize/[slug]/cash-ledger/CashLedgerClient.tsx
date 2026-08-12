"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/Loading";
import { Plus, TrendingUp, TrendingDown, DollarSign, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// Accessibility helpers
const ariaLabels = {
  showForm: "Показать форму добавления транзакции",
  hideForm: "Скрыть форму добавления транзакции",
  submitTransaction: "Добавить транзакцию",
  filterByType: "Фильтр по типу транзакции",
  clearFromDate: "Очистить дату начала",
  clearToDate: "Очистить дату конца",
  transactionsTable: "Таблица транзакций",
} as const;

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

interface CashSummary {
  totalIn: number;
  totalOut: number;
  net: number;
}

interface Crew {
  id: string;
  slug: string;
  name: string;
  theme: Record<string, string>;
}

interface CashLedgerClientProps {
  crewSlug: string;
  crew: Crew;
}

export function CashLedgerClient({ crewSlug, crew }: CashLedgerClientProps) {
  const { dbUser, userCrewMemberships } = useAppContext();
  const tokens = useCrewTokens(crew.theme);

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [summary, setSummary] = useState<CashSummary>({ totalIn: 0, totalOut: 0, net: 0 });
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    type: "income_rent",
    category: "rent",
    amount: "",
    method: "cash",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isOwner = userCrewMemberships.some(
    (m) => m.slug === crewSlug && ["owner", "admin", "co_owner"].includes(m.role)
  );

  useEffect(() => {
    loadTransactions();
  }, [crewSlug, fromDate, toDate, typeFilter]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      if (!dbUser?.user_id) {
        toast.error("Не авторизовано");
        return;
      }

      const params = new URLSearchParams({
        slug: crewSlug,
        actorUserId: dbUser?.user_id || "",
      });

      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (typeFilter !== "all") params.append("type", typeFilter);

      const response = await fetch(`/api/franchize/${crewSlug}/cash-transactions?${params}`);
      const result = await response.json();

      if (result.success) {
        setTransactions(result.data || []);
        setSummary(result.summary || { totalIn: 0, totalOut: 0, net: 0 });
      } else {
        toast.error(result.error || "Не удалось загрузить транзакции");
      }
    } catch (error) {
      console.error("[loadTransactions] Error:", error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    // Validation
    const errors: Record<string, string> = {};
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = "Сумма должна быть больше нуля";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/franchize/${crewSlug}/cash-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: crewSlug,
          actorUserId: dbUser?.user_id,
          type: formData.type,
          category: formData.category,
          amount: Number(formData.amount),
          method: formData.method,
          description: formData.description,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Транзакция создана");
        setShowForm(false);
        setFormData({
          type: "income_rent",
          category: "rent",
          amount: "",
          method: "cash",
          description: "",
        });
        loadTransactions();
      } else {
        toast.error(result.error || "Не удалось создать транзакцию");
      }
    } catch (error) {
      console.error("[handleCreateTransaction] Error:", error);
      toast.error("Ошибка создания транзакции");
    } finally {
      setSubmitting(false);
    }
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setTypeFilter("all");
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: ru });
    } catch {
      return dateString;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      income_rent: "Доход: Аренда",
      income_sale: "Доход: Продажа",
      income_other: "Доход: Прочее",
      expense_salary: "Расход: Зарплата",
      expense_purchase: "Расход: Закупка",
      expense_operational: "Расход: Операционный",
      expense_other: "Расход: Прочее",
    };
    return labels[type] || type;
  };

  const getMethodLabel = (method?: string) => {
    const labels: Record<string, string> = {
      cash: "Наличные",
      bank_transfer: "Банковский перевод",
      card: "Карта",
      crypto: "Криптовалюта",
    };
    return labels[method || ""] || method || "-";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter md:text-3xl">
            Кассовая книга
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{crew?.name || crewSlug}</p>
        </div>
        {isOwner && (
          <Button
            onClick={() => setShowForm(!showForm)}
            aria-label={showForm ? ariaLabels.hideForm : ariaLabels.showForm}
            style={tokens.styles.ctaPrimary}
            className="min-h-[44px] px-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ручная запись
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card style={tokens.styles.card}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{summary.totalIn.toLocaleString()} ₽</div>
                <div className="text-xs text-muted-foreground">Доход</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={tokens.styles.card}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{summary.totalOut.toLocaleString()} ₽</div>
                <div className="text-xs text-muted-foreground">Расход</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={tokens.styles.card}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5" style={{ color: tokens.accent }} />
              <div>
                <div
                  className="text-2xl font-bold"
                  style={{
                    color: summary.net >= 0 ? "#10b981" : "#ef4444",
                  }}
                >
                  {summary.net >= 0 ? "+" : ""}{summary.net.toLocaleString()} ₽
                </div>
                <div className="text-xs text-muted-foreground">Чистый поток</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card style={tokens.styles.subtleCard}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-auto"
              style={tokens.styles.input}
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-auto"
              style={tokens.styles.input}
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" style={tokens.styles.input}>
                <SelectValue placeholder="Тип транзакции" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="income_rent">Доходы</SelectItem>
                <SelectItem value="expense_salary">Расходы</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-[38px] px-3"
            >
              <X className="h-4 w-4 mr-1" />
              Сбросить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry Form */}
      {showForm && isOwner && (
        <Card style={tokens.styles.card}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Новая ручная запись</h3>
            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Тип транзакции</label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => {
                      const newCategory = value.startsWith("income_") ? "rent" : "salary";
                      setFormData({
                        ...formData,
                        type: value,
                        category: newCategory
                      });
                    }}
                  >
                    <SelectTrigger style={tokens.styles.input}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income_rent">Доход: Аренда</SelectItem>
                      <SelectItem value="income_sale">Доход: Продажа</SelectItem>
                      <SelectItem value="income_other">Доход: Прочее</SelectItem>
                      <SelectItem value="expense_salary">Расход: Зарплата</SelectItem>
                      <SelectItem value="expense_purchase">Расход: Закупка</SelectItem>
                      <SelectItem value="expense_operational">Расход: Операционный</SelectItem>
                      <SelectItem value="expense_other">Расход: Прочее</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Категория</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger style={tokens.styles.input}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.type.startsWith("income_") ? (
                        <>
                          <SelectItem value="rent">Аренда</SelectItem>
                          <SelectItem value="sale">Продажа</SelectItem>
                          <SelectItem value="other">Прочее</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="salary">Зарплата</SelectItem>
                          <SelectItem value="purchase">Закупка</SelectItem>
                          <SelectItem value="operational">Операционный</SelectItem>
                          <SelectItem value="other">Прочее</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Сумма (₽)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    style={tokens.styles.input}
                    className={formErrors.amount ? "border-red-500" : ""}
                  />
                  {formErrors.amount && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Способ оплаты</label>
                  <Select
                    value={formData.method}
                    onValueChange={(value) => setFormData({ ...formData, method: value })}
                  >
                    <SelectTrigger style={tokens.styles.input}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Наличные</SelectItem>
                      <SelectItem value="bank_transfer">Банковский перевод</SelectItem>
                      <SelectItem value="card">Карта</SelectItem>
                      <SelectItem value="crypto">Криптовалюта</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание транзакции..."
                  className="w-full min-h-[80px] p-3 rounded-lg resize-none"
                  style={tokens.styles.input}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  aria-label={ariaLabels.submitTransaction}
                  style={tokens.styles.ctaPrimary}
                  className="min-h-[44px] px-6"
                >
                  {submitting ? "Создание..." : "Создать"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormErrors({});
                    setFormData({
                      type: "income_rent",
                      category: "rent",
                      amount: "",
                      method: "cash",
                      description: "",
                    });
                  }}
                  style={tokens.styles.ctaSecondary}
                  className="min-h-[44px] px-6"
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card style={tokens.styles.card}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loading variant="bike" text="Загрузка транзакций..." />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Нет транзакций за выбранный период</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: tokens.borderSoft }}>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Дата</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Тип</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Категория</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Сумма</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Способ</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                      style={{ borderColor: tokens.borderSoft }}
                    >
                      <td className="p-4 text-sm">{formatDate(tx.transactionDate)}</td>
                      <td className="p-4 text-sm">
                        <Badge
                          variant={tx.flowDirection === "in" ? "default" : "secondary"}
                          style={
                            tx.flowDirection === "in"
                              ? tokens.styles.successBadge
                              : {
                                  backgroundColor: "rgba(239, 68, 68, 0.16)",
                                  color: "#b91c1c",
                                  borderColor: "rgba(239, 68, 68, 0.4)",
                                  borderWidth: "1px",
                                  borderStyle: "solid",
                                }
                          }
                        >
                          {getTypeLabel(tx.transactionType)}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {tx.category || "-"}
                      </td>
                      <td className="p-4 text-sm font-semibold">
                        <span
                          style={{
                            color: tx.flowDirection === "in" ? "#10b981" : "#ef4444",
                          }}
                        >
                          {tx.flowDirection === "in" ? "+" : "-"}
                          {tx.amount.toLocaleString()} ₽
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {getMethodLabel(tx.paymentMethod)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">
                        {tx.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}