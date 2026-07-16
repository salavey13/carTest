"use client";

import { Clock, DollarSign, Users, Car, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface AnalyticsSummary {
  totalCount: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
}

interface SummaryCardProps {
  summary: AnalyticsSummary | null;
  formatCurrency: (amount: number) => string;
}

export function SummaryCards({ summary, formatCurrency }: SummaryCardProps) {
  if (!summary) return null;

  const statusColors: Record<string, string> = {
    active: "#10b981",
    completed: "#3b82f6",
    confirmed: "#8b5cf6",
    pending_confirmation: "#f59e0b",
    cancelled: "#6b7280",
    disputed: "#ef4444",
  };

  const paymentStatusColors: Record<string, string> = {
    paid: "#10b981",
    interest_paid: "#f59e0b",
    pending: "#6b7280",
    refunded: "#ef4444",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <SummaryCard
        label="Аренд сегодня"
        value={summary.totalCount}
        icon={Car}
        iconColor="#3b82f6"
      />
      <SummaryCard
        label="Выручка"
        value={formatCurrency(summary.totalRevenue)}
        icon={DollarSign}
        iconColor="#10b981"
      />
      <SummaryCard
        label="По статусам"
        value={
          <div className="space-y-1 text-xs">
            {Object.entries(summary.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span style={{ color: statusColors[status] || "#6b7280" }}>{status}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        }
        icon={Users}
        iconColor="#8b5cf6"
        fullWidth
      />
      <SummaryCard
        label="По оплате"
        value={
          <div className="space-y-1 text-xs">
            {Object.entries(summary.byPaymentStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span style={{ color: paymentStatusColors[status] || "#6b7280" }}>{status}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        }
        icon={CheckCircle}
        iconColor="#10b981"
        fullWidth
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number | React.ReactNode;
  icon: React.ElementType;
  iconColor: string;
  fullWidth?: boolean;
}

function SummaryCard({ label, value, icon: Icon, iconColor, fullWidth }: SummaryCardProps) {
  const Icon = Icon;
  return (
    <div className={`rounded-2xl border p-5 ${fullWidth ? "col-span-full md:col-span-4" : ""}`} style={{ borderColor: "#e5e7eb", backgroundColor: "#fff" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: "#6b7280" }}>{label}</p>
          <p className="text-3xl font-bold" style={{ color: "#1f2937" }}>
            {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
          </p>
        </div>
        <div className="rounded-xl p-2" style={{ backgroundColor: `${iconColor}15` }}>
          <Icon className="h-6 w-6" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

// Connection status indicator
interface ConnectionStatusProps {
  isOnline: boolean;
  lastSync?: Date;
}

export function ConnectionStatus({ isOnline, lastSync }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`flex h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
      <span style={{ color: isOnline ? "#10b981" : "#ef4444" }}>
        {isOnline ? "Онлайн" : "Офлайн"}
      </span>
      {lastSync && (
        <span className="text-gray-500">
          Обновлено {lastSync.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

// Export modal (shared)
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: "csv" | "xlsx") => Promise<void>;
  title: string;
  filename: string;
  loading?: boolean;
}

export function ExportModal({ isOpen, onClose, onExport, title, filename, loading }: ExportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-gray-600 mb-6">Выберите формат для экспорта файла <code>{filename}</code></p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onExport("csv")}
            disabled={loading}
            className="rounded-xl border p-4 text-center hover:bg-gray-50 transition"
          >
            <div className="text-3xl mb-2">📄</div>
            <div className="font-medium">CSV</div>
            <div className="text-xs text-gray-500">Таблица для Excel</div>
          </button>
          <button
            onClick={() => onExport("xlsx")}
            disabled={loading}
            className="rounded-xl border p-4 text-center hover:bg-gray-50 transition"
          >
            <div className="text-3xl mb-2">📊</div>
            <div className="font-medium">XLSX</div>
            <div className="text-xs text-gray-500">Нативный Excel</div>
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}