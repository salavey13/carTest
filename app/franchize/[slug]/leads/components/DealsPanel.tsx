"use client";

import { useState } from "react";
import {
  Calendar, Banknote, ExternalLink, Activity, CheckCircle, XCircle,
  Gauge, Loader2, RotateCcw, ShieldCheck, AlertCircle, Check, X,
  MessageSquare,
} from "lucide-react";

import { activateRental, updateRentalStatus } from "@/app/franchize/server-actions/rentals-dashboard";
import { fmtMoney, formatDate } from "../leads-utils";

interface DealsPanelProps {
  lead: any; // LeadRow
  slug: string;
  T: any; // ThemeTokens
}

export function DealsPanel({ lead, slug, T }: DealsPanelProps) {
  return (
    <div className="space-y-3">
      {lead.rentals.length === 0 && lead.sales.length === 0 && (
        <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <p className="text-xs" style={{ color: T.textFaint }}>Пока нет сделок</p>
        </div>
      )}

      {lead.rentals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold" style={{ color: T.text }}>Аренда</p>
          {lead.rentals.map((r: any, i: number) => <RentalRow key={r.rentalId || i} rental={r} slug={slug} T={T} />)}
        </div>
      )}

      {lead.sales.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold" style={{ color: T.text }}>Продажи</p>
          {lead.sales.map((s: any, i: number) => <SaleRow key={s.saleId || i} sale={s} T={T} />)}
        </div>
      )}
    </div>
  );
}

// ── RentalRow with inline modals extracted ──────────────────────────────────────

interface RentalRowProps {
  rental: any; // LeadRentalRow
  slug: string;
  T: any; // ThemeTokens
}

function RentalRow({ rental, slug, T }: RentalRowProps) {
  const statusMeta: Record<string, { label: string; color: string }> = {
    active: { label: "Активна", color: "#10b981" },
    completed: { label: "Завершена", color: "#3b82f6" },
    confirmed: { label: "Подтверждена", color: "#8b5cf6" },
    pending_confirmation: { label: "В обработке", color: "#f59e0b" },
    cancelled: { label: "Отменена", color: "#64748b" },
  };
  const meta = statusMeta[rental.status] || { label: rental.status, color: T.textMuted };

  // ── Activation state ──
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [odometerInput, setOdometerInput] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Decline state ──
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineMessage, setDeclineMessage] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineMsg, setDeclineMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Complete state ──
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeOdometer, setCompleteOdometer] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeMsg, setCompleteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Odometer pre-fill ──
  const lastOdometer = rental.metadata?.last_known_odometer as number | undefined;

  const handleActivate = async () => {
    const odometer = parseInt(odometerInput, 10);
    if (isNaN(odometer) || odometer < 0 || odometer > 999999) {
      setActivationMsg({ ok: false, text: "Введите корректные показания одометра (0–999999 км)" });
      return;
    }
    setActivating(true);
    setActivationMsg(null);
    try {
      const result = await activateRental({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        odometerBefore: odometer,
        isPasswordAuth: true,
      });
      if (result.success) {
        setActivationMsg({ ok: true, text: result.message || "✅ Аренда активирована! Обновляю..." });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setActivationMsg({ ok: false, text: result.error || "Ошибка активации" });
      }
    } catch (err: any) {
      setActivationMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setActivating(false);
    }
  };

  const handleDecline = async () => {
    if (!declineMessage.trim()) {
      setDeclineMsg({ ok: false, text: "Укажите причину отклонения" });
      return;
    }
    setDeclining(true);
    setDeclineMsg(null);
    try {
      const result = await updateRentalStatus({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        status: "cancelled",
        operatorMessage: declineMessage.trim(),
        isPasswordAuth: true,
      });
      if (result.success) {
        setDeclineMsg({ ok: true, text: result.message || "✅ Аренда отклонена. Обновляю..." });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setDeclineMsg({ ok: false, text: result.error || "Ошибка" });
      }
    } catch (err: any) {
      setDeclineMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setDeclining(false);
    }
  };

  const handleComplete = async () => {
    const odometer = parseInt(completeOdometer, 10);
    if (isNaN(odometer) || odometer < 0 || odometer > 999999) {
      setCompleteMsg({ ok: false, text: "Введите корректные показания одометра (0–999999 км)" });
      return;
    }
    setCompleting(true);
    setCompleteMsg(null);
    try {
      const result = await updateRentalStatus({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        status: "completed",
        odometerAfter: odometer,
        isPasswordAuth: true,
      });
      if (result.success) {
        setCompleteMsg({ ok: true, text: result.message || "✅ Аренда завершена. Обновляю..." });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setCompleteMsg({ ok: false, text: result.error || "Ошибка" });
      }
    } catch (err: any) {
      setCompleteMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setCompleting(false);
    }
  };

  const isPastRental = rental.endDate && new Date(rental.endDate) < new Date();

  return (
    <>
      <div className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: (isPastRental && rental.status === "pending_confirmation" ? "#64748b" : meta.color) + "15",
                    color: isPastRental && rental.status === "pending_confirmation" ? "#64748b" : meta.color }}>
            {isPastRental && rental.status === "pending_confirmation" ? "Просрочена" : meta.label}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: T.textMuted }}>
          <span><Calendar className="inline h-3 w-3 mr-1" />{formatDate(rental.startDate)} — {formatDate(rental.endDate)}</span>
          <span><Banknote className="inline h-3 w-3 mr-1" />{fmtMoney(rental.totalCost)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
            {rental.rentalId && (
            <a href={`/franchize/${slug}/rental/${rental.rentalId}`}
              className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: T.accent }}>
              Открыть <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {/* Activate button — only for pending_confirmation */}
          {rental.status === "pending_confirmation" && (
            <>
              <button onClick={() => setShowActivateModal(true)}
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all hover:opacity-80"
                style={{ backgroundColor: "#10b981", color: "#fff" }}>
                <Activity className="h-3 w-3" />
                Активировать
              </button>
              <button onClick={() => setShowDeclineModal(true)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all hover:opacity-80"
                style={{ backgroundColor: "#ef4444", color: "#fff" }}>
                <XCircle className="h-3 w-3" />
                Отклонить
              </button>
            </>
          )}
          {/* Complete button — only for active */}
          {rental.status === "active" && (
            <button onClick={() => { setShowCompleteModal(true); setCompleteOdometer(String(lastOdometer || "")); }}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all hover:opacity-80"
              style={{ backgroundColor: "#3b82f6", color: "#fff" }}>
              <CheckCircle className="h-3 w-3" />
              Завершить
            </button>
          )}
        </div>
      </div>

      {/* ── Activation Modal ── */}
      {showActivateModal && (
        <ActivateRentalModal
          rental={rental}
          slug={slug}
          T={T}
          odometerInput={odometerInput}
          setOdometerInput={setOdometerInput}
          activating={activating}
          setActivating={setActivating}
          activationMsg={activationMsg}
          setActivationMsg={setActivationMsg}
          showActivateModal={showActivateModal}
          setShowActivateModal={setShowActivateModal}
          lastOdometer={lastOdometer}
          handleActivate={handleActivate}
        />
      )}

      {/* ── Decline Modal ── */}
      {showDeclineModal && (
        <DeclineRentalModal
          rental={rental}
          T={T}
          declineMessage={declineMessage}
          setDeclineMessage={setDeclineMessage}
          declining={declining}
          setDeclining={setDeclining}
          declineMsg={declineMsg}
          setDeclineMsg={setDeclineMsg}
          showDeclineModal={showDeclineModal}
          setShowDeclineModal={setShowDeclineModal}
          handleDecline={handleDecline}
        />
      )}

      {/* ── Complete Modal ── */}
      {showCompleteModal && (
        <CompleteRentalModal
          rental={rental}
          slug={slug}
          T={T}
          completeOdometer={completeOdometer}
          setCompleteOdometer={setCompleteOdometer}
          completing={completing}
          setCompleting={setCompleting}
          completeMsg={completeMsg}
          setCompleteMsg={setCompleteMsg}
          showCompleteModal={showCompleteModal}
          setShowCompleteModal={setShowCompleteModal}
          lastOdometer={lastOdometer}
          handleComplete={handleComplete}
        />
      )}
    </>
  );
}

// ── Separated Modal Components ────────────────────────────────────────────────

interface ActivateRentalModalProps {
  rental: any;
  slug: string;
  T: any;
  odometerInput: string;
  setOdometerInput: (v: string) => void;
  activating: boolean;
  setActivating: (v: boolean) => void;
  activationMsg: { ok: boolean; text: string } | null;
  setActivationMsg: (v: { ok: boolean; text: string } | null) => void;
  showActivateModal: boolean;
  setShowActivateModal: (v: boolean) => void;
  lastOdometer: number | undefined;
  handleActivate: () => Promise<void>;
}

function ActivateRentalModal({
  rental, slug, T, odometerInput, setOdometerInput, activating, setActivating,
  activationMsg, setActivationMsg, showActivateModal, setShowActivateModal,
  lastOdometer, handleActivate,
}: ActivateRentalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => { if (!activating) { setShowActivateModal(false); setActivationMsg(null); } }}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
        style={{ backgroundColor: T.bgCard, borderColor: T.border }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold" style={{ color: T.text }}>Активация аренды</h3>
        <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
          Подтвердите выдачу байка и укажите показания одометра
        </p>
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
          <p className="mt-1 text-[10px]" style={{ color: T.textMuted }}>
            {formatDate(rental.startDate)} — {formatDate(rental.endDate)}
          </p>
          <p className="text-[10px]" style={{ color: T.textMuted }}>{fmtMoney(rental.totalCost)}</p>
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-medium" style={{ color: T.text }}>
            <Gauge className="inline h-3.5 w-3.5 mr-1" />
            Показания одометра (км)
          </label>
          <input
            type="number" min="0" max="999999"
            value={odometerInput}
            onChange={e => { setOdometerInput(e.target.value); setActivationMsg(null); }}
            placeholder={lastOdometer ? `~${lastOdometer} (предыдущий)` : "0"}
            disabled={activating}
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}
            autoFocus
          />
          {lastOdometer && !odometerInput && (
            <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
              <RotateCcw className="inline h-3 w-3 mr-0.5" />
              Предыдущий: {lastOdometer} км
            </p>
          )}
        </div>
        {activationMsg && (
          <div className="mt-3 rounded-xl border p-2.5 text-[11px] font-medium text-center"
            style={{
              borderColor: activationMsg.ok ? "#10b98140" : "#ef444440",
              backgroundColor: activationMsg.ok ? "#10b98110" : "#ef444410",
              color: activationMsg.ok ? "#10b981" : "#ef4444",
            }}>
            {activationMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
            {activationMsg.text}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setShowActivateModal(false); setActivationMsg(null); }} disabled={activating}
            className="flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all hover:opacity-70"
            style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgCard }}>
            Отмена
          </button>
          <button onClick={handleActivate} disabled={activating}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: "#10b981" }}>
            {activating ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Активация...</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Активировать</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeclineRentalModalProps {
  rental: any;
  T: any;
  declineMessage: string;
  setDeclineMessage: (v: string) => void;
  declining: boolean;
  setDeclining: (v: boolean) => void;
  declineMsg: { ok: boolean; text: string } | null;
  setDeclineMsg: (v: { ok: boolean; text: string } | null) => void;
  showDeclineModal: boolean;
  setShowDeclineModal: (v: boolean) => void;
  handleDecline: () => Promise<void>;
}

function DeclineRentalModal({
  rental, T, declineMessage, setDeclineMessage, declining, setDeclining,
  declineMsg, setDeclineMsg, showDeclineModal, setShowDeclineModal, handleDecline,
}: DeclineRentalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => { if (!declining) { setShowDeclineModal(false); setDeclineMsg(null); } }}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
        style={{ backgroundColor: T.bgCard, borderColor: T.border }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold" style={{ color: "#ef4444" }}>
          <XCircle className="inline h-4 w-4 mr-1" />
          Отклонение аренды
        </h3>
        <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
          Укажите причину — она будет отправлена арендатору
        </p>
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
          <p className="mt-1 text-[10px]" style={{ color: T.textMuted }}>
            {formatDate(rental.startDate)} — {formatDate(rental.endDate)}
          </p>
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-medium" style={{ color: T.text }}>
            <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
            Сообщение арендатору
          </label>
          <textarea
            value={declineMessage}
            onChange={e => { setDeclineMessage(e.target.value); setDeclineMsg(null); }}
            placeholder="Например: Байк на зарядке. Предлагаем перенести на завтра или выбрать другой байк."
            disabled={declining}
            rows={4}
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all resize-none"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}
            autoFocus
          />
          <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
            Быстрые причины:
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {["Байк на зарядке", "Байк на ремонте", "Нет свободных дат", "Перенос на другие даты"].map((reason) => (
              <button key={reason}
                onClick={() => { setDeclineMessage(reason); setDeclineMsg(null); }}
                className="rounded-lg border px-2 py-0.5 text-[9px] font-medium transition-all hover:opacity-70"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated }}>
                {reason}
              </button>
            ))}
          </div>
        </div>
        {declineMsg && (
          <div className="mt-3 rounded-xl border p-2.5 text-[11px] font-medium text-center"
            style={{
              borderColor: declineMsg.ok ? "#10b98140" : "#ef444440",
              backgroundColor: declineMsg.ok ? "#10b98110" : "#ef444410",
              color: declineMsg.ok ? "#10b981" : "#ef4444",
            }}>
            {declineMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
            {declineMsg.text}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setShowDeclineModal(false); setDeclineMsg(null); }} disabled={declining}
            className="flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all hover:opacity-70"
            style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgCard }}>
            Отмена
          </button>
          <button onClick={handleDecline} disabled={declining}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: "#ef4444" }}>
            {declining ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Отклоняю...</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />Отклонить</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CompleteRentalModalProps {
  rental: any;
  slug: string;
  T: any;
  completeOdometer: string;
  setCompleteOdometer: (v: string) => void;
  completing: boolean;
  setCompleting: (v: boolean) => void;
  completeMsg: { ok: boolean; text: string } | null;
  setCompleteMsg: (v: { ok: boolean; text: string } | null) => void;
  showCompleteModal: boolean;
  setShowCompleteModal: (v: boolean) => void;
  lastOdometer: number | undefined;
  handleComplete: () => Promise<void>;
}

function CompleteRentalModal({
  rental, slug, T, completeOdometer, setCompleteOdometer, completing, setCompleting,
  completeMsg, setCompleteMsg, showCompleteModal, setShowCompleteModal,
  lastOdometer, handleComplete,
}: CompleteRentalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => { if (!completing) { setShowCompleteModal(false); setCompleteMsg(null); } }}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
        style={{ backgroundColor: T.bgCard, borderColor: T.border }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold" style={{ color: "#3b82f6" }}>
          <CheckCircle className="inline h-4 w-4 mr-1" />
          Завершение аренды
        </h3>
        <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
          Укажите финальные показания одометра при возврате байка
        </p>
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
          <p className="mt-1 text-[10px]" style={{ color: T.textMuted }}>
            {formatDate(rental.startDate)} — {formatDate(rental.endDate)}
          </p>
          <p className="text-[10px]" style={{ color: T.textMuted }}>{fmtMoney(rental.totalCost)}</p>
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-medium" style={{ color: T.text }}>
            <Gauge className="inline h-3.5 w-3.5 mr-1" />
            Финальный одометр (км)
          </label>
          <input
            type="number" min="0" max="999999"
            value={completeOdometer}
            onChange={e => { setCompleteOdometer(e.target.value); setCompleteMsg(null); }}
            placeholder={lastOdometer ? `~${lastOdometer} (примерно)` : "0"}
            disabled={completing}
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}
            autoFocus
          />
          {lastOdometer && (
            <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
              <RotateCcw className="inline h-3 w-3 mr-0.5" />
              Предыдущий: {lastOdometer} км — используйте как отправную точку
            </p>
          )}
        </div>
        {completeMsg && (
          <div className="mt-3 rounded-xl border p-2.5 text-[11px] font-medium text-center"
            style={{
              borderColor: completeMsg.ok ? "#10b98140" : "#ef444440",
              backgroundColor: completeMsg.ok ? "#10b98110" : "#ef444410",
              color: completeMsg.ok ? "#10b981" : "#ef4444",
            }}>
            {completeMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
            {completeMsg.text}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setShowCompleteModal(false); setCompleteMsg(null); }} disabled={completing}
            className="flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all hover:opacity-70"
            style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgCard }}>
            Отмена
          </button>
          <button onClick={handleComplete} disabled={completing}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: "#3b82f6" }}>
            {completing ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Завершаю...</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Завершить</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SaleRow ────────────────────────────────────────────────────────────────

function SaleRow({ sale, T }: { sale: any; T: any }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: T.text }}>{sale.bikeTitle || "Байк"}</p>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#f59e0b15", color: "#f59e0b" }}>Продажа</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: T.textMuted }}>
        <span><Calendar className="inline h-3 w-3 mr-1" />{formatDate(sale.createdAt)}</span>
        <span><Banknote className="inline h-3 w-3 mr-1" />{fmtMoney(sale.salePrice)}</span>
      </div>
    </div>
  );
}