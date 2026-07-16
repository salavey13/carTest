"use client";

import { AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";

interface RentalStatusChangeModalProps {
  isOpen: boolean;
  rental: {
    rental_id: string;
    status: string;
    vehicle?: { make?: string; model?: string } | null;
    user?: { full_name?: string; username?: string } | null;
  } | null;
  updatingRentalStatus: string | null;
  onStatusChange: (rental: any, newStatus: string) => Promise<void>;
  onClose: () => void;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

const STATUS_OPTIONS = [
  { value: "pending_confirmation", label: "Ожидает", icon: AlertCircle, color: "#fbbf24" },
  { value: "confirmed", label: "Подтв.", icon: CheckCircle2, color: "#34d399" },
  { value: "active", label: "Активна", icon: Clock, color: "#60a5fa" },
  { value: "completed", label: "Завершена", icon: CheckCircle2, color: "#4ade80" },
  { value: "cancelled", label: "Отменена", icon: XCircle, color: "#f87171" },
  { value: "disputed", label: "Спор", icon: AlertCircle, color: "#ef4444" },
] as const;

export function RentalStatusChangeModal({
  isOpen,
  rental,
  updatingRentalStatus,
  onStatusChange,
  onClose,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: RentalStatusChangeModalProps) {
  if (!isOpen || !rental) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: withAlpha("#000000", 0.5) }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative rounded-2xl p-6 max-w-sm w-full"
        style={{
          backgroundColor: bgCard,
          borderColor: withAlpha(borderSoft, 0.5),
          borderWidth: "1px",
          boxShadow: `0 20px 60px ${withAlpha("#000000", 0.3)}`,
        }}
      >
        <h3 className="text-lg font-black mb-4" style={{ color: textPrimary }}>
          Изменить статус
        </h3>
        <p className="text-sm mb-4" style={{ color: textSecondary }}>
          {rental.vehicle?.make} {rental.vehicle?.model}
          <br />
          <span className="text-xs">{rental.user?.full_name || rental.user?.username}</span>
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {STATUS_OPTIONS.map((status) => {
            const Icon = status.icon;
            const isSelected = rental.status === status.value;
            const isUpdating = updatingRentalStatus === rental.rental_id;

            return (
              <button
                key={status.value}
                onClick={() => void onStatusChange(rental, status.value)}
                disabled={isUpdating}
                className="relative px-3 py-2 rounded-lg text-xs font-bold transition-all duration-300 disabled:opacity-50 overflow-hidden"
                style={
                  isSelected
                    ? {
                        background: `linear-gradient(135deg, ${withAlpha(status.color, 0.25)}, ${withAlpha(status.color, 0.15)})`,
                        borderColor: withAlpha(status.color, 0.4),
                        color: status.color,
                        borderWidth: "1.5px",
                        boxShadow: `0 0 15px ${withAlpha(status.color, 0.2)}`,
                      }
                    : {
                        backgroundColor: withAlpha(bgCard, 0.6),
                        borderColor: borderSoft,
                        color: textSecondary,
                        borderWidth: "1px",
                      }
                }
              >
                {isUpdating ? (
                  <RefreshCw className="w-4 h-4 mx-auto animate-spin" style={{ color: status.color }} />
                ) : (
                  <div className="flex items-center justify-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? status.color : textSecondary }} />
                    <span>{status.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{ backgroundColor: withAlpha(borderSoft, 0.2), color: textSecondary }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
