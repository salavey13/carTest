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

    const handleHashOrSearchChange = () => {
      const nextUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (previousUrlRef.current === nextUrl) return;
      previousUrlRef.current = nextUrl;
      navigationStore.push(nextUrl);
    };

    window.addEventListener("hashchange", handleHashOrSearchChange);
    window.addEventListener("popstate", handleHashOrSearchChange);

    return () => {
      window.removeEventListener("hashchange", handleHashOrSearchChange);
      window.removeEventListener("popstate", handleHashOrSearchChange);
    };
  }, []);

  return null;
}
