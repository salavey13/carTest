"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { navigationStore } from "@/stores/navigationStore";

const TELEGRAM_NAV_MARKER = "__tg_nav__";

export function TelegramNavigationTracker() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return;

    navigationStore.push(pathname);

    const previousPath = previousPathRef.current;
    if (previousPath && previousPath !== pathname) {
      window.history.pushState({ [TELEGRAM_NAV_MARKER]: true, path: pathname }, "", pathname);
    }

    previousPathRef.current = pathname;
  }, [pathname]);

  return null;
}
