// /hooks/telegram/useTelegramBackButton.ts
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { navigationStore } from "@/stores/navigationStore";

// ─── Helpers ────────────────────────────────────────────────────────

/** Returns the full current URL from the browser (pathname + search + hash). */
function currentFullPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * Determines a sensible "go back" target based purely on the URL structure.
 * This is the SAFETY NET that makes the BackButton appear even when the
 * navigationStore is empty (page refresh, deep link, etc.).
 *
 * IMPORTANT: This function MUST be kept. Removing it (as Grok proposed) is a
 * regression — without it, BackButton would never show after a page refresh
 * even when there's a clear logical parent route.
 */
function fallbackPathFor(path: string): string | null {
  const [pathname] = path.split(/[?#]/);

  // /franchize/vip-bike       → /vipbikerental
  // /franchize/vip-bike/cart  → /franchize/vip-bike
  // /franchize/vip-bike/about → /franchize/vip-bike
  const franchizeMatch = pathname.match(/^\/franchize\/([^/]+)(?:\/(.*))?$/);
  if (franchizeMatch) {
    const slug = franchizeMatch[1];
    const rest = franchizeMatch[2];
    if (!rest) return "/vipbikerental";
    return `/franchize/${slug}`;
  }

  if (pathname === "/vipbikerental") return null;

  // Generic fallback: go up one segment
  // /rent/catalog → /rent
  // /profile/settings → /profile
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 1) return `/${segments.slice(0, -1).join("/")}`;

  return null;
}

/**
 * Returns true if there is any in-app back target for the given path.
 * Checks the navigation store FIRST (for proper stack-based navigation),
 * then falls back to URL-based heuristic (for refreshes / deep links).
 */
function hasAppBackTarget(path: string): boolean {
  return navigationStore.canGoBack() || Boolean(fallbackPathFor(path));
}

/**
 * Resolves the best back target for the given current path.
 * Prefers the navigation store (accurate stack-based back),
 * falls back to URL-based heuristic.
 */
function resolveBackTarget(currentPath: string): string | null {
  // 1. Try the store first — it knows the exact previous route
  const storeTarget = navigationStore.backTarget(currentPath, { emit: false });
  if (storeTarget && storeTarget !== currentPath) return storeTarget;

  // 2. Fallback to URL structure
  const fallback = fallbackPathFor(currentPath);
  if (fallback && fallback !== currentPath) return fallback;

  return null;
}

// ─── Hook ───────────────────────────────────────────────────────────

/**
 * useTelegramBackButton
 *
 * Manages the Telegram Mini App's native BackButton visibility and click handling.
 *
 * Key design decisions:
 * - Does NOT push routes to navigationStore (TelegramNavigationTracker does that)
 * - Uses fallbackPathFor() as a safety net for page refreshes / deep links
 * - Does NOT use isInTelegramContext (which depends on async auth validation)
 *   for the show/hide decision; instead checks for real Telegram runtime
 * - Does NOT create duplicate browser history entries (no pushState guards)
 * - Relies on Telegram's built-in system back interception:
 *   when BackButton.isVisible is true, pressing Android system back fires
 *   BackButton.onClick instead of closing the app
 */
export function useTelegramBackButton() {
  const { tg } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHandlingBackRef = useRef(false);
  const previousRouteRef = useRef<string | null>(null);
  const readyCalledRef = useRef(false);

  const currentRoute = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname || "/"}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  // ─── Visibility Sync ────────────────────────────────────────────

  const syncButtonVisibility = useCallback(() => {
    // Try context tg first, then fall back to window.Telegram directly.
    // This handles the case where AppProvider hasn't initialized yet
    // but the Telegram runtime is already available on window.
    const backButton = tg?.BackButton ?? (typeof window !== "undefined" ? window.Telegram?.WebApp?.BackButton : undefined);
    if (!backButton) return;

    // Check for real Telegram runtime. We do NOT depend on isInTelegramContext
    // because that relies on async auth validation which may be delayed or fail.
    // The native BackButton is available as soon as telegram-web-app.js loads.
    const hasTelegramRuntime = Boolean(
      tg?.initData ||
      tg?.initDataUnsafe?.user ||
      (typeof window !== "undefined" && window.Telegram?.WebApp)
    );

    if (!hasTelegramRuntime) {
      backButton.hide();
      return;
    }

    const browserPath = currentFullPath();
    const canShow = hasAppBackTarget(browserPath);

    logger.info("[Telegram BackButton] visibility sync", {
      browserPath,
      canShow,
      stackLength: navigationStore.getState().stack.length,
      nativeVisible: backButton.isVisible,
    });

    if (canShow) {
      // Ensure tg.ready() has been called at least once.
      // Some Telegram features don't work until ready() is called.
      if (!readyCalledRef.current && tg?.ready) {
        tg.ready();
        readyCalledRef.current = true;
      }
      backButton.show();
    } else {
      backButton.hide();
    }
  }, [tg]); // NOTE: intentionally NO isInTelegramContext here

  // ─── Back Handler ───────────────────────────────────────────────

  // We store the handler in a ref so the click/popstate listeners
  // always call the latest version without needing to re-register.
  const backHandlerRef = useRef<() => void>(() => {});

  backHandlerRef.current = () => {
    if (isHandlingBackRef.current) return;
    isHandlingBackRef.current = true;

    const currentPath = currentFullPath();
    const targetPath = resolveBackTarget(currentPath);

    if (targetPath && targetPath !== currentPath) {
      logger.info(`[Telegram BackButton] Navigating back to "${targetPath}" from "${currentPath}".`);
      router.push(targetPath);
    } else {
      logger.info("[Telegram BackButton] No app-level back target, closing Telegram WebApp.");
      tg?.close?.();
    }

    // Reset the guard after a short delay to allow navigation to complete.
    // This prevents double-handling if both BackButton.onClick and popstate fire.
    setTimeout(() => {
      isHandlingBackRef.current = false;
    }, 300);
  };

  // ─── Reset handling guard on route change ───────────────────────

  useEffect(() => {
    if (previousRouteRef.current !== currentRoute) {
      previousRouteRef.current = currentRoute;
      isHandlingBackRef.current = false;
    }
  }, [currentRoute]);

  // ─── Sync visibility on route change ────────────────────────────

  useEffect(() => {
    syncButtonVisibility();
  }, [currentRoute, syncButtonVisibility]);

  // ─── Mount Telegram BackButton click handler + store subscription ─

  useEffect(() => {
    const backButton = tg?.BackButton ?? (typeof window !== "undefined" ? window.Telegram?.WebApp?.BackButton : undefined);
    if (!backButton || typeof window === "undefined") return;

    const stableClick = () => backHandlerRef.current();

    backButton.offClick(stableClick); // Remove any stale handler first
    backButton.onClick(stableClick);

    // Subscribe to navigation store changes so visibility updates
    // whenever TelegramNavigationTracker pushes a new route.
    const unsubscribe = navigationStore.subscribe(syncButtonVisibility);

    // Initial sync
    syncButtonVisibility();

    return () => {
      backButton.offClick(stableClick);
      unsubscribe();
    };
  }, [tg, syncButtonVisibility]);

  // ─── Handle browser popstate (system back/forward navigation) ────
  //
  // When the user presses the Android system back button or uses browser
  // back/forward, popstate fires AFTER the browser has navigated.
  //
  // In Telegram Mini Apps, the system back button is handled by Telegram's
  // client: when BackButton.isVisible is true, pressing system back triggers
  // BackButton.onClick instead of closing the app. So the main fix for the
  // "system back closes the app" issue is ensuring BackButton.show() is called.
  //
  // This popstate handler is a safety net that re-syncs our state after
  // browser-initiated navigation. It does NOT try to intercept or guard
  // history entries — that approach leads to duplicate history entries and
  // the "two presses needed" bug.
  //
  // WHY NO ensureHistoryGuard / pushState guard?
  // ─────────────────────────────────────────────
  // The guard approach pushed an extra history entry per route so the browser
  // had something to pop before closing. But popstate gives you the state
  // of the NEW entry (where you landed), not the OLD entry (what you left).
  // So checking __isExtra on popstate requires TWO system back presses:
  //
  //   Press 1: pop __isExtra → land on __backGuard (same URL, no action)
  //   Press 2: pop __backGuard → land on previous __isExtra (triggers handler)
  //
  // That's worse UX than the original bug. Instead, we rely on Telegram's
  // built-in interception: when BackButton.isVisible is true, the Telegram
  // client fires BackButton.onClick on system back instead of closing.

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      // After browser back/forward, reset our handling guard and sync visibility.
      // The navigationStore will be updated by TelegramNavigationTracker's
      // popstate handler (which updates previousUrlRef to prevent re-pushing).
      isHandlingBackRef.current = false;
      previousRouteRef.current = currentFullPath();
      syncButtonVisibility();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [syncButtonVisibility]);
}
