// /app/franchize/components/FranchizeProfileButton.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, LayoutDashboard, Palette, Settings, Shield, User, IdCard, MessageCircle, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useIsAdmin } from "@/app/franchize/hooks/useIsAdmin";
import { isMockUserModeEnabled } from "@/lib/mockUserMode";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getFranchizeNotificationPreferencesAction,
  saveFranchizeNotificationPreferencesAction,
  type FranchizeNotificationPreferences,
} from "@/app/franchize/profile-actions";
import { toast } from "sonner";

const TELEGRAM_WEB_APP_URL = "https://t.me/oneBikePlsBot/app";

const DEFAULT_NOTIFICATION_PREFERENCES: FranchizeNotificationPreferences = {
  orderUpdates: true,
  mapRidersAlerts: true,
  marketingDigest: false,
};

const NOTIFICATION_OPTIONS: Array<{ key: keyof FranchizeNotificationPreferences; label: string; helper: string }> = [
  { key: "orderUpdates", label: "Статусы заказов", helper: "бронь, покупка, документы" },
  { key: "mapRidersAlerts", label: "MapRiders", helper: "заезды и встречи экипажа" },
  { key: "marketingDigest", label: "Редкие акции", helper: "промо и новости VIP BIKE" },
];

function normalizeSlug(slug: string | undefined): string {
  return (slug || "vip-bike").trim().toLowerCase() || "vip-bike";
}

interface FranchizeProfileButtonProps {
  bgColor: string;
  textColor: string;
  borderColor: string;
  currentSlug?: string;
}

function getFirstLetter(name: string): string {
  return (name.trim()[0] || "O").toUpperCase();
}

/**
 * Validate that a CSS colour string is safe to pass into var() + color-mix().
 * Accepts #hex, rgb(), rgba(), hsl(), hsla(), hwb(), oklch(), named colours.
 * Rejects bare HSL triplets like "34 92% 70%" (needs hsl() wrapper)
 * and anything that looks like a CSS injection attempt.
 */
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|hwb\([^)]+\)|okl(ch|ab)\([^)]+\)|[a-zA-Z]+)$/;

function sanitizeAccentColor(raw: string, fallback = "#f9ac67"): string {
  const trimmed = raw.trim();
  if (SAFE_COLOR_RE.test(trimmed)) return trimmed;
  return fallback;
}

/* ───────────────────────────────────────────────────────────────────────────
   Spooky ghost-glow keyframes — injected once into <head>

   SECURITY: All colour references use var(--spooky-accent) so that the
   keyframe text is a *static* string. The actual colour value flows only
   through React's style prop (which escapes values), eliminating any
   CSS-injection vector from a crafted palette entry like
   "red;} body{display:none}/*".
   ─────────────────────────────────────────────────────────────────────────── */
const SPOOKY_STYLE_ID = "franchize-spooky-avatar-keyframes";
const SPOOKY_ACCENT_VAR = "--spooky-accent";

function ensureSpookyKeyframes() {
  if (typeof document === "undefined" || document.getElementById(SPOOKY_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SPOOKY_STYLE_ID;
  style.textContent = `
@keyframes spookyPulse {
  0%, 100% {
    opacity: 0.55;
    text-shadow:
      0 0 6px var(${SPOOKY_ACCENT_VAR}),
      0 0 18px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 27%, transparent),
      0 0 36px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 13%, transparent);
    transform: scale(1);
  }
  40% {
    opacity: 1;
    text-shadow:
      0 0 10px var(${SPOOKY_ACCENT_VAR}),
      0 0 28px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 53%, transparent),
      0 0 56px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 27%, transparent),
      0 0 80px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 13%, transparent);
    transform: scale(1.12);
  }
  60% {
    opacity: 0.7;
    text-shadow:
      0 0 4px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 67%, transparent),
      0 0 14px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 20%, transparent);
    transform: scale(0.96) rotate(-2deg);
  }
  80% {
    opacity: 0.9;
    text-shadow:
      0 0 8px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 80%, transparent),
      0 0 22px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 33%, transparent),
      0 0 44px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 20%, transparent);
    transform: scale(1.06) rotate(1deg);
  }
}
@keyframes spookyFlicker {
  0%, 100% { opacity: 1; }
  4% { opacity: 0.4; }
  6% { opacity: 1; }
  42% { opacity: 1; }
  44% { opacity: 0.6; }
  46% { opacity: 1; }
  78% { opacity: 1; }
  80% { opacity: 0.35; }
  82% { opacity: 0.9; }
  83% { opacity: 0.4; }
  84% { opacity: 1; }
}
@keyframes ghostDissolve {
  0% {
    opacity: 1;
    transform: scale(1);
    filter: blur(0px);
    text-shadow:
      0 0 10px var(${SPOOKY_ACCENT_VAR}),
      0 0 28px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 53%, transparent),
      0 0 56px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 27%, transparent);
  }
  35% {
    opacity: 0.8;
    transform: scale(1.15);
    filter: blur(0.5px);
    text-shadow:
      0 0 14px var(${SPOOKY_ACCENT_VAR}),
      0 0 40px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 73%, transparent),
      0 0 80px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 40%, transparent);
  }
  70% {
    opacity: 0.3;
    transform: scale(1.5);
    filter: blur(3px);
    text-shadow:
      0 0 24px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 80%, transparent),
      0 0 60px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 40%, transparent);
  }
  100% {
    opacity: 0;
    transform: scale(2.2);
    filter: blur(8px);
    text-shadow:
      0 0 40px var(${SPOOKY_ACCENT_VAR}),
      0 0 90px color-mix(in srgb, var(${SPOOKY_ACCENT_VAR}) 53%, transparent);
  }
}
`;
  document.head.appendChild(style);
}

/** Permanent spooky letter — used when avatar is broken (never loads) */
function SpookyLetter({ letter, color }: { letter: string; color: string }) {
  useEffect(() => {
    ensureSpookyKeyframes();
  }, []);

  return (
    <span
      className="flex h-full w-full items-center justify-center text-sm font-bold select-none"
      style={{
        color,
        [SPOOKY_ACCENT_VAR]: sanitizeAccentColor(color),
        animation: "spookyPulse 3s ease-in-out infinite, spookyFlicker 5s steps(1) infinite",
      }}
    >
      {letter}
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Main component
   ─────────────────────────────────────────────────────────────────────────── */
export function FranchizeProfileButton({ bgColor, textColor, borderColor, currentSlug }: FranchizeProfileButtonProps) {
  const { dbUser, user, userCrewInfo, isInTelegramContext } = useAppContext();
  const hasUser = Boolean(dbUser || user);
  const displayName = dbUser?.username || dbUser?.full_name || user?.username || user?.first_name || "Operator";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const userIsAdmin = useIsAdmin();
  const scopeSlug = normalizeSlug(currentSlug || userCrewInfo?.slug);
  const franchizeAdminHref = `/franchize/${scopeSlug}/admin`;
  const franchizeDashboardHref = `/franchize/${scopeSlug}/dashboard`;
  const franchizeProfileHref = `/franchize/${scopeSlug}/profile`;

  // ── Avatar loading state machine ──
  //   loading → (onLoad) → dissolving → (animationEnd) → revealed
  //   loading → (onError) → broken (permanent spooky letter)
  const [brokenAvatarUrls, setBrokenAvatarUrls] = useState<Record<string, true>>({});
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarDissolved, setAvatarDissolved] = useState(false);

  // Reset loading/dissolve state when avatar URL changes
  useEffect(() => {
    setAvatarLoaded(false);
    setAvatarDissolved(false);
  }, [avatarUrl]);

  // Inject spooky keyframes once (static CSS — no dynamic colour interpolation)
  useEffect(() => {
    ensureSpookyKeyframes();
  }, []);

  const [tempCartId, setTempCartId] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<FranchizeNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isNotificationSaving, setIsNotificationSaving] = useState(false);
  const canShowTelegramCartCta = !dbUser?.user_id && !isInTelegramContext && !isMockUserModeEnabled();

  useEffect(() => {
    if (typeof window === "undefined" || !canShowTelegramCartCta) return;
    const id = window.localStorage.getItem("franchize-temp-cart-id");
    setTempCartId(id);
  }, [canShowTelegramCartCta]);

  useEffect(() => {
    let cancelled = false;
    if (!dbUser?.user_id) {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    getFranchizeNotificationPreferencesAction({ userId: dbUser.user_id, slug: scopeSlug })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setNotificationPreferences(res.data);
      })
      .catch(() => {
        if (!cancelled) setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      });

    return () => {
      cancelled = true;
    };
  }, [dbUser?.user_id, scopeSlug]);

  const handleNotificationPreferenceChange = async (key: keyof FranchizeNotificationPreferences, checked: boolean) => {
    if (!dbUser?.user_id || isNotificationSaving) return;

    const previous = notificationPreferences;
    const next = { ...previous, [key]: checked };
    setNotificationPreferences(next);
    setIsNotificationSaving(true);

    try {
      const res = await saveFranchizeNotificationPreferencesAction({ userId: dbUser.user_id, slug: scopeSlug, preferences: next });

      if (!res.success) {
        setNotificationPreferences(previous);
        toast.error(res.error || "Не удалось сохранить уведомления");
        return;
      }

      toast.success("Настройки уведомлений сохранены");
    } catch (error) {
      setNotificationPreferences(previous);
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить уведомления");
    } finally {
      setIsNotificationSaving(false);
    }
  };

  const telegramCartHref = useMemo(() => {
    if (!tempCartId) return null;
    return `https://t.me/oneBikePlsBot/app?startapp=cart_id_${encodeURIComponent(tempCartId)}`;
  }, [tempCartId]);

  if (!hasUser) {
    return (
      <a
        href={TELEGRAM_WEB_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть Telegram WebApp"
        className="inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ backgroundColor: bgColor, color: textColor, borderColor }}
      >
        <Send className="h-4 w-4" />
        <span className="hidden sm:inline">WebApp</span>
      </a>
    );
  }

  return (
    <div style={{ isolation: "isolate" }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Профиль и навигация"
            className="inline-flex h-11 items-center gap-2 rounded-xl px-2 transition hover:opacity-80"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            {/* ── Avatar area: 4 states ── */}
            <span className="relative block h-8 w-8 overflow-hidden rounded-full border" style={{ borderColor }}>
              {avatarUrl && !brokenAvatarUrls[avatarUrl] ? (
                <>
                  {/* Image layer — always rendered so it loads in background */}
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    fill
                    sizes="32px"
                    className="object-cover"
                    onLoad={() => setAvatarLoaded(true)}
                    onError={() => {
                      if (!avatarUrl) return;
                      setBrokenAvatarUrls((prev) => ({ ...prev, [avatarUrl]: true }));
                    }}
                  />
                  {/* Spooky letter overlay — breathes while loading, dissolves on load */}
                  {!avatarDissolved && (
                    <span
                      className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold select-none"
                      style={{
                        color: textColor,
                        [SPOOKY_ACCENT_VAR]: sanitizeAccentColor(textColor),
                        animation: avatarLoaded
                          ? "ghostDissolve 0.8s ease-out forwards"
                          : "spookyPulse 3s ease-in-out infinite, spookyFlicker 5s steps(1) infinite",
                      }}
                      onAnimationEnd={() => {
                        if (avatarLoaded) setAvatarDissolved(true);
                      }}
                    >
                      {getFirstLetter(displayName)}
                    </span>
                  )}
                </>
              ) : avatarUrl && brokenAvatarUrls[avatarUrl] ? (
                /* Broken URL — permanent spooky letter */
                <SpookyLetter letter={getFirstLetter(displayName)} color={textColor} />
              ) : (
                /* No avatar URL at all — plain static letter */
                <span className="flex h-full w-full items-center justify-center text-sm font-semibold">
                  {getFirstLetter(displayName)}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 opacity-80" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1.5rem)]" sideOffset={8}>
          <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <User className="mr-2 h-4 w-4" />
              <span className="truncate">Профиль</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <Settings className="mr-2 h-4 w-4" />
              <span className="truncate">Настройки</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/franchize/create" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <Palette className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Оформление экипажа</span>
            </Link>
          </DropdownMenuItem>

          {userIsAdmin ? (
            <DropdownMenuItem asChild>
              <Link href={franchizeAdminHref} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                <Shield className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Админка франшизы</span>
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem asChild>
            <Link href={franchizeDashboardHref} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Дашборд франшизы</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={franchizeProfileHref} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <IdCard className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Профиль франшизы</span>
            </Link>
          </DropdownMenuItem>

          {canShowTelegramCartCta && telegramCartHref ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={telegramCartHref} target="_blank" rel="noreferrer" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                  <MessageCircle className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Перейти в Telegram — корзина сохранится</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuLabel className="pt-0 text-[11px] font-normal text-muted-foreground">
                Добавленные позиции уже сохранены
              </DropdownMenuLabel>
            </>
          ) : null}

          {dbUser?.user_id ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Bell className="h-3.5 w-3.5" />
                Уведомления
              </DropdownMenuLabel>
              {NOTIFICATION_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.key}
                  checked={notificationPreferences[option.key]}
                  disabled={isNotificationSaving}
                  onCheckedChange={(checked) => handleNotificationPreferenceChange(option.key, Boolean(checked))}
                  onSelect={(event) => event.preventDefault()}
                  className="cursor-pointer items-start gap-2 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{option.label}</span>
                    <span className="text-[11px] text-muted-foreground">{option.helper}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </>
          ) : null}

          {userCrewInfo?.slug && (
            <DropdownMenuItem asChild>
              <Link href={`/crews/${userCrewInfo.slug}`} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                <Palette className="mr-2 h-4 w-4" />
                <span className="truncate">Мой экипаж</span>
              </Link>
            </DropdownMenuItem>
          )}

          {userIsAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                  <Shield className="mr-2 h-4 w-4" />
                  <span className="truncate">Админка</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
