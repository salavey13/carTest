"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { navigationStore } from "@/stores/navigationStore";

export function TelegramNavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return;

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    navigationStore.push(currentUrl);

    previousUrlRef.current = currentUrl;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentUrl = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const handleHashChange = () => {
      const nextUrl = currentUrl();
      if (previousUrlRef.current === nextUrl) return;
      previousUrlRef.current = nextUrl;
      navigationStore.push(nextUrl);
    };

    const handlePopState = () => {
      // Back/forward traversal is popped by useTelegramBackButton. The tracker only
      // refreshes its ref here so it does not re-push the route that was just popped.
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
