"use client";

// /app/franchize/[slug]/storage/StorageBikeStoryClient.tsx
// 2026-09-27 — per-bike storage story («Мотопарк story» parity): a
// shareable, deep-linkable page per stored bike. Access is decided by the
// SERVER (staff or the bike's owner; guests get a data-free gate screen).
//
//   · KPI band — ставка ₽/мес, итого за сезон, оплата (до DD.MM / ждёт),
//     оценочная стоимость (якорь ответственности Хранителя);
//   · machine identity — марка/год/цвет/рег/VIN/пробег/комплектность/место;
//   · owner card (staff) — ФИО, tel: link, source;
//   · staff controls — status moves, «Отметить оплату» (default = конец
//     сезона), «Привязать владельца» (TG id), note;
//   · owner controls — «Написать экипажу», doc;
//   · VK-style timeline with «Сегодня/Вчера» dividers (dateDividerLabel) and
//     payment/owner-linked event kinds rendered through storageEventLabel.
//
// Every mutation reuses the wall's server actions (same notifications,
// same STORAGE_STATUS_TRANSITIONS guard) — this page is a lens, not a second brain.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronLeft,
  FileText,
  Link2,
  Loader2,
  MessageSquarePlus,
  Phone,
  RefreshCw,
  Snowflake,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { dateDividerLabel } from "@/app/franchize/lib/bike-wall";
import {
  addStorageBikeNoteAction,
  getStorageBikeStoryAction,
  linkStorageBikeOwnerAction,
  markStorageBikePaidAction,
  updateStorageBikeStatusAction,
} from "@/app/franchize/server-actions/storage-bikes";
import {
  STORAGE_SOURCE_LABELS,
  STORAGE_STORY_EVENTS_CAP,
  STORAGE_STATUS_META,
  STORAGE_STATUS_TRANSITIONS,
  storageDocPublicUrl,
  storageEventLabel,
  storageFormatRub,
  storageIsoToRu,
  storagePaidCovered,
  type StorageBikeStatus,
  type StorageBikeVM,
} from "@/app/franchize/lib/storage";
import type { StorageCrewConfig } from "@/app/franchize/lib/storage-config";
import type { StorageStatusMeta } from "@/app/franchize/lib/storage";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { DEFAULT_FRANCHIZE_THEME, type FranchizeTheme } from "@/lib/franchize-config";

/** Crew theme in «auto» mode — follows the app's light/dark preference. */
const AUTO_THEME: FranchizeTheme = { ...DEFAULT_FRANCHIZE_THEME, isAuto: true };
import { StorageReportButton } from "./StorageReportButton";

const MOVE_BUTTON_LABELS: Record<StorageBikeStatus, string> = {
  in_storage: "Принять на хранение",
  returned: "Вернул владельцу",
  cancelled: "Отменить",
  requested: "Вернуть в заявки",
};

/** Tone keys mirror StorageStatusMeta.tone (see lib/storage). */
type ToneKey = StorageStatusMeta["tone"] | "default";

const TONE_STYLES: Record<ToneKey, { bg: string; fg: string }> = {
  amber: { bg: "rgba(245, 158, 11, 0.14)", fg: "#d97706" },
  sky: { bg: "rgba(14, 165, 233, 0.14)", fg: "#0284c7" },
  green: { bg: "rgba(34, 197, 94, 0.14)", fg: "#16a34a" },
  muted: { bg: "rgba(113, 113, 122, 0.14)", fg: "#71717a" },
  default: { bg: "rgba(113, 113, 122, 0.14)", fg: "#71717a" },
};

interface StorageBikeStoryClientProps {
  initialSlug: string;
  bikeId: string;
  crewName: string;
  contactsPhone: string;
  storageConfig?: StorageCrewConfig;
}

export function StorageBikeStoryClient({ initialSlug, bikeId, crewName, contactsPhone, storageConfig }: StorageBikeStoryClientProps) {
  const { dbUser } = useAppContext();
  const slug = initialSlug;

  const T = useCrewTokens(AUTO_THEME);

  const [story, setStory] = useState<StorageBikeVM | null>(null);
  const [access, setAccess] = useState<"staff" | "owner">("owner");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchEpochRef = useRef(0);

  const fetchStory = useCallback(async () => {
    const epoch = ++fetchEpochRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getStorageBikeStoryAction({
        slug,
        bikeId,
        actorUserId: dbUser?.user_id || undefined,
        initData: getTelegramInitData(),
      });
      if (epoch !== fetchEpochRef.current) return;
      if (!result.success || !result.story) {
        setError(result.error ?? "Карточка недоступна.");
        return;
      }
      setStory(result.story);
      setAccess(result.access === "staff" ? "staff" : "owner");
    } catch (err) {
      if (epoch !== fetchEpochRef.current) return;
      setError(err instanceof Error ? err.message : "Карточка недоступна.");
    } finally {
      if (epoch === fetchEpochRef.current) setIsLoading(false);
    }
  }, [slug, bikeId, dbUser?.user_id]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  // ── gate screen: data-free (never echoes row data to an unauthorized viewer)
  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href={`/franchize/${slug}/storage`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition active:scale-[0.98]"
          style={{ borderColor: T.borderSoft, color: T.textMuted, backgroundColor: T.bgCard }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          К стене хранения
        </Link>
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <Snowflake className="mx-auto h-8 w-8" style={{ color: T.textFaint }} aria-hidden="true" />
          <p className="mt-3 text-sm" style={{ color: T.textMuted }}>{error}</p>
          <p className="mt-2 text-xs" style={{ color: T.textFaint }}>
            Откройте {crewName} через Telegram-бота — владельцы видят свои байки, экипаж видит весь сезон.
          </p>
          <button
            type="button"
            onClick={fetchStory}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-bold text-white transition hover:bg-sky-400 active:scale-[0.98]"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && !story) {
    return (
      <div className="flex items-center justify-center p-10" style={{ color: T.textFaint }}>
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!story) return null;

  const isStaff = access === "staff";
  const meta = STORAGE_STATUS_META[story.status] ?? STORAGE_STATUS_META.requested;
  const tone = TONE_STYLES[meta.tone] ?? TONE_STYLES.default;
  const targets = (STORAGE_STATUS_TRANSITIONS[story.status] ?? []) as StorageBikeStatus[];
  const docUrl = story.docPath ? storageDocPublicUrl(story.docPath) : "";
  const paid = storagePaidCovered(story.paidUntil);
  const activeStatus = story.status === "requested" || story.status === "in_storage";
  const phoneDigits = story.ownerPhone.replace(/\D/g, "");

  return (
    <div className="space-y-4">
      {/* ── header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/franchize/${slug}/storage`}
            className="inline-flex items-center gap-1 text-xs font-semibold transition hover:opacity-80"
            style={{ color: T.textFaint }}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Хранение
          </Link>
          <h1 className="mt-1 truncate text-xl font-extrabold" style={{ color: T.text }}>
            {story.bikeTitle}
            {story.year ? `, ${story.year}` : ""}
          </h1>
          <p className="mt-0.5 truncate text-xs" style={{ color: T.textMuted }}>
            {[story.regNumber, story.color].filter(Boolean).join(" · ") || "гос. номер уточняется"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {meta.emoji} {meta.label}
          </span>
          <button
            type="button"
            onClick={fetchStory}
            className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold transition active:scale-[0.98]"
            style={{ borderColor: T.borderSoft, color: T.textMuted, backgroundColor: T.bgCard }}
            aria-label="Обновить"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── KPI band ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile label="Ставка" value={`${storageFormatRub(story.monthlyPriceRub)} ₽/мес`} T={T} />
        <KpiTile label="Итого за сезон" value={`${storageFormatRub(story.totalPriceRub)} ₽`} hint={story.monthsLabel || undefined} T={T} />
        <KpiTile
          label="Оплата"
          value={story.paidUntil ? (paid ? `до ${storageIsoToRu(story.paidUntil)}` : "просрочена") : "ждёт"}
          tone={paid ? "green" : "amber"}
          T={T}
        />
        <KpiTile label="Оценка (ответств.)" value={`${storageFormatRub(story.estimatedValueRub)} ₽`} T={T} />
      </div>

      {/* ── machine identity ── */}
      <section className="rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
        <h2 className="text-sm font-extrabold" style={{ color: T.text }}>Мотоцикл</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs" style={{ color: T.textMuted }}>
          <Row label="Сезон" value={`${storageIsoToRu(story.seasonStart)} → ${storageIsoToRu(story.seasonEnd)}${story.monthsLabel ? ` (${story.monthsLabel})` : ""}`} T={T} />
          <Row label="Место" value={story.storageAddress || storageConfig?.address || "Стригинский переулок, 13Б"} T={T} />
          <Row label="Гос. номер" value={story.regNumber || "—"} T={T} />
          <Row label="VIN" value={story.vin || "—"} T={T} />
          <Row label="Цвет" value={story.color || "—"} T={T} />
          <Row label="Пробег" value={story.mileageKm != null ? `${story.mileageKm} км` : "—"} T={T} />
          <Row label="Комплектность" value={story.accessories || "—"} wide T={T} />
          <Row label="Адрес для уведомлений" value={story.noticeAddress || "—"} wide T={T} />
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            ❄️ не для аренды
          </span>
          {story.pepSigned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              ПЭП ✓
            </span>
          ) : null}
          {docUrl ? (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-[0.98]"
              style={{ backgroundColor: T.bgElevated, color: T.textMuted }}
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              Договор (DOCX)
            </a>
          ) : null}
          <StorageReportButton
            slug={slug}
            bikeId={story.id}
            bikeLabel={`${story.bikeTitle}${story.regNumber ? ` (${story.regNumber})` : ""}`}
          />
        </div>
      </section>

      {/* ── owner card (staff only) ── */}
      {isStaff ? (
        <section className="rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <h2 className="text-sm font-extrabold" style={{ color: T.text }}>Владелец</h2>
          <p className="mt-2 text-xs" style={{ color: T.textMuted }}>
            {story.ownerName || "—"}
            {story.ownerPhone ? (
              <>
                {" · "}
                <a href={`tel:+7${phoneDigits.slice(-10)}`} className="inline-flex items-center gap-0.5 font-semibold transition hover:opacity-80" style={{ color: T.textMuted }}>
                  <Phone className="h-3 w-3" aria-hidden="true" />
                  {story.ownerPhone}
                </a>
              </>
            ) : null}
            {" · "}
            {STORAGE_SOURCE_LABELS[story.source]}
          </p>
          <OwnerLinkControl slug={slug} bikeId={story.id} onDone={fetchStory} T={T} />
        </section>
      ) : null}

      {/* ── staff controls ── */}
      {isStaff && targets.length > 0 ? (
        <section className="rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <h2 className="text-sm font-extrabold" style={{ color: T.text }}>Действия экипажа</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {targets.map((target) => (
              <MoveButton key={target} slug={slug} bikeId={story.id} target={target} label={MOVE_BUTTON_LABELS[target]} onDone={fetchStory} T={T} />
            ))}
          </div>
          <PaymentControl
            slug={slug}
            bikeId={story.id}
            seasonEnd={story.seasonEnd}
            currentPaidUntil={story.paidUntil}
            onDone={fetchStory}
            T={T}
          />
          <NoteControl slug={slug} bikeId={story.id} onDone={fetchStory} T={T} staffLabel />
        </section>
      ) : null}

      {/* ── owner controls ── */}
      {!isStaff ? (
        <section className="rounded-2xl border p-4" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <NoteControl slug={slug} bikeId={story.id} onDone={fetchStory} T={T} />
        </section>
      ) : null}

      {/* ── timeline ── */}
      <section className="overflow-hidden rounded-2xl border" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-extrabold" style={{ color: T.text }}>История ({story.events.length})</h2>
          {story.events.length >= STORAGE_STORY_EVENTS_CAP ? (
            <span className="text-[10px]" style={{ color: T.textFaint }}>показаны последние {STORAGE_STORY_EVENTS_CAP}</span>
          ) : null}
        </div>
        {story.events.length === 0 ? (
          <p className="px-4 pb-4 text-xs" style={{ color: T.textMuted }}>Событий пока не было — заявка создана, но перемещений ещё не отмечали.</p>
        ) : (
          <StorageTimeline events={story.events} T={T} />
        )}
      </section>
    </div>
  );
}

// ── pieces ───────────────────────────────────────────────────────────────────

function KpiTile({ label, value, hint, tone, T }: { label: string; value: string; hint?: string; tone?: "green" | "amber"; T: ReturnType<typeof useCrewTokens> }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
      <p
        className="text-base font-extrabold"
        style={{ color: tone === "green" ? "#16a34a" : tone === "amber" ? "#d97706" : T.text }}
      >
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>{label}</p>
      {hint ? <p className="text-[10px]" style={{ color: T.textFaint }}>{hint}</p> : null}
    </div>
  );
}

function Row({ label, value, wide, T }: { label: string; value: string; wide?: boolean; T: ReturnType<typeof useCrewTokens> }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wide" style={{ color: T.textFaint }}>{label}</dt>
      <dd className="mt-0.5 break-words" style={{ color: T.text }}>{value}</dd>
    </div>
  );
}

function MoveButton({
  slug,
  bikeId,
  target,
  label,
  onDone,
  T,
}: {
  slug: string;
  bikeId: string;
  target: StorageBikeStatus;
  label: string;
  onDone: () => void;
  T: ReturnType<typeof useCrewTokens>;
}) {
  const [busy, setBusy] = useState(false);
  const move = async () => {
    setBusy(true);
    try {
      const result = await updateStorageBikeStatusAction({
        slug,
        bikeId,
        status: target,
        initData: getTelegramInitData(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось изменить статус.");
        return;
      }
      toast.success(`Статус: → ${STORAGE_STATUS_META[target].label}`);
      onDone();
    } catch {
      toast.error("Нет связи — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={move}
      className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50"
      style={
        target === "cancelled"
          ? { border: `1px solid ${T.borderSoft}`, color: T.textMuted }
          : { backgroundColor: "#0ea5e9", color: "#ffffff" }
      }
    >
      {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}

function PaymentControl({
  slug,
  bikeId,
  seasonEnd,
  currentPaidUntil,
  onDone,
  T,
}: {
  slug: string;
  bikeId: string;
  seasonEnd: string | null;
  currentPaidUntil: string | null;
  onDone: () => void;
  T: ReturnType<typeof useCrewTokens>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(currentPaidUntil || seasonEnd || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!date) {
      toast.error("Выберите дату оплаты.");
      return;
    }
    setBusy(true);
    try {
      const result = await markStorageBikePaidAction({
        slug,
        bikeId,
        paidUntil: date,
        note: note.trim() || undefined,
        initData: getTelegramInitData(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось отметить оплату.");
        return;
      }
      toast.success(`Оплата отмечена до ${storageIsoToRu(date)}`);
      setNote("");
      setOpen(false);
      onDone();
    } catch {
      toast.error("Нет связи — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98]"
        style={{ borderColor: T.borderSoft, color: T.textMuted }}
      >
        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
        {currentPaidUntil ? `Изменить оплату (сейчас до ${storageIsoToRu(currentPaidUntil)})` : "Отметить оплату"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl border px-3 text-sm outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated, color: T.text }}
              aria-label="Оплачено до"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Комментарий (необязательно)…"
              className="h-11 flex-1 rounded-xl border px-3 text-sm outline-none"
              style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated, color: T.text }}
            />
            <button
              type="button"
              disabled={busy || !date}
              onClick={submit}
              className="inline-flex min-h-11 items-center rounded-xl bg-sky-500 px-4 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Отметить
            </button>
          </div>
          <p className="text-[10px]" style={{ color: T.textFaint }}>
            Оплата единовременно за сезон (п. 3 договора). Дата по умолчанию — конец сезона; владелец получит уведомление в Telegram.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function OwnerLinkControl({ slug, bikeId, onDone, T }: { slug: string; bikeId: string; onDone: () => void; T: ReturnType<typeof useCrewTokens> }) {
  const [open, setOpen] = useState(false);
  const [tgId, setTgId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (detach: boolean) => {
    setBusy(true);
    try {
      const result = await linkStorageBikeOwnerAction({
        slug,
        bikeId,
        ownerTgUserId: detach ? "" : tgId.trim(),
        initData: getTelegramInitData(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось привязать владельца.");
        return;
      }
      toast.success(detach ? "Привязка снята" : "Владелец привязан к Telegram");
      setOpen(false);
      onDone();
    } catch {
      toast.error("Нет связи — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98]"
        style={{ borderColor: T.borderSoft, color: T.textMuted }}
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        Привязать владельца (TG id)
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={tgId}
            onChange={(e) => setTgId(e.target.value.replace(/\D/g, "").slice(0, 32))}
            inputMode="numeric"
            placeholder="Telegram chat id, напр. 741852963"
            className="h-11 flex-1 rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated, color: T.text }}
          />
          <button
            type="button"
            disabled={busy || !tgId.trim()}
            onClick={() => submit(false)}
            className="inline-flex min-h-11 items-center rounded-xl bg-sky-500 px-4 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            Привязать
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(true)}
            className="inline-flex min-h-11 items-center rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50"
            style={{ borderColor: T.borderSoft, color: T.textMuted }}
          >
            Снять привязку
          </button>
        </div>
      ) : null}
      <p className="mt-1.5 text-[10px]" style={{ color: T.textFaint }}>
        Веб-заявки приходят без Telegram-привязки — укажите chat id владельца, и он увидит свою карточку и получит уведомления.
      </p>
    </div>
  );
}

function NoteControl({
  slug,
  bikeId,
  onDone,
  T,
  staffLabel,
}: {
  slug: string;
  bikeId: string;
  onDone: () => void;
  T: ReturnType<typeof useCrewTokens>;
  staffLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const message = noteText.trim();
    if (!message) return;
    setBusy(true);
    try {
      const result = await addStorageBikeNoteAction({
        slug,
        bikeId,
        message,
        initData: getTelegramInitData(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Не удалось сохранить заметку.");
        return;
      }
      setNoteText("");
      setOpen(false);
      toast.success("Заметка добавлена");
      onDone();
    } catch {
      toast.error("Нет связи — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98]"
        style={{ borderColor: T.borderSoft, color: T.textMuted }}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
        {staffLabel ? "Заметка" : "Написать экипажу"}
      </button>
      {open ? (
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
            onClick={send}
            className="inline-flex min-h-11 items-center rounded-xl bg-sky-500 px-4 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            Отправить
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** VK-style feed with «Сегодня/Вчера» dividers (Мотопарк story recipe). */
function StorageTimeline({ events, T }: { events: StorageBikeVM["events"]; T: ReturnType<typeof useCrewTokens> }) {
  const chrono = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  let lastDivider = "";
  return (
    <ul className="space-y-3 px-4 pb-4">
      {chrono.map((event) => {
        const divider = dateDividerLabel(event.createdAt);
        const showDivider = divider && divider !== lastDivider;
        if (showDivider) lastDivider = divider;
        const tone = event.status
          ? TONE_STYLES[(STORAGE_STATUS_META[event.status as StorageBikeStatus]?.tone) ?? "default"]
          : TONE_STYLES.default;
        return (
          <li key={event.id}>
            {showDivider ? (
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: T.textFaint }}>
                {divider}
              </p>
            ) : null}
            <div className="flex gap-2.5 text-xs">
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    event.type === "payment"
                      ? "#d97706"
                      : event.type === "owner_linked"
                        ? "#0284c7"
                        : event.type === "note"
                          ? T.textFaint
                          : tone.fg,
                }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p style={{ color: T.text }}>
                  <b>
                    {event.type === "status_changed" && event.status
                      ? `Статус: ${STORAGE_STATUS_META[event.status]?.label ?? "—"}`
                      : storageEventLabel(event.type) || "Событие"}
                  </b>
                  {" · "}
                  <span style={{ color: T.textFaint }}>
                    {new Date(event.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
                {event.message ? <p style={{ color: T.textMuted }}>{event.message}</p> : null}
                {event.actorName ? <p style={{ color: T.textFaint }}>{event.actorName}</p> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
