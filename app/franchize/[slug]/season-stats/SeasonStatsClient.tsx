"use client";

// app/franchize/[slug]/season-stats/SeasonStatsClient.tsx
//
// Сезон 2026 — инфографика кодом (CSS/SVG), без картинок.
//  • Обзор сезона грузится один раз (сервер кэширует ~10 мин).
//  • Детали месяца — лениво, только по клику (кэш на клиенте тоже держим).
//  • Раунд сверки + повторная отправка сверки — owner-tier (сервер проверяет).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bike, Banknote, CalendarRange, CarFront, CheckCircle2, Loader2,
  RefreshCw, Send, Tag, TrendingUp, Wallet, AlertTriangle,
} from "lucide-react";
import {
  getSeasonStatsOverview,
  getSeasonMonthDetails,
  startSeasonVerificationRound,
  type SeasonOverview,
  type SeasonMonthDetails,
  type VerificationRoundResult,
} from "@/app/franchize/server-actions/season-stats";
import { resendVerificationDmsAction } from "@/app/franchize/server-actions/rental-verify-actions";
import { ARCHIVE_SNAPSHOT } from "./archive-snapshot";

export interface SeasonStatsTokens {
  bg: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
}

const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const VIOLET = "#8b5cf6";

const nf = new Intl.NumberFormat("ru-RU");
const rub = (v: number) => `${nf.format(Math.round(v))} ₽`;

const STATUS_RU: Record<string, string> = {
  completed: "завершена",
  active: "в аренде",
  pending_confirmation: "ожидает",
  confirmed: "подтверждена",
  cancelled: "отменена",
};

const VER_STYLE: Record<string, { label: string; color: string }> = {
  verified: { label: "✅ сверена", color: GREEN },
  disputed: { label: "⚠️ спор", color: RED },
  pending: { label: "⏳ ждёт", color: AMBER },
  operator_confirmed: { label: "⏳ оператор ✓", color: AMBER },
  owner_confirmed: { label: "⏳ владелец ✓", color: AMBER },
};

function verMeta(status: string | null) {
  if (!status) return { label: "— не сверена", color: AMBER };
  return VER_STYLE[status] || { label: status, color: AMBER };
}

interface Props {
  slug: string;
  crewName: string;
  ownerTier: boolean;
  tokens: SeasonStatsTokens;
}

export function SeasonStatsClient({ slug, crewName, ownerTier, tokens }: Props) {
  const [overview, setOverview] = useState<SeasonOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SeasonMonthDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"rentals" | "sales" | "cash">("rentals");
  const [roundBusy, setRoundBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState<string | null>(null);
  const detailsCache = useRef<Record<string, SeasonMonthDetails>>({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getSeasonStatsOverview({ slug });
    if (res.success && res.data) {
      setOverview(res.data);
    } else {
      setError(res.error || "Не удалось загрузить статистику сезона.");
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const openMonth = useCallback(
    async (month: string) => {
      setSelectedMonth(month);
      setDetailsTab("rentals");
      if (detailsCache.current[month]) {
        setDetails((d) => ({ ...d, [month]: detailsCache.current[month] }));
        return;
      }
      setDetailsLoading(true);
      const res = await getSeasonMonthDetails({ slug, month });
      if (res.success && res.data) {
        detailsCache.current[month] = res.data;
        setDetails((d) => ({ ...d, [month]: res.data as SeasonMonthDetails }));
      } else {
        toast.error(res.error || "Не удалось загрузить детали месяца.");
      }
      setDetailsLoading(false);
    },
    [slug],
  );

  const startRound = useCallback(async () => {
    setRoundBusy(true);
    try {
      const res = await startSeasonVerificationRound({ slug, limit: 10 });
      if (res.success && res.data) {
        const r: VerificationRoundResult = res.data;
        toast.success(
          r.sent > 0
            ? `🎲 Раунд сверки: выслано ${r.sent}${r.skipped ? `, пропущено ${r.skipped}` : ""}${r.dmed ? " — детали в TG" : ""}`
            : "Новых сверок для отправки нет — всё уже разослано.",
        );
        await loadOverview();
      } else {
        toast.error(res.error || "Не удалось запустить раунд сверки.");
      }
    } finally {
      setRoundBusy(false);
    }
  }, [slug, loadOverview]);

  const resendOne = useCallback(
    async (rentalId: string) => {
      setResendBusy(rentalId);
      try {
        const res = await resendVerificationDmsAction({ slug, rentalId });
        if (res.success) toast.success("🤝 Сверка выслана в Telegram");
        else toast.error(res.error || "Ошибка отправки сверки.");
      } finally {
        setResendBusy(null);
      }
    },
    [slug],
  );

  const maxRevenue = useMemo(
    () => Math.max(1, ...(overview?.months.map((m) => m.revenue) || [1])),
    [overview],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ borderColor: tokens.border, backgroundColor: tokens.card, minHeight: 84 }} />
          ))}
        </div>
        <div className="rounded-2xl border p-8 animate-pulse" style={{ borderColor: tokens.border, backgroundColor: tokens.card, minHeight: 220 }} />
        <p className="text-center text-xs" style={{ color: tokens.textMuted }}>Считаем сезон…</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-3" style={{ borderColor: tokens.border, backgroundColor: tokens.card }}>
        <p className="text-sm" style={{ color: tokens.text }}>😕 {error || "Нет данных"}</p>
        <button
          onClick={loadOverview}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: tokens.accent, color: tokens.accent }}
        >
          <RefreshCw className="w-4 h-4" /> Повторить
        </button>
      </div>
    );
  }

  const t = overview.totals;
  const v = overview.verification;
  const donutSegments = [
    { value: v.verified, color: GREEN },
    { value: v.disputed, color: RED },
    { value: v.waiting, color: AMBER },
    { value: v.unverified, color: "transparent" },
  ];
  const donutTotal = Math.max(1, v.completed);
  let acc = 0;
  const donutStops = donutSegments.map((s) => {
    const from = (acc / donutTotal) * 360;
    acc += s.value;
    const to = (acc / donutTotal) * 360;
    return `${s.color === "transparent" ? tokens.card : s.color} ${from}deg ${to}deg`;
  }).filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      {/* ── KPI grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Выручка аренд" value={rub(t.revenue)} sub={`${t.rentals} аренд · средний чек ${rub(t.avgCheck)}`} color={tokens.accent} tokens={tokens} />
        <KpiCard icon={<Bike className="w-4 h-4" />} label="Завершено аренд" value={String(t.completed)} sub={`из ${t.rentals} за сезон`} color={GREEN} tokens={tokens} />
        <KpiCard icon={<Tag className="w-4 h-4" />} label="Продажи байков" value={rub(t.salesRevenue)} sub={`${t.sales} сделок (ДКП)`} color={VIOLET} tokens={tokens} />
        <KpiCard icon={<Wallet className="w-4 h-4" />} label="Касса" value={rub(t.cashIn)} sub={`расходы: ${rub(t.cashOut)}`} color={AMBER} tokens={tokens} />
      </div>

      {/* ── Season timeline (CSS bars, no pictures) ──────────────────────── */}
      <section className="rounded-2xl border p-4" style={{ borderColor: tokens.border, backgroundColor: tokens.card }}>
        <header className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: tokens.text }}>
            <CalendarRange className="w-4 h-4" style={{ color: tokens.accent }} />
            Таймлайн сезона {overview.seasonYear}
          </h2>
          <span className="text-[11px]" style={{ color: tokens.textMuted }}>клик по месяцу — детали</span>
        </header>
        <div className="flex items-end gap-1.5 sm:gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {overview.months.map((m) => {
            const h = Math.max(4, Math.round((m.revenue / maxRevenue) * 120));
            const active = selectedMonth === m.month;
            return (
              <button
                key={m.month}
                onClick={() => openMonth(m.month)}
                className="group flex-1 min-w-[44px] flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition"
                style={{
                  backgroundColor: active ? `color-mix(in srgb, ${tokens.accent} 14%, transparent)` : "transparent",
                  opacity: m.isFuture ? 0.45 : 1,
                }}
                aria-label={`${m.label}: ${m.rentals} аренд, ${rub(m.revenue)}`}
              >
                <span className="text-[10px] sm:text-[11px] font-bold tabular-nums" style={{ color: tokens.text }}>
                  {m.revenue > 0 ? `${Math.round(m.revenue / 1000)}к` : "—"}
                </span>
                <div className="w-full flex items-end justify-center" style={{ height: 124 }}>
                  <div
                    className="w-5 sm:w-7 rounded-t-md transition-all group-hover:opacity-85"
                    style={{
                      height: h,
                      background: `linear-gradient(180deg, ${tokens.accent} 0%, color-mix(in srgb, ${tokens.accent} 45%, transparent) 100%)`,
                      boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${tokens.accent} 55%, transparent)` : "none",
                    }}
                  />
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold" style={{ color: active ? tokens.accent : tokens.textMuted }}>
                  {m.label.split(" ")[0]}
                </span>
                <span className="text-[9px] tabular-nums" style={{ color: tokens.textMuted }}>{m.rentals} ар.</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Verification donut + round starter ───────────────────────────── */}
      <section className="rounded-2xl border p-4" style={{ borderColor: tokens.border, backgroundColor: tokens.card }}>
        <h2 className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: tokens.text }}>
          <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} />
          Сверка расчётов — игра экипажа
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative w-28 h-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${donutStops})` }}>
              <div className="absolute inset-2.5 rounded-full flex flex-col items-center justify-center" style={{ backgroundColor: tokens.card }}>
                <span className="text-xl font-black tabular-nums" style={{ color: tokens.text }}>{v.verifiedSharePct}%</span>
                <span className="text-[9px]" style={{ color: tokens.textMuted }}>сверено</span>
              </div>
            </div>
            <ul className="space-y-1 text-xs" style={{ color: tokens.text }}>
              <li className="flex items-center gap-2"><Dot color={GREEN} /> сверено: <b className="tabular-nums">{v.verified}</b></li>
              <li className="flex items-center gap-2"><Dot color={AMBER} /> ждут: <b className="tabular-nums">{v.waiting + v.unverified}</b></li>
              <li className="flex items-center gap-2"><Dot color={RED} /> споры: <b className="tabular-nums">{v.disputed}</b></li>
              <li className="text-[10px]" style={{ color: tokens.textMuted }}>из {v.completed} завершённых аренд</li>
            </ul>
          </div>
          {ownerTier && v.unverified + v.waiting > 0 && (
            <div className="flex flex-col gap-2 sm:ml-auto">
              <button
                onClick={startRound}
                disabled={roundBusy}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#16130A] transition disabled:opacity-60"
                style={{ backgroundColor: tokens.accent }}
              >
                {roundBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                🎲 Раунд сверки — выслать до 10
              </button>
              <span className="text-[10px] leading-snug" style={{ color: tokens.textMuted }}>
                Последним завершённым арендам уйдут личные сообщения с кнопками ✅/⚠️. Повторный запуск спам не удвоит.
              </span>
            </div>
          )}
        </div>

        {overview.latestUnverified.length > 0 && (
          <div className="mt-3 rounded-xl border overflow-hidden" style={{ borderColor: tokens.border }}>
            <p className="px-3 py-2 text-[11px] font-semibold" style={{ color: tokens.textMuted, backgroundColor: `color-mix(in srgb, ${AMBER} 8%, transparent)` }}>
              Последние несверенные аренды — проверь, пока память свежа:
            </p>
            <ul>
              {overview.latestUnverified.map((r) => (
                <li key={r.rentalId} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs border-t" style={{ borderColor: tokens.border, color: tokens.text }}>
                  <Link href={`/franchize/${slug}/rental/${r.rentalId}`} className="font-semibold hover:underline" style={{ color: tokens.accent }}>
                    {r.title}
                  </Link>
                  <span style={{ color: tokens.textMuted }}>{r.startedAt}</span>
                  {r.renter && <span className="truncate max-w-[160px]">{r.renter}</span>}
                  <b className="ml-auto tabular-nums">{rub(r.total)}</b>
                  {ownerTier && (
                    <button
                      onClick={() => resendOne(r.rentalId)}
                      disabled={resendBusy === r.rentalId}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                      style={{ borderColor: AMBER, color: AMBER }}
                    >
                      {resendBusy === r.rentalId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Выслать
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Month details (lazy) ─────────────────────────────────────────── */}
      {selectedMonth && (
        <section className="rounded-2xl border p-4" style={{ borderColor: tokens.border, backgroundColor: tokens.card }}>
          <header className="flex flex-wrap items-center gap-2 mb-3">
            <h2 className="text-sm font-bold" style={{ color: tokens.text }}>
              {overview.months.find((m) => m.month === selectedMonth)?.label} — детали
            </h2>
            <div className="ml-auto flex gap-1">
              {([["rentals", "Аренды"], ["sales", "Продажи"], ["cash", "Касса"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDetailsTab(key)}
                  className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                  style={{
                    borderColor: detailsTab === key ? tokens.accent : tokens.border,
                    color: detailsTab === key ? tokens.accent : tokens.textMuted,
                    backgroundColor: detailsTab === key ? `color-mix(in srgb, ${tokens.accent} 12%, transparent)` : "transparent",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          {detailsLoading && (
            <p className="flex items-center gap-2 text-xs py-6 justify-center" style={{ color: tokens.textMuted }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Загружаем месяц…
            </p>
          )}

          {!detailsLoading && details[selectedMonth] && (() => {
            const d = details[selectedMonth];
            if (detailsTab === "rentals") {
              const bikes = d.rentals.filter((r) => r.kind === "bike");
              const other = d.rentals.filter((r) => r.kind !== "bike");
              return bikes.length + other.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: tokens.textMuted }}>В этом месяце аренд нет.</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {[...bikes, ...other].map((r) => {
                    const vm = verMeta(r.verificationStatus);
                    return (
                      <div key={r.rentalId} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: tokens.border }}>
                        <span className="tabular-nums" style={{ color: tokens.textMuted }}>{r.startedAt.slice(8)}.{r.startedAt.slice(5, 7)}</span>
                        <Link href={`/franchize/${slug}/rental/${r.rentalId}`} className="font-semibold hover:underline" style={{ color: tokens.accent }}>
                          {r.title}{r.kind !== "bike" ? " · экип" : ""}
                        </Link>
                        {r.renter && <span className="truncate max-w-[150px]" style={{ color: tokens.text }}>{r.renter}</span>}
                        <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `color-mix(in srgb, ${tokens.textMuted} 12%, transparent)`, color: tokens.textMuted }}>
                          {STATUS_RU[r.status] || r.status}
                        </span>
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: vm.color, backgroundColor: `color-mix(in srgb, ${vm.color} 10%, transparent)` }}>
                          {vm.label}
                        </span>
                        <b className="ml-auto tabular-nums" style={{ color: tokens.text }}>{rub(r.total)}</b>
                        {ownerTier && r.status === "completed" && (!r.verificationStatus || r.verificationStatus === "pending") && (
                          <button
                            onClick={() => resendOne(r.rentalId)}
                            disabled={resendBusy === r.rentalId}
                            className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                            style={{ borderColor: AMBER, color: AMBER }}
                            title="Выслать сверку в TG"
                          >
                            {resendBusy === r.rentalId ? <Loader2 className="w-3 h-3 animate-spin" /> : "🤝"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] pt-1" style={{ color: tokens.textMuted }}>
                    Аренд: {d.rentals.length} · на сумму {rub(d.rentals.reduce((s, r) => s + r.total, 0))}
                  </p>
                </div>
              );
            }
            if (detailsTab === "sales") {
              return d.sales.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: tokens.textMuted }}>Продаж в этом месяце нет.</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {d.sales.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: tokens.border, color: tokens.text }}>
                      <CarFront className="w-3.5 h-3.5" style={{ color: VIOLET }} />
                      <span className="font-semibold">{s.buyer}</span>
                      <span style={{ color: tokens.textMuted }}>{s.createdAt}</span>
                      <b className="ml-auto tabular-nums">{rub(s.price)}</b>
                    </div>
                  ))}
                  <p className="text-[10px] pt-1" style={{ color: tokens.textMuted }}>Сделок: {d.sales.length} · на сумму {rub(d.sales.reduce((s, x) => s + x.price, 0))}</p>
                </div>
              );
            }
            return (
              <div className="space-y-2 text-xs" style={{ color: tokens.text }}>
                <div className="flex gap-3">
                  <span className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: GREEN, color: GREEN }}>приход: <b className="tabular-nums">{rub(d.cash.in)}</b></span>
                  <span className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: RED, color: RED }}>расход: <b className="tabular-nums">{rub(d.cash.out)}</b></span>
                </div>
                {d.cash.top.length === 0 ? (
                  <p style={{ color: tokens.textMuted }}>Операций в кассе за месяц не найдено.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {d.cash.top.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: tokens.border }}>
                        <Banknote className="w-3.5 h-3.5" style={{ color: c.direction === "out" ? RED : GREEN }} />
                        <span style={{ color: tokens.textMuted }}>{c.date}</span>
                        <span className="truncate max-w-[220px]">{c.description || c.type}</span>
                        <b className={`ml-auto tabular-nums`} style={{ color: c.direction === "out" ? RED : GREEN }}>
                          {c.direction === "out" ? "−" : "+"}{rub(c.amount)}
                        </b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* ── Archive coverage (docs vs DB) ────────────────────────────────── */}
      <section className="rounded-2xl border p-4" style={{ borderColor: tokens.border, backgroundColor: tokens.card }}>
        <h2 className="flex items-center gap-2 text-sm font-bold mb-1" style={{ color: tokens.text }}>
          <AlertTriangle className="w-4 h-4" style={{ color: AMBER }} />
          Архив договоров vs база — что досчитается после ретроимпорта
        </h2>
        <p className="text-[11px] mb-3" style={{ color: tokens.textMuted }}>
          Разбор архива от {ARCHIVE_SNAPSHOT.generatedAt.slice(0, 10)}: файлов {ARCHIVE_SNAPSHOT.filesTotal} ·
          в базе уже {ARCHIVE_SNAPSHOT.byStatus.imported_db + ARCHIVE_SNAPSHOT.byStatus.imported_backfill_v1} ·
          ждут импорта {ARCHIVE_SNAPSHOT.byStatus.retro_missing + ARCHIVE_SNAPSHOT.byStatus.retro_needs_review} ·
          тест-драйвов {ARCHIVE_SNAPSHOT.byStatus.testdrive} · продаж {ARCHIVE_SNAPSHOT.byStatus.sale} · шаблонов {ARCHIVE_SNAPSHOT.byStatus.template}
        </p>
        <div className="space-y-1">
          {ARCHIVE_SNAPSHOT.months.filter((m) => m.docs > 0 || m.db > 0).map((m) => {
            const gap = m.expected - m.db;
            return (
              <div key={m.month} className="flex items-center gap-2 text-xs" style={{ color: tokens.text }}>
                <span className="w-16 shrink-0" style={{ color: tokens.textMuted }}>{m.month}</span>
                <div className="flex-1 flex items-center gap-1">
                  <div className="h-4 rounded-md" style={{ width: `${Math.min(100, (m.db / Math.max(1, m.expected)) * 100)}%`, backgroundColor: `color-mix(in srgb, ${tokens.accent} 55%, transparent)` }} />
                  <div className="h-4 rounded-md border border-dashed" style={{ width: gap > 0 ? `${Math.min(100 - (m.db / Math.max(1, m.expected)) * 100, 45)}%` : 0, borderColor: AMBER, backgroundColor: `color-mix(in srgb, ${AMBER} 14%, transparent)` }} />
                  <span className="text-[10px] tabular-nums" style={{ color: tokens.textMuted }}>
                    в базе {m.db}{gap > 0 ? ` → будет ${m.expected} (+${gap})` : ""}
                  </span>
                </div>
                {(m.month === "2026-05" || m.month === "2026-06") && gap > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `color-mix(in srgb, ${AMBER} 16%, transparent)`, color: AMBER }}>
                    май/июн уточнится
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] mt-2" style={{ color: tokens.textMuted }}>
          Известные суммы по ненайденным договорам: {rub(ARCHIVE_SNAPSHOT.missingMoneyKnownRub)} + {rub(ARCHIVE_SNAPSHOT.reviewMoneyKnownRub)} на проверке.
          Ретроимпорт запустим отдельным шагом — ничего не теряется.
        </p>
      </section>

      <p className="text-center text-[10px] pb-2" style={{ color: tokens.textMuted }}>
        {crewName} · сезон {overview.seasonYear} · данные кэшируются ≈10 минут, детали месяца грузятся по клику · обновлено {overview.generatedAt.slice(11, 16)} MSK
      </p>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color, tokens }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string; tokens: SeasonStatsTokens;
}) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: tokens.border, backgroundColor: `color-mix(in srgb, ${tokens.card} 88%, transparent)` }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] md:text-[11px] uppercase tracking-wide font-bold" style={{ color: tokens.textMuted }}>{label}</span>
      </div>
      <div className="text-lg md:text-xl font-black tabular-nums" style={{ color: tokens.text }}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: tokens.textMuted }}>{sub}</div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}
