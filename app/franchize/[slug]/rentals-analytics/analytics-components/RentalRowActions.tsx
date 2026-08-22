"use client";

import {
  RefreshCw,
  QrCode,
  Edit,
  MessageSquare,
  Send,
  Mail,
  CheckCircle2,
  Share2,
} from "lucide-react";
import type { RentalDashboardItem } from "@/app/franchize/server-actions/rentals-dashboard";
import { withAlpha } from "@/app/franchize/lib/theme";

interface RentalRowActionsProps {
  rental: RentalDashboardItem;
  messageTemplates: Array<{ id: string; key: string; name: string }>;
  /** ID of the rental whose message menu is open, or null */
  messageMenuOpen: string | null;
  /** Currently loading IDs per action type (or null) */
  regeneratingQr: string | null;
  sendingMessage: string | null;
  sendingEmail: string | null;
  completingRental: string | null;
  updatingRentalStatus: string | null;
  // Theme colours
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
  // Callbacks
  onHandout: (rental: RentalDashboardItem) => void;
  onReturn: (rental: RentalDashboardItem) => void;
  onQrRegeneration: (rental: RentalDashboardItem) => void;
  onStatusChange: (rental: RentalDashboardItem) => void;
  onSendMessage: (rental: RentalDashboardItem, templateKey: string) => void;
  onSendEmail: (rental: RentalDashboardItem) => void;
  onMarkComplete: (rental: RentalDashboardItem) => void;
  onShareQr: (rental: RentalDashboardItem) => void;
  onToggleMessageMenu: (rentalId: string | null) => void;
}

export function RentalRowActions({
  rental,
  messageTemplates,
  messageMenuOpen,
  regeneratingQr,
  sendingMessage,
  sendingEmail,
  completingRental,
  updatingRentalStatus,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
  onHandout,
  onReturn,
  onQrRegeneration,
  onStatusChange,
  onSendMessage,
  onSendEmail,
  onMarkComplete,
  onShareQr,
  onToggleMessageMenu,
}: RentalRowActionsProps) {
  return (
    <td className="px-3 md:px-5 py-3 md:py-4 text-center">
      <div className="flex items-center justify-center gap-1 md:gap-1.5 flex-wrap">
        {/* Handout button */}
        <button
          onClick={() => onHandout(rental)}
          className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group"
          style={
            rental.handoutCompleted
              ? {
                  background: `linear-gradient(135deg, #10b981, #059669)`,
                  color: "white",
                  boxShadow: `0 4px 12px ${withAlpha("#10b981", 0.4)}`,
                  border: "none",
                }
              : {
                  backgroundColor: withAlpha("#10b981", 0.15),
                  borderColor: withAlpha("#10b981", 0.4),
                  color: "#34d399",
                  border: "1.5px solid",
                }
          }
        >
          {rental.handoutCompleted && (
            <div className="absolute inset-0 bg-white/20 blur-sm" />
          )}
          <span className="relative z-10">→</span>
        </button>
        {/* Return button */}
        <button
          onClick={() => onReturn(rental)}
          className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group"
          style={
            rental.returnCompleted
              ? {
                  background: `linear-gradient(135deg, #3b82f6, #2563eb)`,
                  color: "white",
                  boxShadow: `0 4px 12px ${withAlpha("#3b82f6", 0.4)}`,
                  border: "none",
                }
              : {
                  backgroundColor: withAlpha("#3b82f6", 0.15),
                  borderColor: withAlpha("#3b82f6", 0.4),
                  color: "#60a5fa",
                  border: "1.5px solid",
                }
          }
        >
          {rental.returnCompleted && (
            <div className="absolute inset-0 bg-white/20 blur-sm" />
          )}
          <span className="relative z-10">←</span>
        </button>
        {/* QR Regenerate button */}
        {rental.documentSecret && (
          <button
            onClick={() => void onQrRegeneration(rental)}
            disabled={regeneratingQr === rental.rental_id}
            className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
            style={{
              backgroundColor:
                regeneratingQr === rental.rental_id
                  ? withAlpha("#f59e0b", 0.25)
                  : withAlpha("#f59e0b", 0.15),
              borderColor: withAlpha("#f59e0b", 0.4),
              color: "#f59e0b",
              border: "1.5px solid",
            }}
          >
            {regeneratingQr === rental.rental_id ? (
              <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
            ) : (
              <QrCode className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
            )}
          </button>
        )}
        {/* Status change button */}
        <button
          onClick={() => onStatusChange(rental)}
          disabled={updatingRentalStatus === rental.rental_id}
          className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
          style={{
            backgroundColor: withAlpha(accentMain, 0.15),
            borderColor: withAlpha(accentMain, 0.4),
            color: accentMain,
            border: "1.5px solid",
          }}
        >
          {updatingRentalStatus === rental.rental_id ? (
            <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
          ) : (
            <Edit className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
          )}
        </button>
        {/* Message button with dropdown */}
        {rental.documentSecret && (
          <div className="relative">
            <button
              onClick={() =>
                onToggleMessageMenu(
                  messageMenuOpen === rental.rental_id ? null : rental.rental_id
                )
              }
              disabled={sendingMessage === rental.rental_id}
              className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
              style={{
                backgroundColor:
                  sendingMessage === rental.rental_id
                    ? withAlpha("#8b5cf6", 0.25)
                    : withAlpha("#8b5cf6", 0.15),
                borderColor: withAlpha("#8b5cf6", 0.4),
                color: "#8b5cf6",
                border: "1.5px solid",
              }}
              title="Отправить сообщение"
            >
              {sendingMessage === rental.rental_id ? (
                <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
              ) : (
                <MessageSquare className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
              )}
            </button>

            {/* Dropdown menu */}
            {messageMenuOpen === rental.rental_id && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => onToggleMessageMenu(null)}
                />
                {/* Menu */}
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl py-1 min-w-[200px]"
                  style={{
                    backgroundColor: bgCard,
                    borderColor: borderSoft,
                    borderWidth: "1px",
                  }}
                >
                  <div
                    className="px-2 py-1.5 border-b text-xs font-bold"
                    style={{
                      borderColor: withAlpha(borderSoft, 0.3),
                      color: textSecondary,
                    }}
                  >
                    Быстрые сообщения
                  </div>
                  {messageTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => void onSendMessage(rental, template.key)}
                      className="w-full px-3 py-2 text-left text-xs hover:opacity-80 transition-colors flex items-center gap-2"
                      style={{ color: textPrimary }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = withAlpha(
                          accentMain,
                          0.1
                        ))
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <Send
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color: "#8b5cf6" }}
                      />
                      <span className="truncate">{template.name}</span>
                    </button>
                  ))}
                  {messageTemplates.length === 0 && (
                    <div
                      className="px-3 py-2 text-xs"
                      style={{ color: textSecondary }}
                    >
                      Нет шаблонов
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {/* Email button */}
        {rental.documentSecret && (
          <button
            onClick={() => void onSendEmail(rental)}
            disabled={sendingEmail === rental.rental_id}
            className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50 hidden sm:block"
            style={{
              backgroundColor:
                sendingEmail === rental.rental_id
                  ? withAlpha("#06b6d4", 0.25)
                  : withAlpha("#06b6d4", 0.15),
              borderColor: withAlpha("#06b6d4", 0.4),
              color: "#06b6d4",
              border: "1.5px solid",
            }}
            title="Отправить на email"
          >
            {sendingEmail === rental.rental_id ? (
              <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
            ) : (
              <Mail className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
            )}
          </button>
        )}
        {/* Mark as complete button */}
        {rental.status !== "completed" && (
          <button
            onClick={() => void onMarkComplete(rental)}
            disabled={completingRental === rental.rental_id}
            className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
            style={{
              backgroundColor:
                completingRental === rental.rental_id
                  ? withAlpha("#10b981", 0.25)
                  : withAlpha("#10b981", 0.15),
              borderColor: withAlpha("#10b981", 0.4),
              color: "#10b981",
              border: "1.5px solid",
            }}
            title="Завершить аренду"
          >
            {completingRental === rental.rental_id ? (
              <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
            ) : (
              <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
            )}
          </button>
        )}
        {/* QR Share button - for crew members to quickly access rental */}
        <button
          onClick={() => onShareQr(rental)}
          className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group"
          style={{
            backgroundColor: withAlpha("#8b5cf6", 0.15),
            borderColor: withAlpha("#8b5cf6", 0.4),
            color: "#8b5cf6",
            border: "1.5px solid",
          }}
          title="Скопировать ссылку для быстрого доступа"
        >
          <Share2 className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
        </button>
      </div>
    </td>
  );
}
