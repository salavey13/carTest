"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Client component that initializes the theme for first-time visitors.
 * Only sets theme if no user preference exists (resolvedTheme is undefined).
 */
export function ThemeInitializer({ defaultTheme }: { defaultTheme: "dark" | "light" }) {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    // Only set theme if user hasn't explicitly chosen one (first visit)
    if (resolvedTheme === undefined) {
      setTheme(defaultTheme);
    }
  }, [resolvedTheme, setTheme, defaultTheme]);

  return null;
}
