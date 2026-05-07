"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";

const MAX_INTERNAL_HISTORY = 20;

function fallbackPathFor(pathname: string) {
  const franchizeMatch = pathname.match(/^\/franchize\/([^/]+)(?:\/.*)?$/);
  if (franchizeMatch && pathname !== `/franchize/${franchizeMatch[1]}`) {
    return `/franchize/${franchizeMatch[1]}`;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 1) {
    return `/${segments.slice(0, -1).join("/")}`;
  }

  return "/";
}

export function useTelegramBackButton() {
  const { tg, isInTelegramContext } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const internalHistoryRef = useRef<string[]>([]);

  useEffect(() => {
    if (!pathname) return;

    const currentPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : pathname;
    const stack = internalHistoryRef.current;
    const latest = stack[stack.length - 1];

    if (latest !== currentPath) {
      stack.push(currentPath);
      if (stack.length > MAX_INTERNAL_HISTORY) {
        stack.splice(0, stack.length - MAX_INTERNAL_HISTORY);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!isInTelegramContext || !tg?.BackButton) {
      return;
    }

    const backButton = tg.BackButton;

    const handleBackClick = () => {
      const stack = internalHistoryRef.current;
      const currentPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : pathname;

      while (stack.length > 0 && stack[stack.length - 1] === currentPath) {
        stack.pop();
      }

      const previousPath = stack.pop();
      const targetPath = previousPath || fallbackPathFor(pathname || "/");

      logger.info(
        `[Telegram BackButton] Back button clicked. Navigating with SPA push to "${targetPath}" instead of native history back.`,
      );

      router.push(targetPath);
    };

    if (pathname !== "/") {
      if (!backButton.isVisible) {
        logger.debug(`[Telegram BackButton] Path is "${pathname}". Showing button.`);
        backButton.show();
      }
      backButton.onClick(handleBackClick);
    } else if (backButton.isVisible) {
      logger.debug('[Telegram BackButton] Path is "/". Hiding button.');
      backButton.hide();
    }

    return () => {
      if (isInTelegramContext && tg?.BackButton) {
        logger.debug(`[Telegram BackButton] Cleanup: removing onClick handler for path "${pathname}".`);
        tg.BackButton.offClick(handleBackClick);
      }
    };
  }, [pathname, router, tg, isInTelegramContext]);
}
