"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, Palette, Settings, Shield, User, IdCard, MessageCircle, Send } from "lucide-react";
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FranchizeProfileButton({ bgColor, textColor, borderColor, currentSlug }: FranchizeProfileButtonProps) {
  const { dbUser, user, userCrewInfo, isInTelegramContext } = useAppContext();
  const effectiveUser = dbUser || user;
  const displayName = effectiveUser?.username || effectiveUser?.full_name || effectiveUser?.first_name || "Operator";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const userIsAdmin = useIsAdmin();
  const scopeSlug = normalizeSlug(currentSlug || userCrewInfo?.slug);
  const franchizeAdminHref = `/franchize/${scopeSlug}/admin`;
  const franchizeProfileHref = `/franchize/${scopeSlug}/profile`;
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

  if (!effectiveUser) {
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
            <span className="relative block h-8 w-8 overflow-hidden rounded-full border" style={{ borderColor }}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} fill sizes="32px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold">
                  {getInitials(displayName)}
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
              <span className="truncate">Branding (экипаж)</span>
            </Link>
          </DropdownMenuItem>

          {userIsAdmin ? (
            <DropdownMenuItem asChild>
              <Link href={franchizeAdminHref} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                <Shield className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Franchize admin</span>
              </Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem asChild>
            <Link href={franchizeProfileHref} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <IdCard className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Franchize profile</span>
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
                  <span className="truncate">Admin</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
