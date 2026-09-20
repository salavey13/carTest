"use client";

// app/franchize/[slug]/rider/[userId]/RiderProfileClient.tsx
//
// ─────────────────────────────────────────────────────────────────────────────
// Rider profile v1 (Chain-inspired) — the public face of a wall user.
//
//   · OTHERS see: public stats strip (no ₽ — that stays in the CRM profile),
//     badges, garage, and «this rider's part of the wall» (their posts).
//   · THE OWNER additionally gets an edit mode: bio / city / status emoji+text
//     / hideProfile toggle — saved through saveRiderProfileAction.
//   · «Написать в TG» — deep link button only; the username itself is never
//     printed as text (Chain-report privacy rule: raw handles get scraped).
//
// Styling reuses the wall's design system: --community-* palette bridge (set
// by the page) + cw-card / cw-rise from globals.css — the profile reads as
// the third part of one thing (wall · map · profile).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bike,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  Send,
  ThumbsUp,
  Timer,
  X,
} from "lucide-react";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { buildTelegramAppLink, riderProfileStartParam } from "@/lib/wall-deeplink";
import { buildWallPostPreview, formatRelativeTimeRu } from "@/app/franchize/lib/community-wall";
import {
  RIDER_STATUS_EMOJIS,
  RIDER_BIO_MAX_LEN,
  RIDER_CITY_MAX_LEN,
  RIDER_STATUS_TEXT_MAX_LEN,
  type RiderProfileCustom,
} from "@/app/franchize/lib/rider-profile";
import { saveRiderProfileAction, type RiderProfileView } from "@/app/franchize/server-actions/rider-profile";
import type { WallPostView } from "@/app/franchize/lib/community-wall";

// ── small building blocks ────────────────────────────────────────────────────

function Avatar({ url, name, size = 72 }: { url: string | null; name: string; size?: number }) {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  }, [name]);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover ring-2 ring-[var(--community-accent)]/40" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex items-center justify-center rounded-full font-black text-[var(--community-accent-text)] ring-2 ring-[var(--community-accent)]/40"
      style={{ width: size, height: size, backgroundColor: "var(--community-accent)", fontSize: size / 2.6 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="cw-card flex flex-col items-center gap-1 px-2 py-3 text-center">
      <span className="text-[var(--community-muted)]" aria-hidden>
        {icon}
      </span>
      <span className="text-lg font-black leading-none text-[var(--community-text)]">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--community-muted)]">{label}</span>
    </div>
  );
}

function pluralRuClient(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function shortDateClient(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

const RENTAL_STATUS_LABEL: Record<string, { label: string; emoji: string }> = {
  active: { label: "в аренде", emoji: "🚀" },
  completed: { label: "завершена", emoji: "✅" },
  cancelled: { label: "отменена", emoji: "❌" },
  confirmed: { label: "подтверждена", emoji: "📋" },
  pending_confirmation: { label: "ожидает", emoji: "⏳" },
  disputed: { label: "спор", emoji: "⚠️" },
};

// ── main component ───────────────────────────────────────────────────────────

export function RiderProfileClient({
  profile,
  crewSlug,
  crewName,
  initialPosts,
}: {
  profile: RiderProfileView;
  crewSlug: string;
  crewName: string;
  initialPosts: WallPostView[];
}) {
  const { rider, stats, badges, garage, recentRentals, isSelf, isStaff } = profile;
  const displayName = rider.fullName || rider.username || "Райдер";
  // The served customization payload as local view state — updated after a
  // successful save (server is the source of truth, it re-sanitizes).
  const [viewCustom, setViewCustom] = useState<RiderProfileCustom>(profile.custom);
  const custom = viewCustom;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RiderProfileCustom>(custom);
  const [savedFlash, setSavedFlash] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement | null>(null);

  const openStartEditing = () => {
    setDraft(custom);
    setEditing(true);
    requestAnimationFrame(() => bioRef.current?.focus());
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await saveRiderProfileAction({ slug: crewSlug, initData: getTelegramInitData() || undefined, custom: draft });
      if (res.ok) {
        setViewCustom(res.custom);
        setEditing(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } else {
        window.alert(res.error || "Не получилось сохранить профиль.");
      }
    } finally {
      setSaving(false);
    }
  };

  const shareProfile = () => {
    const webUrl = `${window.location.origin}/franchize/${crewSlug}/rider/${rider.userId}`;
    let url = webUrl;
    try {
      const bot = profile.botUsername;
      if (bot) url = buildTelegramAppLink(bot, riderProfileStartParam(rider.userId, crewSlug));
    } catch {
      url = webUrl;
    }
    const text = `Профиль райдера ${displayName} в экипаже ${crewName}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    try {
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
        return;
      }
    } catch {
      // plain web — fall through
    }
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const tgHref = profile.botUsername ? `https://t.me/${profile.botUsername.replace(/^@/, "")}` : null;

  // ── hidden profile: minimal card, nothing else ────────────────────────────
  if (profile.hidden) {
    return (
      <section className="cw-card cw-rise p-6 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <div className="text-4xl" aria-hidden>
            🕶
          </div>
          <h1 className="text-xl font-black text-[var(--community-text)]">{displayName}</h1>
          <p className="text-sm text-[var(--community-muted)]">
            Райдер предпочёл скрыть профиль. Видны только имя и аватар — всё остальное доступно ему и админам экипажа.
          </p>
        </div>
      </section>
    );
  }

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const lockedBadges = badges.filter((b) => !b.unlocked);

  return (
    <div className="space-y-5">
      {/* ── header card ──────────────────────────────────────────────────── */}
      <section className="cw-card cw-rise p-5 md:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar url={rider.avatarUrl} name={displayName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black leading-tight text-[var(--community-text)]">{displayName}</h1>
              <span className="rounded-full border border-[var(--community-border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--community-muted)]">
                Райдер
              </span>
              {profile.sinceLabel && (
                <span className="rounded-full bg-[var(--community-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--community-accent)]">
                  {profile.sinceLabel}
                </span>
              )}
            </div>
            {(custom.statusEmoji || custom.statusText) && (
              <p className="mt-1 text-sm font-semibold text-[var(--community-text)]">
                {custom.statusEmoji ? <span aria-hidden>{custom.statusEmoji} </span> : null}
                {custom.statusText}
              </p>
            )}
            {custom.bio && <p className="mt-1.5 whitespace-pre-line text-sm text-[var(--community-muted)]">{custom.bio}</p>}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--community-muted)]">
              {custom.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {custom.city}
                </span>
              )}
              <span>{crewName}</span>
            </p>
          </div>

          {/* actions — own profile gets edit, everyone gets TG + share */}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
            {isSelf && !editing && (
              <button
                type="button"
                onClick={openStartEditing}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--community-accent)] px-4 py-2.5 text-sm font-bold text-[var(--community-accent-text)] transition hover:brightness-110 sm:flex-none"
              >
                <Pencil className="h-4 w-4" aria-hidden /> Редактировать
              </button>
            )}
            {tgHref && (
              <a
                href={tgHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--community-border)] px-4 py-2.5 text-sm font-semibold text-[var(--community-text)] transition hover:border-[var(--community-accent)] sm:flex-none"
              >
                <Send className="h-4 w-4" aria-hidden /> Написать
              </a>
            )}
            <button
              type="button"
              onClick={shareProfile}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--community-border)] px-4 py-2.5 text-sm font-semibold text-[var(--community-text)] transition hover:border-[var(--community-accent)] sm:flex-none"
            >
              <Share2 className="h-4 w-4" aria-hidden /> Поделиться
            </button>
            {savedFlash && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--community-accent)]" role="status">
                <Check className="h-3.5 w-3.5" aria-hidden /> сохранено
              </span>
            )}
          </div>
        </div>

        {/* edit form (own profile only) */}
        {isSelf && editing && (
          <form
            className="mt-5 space-y-3 rounded-2xl border border-[var(--community-border)] p-4"
            style={{ backgroundColor: "var(--community-card-faint)" }}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--community-text)]">Настройка профиля</p>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--community-border)] text-[var(--community-muted)] transition hover:text-[var(--community-text)]"
                aria-label="Закрыть редактор"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--community-muted)]">
              О себе ({draft.bio.length}/{RIDER_BIO_MAX_LEN})
              <textarea
                ref={bioRef}
                value={draft.bio}
                maxLength={RIDER_BIO_MAX_LEN}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                rows={3}
                placeholder="Люблю ночные заезды и кофе на набережной…"
                className="mt-1 w-full rounded-xl border border-[var(--community-border)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[var(--community-text)] outline-none focus:border-[var(--community-accent)]"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--community-muted)]">
                Город
                <input
                  value={draft.city}
                  maxLength={RIDER_CITY_MAX_LEN}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  placeholder="Нижний Новгород"
                  className="mt-1 w-full rounded-xl border border-[var(--community-border)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[var(--community-text)] outline-none focus:border-[var(--community-accent)]"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--community-muted)]">
                Статус
                <input
                  value={draft.statusText}
                  maxLength={RIDER_STATUS_TEXT_MAX_LEN}
                  onChange={(e) => setDraft({ ...draft, statusText: e.target.value })}
                  placeholder="в гараже / жду выезда"
                  className="mt-1 w-full rounded-xl border border-[var(--community-border)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[var(--community-text)] outline-none focus:border-[var(--community-accent)]"
                />
              </label>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--community-muted)]">Эмодзи статуса</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Эмодзи статуса">
                {RIDER_STATUS_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="radio"
                    aria-checked={draft.statusEmoji === emoji}
                    onClick={() => setDraft({ ...draft, statusEmoji: draft.statusEmoji === emoji ? "" : emoji })}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition ${
                      draft.statusEmoji === emoji
                        ? "border-[var(--community-accent)] bg-[var(--community-accent)]/10"
                        : "border-[var(--community-border)] hover:border-[var(--community-accent)]"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, hideProfile: !draft.hideProfile })}
              aria-pressed={draft.hideProfile}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--community-border)] px-3 py-2.5 text-left transition hover:border-[var(--community-accent)]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--community-text)]">
                {draft.hideProfile ? <EyeOff className="h-4 w-4 text-[var(--community-accent)]" aria-hidden /> : <Eye className="h-4 w-4 text-[var(--community-muted)]" aria-hidden />}
                Скрыть профиль от других
              </span>
              <span
                className={`relative h-6 w-10 shrink-0 rounded-full transition ${draft.hideProfile ? "bg-[var(--community-accent)]" : "bg-[var(--community-border)]"}`}
                aria-hidden
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${draft.hideProfile ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </button>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-11 rounded-full px-4 py-2 text-sm font-semibold text-[var(--community-muted)] transition hover:text-[var(--community-text)]"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-full bg-[var(--community-accent)] px-5 py-2 text-sm font-bold text-[var(--community-accent-text)] transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Сохраняю…" : "Сохранить"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── stats strip ──────────────────────────────────────────────────── */}
      <section aria-label="Статистика райдера" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <StatTile icon="🏍" value={stats.ridesCount} label="заездов" />
        <StatTile icon={<Timer className="h-4 w-4" />} value={stats.hoursRented} label="часов" />
        <StatTile icon={<ThumbsUp className="h-4 w-4" />} value={stats.reactionsReceived} label="реакций" />
        <StatTile icon={<Camera className="h-4 w-4" />} value={stats.photoPostsCount} label="фото-постов" />
        <StatTile icon={<MapPin className="h-4 w-4" />} value={stats.checkinCount} label="чек-инов" />
      </section>

      {/* ── badges ───────────────────────────────────────────────────────── */}
      <section className="cw-card cw-rise p-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-[var(--community-text)]">
          Бейджи
          <span className="ml-2 text-xs font-semibold normal-case text-[var(--community-muted)]">
            {unlockedBadges.length > 0
              ? `${unlockedBadges.length} ${pluralRuClient(unlockedBadges.length, ["получен", "получено", "получено"])}`
              : "всё впереди"}
          </span>
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...unlockedBadges, ...lockedBadges].map((badge) => (
            <div
              key={badge.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                badge.unlocked ? "border-[var(--community-accent)]" : "border-[var(--community-border)]"
              }`}
              style={{ backgroundColor: badge.unlocked ? "color-mix(in srgb, var(--community-accent) 9%, transparent)" : "var(--community-card-faint)" }}
            >
              <span className={`text-2xl ${badge.unlocked ? "" : "opacity-40 grayscale"}`} aria-hidden>
                {badge.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${badge.unlocked ? "text-[var(--community-text)]" : "text-[var(--community-muted)]"}`}>{badge.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--community-muted)]">{badge.unlocked ? badge.description : badge.hint ?? badge.description}</p>
                {!badge.unlocked && (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--community-border)]">
                    <div className="h-full rounded-full bg-[var(--community-accent)]" style={{ width: `${Math.round(badge.progress * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── garage ───────────────────────────────────────────────────────── */}
      {garage.length > 0 && (
        <section className="cw-card cw-rise p-5">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[var(--community-text)]">
            <Bike className="h-4 w-4 text-[var(--community-accent)]" aria-hidden /> Гараж
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {garage.map((bike) => (
              <div key={bike.bikeId} className="overflow-hidden rounded-2xl border border-[var(--community-border)]" style={{ backgroundColor: "var(--community-card-faint)" }}>
                {bike.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bike.imageUrl} alt={bike.title} className="h-24 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center text-3xl" aria-hidden>
                    🏍
                  </div>
                )}
                <div className="p-2.5">
                  <p className="truncate text-xs font-bold text-[var(--community-text)]" title={bike.title}>
                    {bike.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--community-muted)]">
                    в {bike.mentions} {pluralRuClient(bike.mentions, ["посте", "постах", "постах"])}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── recent rentals — ТОЛЬКО self / crew staff (видимость по ролям).
          Сервер уже отфильтровал: чужой зритель получает пустой массив. ── */}
      {recentRentals.length > 0 && (
        <section className="cw-card cw-rise p-5">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[var(--community-text)]">
            <KeyRound className="h-4 w-4 text-[var(--community-accent)]" aria-hidden /> Аренды
            <span className="ml-1 text-xs font-semibold normal-case text-[var(--community-muted)]">
              {/* isCrewStaffUser = любой активный член экипажа (не только админ):
                  честная формулировка вместо «только админам» (codereview P2-5). */}
              {isStaff && !isSelf ? "— видно экипажу" : "— твои заезды"}
            </span>
          </h2>
          <ul className="mt-3 space-y-2">
            {recentRentals.map((r) => {
              const st = RENTAL_STATUS_LABEL[r.status] ?? { label: r.status, emoji: "•" };
              const from = shortDateClient(r.startedAt);
              const to = shortDateClient(r.endedAt);
              return (
                <li
                  key={r.rentalId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--community-border)] p-3"
                  style={{ backgroundColor: "var(--community-card-faint)" }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--community-text)]">
                      {st.emoji} {r.bikeTitle}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--community-muted)]" suppressHydrationWarning>
                      {st.label}
                      {from ? ` · ${from}${to ? " → " + to : ""}` : ""}
                    </p>
                  </div>
                  {r.totalCost != null && r.totalCost > 0 && (
                    <span className="shrink-0 text-sm font-black text-[var(--community-text)]">
                      {r.totalCost.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── the rider's part of the wall ─────────────────────────────────── */}
      <section className="cw-card cw-rise p-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-[var(--community-text)]">
          На стене
          <span className="ml-2 text-xs font-semibold normal-case text-[var(--community-muted)]">
            {stats.postsCount} {pluralRuClient(stats.postsCount, ["пост", "поста", "постов"])}
          </span>
        </h2>
        {initialPosts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--community-muted)]">
            {isSelf ? "Ты ещё ничего не писал на стене — время исправить!" : "Постов пока нет."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {initialPosts.slice(0, 8).map((post) => (
              <li key={post.id}>
                <Link
                  href={`/franchize/${crewSlug}/community?post=${post.id}`}
                  className="block rounded-2xl border border-[var(--community-border)] p-3 transition hover:border-[var(--community-accent)]"
                  style={{ backgroundColor: "var(--community-card-faint)" }}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--community-muted)]">
                    {/* relative time is computed against Date.now() on both
                        sides — suppress the rare in-flight minute-boundary
                        mismatch instead of shipping a clock refresher */}
                    <span suppressHydrationWarning>{formatRelativeTimeRu(post.createdAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" aria-hidden /> {post.likeCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" aria-hidden /> {post.commentCount}
                    </span>
                    {post.isPinned && <span className="text-[var(--community-accent)]">📌</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--community-text)]">
                    {buildWallPostPreview(post.body || (post.photos.length > 0 ? "пост с фото" : ""), 160)}
                  </p>
                  {post.photos.length > 0 && (
                    <div className="mt-2 flex gap-1.5 overflow-hidden">
                      {post.photos.slice(0, 4).map((photo) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={photo.id} src={photo.url} alt="" loading="lazy" className="h-14 w-14 rounded-lg object-cover" />
                      ))}
                      {post.photos.length > 4 && (
                        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--community-border)] text-xs font-bold text-[var(--community-text)]">
                          +{post.photos.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
