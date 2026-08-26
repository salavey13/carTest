"use client";

// AchievementExplorer
// ──────────────────────────────────────────────────────────────────────────
// Mounts on crew tool pages (analytics / leads / todos / salary / dashboard /
// map-riders). On mount, grants the matching "explorer_*" achievement to crew
// members (server gates access) and toasts the newly unlocked badges.
//
// One call per page per session (sessionStorage guard) — re-visiting the page
// in the same session does not re-fire the server action.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { grantFranchizeExplorationAchievementAction } from "@/app/franchize/profile-actions";

export function AchievementExplorer({
  slug,
  achievementId,
}: {
  slug: string;
  achievementId: "explorer_analytics" | "explorer_leads" | "explorer_todos" | "explorer_salary" | "explorer_dashboard" | "explorer_map_riders";
}) {
  const { dbUser } = useAppContext();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !dbUser?.user_id || !slug) return;
    const sessionKey = `franchize-ach-explorer:${slug}:${achievementId}`;
    try {
      if (window.sessionStorage.getItem(sessionKey) === "1") {
        firedRef.current = true;
        return;
      }
      window.sessionStorage.setItem(sessionKey, "1");
    } catch {
      // sessionStorage unavailable — still fire once per mount lifetime
    }
    firedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const result = await grantFranchizeExplorationAchievementAction({
          userId: dbUser.user_id!,
          slug,
          achievementId,
          sourceRoute: typeof window !== "undefined" ? window.location.pathname : undefined,
        });
        if (cancelled || !result.success || !result.granted || result.granted.length === 0) return;
        // Mark as seen so AchievementToastSync doesn't toast them again.
        try {
          const storageKey = `franchize-ach-seen:${slug}`;
          const seen = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
          const next = Array.isArray(seen)
            ? Array.from(new Set([...seen, ...result.granted.map((b) => b.id)]))
            : result.granted.map((b) => b.id);
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        for (const badge of result.granted) {
          toast.success(`🏆 Достижение: ${badge.title}`, {
            description: badge.description,
            duration: 6000,
            icon: <Trophy className="h-4 w-4 text-amber-500" />,
          });
        }
      } catch {
        // achievements are a bonus — never break the page
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dbUser?.user_id, slug, achievementId]);

  return null;
}
