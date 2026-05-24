"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, LayoutDashboard, Palette, Settings, Shield, User, IdCard, MessageCircle, Send } from "lucide-react";
import { Component, useEffect, useMemo, useState } from "react";
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
import {
  ensureSpookyKeyframes,
  getFirstLetter,
  sanitizeAccentColor,
  SpookyLetter,
  SPOOKY_ACCENT_VAR,
} from "@/app/franchize/lib/spooky-avatar";

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
  // FIX: Also handle empty-string slugs — previously "" || "vip-bike" worked
  // but trim().toLowerCase() on an empty string returns "", then the || fallback
  // catches it. However, we should also guard against whitespace-only slugs.
  const normalized = (slug || "").trim().toLowerCase();
  return normalized || "vip-bike";
}

// ─────────────────────────────────────────────────────────
// FIX: Local error boundary to prevent "crew recovery" full-page crash.
// ─────────────────────────────────────────────────────────
// When the DropdownMenu or any of its children throw during rendering
// (e.g., due to missing AppContext during SPA navigation, useIsAdmin
// throwing, or Radix portal failures), the error bubbles up to the
// nearest error boundary. Without this local boundary, the error reaches
// the page-level "crew recovery" boundary, replacing the ENTIRE page
// with the fallback screen. This local boundary catches the error
// gracefully and renders a simple fallback button instead.
// ─────────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
}

class CrewButtonErrorBoundary extends Component<
  { bgColor: string; textColor: string; borderColor: string; children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { bgColor: string; textColor: string; borderColor: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Log to console for debugging — NOT to the user
    console.warn("[FranchizeProfileButton] caught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      // Minimal fallback: just show the avatar letter button without the dropdown.
      // Clicking it navigates to Telegram WebApp (same as the old !hasUser behavior).
      return (
        <a
          href={TELEGRAM_WEB_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть Telegram WebApp"
          className="inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: this.props.bgColor, color: this.props.textColor, borderColor: this.props.borderColor }}
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">WebApp</span>
        </a>
      );
    }
    return this.props.children;
  }
}

interface FranchizeProfileButtonProps {
  bgColor: string;
  textColor: string;
  borderColor: string;
  currentSlug?: string;
}

export function FranchizeProfileButton({ bgColor, textColor, borderColor, currentSlug }: FranchizeProfileButtonProps) {
  const { dbUser, user, userCrewInfo, isInTelegramContext } = useAppContext();
  const hasUser = Boolean(dbUser || user);
  const displayName = dbUser?.username || dbUser?.full_name || user?.username || user?.first_name || "Operator";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const userIsAdmin = useIsAdmin();
  const scopeSlug = normalizeSlug(currentSlug || userCrewInfo?.slug);
  // FIX: If currentSlug was explicitly provided (from CrewHeader), prefer it over
  // the fallback "vip-bike". This prevents navigating to /franchize/vip-bike/profile
  // when the user is on /franchize/sly13 and the slug is somehow empty.
  const effectiveSlug = currentSlug?.trim() ? currentSlug.trim().toLowerCase() : scopeSlug;
  const franchizeAdminHref = `/franchize/${effectiveSlug}/admin`;
  const franchizeDashboardHref = `/franchize/${effectiveSlug}/dashboard`;
  const franchizeProfileHref = `/franchize/${effectiveSlug}/profile`;

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

  // ─────────────────────────────────────────────────────────
  // FIX: "Profile icon routes to abyss" bug
  // ─────────────────────────────────────────────────────────
  // When !hasUser (auth hasn't resolved or user is anonymous), the old code
  // rendered an <a> tag that navigated to the Telegram WebApp URL. This caused
  // the "routes to abyss" symptom: clicking the profile icon took the user to
  // an external Telegram URL instead of opening a dropdown.
  //
  // The fix: render a DropdownMenu even for unauthenticated users, with a
  // "Login via Telegram" option inside. This way the profile icon always
  // opens a dropdown (consistent UX) and never navigates away unexpectedly.
  // ─────────────────────────────────────────────────────────

  const inner = (
    <div style={{ isolation: "isolate" }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={hasUser ? "Профиль и навигация" : "Войти через Telegram"}
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
                        [SPOOKY_ACCENT_VAR as string]: sanitizeAccentColor(textColor),
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
                <SpookyLetter letter={getFirstLetter(displayName)} color={textColor} sizeClass="text-sm" />
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
          {!hasUser ? (
            <>
              <DropdownMenuLabel>Гость</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a
                  href={TELEGRAM_WEB_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer flex min-w-0 items-center gap-2 w-full"
                >
                  <Send className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Войти через Telegram</span>
                </a>
              </DropdownMenuItem>
            </>
          ) : (
            <>
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // FIX: Wrap in local error boundary so a DropdownMenu crash doesn't
  // take down the entire page (replacing it with "crew recovery" fallback).
  return (
    <CrewButtonErrorBoundary bgColor={bgColor} textColor={textColor} borderColor={borderColor}>
      {inner}
    </CrewButtonErrorBoundary>
  );
}