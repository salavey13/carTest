// /components/telegram/TelegramNavigationTracker.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { navigationStore } from "@/stores/navigationStore";

/**
 * TelegramNavigationTracker
 *
 * Pushes the current URL into the navigationStore whenever the route changes.
 * This is the SINGLE source of route-pushing — useTelegramBackButton does NOT
 * push routes to avoid duplicates.
 *
 * Also handles hash changes and popstate events to keep the store in sync
 * with the browser's actual navigation state.
 */
export function TelegramNavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);

  // Push route on pathname / searchParams change (Next.js navigation)
  useEffect(() => {
    if (!pathname || typeof window === "undefined") return;

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    // Dedup: don't push the same URL twice (can happen on re-renders)
    if (previousUrlRef.current === currentUrl) return;

    navigationStore.push(currentUrl);
    previousUrlRef.current = currentUrl;
  }, [pathname, searchParams]);

  // Handle hash changes and popstate (browser navigation)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentUrl = () =>
      `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const handleHashChange = () => {
      const nextUrl = currentUrl();
      if (previousUrlRef.current === nextUrl) return;
      previousUrlRef.current = nextUrl;
      navigationStore.push(nextUrl);
    };

    const handlePopState = () => {
      // Back/forward traversal is popped by useTelegramBackButton.
      // The tracker only refreshes its ref here so it does not re-push
      // the route that was just popped.
      previousUrlRef.current = currentUrl();
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}
