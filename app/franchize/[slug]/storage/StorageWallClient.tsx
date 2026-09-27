"use client";

// /app/franchize/[slug]/storage/StorageWallClient.tsx
// 2026-09-27 — «Хранение»: the owner-facing winter-storage wall («Мотопарк»
// for actual owners). Three views from one server-verified fetch:
//   · staff  — the whole season: stats, every bike, status moves, notes;
//   · owner  — HIS bikes only (matched by the verified Telegram id);
//   · guest  — the offer (place / care / price) + CTA, zero bike data.
// Every bike card carries its move timeline (storage_bike_events) and the
// «не для аренды» badge — these are client machines, never catalog items.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown, FileText, Loader2, MessageSquarePlus, RefreshCw, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import {
  addStorageBikeNoteAction,
  getStorageWallAction,
  updateStorageBikeStatusAction,
} from "@/app/franchize/server-actions/storage-bikes";
import {
  STORAGE_SOURCE_LABELS,
  STORAGE_STATUS_META,
  STORAGE_STATUS_TRANSITIONS,
  storageDocPublicUrl,
  storageFormatRub,
  storageIsoToRu,
  type StorageBikeStatus,
  type StorageBikeVM,
  type StorageWallVM,
} from "@/app/franchize/lib/storage";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";

/** Action label per target status (the buttons the staff sees on a card). */
const MOVE_BUTTON_LABELS: Record<StorageBikeStatus, string> = {
  in_storage: "Принять на хранение",
  returned: "Вернул владельцу",
  cancelled: "Отменить",
  requested: "Вернуть в заявки",
};

const TONE_STYLES: Record<StorageBikeStatus | "default", { bg: string; fg: string }> = {
  amber: { bg: "rgba(245, 158, 11, 0.14)", fg: "#d97706" },
  sky: { bg: "rgba(14, 165, 233, 0.14)", fg: "#0284c7" },
  green: { bg: "rgba(34, 197, 94, 0.14)", fg: "#16a34a" },
  muted: { bg: "rgba(113, 113, 122, 0.14)", fg: "#71717a" },
  default: { bg: "rgba(113, 113, 122, 0.14)", fg: "#71717a" },
};

interface StorageWallClientProps {
  initialSlug: string;
  crewName: string;
  contactsPhone: string;
}

export function StorageWallClient({ initialSlug, crewName, contactsPhone }: StorageWallClientProps) {
  const { dbUser, user } = useAppContext();
  const params = useParams<{ slug: string }>();
  const slug = initialSlug || params?.slug || "vip-bike";

  useFranchizeTheme({ mode: "auto", isAuto: true });
  const T = useCrewTokens({ mode: "auto", isAuto: true });

  const [wall, setWall] = useState<StorageWallVM | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchEpochRef = useRef(0);

  const fetchWall = useCallback(async () => {
    const epoch = ++fetchEpochRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getStorageWallAction({
        slug,
        actorUserId: dbUser?.user_id || user?.id || undefined,
        initData: getTelegramInitData(),
      });
      if (epoch !== fetchEpochRef.current) return; // a newer request already committed
      if (!result.success || !result.wall) {
        setError(result.error ?? "Не удалось загрузить стену хранения.");
        return;
      }
      setWall(result.wall);
    } catch (err) {
      if (epoch !== fetchEpochRef.current) return;
      setError(err instanceof Error ? err.message : "Не удалось загрузить стену хранения.");
    } finally {
      if (epoch === fetchEpochRef.current) setIsLoading(false);
    }
  }, [slug, dbUser?.user_id, user?.id]);

  useEffect(() => {
    fetchWall();
  }, [fetchWall]);

  const access = wall?.access ?? "guest";
  const stats = wall?.stats;

  return (
    <div className="space-y-4">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold" style={{ color: T.textPrimary }}>
            <Snowflake className="h-5 w-5 text-sky-400" aria-hidden="true" />
            Зимнее хранение
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
            {access === "staff"
              ? `${crewName} · сезон ${new Date().getFullYear()}→${new Date().getFullYear() + 1}`
              : access === "owner"
                ? "Ваши байки на сезоне — каждый шаг экипажа виден здесь"
                : `${crewName} · ответственное хранение по договору (гл. 47 ГК РФ)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchWall}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition active:scale-[0.98]"
            style={{ borderColor: T.borderSoft, color: T.textSecondary, backgroundColor: T.bgCard }}
            aria-label="Обновить"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          {access !== "guest" ? (
            <Link
              href={`/franchize/${slug}/storage/new`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-bold text-white transition hover:bg-sky-400 active:scale-[0.98]"
            >
              <Snowflake className="h-4 w-4" aria-hidden="true" />
              Добавить байк
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── staff stats ── */}
      {access === "staff" && stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Всего", value: stats.total },
            { label: "Заявок", value: stats.requested },
            { label: "На хранении", value: stats.inStorage },
            { label: "Возвращено", value: stats.returned },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
              <p className="text-lg font-extrabold" style={{ color: T.textPrimary }}>{value}</p>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── guest offer ── */}
      {access === "guest" ? (
        <GuestOffer slug={slug} crewName={crewName} contactsPhone={contactsPhone} T={T} />
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      {/* ── cards ── */}
      {isLoading && !wall ? (
        <div className="flex items-center justify-center p-10" style={{ color: T.textFaint }}>
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      ) : access !== "guest" && (wall?.bikes.length ?? 0) === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <Snowflake className="mx-auto h-8 w-8" style={{ color: T.textFaint }} aria-hidden="true" />
          <p className="mt-3 text-sm" style={{ color: T.textMuted }}>
            {access === "owner"
              ? "Ваших байков на хранении пока нет — добавьте первый, и экипаж подтвердит приём по акту."
              : "На сезоне пока пусто. Заявки с сайта и добавленные вручную байки появятся здесь."}
          </p>
          <Link
            href={`/franchize/${slug}/storage/new`}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-bold text-white transition hover:bg-sky-400"
          >
            Добавить байк на хранение
          </Link>
        </div>
      ) : (wall?.bikes.length ?? 0) > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {wall!.bikes.map((bike) => (
            <StorageBikeCard key={bike.id} bike={bike} slug={slug} access={access} T={T} onChanged={fetchWall} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── guest offer (zero PII) ───────────────────────────────────────────────────

function GuestOffer({ slug, crewName, contactsPhone, T }: { slug: string; crewName: string; contactsPhone: string; T: ReturnType<typeof useCrewTokens> }) {
  const phoneHref = contactsPhone.replace(/\D/g, "").length >= 10 ? `tel:+7${contactsPhone.replace(/\D/g, "").slice(-10)}` : "";
  return (
    <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
      <p className="text-sm leading-relaxed" style={{ color: T.textSecondary }}>
        Сдаёте мотоцикл на зиму — мы храним его в тёплом закрытом помещении
        (Стригинский переулок, 13Б): подзарядка АКБ, контроль давления в шинах,
        чехол и защита от грызунов, ежемесячный осмотр. Оформление — договор
        ответственного хранения + акт приёма-передачи с фотофиксацией, подпись
        простой электронной подписью (ПЭП) прямо в Telegram.
      </p>
      <p className="text-sm font-extrabold" style={{ color: T.textPrimary }}>
        от 2 000 ₽ / месяц · оплата единовременно за сезон
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/franchize/${slug}/storage/new`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-bold text-white transition hover:bg-sky-400"
        >
          Оставить заявку
        </Link>
        {phoneHref ? (
          <a
            href={phoneHref}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-[0.98]"
            style={{ borderColor: T.borderSoft, color: T.textSecondary }}
          >
            {contactsPhone}
          </a>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: T.textFaint }}>
        Откройте {crewName} через Telegram-бота — и эта стена покажет именно ваши
        байки: статус, историю перемещений и договор.
      </p>
    </div>
  );
}

// ── bike card ────────────────────────────────────────────────────────────────

function StorageBikeCard({
  bike,
  slug,
  access,
  T,
  onChanged,
}: {
  bike: StorageBikeVM;
  slug: string;
  access: "staff" | "owner" | "guest";
  T: ReturnType<typeof useCrewTokens>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  const meta = STORAGE_STATUS_META[bike.status] ?? STORAGE_STATUS_META.requested;
  const tone = TONE_STYLES[meta.tone] ?? TONE_STYLES.default;
  const isStaff = access === "staff";
  const targets = (STORAGE_STATUS_TRANSITIONS[bike.status] ?? []) as StorageBikeStatus[];
  const docUrl = bike.docPath ? storageDocPublicUrl(bike.docPath) : "";

  const move = async (status: StorageBikeStatus) => {
    setBusy(true);
    try {
      const result = await updateStorageBikeStatusAction({
        slug,
        bikeId: bike.id,
        status,
        actorUserId: undefined,
        initData: getTelegramInitData(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось изменить статус.");
        return;
      }
      toast.success(`Статус: ${meta.label} → ${STORAGE_STATUS_META[status].label}`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const sendNote = async () => {
    const message = noteText.trim();
    if (!message) return;
    setBusy(true);
    try {
      const result = await addStorageBikeNoteAction({
        slug,
        bikeId: bike.id,
        message,
        initData: getTelegramInitData(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось сохранить заметку.");
        return;
      }
      setNoteText("");
      setNoteOpen(false);
      toast.success("Заметка добавлена");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold" style={{ color: T.textPrimary }}>
              {bike.bikeTitle}
              {bike.year ? `, ${bike.year}` : ""}
            </p>
            <p className="mt-0.5 truncate text-xs" style={{ color: T.textMuted }}>
              {[bike.regNumber, bike.color].filter(Boolean).join(" · ") || "гос. номер уточняется"}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: tone.bg, color: tone.fg }}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: T.textSecondary }}>
          <p>
            Сезон: <b style={{ color: T.textPrimary }}>{storageIsoToRu(bike.seasonStart)} → {storageIsoToRu(bike.seasonEnd)}</b>
            {bike.monthsLabel ? ` (${bike.monthsLabel})` : ""}
          </p>
          <p>
            Цена: <b style={{ color: T.textPrimary }}>{storageFormatRub(bike.monthlyPriceRub)} ₽/мес</b>
            {bike.totalPriceRub > 0 ? ` · ${storageFormatRub(bike.totalPriceRub)} ₽` : ""}
          </p>
          <p>Оценка: <b style={{ color: T.textPrimary }}>{storageFormatRub(bike.estimatedValueRub)} ₽</b></p>
          <p>Место: {bike.storageAddress || "Стригинский переулок, 13Б"}</p>
        </div>

        {isStaff ? (
          <p className="mt-2 text-xs" style={{ color: T.textMuted }}>
            Владелец: {bike.ownerName || "—"}{bike.ownerPhone ? `, ${bike.ownerPhone}` : ""} · {STORAGE_SOURCE_LABELS[bike.source]}
          </p>
        ) : null}

        {/* badges row */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            ❄️ не для аренды
          </span>
          {bike.pepSigned ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              ПЭП ✓
            </span>
          ) : null}
          {docUrl ? (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-[0.98]"
              style={{ backgroundColor: T.bgElevated, color: T.textSecondary }}
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              Договор
            </a>
          ) : null}
        </div>

        {/* staff moves */}
        {isStaff && targets.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {targets.map((target) => (
              <button
                key={target}
                type="button"
                disabled={busy}
                onClick={() => move(target)}
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50"
                style={
                  target === "cancelled"
                    ? { border: `1px solid ${T.borderSoft}`, color: T.textSecondary }
                    : { backgroundColor: "#0ea5e9", color: "#ffffff" }
                }
              >
                {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                {MOVE_BUTTON_LABELS[target]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNoteOpen((v) => !v)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98]"
              style={{ borderColor: T.borderSoft, color: T.textSecondary }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
              Заметка
            </button>
          </div>
        ) : null}
        {!isStaff && access === "owner" ? (
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98]"
            style={{ borderColor: T.borderSoft, color: T.textSecondary }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            Написать экипажу
          </button>
        ) : null}

        {noteOpen ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Сообщение к этой заявке (увидит другая сторона)…"
              className="w-full rounded-xl border p-2.5 text-sm outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated, color: T.textPrimary }}
            />
            <button
              type="button"
              disabled={busy || !noteText.trim()}
              onClick={sendNote}
              className="inline-flex min-h-11 items-center rounded-xl bg-sky-500 px-4 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Отправить
            </button>
          </div>
        ) : null}
      </div>

      {/* timeline */}
      {bike.events.length > 0 ? (
        <div style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold transition active:scale-[0.99]"
            style={{ color: T.textMuted }}
            aria-expanded={open}
          >
            <span>История ({bike.events.length})</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open ? (
            <ul className="space-y-2 px-4 pb-4">
              {bike.events.map((event) => {
                const eventTone = event.status ? TONE_STYLES[(STORAGE_STATUS_META[event.status as StorageBikeStatus]?.tone) ?? "default"] : TONE_STYLES.default;
                return (
                  <li key={event.id} className="flex gap-2.5 text-xs">
                    <span
                      className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: eventTone.fg }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p style={{ color: T.textPrimary }}>
                        <b>
                          {event.type === "note"
                            ? "Заметка"
                            : event.type === "created"
                              ? "Заявка создана"
                              : `Статус: ${storageStatusLabel(event.status)}`}
                        </b>
                        {" · "}
                        <span style={{ color: T.textFaint }}>
                          {new Date(event.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                      {event.message ? <p style={{ color: T.textMuted }}>{event.message}</p> : null}
                      {event.actorName ? <p style={{ color: T.textFaint }}>{event.actorName}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
