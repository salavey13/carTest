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

  const currentRoute = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname || "/"}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  const syncButtonVisibility = useCallback(() => {
    if (!tg?.BackButton) return;

    if (!isInTelegramContext) {
      tg.BackButton.hide();
      return;
    }

    const browserPath = currentBrowserPath();
    if (hasAppBackTarget(browserPath)) {
      tg.BackButton.show();
      markTelegramBackGuard(browserPath);
      return;
    }

    tg.BackButton.hide();
  }, [isInTelegramContext, tg]);

  backHandlerRef.current = () => {
    const currentPath = currentBrowserPath();
    const targetPath = navigationStore.backTarget(currentPath) ?? fallbackPathFor(currentPath);

    if (targetPath && targetPath !== currentPath) {
      logger.info(`[Telegram BackButton] Navigating back to "${targetPath}" from "${currentPath}".`);
      router.push(targetPath);
      return;
    }

    logger.info("[Telegram BackButton] No app-level back target, closing Telegram WebApp.");
    tg?.close();
  };

  useEffect(() => {
    syncButtonVisibility();
  }, [currentRoute, syncButtonVisibility]);

  useEffect(() => {
    if (!isInTelegramContext || !tg?.BackButton || typeof window === "undefined") return;
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
  }, [isInTelegramContext, tg, syncButtonVisibility]);
}
