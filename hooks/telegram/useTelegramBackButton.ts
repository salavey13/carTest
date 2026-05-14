"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { navigationStore } from "@/stores/navigationStore";

const TELEGRAM_BACK_GUARD_KEY = "__carTestTelegramBackGuardFor";

function currentBrowserPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}

function fallbackPathFor(path: string) {
  const [pathname] = path.split(/[?#]/);
  const franchizeMatch = pathname.match(/^\/franchize\/([^/]+)(?:\/(.*))?$/);

  if (franchizeMatch) {
    const slug = franchizeMatch[1];
    const rest = franchizeMatch[2];

    if (!rest) return "/vipbikerental";
    return `/franchize/${slug}`;
  }

  if (pathname === "/vipbikerental") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 1) return `/${segments.slice(0, -1).join("/")}`;

  return null;
}

function hasAppBackTarget(path: string) {
  return navigationStore.canGoBack() || Boolean(fallbackPathFor(path));
}

function markTelegramBackGuard(path: string) {
  if (typeof window === "undefined") return;

  const historyState = window.history.state ?? {};
  if (historyState?.[TELEGRAM_BACK_GUARD_KEY] === path) return;

  window.history.pushState(
    {
      ...historyState,
      [TELEGRAM_BACK_GUARD_KEY]: path,
    },
    "",
    path,
  );
}

export function useTelegramBackButton() {
  const { tg, isInTelegramContext } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const backHandlerRef = useRef<() => void>(() => {});
  const isHandlingBackRef = useRef(false);
  const previousRouteRef = useRef<string | null>(null);

  const currentRoute = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname || "/"}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  const syncButtonVisibility = useCallback(() => {
    if (!tg?.BackButton) return;

    // The native BackButton is only exposed by Telegram's WebApp runtime.
    // `isInTelegramContext` depends on async auth/initData validation, so do not
    // let a delayed/failed auth pass hide an otherwise available native button.
    const hasTelegramRuntime = Boolean(tg.initData || tg.initDataUnsafe?.user || (typeof window !== "undefined" && window.Telegram?.WebApp));
    if (!hasTelegramRuntime) {
      tg.BackButton.hide();
      return;
    }

    const browserPath = currentBrowserPath();
    const canShow = hasAppBackTarget(browserPath);

    logger.info("[Telegram BackButton] visibility sync", {
      browserPath,
      canShow,
      isInTelegramContext,
      stack: navigationStore.getState().stack,
      nativeVisible: tg.BackButton.isVisible,
    });

    if (canShow) {
      tg.ready?.();
      tg.BackButton.show();
      if (!isHandlingBackRef.current) {
        markTelegramBackGuard(browserPath);
      }
      return;
    }

    tg.BackButton.hide();
  }, [isInTelegramContext, tg]);

  backHandlerRef.current = () => {
    const currentPath = currentBrowserPath();
    isHandlingBackRef.current = true;
    const targetPath = navigationStore.backTarget(currentPath, { emit: false }) ?? fallbackPathFor(currentPath);

    if (targetPath && targetPath !== currentPath) {
      logger.info(`[Telegram BackButton] Navigating back to "${targetPath}" from "${currentPath}".`);
      router.push(targetPath);
      return;
    }

    isHandlingBackRef.current = false;
    logger.info("[Telegram BackButton] No app-level back target, closing Telegram WebApp.");
    tg?.close();
  };

  useEffect(() => {
    if (previousRouteRef.current !== currentRoute) {
      previousRouteRef.current = currentRoute;
      isHandlingBackRef.current = false;
    }
  }, [currentRoute]);

  useEffect(() => {
    syncButtonVisibility();
  }, [currentRoute, syncButtonVisibility]);

  useEffect(() => {
    if (!tg?.BackButton || typeof window === "undefined") return;
    const backButton = tg.BackButton;

    const stableClick = () => backHandlerRef.current();
    const handlePopState = () => {
      backHandlerRef.current();
    };

    const unsubscribe = navigationStore.subscribe(syncButtonVisibility);
    syncButtonVisibility();

    backButton.offClick(stableClick);
    backButton.onClick(stableClick);
    window.addEventListener("popstate", handlePopState);

    return () => {
      unsubscribe();
      backButton.offClick(stableClick);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [tg, syncButtonVisibility]);
}
