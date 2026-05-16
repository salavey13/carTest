// /hooks/telegram/useTelegramBackButton.ts
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { debugLogger as logger } from "@/lib/debugLogger";
import { navigationStore } from "@/stores/navigationStore";

// ─── Helpers ────────────────────────────────────────────────────────

/** Returns the full current URL from the browser (pathname + search + hash). */
function currentFullPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * Returns the Telegram WebApp object directly from window.Telegram.
 * This is the RELIABLE source — it exists from the very first JS execution
 * inside a Telegram WebView, BEFORE any React rendering or async auth.
 *
 * Do NOT use tg from React context for BackButton operations.
 * The context tg depends on async auth validation and may be null/stale
 * when the hook first mounts.
 */
function getWebApp() {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}

/**
 * Determines a sensible "go back" target based purely on the URL structure.
 * This is the SAFETY NET that makes the BackButton appear even when the
 * navigationStore is empty (page refresh, deep link, etc.).
 *
 * IMPORTANT: This function MUST be kept. Without it, BackButton would never
 * show after a page refresh even when there's a clear logical parent route.
 *
 * Examples:
 *   /franchize/vip-bike       → /vipbikerental
 *   /franchize/vip-bike/cart  → /franchize/vip-bike
 *   /rent/catalog             → /rent
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
 * - Does NOT use `tg` from React context (AppProvider) for BackButton operations.
 *   The context tg depends on async auth validation and may be null/stale when
 *   the hook first mounts. Instead, we use `window.Telegram.WebApp` directly,
 *   which is injected by the Telegram client BEFORE any JavaScript runs.
 * - Does NOT push routes to navigationStore (TelegramNavigationTracker does that)
 * - Uses fallbackPathFor() as a safety net for page refreshes / deep links
 * - Does NOT create duplicate browser history entries (no pushState guards)
 * - Relies on Telegram's built-in system back interception:
 *   when BackButton.isVisible is true, pressing Android system back fires
 *   BackButton.onClick instead of closing the app
 */
export function useTelegramBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHandlingBackRef = useRef(false);
  const previousRouteRef = useRef<string | null>(null);
  const readyCalledRef = useRef(false);
  // Track whether we've successfully set up the BackButton listener,
  // so we can retry if the runtime isn't available yet.
  const isSetupRef = useRef(false);
  // Retry timer for when Telegram runtime isn't available yet
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentRoute = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname || "/"}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  // ─── Visibility Sync ────────────────────────────────────────────
  //
  // IMPORTANT: This callback has NO dependency on `tg` from context.
  // We always read from `window.Telegram.WebApp` directly at call time.
  // This avoids stale closures and timing issues with context initialization.

  const syncButtonVisibility = useCallback(() => {
    const webApp = getWebApp();
    const backButton = webApp?.BackButton;

    logger.info("[Telegram BackButton] syncButtonVisibility", {
      hasWebApp: Boolean(webApp),
      hasBackButton: Boolean(backButton),
      browserPath: typeof window !== "undefined" ? currentFullPath() : "SSR",
      canGoBack: navigationStore.canGoBack(),
      stackLength: navigationStore.getState().stack.length,
      nativeVisible: backButton?.isVisible,
    });

    if (!backButton) return;

    const browserPath = currentFullPath();
    const canShow = hasAppBackTarget(browserPath);

    if (canShow) {
      // Call WebApp.ready() at least once. This is required for some
      // Telegram features to work, including BackButton visibility.
      if (!readyCalledRef.current && webApp?.ready) {
        webApp.ready();
        readyCalledRef.current = true;
      }
      backButton.show();
      logger.info("[Telegram BackButton] → SHOWN", { browserPath });
    } else {
      backButton.hide();
      logger.info("[Telegram BackButton] → HIDDEN", { browserPath });
    }
  }, []); // EMPTY — no dependency on tg context

  // ─── Back Handler ───────────────────────────────────────────────

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
      // Use the global directly — don't depend on context tg
      getWebApp()?.close?.();
    }

    // Reset the guard after a short delay to allow navigation to complete.
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
  //
  // This effect also includes retry logic: if `window.Telegram.WebApp`
  // isn't available yet (e.g., the script hasn't loaded), we retry
  // every 200ms up to 10 times (2 seconds total).

  useEffect(() => {
    const setupBackButton = () => {
      const webApp = getWebApp();
      const backButton = webApp?.BackButton;

      if (!backButton) {
        // Runtime not available yet — retry
        if (!isSetupRef.current) {
          logger.info("[Telegram BackButton] Runtime not available yet, will retry...");
        }
        return false;
      }

      const stableClick = () => backHandlerRef.current();

      backButton.offClick(stableClick); // Remove any stale handler
      backButton.onClick(stableClick);

      logger.info("[Telegram BackButton] Click handler mounted successfully.");
      return true;
    };

    // Try immediately
    if (setupBackButton()) {
      isSetupRef.current = true;
    } else {
      // Retry with exponential backoff
      let attempts = 0;
      const maxAttempts = 10;
      const trySetup = () => {
        attempts++;
        if (setupBackButton()) {
          isSetupRef.current = true;
          return;
        }
        if (attempts < maxAttempts) {
          retryTimerRef.current = setTimeout(trySetup, 200);
        } else {
          logger.warn("[Telegram BackButton] Failed to mount after 10 retries. Giving up.");
        }
      };
      retryTimerRef.current = setTimeout(trySetup, 200);
    }

    // Subscribe to navigation store changes so visibility updates
    // whenever TelegramNavigationTracker pushes a new route.
    const unsubscribe = navigationStore.subscribe(syncButtonVisibility);

    // Initial sync
    syncButtonVisibility();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // Clean up click handler
      const backButton = getWebApp()?.BackButton;
      if (backButton) {
        backButton.offClick(() => backHandlerRef.current());
      }
      unsubscribe();
    };
  }, [syncButtonVisibility]);

  // ─── Handle browser popstate (system back/forward navigation) ────
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
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
