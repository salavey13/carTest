"use client";

// SubrenterManagerPanel
// ──────────────────────────────────────────────────────────────────────────
// Admin panel section: marks a Telegram user as the SUBRENTER (partner owner)
// of a bike by writing his chat id into cars.specs.subrenter_chat_id.
// The subrenter then sees rentals of his bike (mini admin) and gets
// exploration achievements. No DB migration — pure specs JSONB data.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  getCrewBikesSubrenterInfoAction,
  setBikeSubrenterAction,
} from "@/app/franchize/server-actions/bike-subrenter";
import {
  generateSubrenterWeeklyReportAction,
  type SubrentWeeklyReportResult,
} from "@/app/franchize/server-actions/subrenter-monitoring";
import { FranchizeOperatorPanel } from "./FranchizeOperatorSurface";

interface BikeSubrenterRow {
  bikeId: string;
  label: string;
  subrenterChatId: string | null;
  subrenterUsername?: string | null;
}

export function SubrenterManagerPanel({
  slug,
  canManage,
}: {
  slug: string;
  canManage: boolean;
}) {
  const { dbUser } = useAppContext();
  const [bikes, setBikes] = useState<BikeSubrenterRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Quick search — vip-bike alone has 50+ bikes, scrolling the whole wall to
  // find yamaha-r7 was painful. Filters by label OR bike id OR subrenter id.
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // ── Weekly owner report (§5.5 / Приложение № 3) ──
  // Default period: the CURRENT week Mon–Sun in the MSK calendar.
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportChatId, setReportChatId] = useState("");
  const [reportPct, setReportPct] = useState("");
  const [reportBusy, setReportBusy] = useState<"download" | "send" | null>(null);

  useEffect(() => {
    // MSK current week boundaries (Mon..Sun)
    const nowMsk = new Date(Date.now() + 3 * 3600 * 1000);
    const day = nowMsk.getUTCDay(); // 0=Sun
    const mondayOffset = day === 0 ? 6 : day - 1;
    const monday = new Date(nowMsk.getTime() - mondayOffset * 24 * 3600 * 1000);
    const sunday = new Date(monday.getTime() + 6 * 24 * 3600 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setReportFrom(iso(monday));
    setReportTo(iso(sunday));
  }, []);

  const partners = useMemo(() => {
    const byChat = new Map<string, { chatId: string; username: string | null; bikes: string[] }>();
    for (const b of bikes) {
      if (!b.subrenterChatId) continue;
      const entry = byChat.get(b.subrenterChatId) ?? { chatId: b.subrenterChatId, username: b.subrenterUsername ?? null, bikes: [] };
      entry.bikes.push(b.label);
      byChat.set(b.subrenterChatId, entry);
    }
    return Array.from(byChat.values());
  }, [bikes]);

  useEffect(() => {
    if (!reportChatId && partners.length > 0) setReportChatId(partners[0].chatId);
  }, [partners, reportChatId]);

  const runWeeklyReport = async (mode: "download" | "send") => {
    const userId = dbUser?.user_id;
    if (!userId) {
      toast.error("Пользователь ещё авторизуется — попробуйте ещё раз.");
      return;
    }
    if (!reportChatId || !reportFrom || !reportTo) {
      toast.error("Выберите партнёра и даты отчётного периода.");
      return;
    }
    setReportBusy(mode);
    try {
      const result: SubrentWeeklyReportResult = await generateSubrenterWeeklyReportAction({
        slug,
        actorUserId: userId,
        chatId: reportChatId,
        from: reportFrom,
        to: reportTo,
        ...(reportPct.trim() ? { ownerPercentage: Number(reportPct) } : {}),
        sendToPartner: mode === "send",
      });
      if (!result.success || !result.docBase64) {
        toast.error(`Отчёт не сформирован — ${result.error ?? "неизвестная ошибка"}`);
        return;
      }
      const s = result.summary;
      const summaryText = s ? `${s.rentalCount} аренд · ${s.totalPaymentsRub.toLocaleString("ru-RU")} ₽ · доля партнёра ${s.ownerPayoutRub.toLocaleString("ru-RU")} ₽ (${s.ownerPercentage}%)` : "";
      if (mode === "download") {
        const binary = Uint8Array.from(atob(result.docBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([binary], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName ?? `subrent-weekly-report-${reportFrom}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Отчёт сформирован${summaryText ? `: ${summaryText}` : ""}`);
      } else {
        toast.success(result.sentToPartner ? `Отчёт отправлен партнёру в Telegram${summaryText ? ` — ${summaryText}` : ""}` : "Отчёт сформирован, но отправка партнёру не удалась (проверьте chat id).") ;
      }
    } catch (err) {
      toast.error(`Отчёт не сформирован — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReportBusy(null);
    }
  };

  const visibleBikes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bikes;
    return bikes.filter((b) =>
      b.label.toLowerCase().includes(q) ||
      b.bikeId.toLowerCase().includes(q) ||
      (b.subrenterChatId ?? "").includes(q),
    );
  }, [bikes, search]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setLoadError(null);
    try {
      // NOTE: dbUser may still be resolving on first expand (AppContext auth
      // runs async). Wait for it — previously the early return left bikes=[]
      // and the panel claimed "В экипаже пока нет техники".
      const userId = await waitForUserId();
      if (!userId) {
        setLoadError("Пользователь ещё авторизуется — нажмите «Обновить».");
        return;
      }
      const result = await getCrewBikesSubrenterInfoAction({ slug, actorUserId: userId });
      if (result.success && result.data) {
        setBikes(result.data);
        setDrafts(Object.fromEntries(result.data.map((b) => [b.bikeId, b.subrenterChatId ?? ""])));
      } else if (result.error) {
        setLoadError(result.error);
        toast.error(`Не удалось загрузить список байков — ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadError(message);
      toast.error(`Не удалось загрузить список байков — ${message}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, loadAttempt]);

  // Resolves dbUser.user_id, waiting up to ~10s for AppContext auth to land.
  // The old code bailed immediately when dbUser was null (fresh page load,
  // slow Telegram auth) which surfaced as a permanent empty list.
  const waitForUserId = useCallback(async (): Promise<string | null> => {
    for (let i = 0; i < 20; i++) {
      if (dbUser?.user_id) return dbUser.user_id;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return dbUser?.user_id ?? null;
  }, [dbUser?.user_id]);

  useEffect(() => {
    if (expanded && canManage) void load();
  }, [expanded, canManage, load]);

  const save = async (bikeId: string) => {
    const userId = dbUser?.user_id;
    if (!userId) {
      toast.error("Пользователь ещё авторизуется — попробуйте ещё раз через пару секунд.");
      return;
    }
    const value = (drafts[bikeId] ?? "").trim();
    setSavingId(bikeId);
    try {
      const result = await setBikeSubrenterAction({
        slug,
        actorUserId: userId,
        bikeId,
        subrenterChatId: value || null,
      });
      if (result.success) {
        toast.success(value ? "Субарендатор назначен — отправили ему уведомление в Telegram" : "Субарендатор снят");
        setBikes((prev) => prev.map((b) => (b.bikeId === bikeId ? { ...b, subrenterChatId: value || null } : b)));
      } else {
        toast.error(`Не удалось сохранить — ${result.error ?? "неизвестная ошибка"}`);
      }
    } catch (err) {
      toast.error(`Не удалось сохранить — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingId(null);
    }
  };

  if (!canManage) return null;

  return (
    <FranchizeOperatorPanel className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
            Субарендаторы (мини-админы)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--fr-admin-muted)]">
            Telegram chat id партнёра-владельца байка. Субарендатор видит аренды
            своего байка на странице «Аренды» и может открыть страницу аренды.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 text-xs"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded) void load();
          }}
        >
          {expanded ? "Свернуть" : "Управлять"}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {/* ── Weekly owner report (§5.5 / Приложение № 3) ── */}
          {partners.length > 0 && (
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-admin-border)" }}>
              <p className="text-xs font-semibold text-[var(--fr-admin-text)]">
                Еженедельный отчёт партнёру (п. 5.5 договора, Приложение № 3)
              </p>
              <p className="mt-1 text-xs text-[var(--fr-admin-muted)]">
                Отчёт по арендам мотоциклов партнёра за период + его доля платежей. По умолчанию — текущая неделя (пн–вс).
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-[var(--fr-admin-muted)]">
                  Партнёр
                  <select
                    value={reportChatId}
                    onChange={(e) => setReportChatId(e.target.value)}
                    className="h-9 rounded-lg border bg-transparent px-2 text-xs text-[var(--fr-admin-text)] outline-none focus:border-[var(--fr-admin-accent)]"
                    style={{ borderColor: "var(--fr-admin-border)" }}
                  >
                    {partners.map((p) => (
                      <option key={p.chatId} value={p.chatId} className="bg-zinc-900">
                        {p.username ? `@${p.username}` : `ID ${p.chatId}`} · {p.bikes.length} мото
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--fr-admin-muted)]">
                  С
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="h-9 rounded-lg border bg-transparent px-2 text-xs text-[var(--fr-admin-text)] outline-none focus:border-[var(--fr-admin-accent)]"
                    style={{ borderColor: "var(--fr-admin-border)" }}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--fr-admin-muted)]">
                  По
                  <input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="h-9 rounded-lg border bg-transparent px-2 text-xs text-[var(--fr-admin-text)] outline-none focus:border-[var(--fr-admin-accent)]"
                    style={{ borderColor: "var(--fr-admin-border)" }}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--fr-admin-muted)]">
                  Доля, %
                  <input
                    value={reportPct}
                    onChange={(e) => setReportPct(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                    placeholder="из договора"
                    inputMode="numeric"
                    className="h-9 w-24 rounded-lg border bg-transparent px-2 text-xs text-[var(--fr-admin-text)] outline-none focus:border-[var(--fr-admin-accent)]"
                    style={{ borderColor: "var(--fr-admin-border)" }}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-xs"
                  disabled={reportBusy !== null}
                  onClick={() => void runWeeklyReport("download")}
                >
                  <FileDown className="mr-1 h-3 w-3" />
                  {reportBusy === "download" ? "Формирую…" : "Скачать отчёт"}
                </Button>
                <Button
                  type="button"
                  className="h-9 text-xs font-semibold"
                  disabled={reportBusy !== null}
                  onClick={() => void runWeeklyReport("send")}
                >
                  <Send className="mr-1 h-3 w-3" />
                  {reportBusy === "send" ? "Отправляю…" : "Отправить партнёру"}
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: yamaha-r7, R7, 687580818…"
              className="h-8 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-xs text-[var(--fr-admin-text)] outline-none focus:border-[var(--fr-admin-accent)]"
              style={{ borderColor: "var(--fr-admin-border)" }}
            />
            <span className="shrink-0 text-xs text-[var(--fr-admin-muted)]">
              {loading ? "Загрузка…" : `${visibleBikes.length} / ${bikes.length} байков`}
            </span>
            <Button type="button" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => setLoadAttempt((n) => n + 1)} disabled={loading}>
              <RefreshCw className="mr-1 h-3 w-3" /> Обновить
            </Button>
          </div>
          {!loading && loadError && (
            <p className="rounded-lg border px-3 py-2 text-xs text-amber-300" style={{ borderColor: "var(--fr-admin-border)" }}>
              Ошибка загрузки: {loadError}. Нажмите «Обновить».
            </p>
          )}
          {!loading && !loadError && bikes.length === 0 && (
            <p className="py-2 text-center text-xs text-[var(--fr-admin-muted)]">
              В экипаже пока нет мотоциклов.
            </p>
          )}
          {!loading && bikes.length > 0 && visibleBikes.length === 0 && (
            <p className="py-2 text-center text-xs text-[var(--fr-admin-muted)]">
              По запросу ничего не найдено.
            </p>
          )}
          {visibleBikes.map((bike) => (
            <div
              key={bike.bikeId}
              className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
              style={{ borderColor: "var(--fr-admin-border)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--fr-admin-text)]">
                  {bike.label}
                </p>
                <p className="mt-0.5 text-xs text-[var(--fr-admin-muted)]">
                  {bike.subrenterChatId
                    ? `Субарендатор: ${bike.subrenterUsername ? `@${bike.subrenterUsername} · ` : ""}${bike.subrenterChatId}`
                    : "Субарендатор не назначен"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={drafts[bike.bikeId] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [bike.bikeId]: e.target.value.replace(/[^\d]/g, "") }))}
                  placeholder="chat id, напр. 123456789"
                  inputMode="numeric"
                  className="h-9 w-40 rounded-lg border bg-transparent px-3 text-xs text-[var(--fr-admin-text)] outline-none focus:border-[var(--fr-admin-accent)]"
                  style={{ borderColor: "var(--fr-admin-border)" }}
                />
                <Button
                  type="button"
                  className="h-9 text-xs font-semibold"
                  disabled={savingId === bike.bikeId || (drafts[bike.bikeId] ?? "") === (bike.subrenterChatId ?? "")}
                  onClick={() => void save(bike.bikeId)}
                >
                  {savingId === bike.bikeId ? "Сохраняю…" : "Сохранить"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </FranchizeOperatorPanel>
  );
}
