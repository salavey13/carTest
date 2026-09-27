"use client";

// /app/franchize/[slug]/storage/StorageWallClient.tsx
// 2026-09-27 — «Хранение»: the owner-facing winter-storage wall («Мотопарк»
// for actual owners). Three views from one server-verified fetch:
//   · staff  — the whole season: count+money stats, status filters, sorting,
//              every bike, status moves, payment marks, notes, reports;
//   · owner  — HIS bikes only (matched by the verified Telegram id), same
//              per-bike transparency: story page, «Отчёт» pill, doc, payment;
//   · guest  — the offer (place / care / price) + CTA, zero bike data.
// Every bike card carries its move timeline (storage_bike_events) and the
// «не для аренды» badge — these are client machines, never catalog items.
// v2 (transparency parity): money tiles, filter chips, sort modes, per-card
// «Отчёт» pill (TG sendDocument recipe), «Оплачено до» badges, story links,
// config-driven offer (admin/crewowner config via resolveStorageConfig).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDownWideNarrow, ChevronDown, FileText, Loader2, MessageSquarePlus, Phone, RefreshCw, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import {
  addStorageBikeNoteAction,
  getStorageWallAction,
  updateStorageBikeStatusAction,
} from "@/app/franchize/server-actions/storage-bikes";
import {
  STORAGE_PHOTO_WORTHY_TARGETS,
  STORAGE_SORT_LABELS,
  STORAGE_SOURCE_LABELS,
  STORAGE_STATUS_META,
  STORAGE_STATUS_TRANSITIONS,
  filterStorageBikes,
  sortStorageBikes,
  storageEventLabel,
  storageFormatRub,
  storageIsoToRu,
  storageMoneyStatsOf,
  storagePaidCovered,
  storageSeasonDefaults,
  type StorageBikeStatus,
  type StorageBikeVM,
  type StorageSortMode,
  type StorageStatusFilter,
  type StorageWallVM,
  type StorageStatusMeta,
} from "@/app/franchize/lib/storage";
import type { StorageCrewConfig } from "@/app/franchize/lib/storage-config";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { DEFAULT_FRANCHIZE_THEME, type FranchizeTheme } from "@/lib/franchize-config";
import { StorageEventPhotoGrid, StoragePhotoStrip, useStoragePhotoUpload } from "./StoragePhotos";
import { openStorageDoc } from "./openStorageDoc";

/** Crew theme in «auto» mode — follows the app's light/dark preference. */
const AUTO_THEME: FranchizeTheme = { ...DEFAULT_FRANCHIZE_THEME, isAuto: true };
import { StorageReportButton } from "./StorageReportButton";

/** Action label per target status (the buttons the staff sees on a card). */
const MOVE_BUTTON_LABELS: Record<StorageBikeStatus, string> = {
  in_storage: "Принять на хранение",
  returned: "Вернул владельцу",
  cancelled: "Отменить",
  requested: "Вернуть в заявки",
};

/** Сезон на шапке стаффа считается из конфигурации (анкеры MM-DD), не из стенного часа. */
function seasonRangeLabel(config?: StorageCrewConfig): string {
  const d = storageSeasonDefaults(new Date(), { start: config?.seasonStartMMDD || "10-15", end: config?.seasonEndMMDD || "06-01" });
  return `${d.start.slice(0, 4)}→${d.end.slice(0, 4)}`;
}

/** Tone keys mirror StorageStatusMeta.tone (see lib/storage). */
type ToneKey = StorageStatusMeta["tone"] | "default";

const TONE_STYLES: Record<ToneKey, { bg: string; fg: string }> = {
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
  storageConfig?: StorageCrewConfig;
  /** Crew switched the service off in the admin config → off-card for non-staff. */
  serviceEnabled?: boolean;
}

const STATUS_FILTER_ORDER: Array<StorageStatusFilter> = ["all", "requested", "in_storage", "returned", "cancelled"];

export function StorageWallClient({ initialSlug, crewName, contactsPhone, storageConfig, serviceEnabled = true }: StorageWallClientProps) {
  const { dbUser } = useAppContext();
  const params = useParams<{ slug: string }>();
  const slug = initialSlug || params?.slug || "vip-bike";

  const T = useCrewTokens(AUTO_THEME);

  const [wall, setWall] = useState<StorageWallVM | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StorageStatusFilter>("all");
  const [sortMode, setSortMode] = useState<StorageSortMode>("recent");
  const fetchEpochRef = useRef(0);

  const fetchWall = useCallback(async () => {
    const epoch = ++fetchEpochRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getStorageWallAction({
        slug,
        initData: getTelegramInitData(),
        actorUserId: dbUser?.user_id,
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
  }, [slug, dbUser?.user_id]);

  useEffect(() => {
    fetchWall();
  }, [fetchWall]);

  const access = wall?.access ?? "guest";
  const stats = wall?.stats;
  const isStaff = access === "staff";

  const visibleBikes = useMemo(() => {
    const base = wall?.bikes ?? [];
    return sortStorageBikes(filterStorageBikes(base, statusFilter), sortMode);
  }, [wall?.bikes, statusFilter, sortMode]);

  const moneyStats = useMemo(
    () => storageMoneyStatsOf(wall?.bikes ?? []),
    [wall?.bikes],
  );

  const serviceOff = !serviceEnabled;

  const filterCounts = useMemo(() => {
    const counts: Record<StorageStatusFilter, number> = { all: wall?.bikes.length ?? 0, requested: 0, in_storage: 0, returned: 0, cancelled: 0 };
    for (const b of wall?.bikes ?? []) {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    }
    return counts;
  }, [wall?.bikes]);

  return (
    <div className="space-y-4">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold" style={{ color: T.text }}>
            <Snowflake className="h-5 w-5 text-sky-400" aria-hidden="true" />
            Зимнее хранение
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
            {isStaff
              ? `${crewName} · сезон ${seasonRangeLabel(storageConfig)}`
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
            style={{ borderColor: T.borderSoft, color: T.textMuted, backgroundColor: T.bgCard }}
            aria-label="Обновить"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          {access !== "guest" && !serviceOff ? (
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

      {/* ── service disabled: crew keeps management access, nobody else ── */}
      {serviceOff ? (
        access === "staff" ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
            Услуга «Зимнее хранение» отключена в конфиге экипажа — стена видна только экипажу, новые онлайн-заявки не принимаются.
          </div>
        ) : (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
            <Snowflake className="mx-auto h-8 w-8" style={{ color: T.textFaint }} aria-hidden="true" />
            <p className="mt-3 text-sm font-bold" style={{ color: T.text }}>Зимнее хранение временно недоступно</p>
            <p className="mt-2 text-sm" style={{ color: T.textMuted }}>
              Экипаж приостановил приём байков на сезон. Вопросы — по телефону {contactsPhone || "или в Telegram"}.
            </p>
          </div>
        )
      ) : null}

      {/* ── staff count tiles → clickable status filters (Мотопарк triage parity) ── */}
      {isStaff && stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STATUS_FILTER_ORDER.map((key) => {
            const value = key === "all" ? stats.total : stats[key === "requested" ? "requested" : key === "in_storage" ? "inStorage" : key === "returned" ? "returned" : "cancelled"];
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                aria-pressed={active}
                className="rounded-2xl border p-3 text-left transition active:scale-[0.98]"
                style={{
                  borderColor: active ? "#0ea5e9" : T.borderSoft,
                  backgroundColor: active ? "rgba(14, 165, 233, 0.10)" : T.bgCard,
                }}
              >
                <p className="text-lg font-extrabold" style={{ color: T.text }}>{value}</p>
                <p className="text-[11px] uppercase tracking-wide" style={{ color: active ? "#0284c7" : T.textFaint }}>
                  {key === "all" ? "Все" : STORAGE_STATUS_META[key as StorageBikeStatus].label}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── staff money tiles (season one-shot payment parity) ── */}
      {isStaff ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Сезон ₽", value: moneyStats.activeRub, hint: "заявки + на хранении" },
            { label: "В хранении ₽", value: moneyStats.inStorageRub, hint: "принятые байки" },
            { label: "Оплачено ₽", value: moneyStats.paidRub, hint: "есть действующая отметка оплаты" },
            { label: "Ждёт оплаты ₽", value: moneyStats.unpaidRub, hint: "заявки + на хранении, без оплаты" },
          ].map(({ label, value, hint }) => (
            <div key={label} className="rounded-2xl border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
              <p className="text-lg font-extrabold" style={{ color: T.text }}>{storageFormatRub(value)}</p>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>{label}</p>
              <p className="text-[10px]" style={{ color: T.textFaint }}>{hint}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── owner quick money line (transparency without clutter) ── */}
      {access === "owner" && (wall?.bikes.length ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(wall?.bikes ?? []).map((bike) => (
            <span
              key={bike.id}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={
                storagePaidCovered(bike.paidUntil)
                  ? { backgroundColor: "rgba(34, 197, 94, 0.14)", color: "#16a34a" }
                  : { backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#d97706" }
              }
            >
              {bike.bikeTitle}: {storagePaidCovered(bike.paidUntil) ? `оплачено до ${storageIsoToRu(bike.paidUntil)}` : "оплата ждёт"}
            </span>
          ))}
        </div>
      ) : null}

      {/* ── guest offer (zero PII, config-driven) — hidden while service off ── */}
      {access === "guest" && !serviceOff ? (
        <GuestOffer slug={slug} crewName={crewName} contactsPhone={contactsPhone} config={storageConfig} T={T} />
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      {/* ── sort pills (Мотопарк parity) ── */}
      {access !== "guest" && (wall?.bikes.length ?? 0) > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <ArrowDownWideNarrow className="h-3.5 w-3.5" style={{ color: T.textFaint }} aria-hidden="true" />
          {(Object.keys(STORAGE_SORT_LABELS) as StorageSortMode[]).map((mode) => {
            const active = sortMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                aria-pressed={active}
                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition active:scale-[0.98]"
                style={{
                  borderColor: active ? "#0ea5e9" : T.borderSoft,
                  backgroundColor: active ? "rgba(14, 165, 233, 0.10)" : T.bgCard,
                  color: active ? "#0284c7" : T.textMuted,
                }}
              >
                {STORAGE_SORT_LABELS[mode]}
              </button>
            );
          })}
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
      ) : access !== "guest" && !serviceOff && (wall?.bikes.length ?? 0) > 0 && visibleBikes.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <p className="text-sm" style={{ color: T.textMuted }}>
            В фильтре «{statusFilter === "all" ? "Все" : STORAGE_STATUS_META[statusFilter as StorageBikeStatus].label}» пусто — смените фильтр или сортировку.
          </p>
        </div>
      ) : !serviceOff && visibleBikes.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visibleBikes.map((bike) => (
            <StorageBikeCard key={bike.id} bike={bike} slug={slug} access={access} config={storageConfig} T={T} onChanged={fetchWall} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── guest offer (zero PII) ───────────────────────────────────────────────────

function GuestOffer({
  slug,
  crewName,
  contactsPhone,
  config,
  T,
}: {
  slug: string;
  crewName: string;
  contactsPhone: string;
  config?: StorageCrewConfig;
  T: ReturnType<typeof useCrewTokens>;
}) {
  const phoneHref = contactsPhone.replace(/\D/g, "").length >= 10 ? `tel:+7${contactsPhone.replace(/\D/g, "").slice(-10)}` : "";
  const address = config?.address || "Стригинский переулок, 13Б";
  const price = config?.defaultMonthlyPriceRub ?? 2000;
  const careDuties = config?.careDuties?.length ? config.careDuties : [];
  return (
    <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
      <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>
        Сдаёте мотоцикл на зиму — мы храним его в тёплом закрытом помещении
        ({address}): подзарядка АКБ, контроль давления в шинах, чехол и защита
        от грызунов, ежемесячный осмотр. Оформление — договор ответственного
        хранения + акт приёма-передачи с фотофиксацией, подпись простой
        электронной подписью (ПЭП) прямо в Telegram.
      </p>
      {careDuties.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Что входит в хранение">
          {careDuties.map((duty) => (
            <li key={duty} className="flex items-start gap-2 text-xs" style={{ color: T.textMuted }}>
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
              {duty}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm font-extrabold" style={{ color: T.text }}>
        от {storageFormatRub(price)} ₽ / месяц · оплата единовременно за сезон
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
            style={{ borderColor: T.borderSoft, color: T.textMuted }}
          >
            {contactsPhone}
          </a>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: T.textFaint }}>
        Откройте {crewName} через Telegram-бота — и эта стена покажет именно ваши
        байки: статус, историю перемещений, оплаты и договор.
      </p>
    </div>
  );
}

// ── bike card ────────────────────────────────────────────────────────────────

function StorageBikeCard({
  bike,
  slug,
  access,
  config,
  T,
  onChanged,
}: {
  bike: StorageBikeVM;
  slug: string;
  access: "staff" | "owner" | "guest";
  config?: StorageCrewConfig;
  T: ReturnType<typeof useCrewTokens>;
  onChanged: () => void;
}) {
  const { dbUser } = useAppContext(); // boss R2 #12 — initData fallback needs the claimed id
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  // фотофиксация panel: the photo-worthy move being prepared (null = none).
  const [moveTarget, setMoveTarget] = useState<StorageBikeStatus | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const upload = useStoragePhotoUpload(slug, bike.id);
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = STORAGE_STATUS_META[bike.status] ?? STORAGE_STATUS_META.requested;
  const tone = TONE_STYLES[meta.tone] ?? TONE_STYLES.default;
  const isStaff = access === "staff";
  const targets = (STORAGE_STATUS_TRANSITIONS[bike.status] ?? []) as StorageBikeStatus[];
  // Boss R2 #1: the contract opens via a per-click SIGNED URL from the
  // gated server action — never a /object/public/ link on passport-bearing
  // documents.
  const paid = storagePaidCovered(bike.paidUntil);
  const activeStatus = bike.status === "requested" || bike.status === "in_storage";
  const storyHref = `/franchize/${slug}/storage/${bike.id}`;
  const phoneDigits = bike.ownerPhone.replace(/\D/g, "");

  const move = async (status: StorageBikeStatus) => {
    // A direct (non-photo) move must not leave a stale photo panel behind —
    // after refetch it would show the old target with orphaned drafts.
    upload.reset();
    setMoveMessage("");
    setMoveTarget(null);
    setBusy(true);
    try {
      const result = await updateStorageBikeStatusAction({
        slug,
        bikeId: bike.id,
        status,
        initData: getTelegramInitData(),
        actorUserId: dbUser?.user_id,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось изменить статус.");
        return;
      }
      if (result.warning) toast.warning(result.warning);
      toast.success(`Статус: ${meta.label} → ${STORAGE_STATUS_META[status].label}`);
      onChanged();
    } catch {
      toast.error("Нет связи — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  /** Tap on a move button: photo-worthy moves open the панель, others go straight.
   * Switching/clearing the target resets the draft — acceptance photos must
   * never ride onto the return act (boss review R1 finding #2). */
  const handleMoveTap = (target: StorageBikeStatus) => {
    if (!STORAGE_PHOTO_WORTHY_TARGETS.includes(target)) {
      void move(target);
      return;
    }
    if (moveTarget !== target) {
      upload.reset();
      setMoveMessage("");
    }
    setMoveTarget((cur) => (cur === target ? null : target));
  };

  const addMoveFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      await upload.addFiles(files);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить фото.");
    }
  };

  const confirmMoveWithPhotos = async () => {
    if (!moveTarget) return;
    if (upload.hasPending) {
      toast.error("Фото ещё загружаются — секунду.");
      return;
    }
    setBusy(true);
    try {
      const result = await updateStorageBikeStatusAction({
        slug,
        bikeId: bike.id,
        status: moveTarget,
        message: moveMessage.trim() || undefined,
        photos: upload.paths.length > 0 ? upload.paths : undefined,
        initData: getTelegramInitData(),
        actorUserId: dbUser?.user_id,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось изменить статус.");
        return;
      }
      toast.success(
        upload.paths.length > 0
          ? `Статус: → ${STORAGE_STATUS_META[moveTarget].label} · ${upload.paths.length} фото`
          : `Статус: → ${STORAGE_STATUS_META[moveTarget].label}`,
      );
      if (result.warning) toast.warning(result.warning);
      upload.reset();
      setMoveMessage("");
      setMoveTarget(null);
      onChanged();
    } catch {
      toast.error("Нет связи — попробуйте ещё раз.");
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
        actorUserId: dbUser?.user_id,
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось сохранить заметку.");
        return;
      }
      setNoteText("");
      setNoteOpen(false);
      toast.success("Заметка добавлена");
      onChanged();
    } catch {
      toast.error("Нет связи — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={storyHref} className="block truncate text-sm font-extrabold transition hover:opacity-80" style={{ color: T.text }}>
              {bike.bikeTitle}
              {bike.year ? `, ${bike.year}` : ""}
            </Link>
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

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: T.textMuted }}>
          <p>
            Сезон: <b style={{ color: T.text }}>{storageIsoToRu(bike.seasonStart)} → {storageIsoToRu(bike.seasonEnd)}</b>
            {bike.monthsLabel ? ` (${bike.monthsLabel})` : ""}
          </p>
          <p>
            Цена: <b style={{ color: T.text }}>{storageFormatRub(bike.monthlyPriceRub)} ₽/мес</b>
            {bike.totalPriceRub > 0 ? ` · ${storageFormatRub(bike.totalPriceRub)} ₽` : ""}
          </p>
          <p>Оценка: <b style={{ color: T.text }}>{storageFormatRub(bike.estimatedValueRub)} ₽</b></p>
          <p>Место: {bike.storageAddress || config?.address || "Стригинский переулок, 13Б"}</p>
        </div>

        {isStaff ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: T.textMuted }}>
            <span>
              Владелец: {bike.ownerName || "—"}
              {bike.ownerPhone ? (
                <>
                  {", "}
                  <a href={`tel:+7${phoneDigits.slice(-10)}`} className="inline-flex items-center gap-0.5 font-semibold transition hover:opacity-80" style={{ color: T.textMuted }}>
                    <Phone className="h-3 w-3" aria-hidden="true" />
                    {bike.ownerPhone}
                  </a>
                </>
              ) : null}
            </span>
            <span>· {STORAGE_SOURCE_LABELS[bike.source]}</span>
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
          {bike.paidUntil ? (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={paid ? { backgroundColor: "rgba(34, 197, 94, 0.14)", color: "#16a34a" } : { backgroundColor: "rgba(245, 158, 11, 0.14)", color: "#d97706" }}
            >
              {paid ? `оплачено до ${storageIsoToRu(bike.paidUntil)}` : `оплата просрочена (до ${storageIsoToRu(bike.paidUntil)})`}
            </span>
          ) : activeStatus ? (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: "rgba(245, 158, 11, 0.10)", color: "#b45309" }}>
              оплата ждёт
            </span>
          ) : null}
          {bike.docPath ? (
            <button
              type="button"
              onClick={() => void openStorageDoc({ slug, bikeId: bike.id, label: bike.bikeTitle })}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-[0.98]"
              style={{ backgroundColor: T.bgElevated, color: T.textMuted }}
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              Договор
            </button>
          ) : null}
          <Link
            href={storyHref}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-[0.98]"
            style={{ backgroundColor: T.bgElevated, color: T.textMuted }}
          >
            Карточка →
          </Link>
        </div>

        {/* staff moves */}
        {isStaff && targets.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {targets.map((target) => (
              <button
                key={target}
                type="button"
                disabled={busy}
                onClick={() => handleMoveTap(target)}
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50"
                style={
                  target === "cancelled"
                    ? { border: `1px solid ${T.borderSoft}`, color: T.textMuted }
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
              style={{ borderColor: T.borderSoft, color: T.textMuted }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
              Заметка
            </button>
          </div>
        ) : null}

        {/* фотофиксация panel — opens under the move buttons for accept/return */}
        {isStaff && moveTarget ? (
          <div className="mt-2 space-y-2 rounded-xl border p-2.5" style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}>
            <p className="text-xs font-bold" style={{ color: T.text }}>
              {STORAGE_STATUS_META[moveTarget].emoji} {MOVE_BUTTON_LABELS[moveTarget]} — фотофиксация
            </p>
            <StoragePhotoStrip photos={upload.photos} onRemove={upload.removePhoto} onAdd={() => fileRef.current?.click()} T={T} />
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addMoveFiles(e.target.files); e.target.value = ""; }} />
            <input
              value={moveMessage}
              onChange={(e) => setMoveMessage(e.target.value)}
              maxLength={500}
              placeholder="Комментарий (необязательно)…"
              className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard, color: T.text }}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px]" style={{ color: T.textFaint }}>
                📸 До 6 фото — владелец увидит их в таймлайне и отчёте.
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    upload.reset();
                    setMoveMessage("");
                    setMoveTarget(null);
                  }}
                  className="inline-flex min-h-11 items-center rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50"
                  style={{ borderColor: T.borderSoft, color: T.textMuted }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={busy || upload.hasPending}
                  onClick={confirmMoveWithPhotos}
                  className="inline-flex min-h-11 items-center rounded-xl bg-sky-500 px-4 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {!isStaff && access === "owner" ? (
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98]"
            style={{ borderColor: T.borderSoft, color: T.textMuted }}
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
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated, color: T.text }}
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

        {/* «Отчёт» pill — Мотопарк parity, sibling of everything else */}
        <div className="mt-3">
          <StorageReportButton
            slug={slug}
            bikeId={bike.id}
            bikeLabel={`${bike.bikeTitle}${bike.regNumber ? ` (${bike.regNumber})` : ""}`}
          />
        </div>
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
                      style={{ backgroundColor: event.type === "payment" ? "#d97706" : event.type === "photo" ? "#8b5cf6" : eventTone.fg }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p style={{ color: T.text }}>
                        <b>
                          {event.type === "status_changed"
                            ? `Статус: ${storageStatusLabelSafe(event.status)}`
                            : storageEventLabel(event.type) || "Событие"}
                          {event.photoUrls.length > 0 ? ` 📸 ${event.photoUrls.length}` : ""}
                        </b>
                        {" · "}
                        <span style={{ color: T.textFaint }}>
                          {new Date(event.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                      {event.message ? <p style={{ color: T.textMuted }}>{event.message}</p> : null}
                      {event.photoPaths.length > 0 ? <StorageEventPhotoGrid paths={event.photoPaths} T={T} size={44} /> : null}
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

function storageStatusLabelSafe(status: StorageBikeStatus | null): string {
  return status ? STORAGE_STATUS_META[status]?.label ?? "—" : "—";
}
