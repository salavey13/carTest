"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, LayoutDashboard, List, Palette, Settings, Shield, IdCard, MessageCircle, Send, UserPlus, Users, Moon, Sun, BarChart3, PhoneCall } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useTheme } from "next-themes";
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

 
// FIX: Removed hardcoded "https://t.me/oneBikePlsBot/app".
// The Telegram WebApp URL should come from crew metadata (contacts.telegramBotUsername).
// For now, we construct it dynamically when a slug is available.
// If no slug is available, the link simply won't render.
const TELEGRAM_BOT_APP_URL_TEMPLATE = "https://t.me/{botUsername}/app";

const DEFAULT_NOTIFICATION_PREFERENCES: FranchizeNotificationPreferences = {
  orderUpdates: true,
  mapRidersAlerts: true,
  marketingDigest: false,
};

// FIX: De-biked notification option helper text.
// Was "промо и новости VIP BIKE" — now generic "промо и новости экипажа".
const NOTIFICATION_OPTIONS: Array<{ key: keyof FranchizeNotificationPreferences; label: string; helper: string }> = [
  { key: "orderUpdates", label: "Статусы заказов", helper: "бронь, покупка, документы" },
  { key: "mapRidersAlerts", label: "MapRiders", helper: "заезды и встречи экипажа" },
  { key: "marketingDigest", label: "Редкие акции", helper: "промо и новости экипажа" },
];

// FIX: De-biked slug fallback. Was "vip-bike" — now empty string.
// The slug should ALWAYS come from the crew context. A fallback slug
// would navigate users to the wrong crew's pages.
function normalizeSlug(slug: string | undefined): string {
  const normalized = (slug || "").trim().toLowerCase();
  return normalized;
}

interface FranchizeProfileButtonProps {
  bgColor: string;
  textColor: string;
  borderColor: string;
  currentSlug?: string;
  // FIX: Added optional telegramBotUsername prop so the Telegram CTA
  // can be constructed dynamically per-crew instead of hardcoding oneBikePlsBot.
  telegramBotUsername?: string;
}

export function FranchizeProfileButton({ bgColor, textColor, borderColor, currentSlug, telegramBotUsername }: FranchizeProfileButtonProps) {
  const { dbUser, user, userCrewInfo, isInTelegramContext, tg } = useAppContext();
  const { theme, setTheme } = useTheme();

  const handleInvite = () => {
    if (!userCrewInfo) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${userCrewInfo.slug}_join_crew`;
    const text = `Присоединяйся к нашему экипажу '${userCrewInfo.name}' в VibeRider!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;
    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };
  const hasUser = Boolean(dbUser || user);
  const displayName = dbUser?.username || dbUser?.full_name || user?.username || user?.first_name || "Operator";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const userIsAdmin = useIsAdmin();
  const { userCrewMemberships } = useAppContext();
  // Check if user has admin-level role for the current crew
  const isCurrentCrewAdmin = useMemo(() => {
    if (!effectiveSlug) return false;
    return userCrewMemberships.some((m) => m.slug === effectiveSlug && ["owner", "admin", "co_owner"].includes(m.role));
  }, [userCrewMemberships, effectiveSlug]);
  const scopeSlug = normalizeSlug(currentSlug || userCrewInfo?.slug);
  // FIX: If currentSlug was explicitly provided (from CrewHeader), prefer it.
  // No longer falls back to "vip-bike" — empty slug is handled gracefully.
  const effectiveSlug = currentSlug?.trim() ? currentSlug.trim().toLowerCase() : scopeSlug;
  // Only show crew operator links (leads, rentals, analytics) if user is admin
  // OR belongs to the crew whose page they're currently viewing.
  const isCurrentCrewMember = !!(userCrewInfo?.slug && effectiveSlug && userCrewInfo.slug === effectiveSlug);
  const canViewCrewLinks = userIsAdmin || isCurrentCrewMember;
  const franchizeAdminHref = `/franchize/${effectiveSlug}/admin`;
  const franchizeDashboardHref = `/franchize/${effectiveSlug}/dashboard`;
  const franchizeProfileHref = `/franchize/${effectiveSlug}/profile`;

  // Construct the Telegram WebApp URL dynamically from crew metadata
  const telegramWebAppUrl = useMemo(() => {
    const botUsername = telegramBotUsername || "";
    if (!botUsername) return "";
    return TELEGRAM_BOT_APP_URL_TEMPLATE.replace("{botUsername}", botUsername);
  }, [telegramBotUsername]);

  // Generate a deep-link that routes to the franchize profile page via StartParamRouter
  const telegramProfileDeepLink = useMemo(() => {
    if (!telegramWebAppUrl || !effectiveSlug) return telegramWebAppUrl || "";
    return `${telegramWebAppUrl}?startapp=franchize/${effectiveSlug}/profile`;
  }, [telegramWebAppUrl, effectiveSlug]);

  // ── Avatar loading state machine ──
  const [brokenAvatarUrls, setBrokenAvatarUrls] = useState<Record<string, true>>({});
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarDissolved, setAvatarDissolved] = useState(false);

  // Reset loading/dissolve state when avatar URL changes
  useEffect(() => {
    setAvatarLoaded(false);
    setAvatarDissolved(false);
  }, [avatarUrl]);

  // Inject spooky keyframes once
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

  // FIX: Construct Telegram cart link dynamically from crew bot username
  const telegramCartHref = useMemo(() => {
    if (!tempCartId || !telegramWebAppUrl) return null;
    const botUrl = telegramWebAppUrl;
    return `${botUrl}?startapp=cart_id_${encodeURIComponent(tempCartId)}`;
  }, [tempCartId, telegramWebAppUrl]);

  if (!hasUser) {
    // Inside Telegram WebApp but auth not resolved yet — show loading state
    if (isInTelegramContext) {
      return (
        <button
          type="button"
          disabled
          aria-label="Загрузка профиля"
          className="inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold opacity-60"
          style={{ backgroundColor: bgColor, color: textColor, borderColor }}
        >
          <Send className="h-4 w-4 animate-pulse" />
          <span className="hidden sm:inline">...</span>
        </button>
      );
    }
    // Outside Telegram (browser) — ALWAYS produce a working link.
    // Use crew-specific bot if available, fallback to oneBikePlsBot.
    // Use t.me format (not web.telegram.org) — t.me properly redirects to Telegram Web on desktop.
    const botName = telegramBotUsername || "oneBikePlsBot";
    const startappValue = effectiveSlug ? `franchize/${effectiveSlug}/profile` : "";
    const tmeHref = startappValue
      ? `https://t.me/${botName}/app?startapp=${encodeURIComponent(startappValue)}`
      : `https://t.me/${botName}`;
    const label = tmeHref.includes("/app?startapp=") ? "Открыть в TG" : "Написать в TG";
    return (
      <a
        href={tmeHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ backgroundColor: bgColor, color: textColor, borderColor }}
      >
        <Send className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
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
            className="inline-flex h-11 items-center gap-2 rounded-xl px-2 transition hover:opacity-80 pointer-events-auto"
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
          <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Theme Toggle — persists to both next-themes and localStorage */}
          <DropdownMenuItem
            onSelect={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
              localStorage.setItem("theme", next);
            }}
            className="cursor-pointer flex min-w-0 items-center gap-2 w-full"
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4 text-yellow-500" />
            ) : (
              <Moon className="mr-2 h-4 w-4 text-blue-500" />
            )}
            <span className="truncate">{theme === "dark" ? "Светлая тема" : "Темная тема"}</span>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/franchize/create" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <Palette className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Оформление экипажа</span>
            </Link>
          </DropdownMenuItem>

          {(userIsAdmin || isCurrentCrewAdmin) && effectiveSlug ? (
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

          {/* Leads page — visible to current crew members/owner or admin */}
          {canViewCrewLinks && effectiveSlug && (
            <DropdownMenuItem asChild>
              <Link href={`/franchize/${effectiveSlug}/leads`} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                <PhoneCall className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Клиенты и заявки</span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild>
            <Link href={franchizeProfileHref} className="cursor-pointer flex min-w-0 items-center gap-2 w-full font-semibold bg-muted/30">
              <IdCard className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Профиль</span>
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

          {/* Мои аренды — для всех (личные аренды на странице профиля) */}
          {effectiveSlug && (
            <DropdownMenuItem asChild>
              <Link href={`/franchize/${effectiveSlug}/profile`} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                <List className="mr-2 h-4 w-4" />
                <span className="truncate">Мои аренды</span>
              </Link>
            </DropdownMenuItem>
          )}

          {/* Аналитика — только crew members/owner/admin */}
          {canViewCrewLinks && effectiveSlug && (
            <DropdownMenuItem asChild>
              <Link href={`/franchize/${effectiveSlug}/rentals-analytics`} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                <BarChart3 className="mr-2 h-4 w-4" />
                <span className="truncate">Аналитика аренд</span>
              </Link>
            </DropdownMenuItem>
          )}

          {/* FIX: Crew-management links require userCrewInfo to be loaded.
              Previous code conditionally wrapped on `effectiveSlug` but the
              body accessed `userCrewInfo.slug` directly — when userCrewInfo
              was null (user not in any crew, or snapshot still loading),
              this threw TypeError and triggered CrewButtonErrorBoundary →
              the "?" fallback button was rendered instead of the profile. */}
          {userCrewInfo?.slug && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/franchize/${userCrewInfo.slug}/crew`} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                  <Users className="mr-2 h-4 w-4" />
                  <span className="truncate">Управление экипажем</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <button onClick={handleInvite} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                  <UserPlus className="mr-2 h-4 w-4" />
                  <span className="truncate">Пригласить в экипаж</span>
                </button>
              </DropdownMenuItem>
            </>
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

// ── Error boundary for the profile button ──
import { Component, type ReactNode } from "react";

interface CrewButtonErrorBoundaryProps {
  children: ReactNode;
  bgColor: string;
  textColor: string;
  borderColor: string;
  resetKey?: string;
}

interface CrewButtonErrorBoundaryState {
  hasError: boolean;
  resetKey?: string;
}

export class CrewButtonErrorBoundary extends Component<CrewButtonErrorBoundaryProps, CrewButtonErrorBoundaryState> {
  constructor(props: CrewButtonErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(): Partial<CrewButtonErrorBoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    nextProps: CrewButtonErrorBoundaryProps,
    prevState: CrewButtonErrorBoundaryState,
  ): Partial<CrewButtonErrorBoundaryState> | null {
    if (nextProps.resetKey !== prevState.resetKey) {
      return { hasError: false, resetKey: nextProps.resetKey };
    }
    return null;
  }

  render() {
    if (this.state.hasError) {
      return (
        <button
          type="button"
          aria-label="Профиль временно недоступен"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border text-sm transition"
          style={{ backgroundColor: this.props.bgColor, color: this.props.textColor, borderColor: this.props.borderColor }}
        >
          ?
        </button>
      );
    }
    return this.props.children;
  }
}