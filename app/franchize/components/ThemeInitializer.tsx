"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppContext } from "@/contexts/AppContext";

/**
 * Client component that initializes the theme for first-time visitors.
 * Priority: 1) Supabase user preference (theme_mode in metadata)
 *           2) next-themes stored preference (localStorage)
 *           3) Crew default theme
 *
 * Also syncs Supabase-stored theme on mount when next-themes has no
 * localStorage value (e.g., Telegram WebView storage cleared).
 */
export function ThemeInitializer({ defaultTheme }: { defaultTheme: "dark" | "light" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { dbUser } = useAppContext();

  useEffect(() => {
    // Step 1: If next-themes already has a resolved theme, use it (fast path)
    if (resolvedTheme !== undefined) return;

    // Step 2: No resolved theme yet — check Supabase for stored preference
    if (dbUser?.user_id) {
      fetch(`/api/franchize/user-theme?userId=${dbUser.user_id}`)
        .then(r => r.json())
        .then(data => {
          if (data.themeMode) {
            setTheme(data.themeMode);
          } else {
            setTheme(defaultTheme);
          }
        })
        .catch(() => {
          // Fallback to default on network error
          setTheme(defaultTheme);
        });
    } else {
      // No user — use crew default
      setTheme(defaultTheme);
    }
  }, [resolvedTheme, setTheme, defaultTheme, dbUser?.user_id]);

  return null;
}
