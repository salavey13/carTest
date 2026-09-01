"use client";

// SubrentersOverviewPanel — crew owner / admin panel: «Субарендаторы».
// One card per partner (bikes + rental stats), plus the monthly payout sheet
// («сколько должны партнёрам за месяц») with a month switcher and a one-tap
// «Записать выплату» into the owner cash wallet.
//
// iter31 enhancements:
//  • per-partner inline month chip — rentals + payout amount for the selected
//    month right on the partner card (previously buried in the payout sheet);
//  • «Записать выплату» straight on the partner card (same handler as the
//    sheet, disabled while the write is in flight);
//  • TG contact button per partner (t.me link when username is known,
//    otherwise a copy-id fallback).

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Copy, Handshake, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FranchizeOperatorLinkButton, FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import { MonthPickerBar } from "@/app/franchize/components/FranchizeMonthPicker";
import {
  getSubrentersMonthlyPayoutsAction,
  type SubrenterOverviewRow,
  type SubrentersMonthlyPayoutsData,
} from "@/app/franchize/server-actions/subrenter-monitoring";
import { addOwnerCashEntryAction } from "@/app/franchize/server-actions/owner-cash";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { currentMskMonthKey } from "@/app/franchize/lib/subrenter-economics";
import { formatCurrency, monthLabel, itemVariants, type CrewTokens, type SpaNavigate } from "./profile-shared";

export function SubrentersOverviewPanel({
  rows,
  slug,
  userId,
  T,
  navigateSpa,
  onPayoutRecorded,
}: {
  rows: SubrenterOverviewRow[];
  slug: string;
  /** Authenticated actor (cookie identity) — used for permissioned actions. */
  userId: string;
  T: CrewTokens;
  navigateSpa: SpaNavigate;
  /** Notifies the owner-wallet panel to reload after a payout was written. */
  onPayoutRecorded?: () => void;
}) {
  // iter18: monthly payout sheet — how much the crew owes every partner this
  // month (50% of the bike part; equipment is not split). Month switcher for
  // payback bookkeeping.
  const [payoutsMonth, setPayoutsMonth] = useState(() => currentMskMonthKey());
  const [payouts, setPayouts] = useState<SubrentersMonthlyPayoutsData | null>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutRecordBusy, setPayoutRecordBusy] = useState<string | null>(null);
  // m3 fix: bump after each recorded payout so the sheet refetches and shows
  // the up-to-date "к выплате" remainder (previously the full amount stayed
  // tappable, inviting duplicate payout entries).
  const [payoutsVersion, setPayoutsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPayoutsLoading(true);
    getSubrentersMonthlyPayoutsAction({ slug, actorUserId: userId, month: payoutsMonth, initData: getTelegramInitData() })
      .then((res) => {
        if (!cancelled && res.success && res.data) setPayouts(res.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setPayoutsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, userId, payoutsMonth, payoutsVersion]);

  // iter31: month payouts indexed by partner chat id → inline chips on cards.
  const payoutByChat = useMemo(() => {
    const m = new Map<string, { rentalCount: number; payoutRub: number }>();
    if (payouts && payouts.month === payoutsMonth) {
      for (const r of payouts.rows) m.set(r.chatId, { rentalCount: r.rentalCount, payoutRub: r.payoutRub });
    }
    return m;
  }, [payouts, payoutsMonth]);

  /** Быстрая запись выплаты субарендатору (kind=subrenter_payout). */
  const recordPayout = async (chatId: string, name: string, amountRub: number) => {
    if (!amountRub || amountRub <= 0) {
      toast.error("Нечего записывать — сумма 0");
      return;
    }
    setPayoutRecordBusy(chatId);
    try {
      const res = await addOwnerCashEntryAction({
        slug,
        actorUserId: userId,
        direction: "out",
        kind: "subrenter_payout",
        amount: amountRub,
        title: "Выплата субарендатору",
        person: name,
        initData: getTelegramInitData(),
      });
      if (res.success) {
        toast.success(`Выплата ${name} записана в кошелёк`);
        // m3 fix: refetch the payout sheet (and the wallet via the callback)
        // right after a write so both views reflect fresh data immediately.
        setPayoutsVersion((v) => v + 1);
        onPayoutRecorded?.();
      } else {
        toast.error(res.error || "Не удалось записать выплату");
      }
    } catch {
      toast.error("Не удалось записать выплату — нет связи.");
    } finally {
      setPayoutRecordBusy(null);
    }
  };

  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
              <Handshake className="h-4 w-4" /> Субарендаторы
            </h2>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              Партнёры, передавшие свои байки в парк экипажа. Назначить или
              снять субарендатора можно в админ-панели.
            </p>
          </div>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}/admin`}>
            Управлять
          </FranchizeOperatorLinkButton>
        </div>

        {/* Monthly payout sheet */}
        <div className="mt-4 rounded-xl border p-3" style={T.styles.card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>
              <Wallet className="h-3.5 w-3.5" /> Выплаты субарендаторам
            </p>
            <MonthPickerBar
              value={payoutsMonth}
              onChange={setPayoutsMonth}
              accent={T.accent}
              accentContrast={T.accentContrast}
              bgCard={T.bgCard}
              bgElevated={T.bgElevated}
              border={T.borderSoft}
              text={T.text}
              textMuted={T.textMuted}
            />
          </div>

          {payoutsLoading ? (
            <p className="mt-3 animate-pulse text-sm" style={{ color: T.textMuted }}>
              Считаем…
            </p>
          ) : payouts ? (
            <>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                <span className="text-2xl font-bold tabular-nums" style={{ color: "#f59e0b" }}>
                  {formatCurrency(payouts.totalPayoutRub)}
                </span>
                <span className="text-[11px]" style={{ color: T.textMuted }}>
                  к выплате партнёрам за {monthLabel(payouts.month).toLowerCase()} · 50% аренды байков (экипировка не делится)
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                {payouts.rows.map((row) => {
                  const displayName = row.name || (row.username ? `@${row.username.replace(/^@+/, "")}` : `id ${row.chatId}`);
                  return (
                    <div
                      key={row.chatId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-xs"
                      style={T.styles.card}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold" style={{ color: T.text }}>
                          {displayName}
                        </span>
                        <span className="ml-1.5 font-normal" style={{ color: T.textMuted }}>
                          {row.rentalCount} аренд{row.rentalCount > 0 && row.totalRub > 0 ? ` · оборот ${formatCurrency(row.totalRub)}` : ""}
                          {row.rentalCount > 0 && row.totalRub > 0 ? ` · нам ${formatCurrency(Math.max(0, row.totalRub - row.payoutRub))}` : ""}
                        </span>
                      </div>
                      <span className="whitespace-nowrap font-bold tabular-nums" style={{ color: "#f59e0b" }}>
                        {row.payoutRub > 0 ? `→ ${formatCurrency(row.payoutRub)}` : "—"}
                      </span>
                      {row.payoutRub > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 text-[11px]"
                          disabled={payoutRecordBusy === row.chatId}
                          onClick={() => void recordPayout(row.chatId, displayName, row.payoutRub)}
                        >
                          {payoutRecordBusy === row.chatId ? "…" : "Записать выплату"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm" style={{ color: T.textMuted }}>
              Нет данных за этот месяц.
            </p>
          )}
        </div>

        {/* Partner cards */}
        <div className="mt-3 space-y-2">
          {rows.map((s) => {
            const displayName = s.name || (s.username ? `@${s.username.replace(/^@+/, "")}` : `id ${s.chatId}`);
            const monthPayout = payoutByChat.get(s.chatId);
            return (
              <div key={s.chatId} className="rounded-xl border p-3" style={T.styles.card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-semibold" style={{ color: T.text }}>
                      {displayName}
                    </span>
                    <span className="hidden text-[11px] sm:inline" style={{ color: T.textMuted }}>
                      {s.username ? `@${s.username.replace(/^@+/, "")} · ` : ""}id {s.chatId}
                    </span>
                    {/* iter31: TG contact — t.me link when username known.
                        n1 fix: strip stray leading @ (legacy/manual rows). */}
                    {s.username ? (
                      <a
                        href={`https://t.me/${s.username.replace(/^@+/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Написать ${displayName} в Telegram`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:opacity-80"
                        style={{ backgroundColor: T.bgElevated, color: T.accent }}
                      >
                        <Send className="h-3 w-3" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        title="Скопировать Telegram ID"
                        onClick={() => {
                          void navigator.clipboard?.writeText(s.chatId);
                          toast.success("Telegram ID скопирован");
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:opacity-80"
                        style={{ backgroundColor: T.bgElevated, color: T.textMuted }}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: T.textMuted }}>
                    <span>Аренд: {s.totalRentals}</span>
                    {s.activeRentals > 0 && (
                      <span className="rounded-full px-2 py-0.5 font-semibold" style={{ ...T.styles.accentPill }}>
                        активных: {s.activeRentals}
                      </span>
                    )}
                    {s.lastRentalAt && (
                      <span>· последняя {new Date(s.lastRentalAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                </div>

                {/* iter31: inline month chip — partner's month rentals + payout. */}
                {monthPayout && (monthPayout.rentalCount > 0 || monthPayout.payoutRub > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: "color-mix(in srgb, #f59e0b 14%, transparent)",
                        color: "#f59e0b",
                      }}
                    >
                      {monthLabel(payoutsMonth).toLowerCase()}:{monthPayout.rentalCount > 0 ? ` ${monthPayout.rentalCount} аренд ·` : ""} к выплате {formatCurrency(monthPayout.payoutRub)}
                    </span>
                    {monthPayout.payoutRub > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px]"
                        disabled={payoutRecordBusy === s.chatId}
                        onClick={() => void recordPayout(s.chatId, displayName, monthPayout.payoutRub)}
                      >
                        {payoutRecordBusy === s.chatId ? "…" : "Записать выплату"}
                      </Button>
                    )}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.bikes.map((b) => (
                    <button
                      key={b.bikeId}
                      type="button"
                      onClick={() => navigateSpa(`/franchize/${slug}/bikes/${b.bikeId}`)}
                      title="Открыть историю байка"
                      className="cursor-pointer rounded-full border px-2 py-0.5 text-[11px] transition hover:opacity-80 active:scale-[0.98]"
                      style={{
                        borderColor: b.activeRentals > 0 ? T.accent : T.borderSoft,
                        color: b.activeRentals > 0 ? T.accent : T.textMuted,
                      }}
                    >
                      {b.label} · {b.totalRentals} аренд{b.activeRentals > 0 ? ` · ${b.activeRentals} активна` : ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </FranchizeOperatorPanel>
    </motion.div>
  );
}
