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
 * Also intercepts the Android system back button (popstate) to navigate within
 * the app instead of closing it.
 *
 * Key design decisions:
 * - Does NOT push routes to navigationStore (TelegramNavigationTracker does that)
 * - Uses fallbackPathFor() as a safety net for page refreshes / deep links
 * - Does NOT use isInTelegramContext (which depends on async auth validation)
 *   for the show/hide decision; instead checks for real Telegram runtime
 * - Does NOT create duplicate browser history entries (no markTelegramBackGuard)
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

  // ─── Handle Android system back button (popstate) ───────────────
  //
  // When the user presses the system back button:
  // 1. The browser navigates back in history (popstate fires)
  // 2. We need to intercept this and navigate to the correct in-app target
  //
  // Strategy: Before the browser processes the back navigation,
  // we push a guard state so there's always at least one entry.
  // Then on popstate, we figure out where we came from and
  // navigate to the right in-app target.
  //
  // CRITICAL: We do NOT call router.push() here because the browser
  // has already navigated back. Instead, we detect the popstate and
  // trigger our back handler which uses resolveBackTarget().

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Push a single guard entry so the system back button has something
    // to pop before it would close the web app. We use replaceState to
    // avoid creating duplicate entries (the old markTelegramBackGuard bug).
    const ensureHistoryGuard = () => {
      const currentPath = currentFullPath();
      const state = window.history.state ?? {};
      // Only add guard if we have a back target (don't block closing at root)
      if (hasAppBackTarget(currentPath) && !state.__backGuard) {
        window.history.replaceState(
          { ...state, __backGuard: currentPath },
          "",
          currentPath
        );
        // Push one extra entry so the browser can "pop" without closing
        window.history.pushState(
          { ...state, __backGuard: currentPath, __isExtra: true },
          "",
          currentPath
        );
      }
    };

    const handlePopState = () => {
      // The browser has already gone back. Check if we should intercept.
      const state = window.history.state;
      if (state?.__isExtra) {
        // We popped the extra guard entry — the browser is now at the
        // original entry for this route. Trigger our back handler.
        backHandlerRef.current();
        return;
      }

      // If we popped to a different route (legitimate back navigation
      // via Next.js router), just update our ref and sync visibility.
      previousRouteRef.current = currentFullPath();
      syncButtonVisibility();
    };

    // Set up the guard on mount and route changes
    ensureHistoryGuard();

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [currentRoute, syncButtonVisibility, tg]);
}
