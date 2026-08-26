"use client";

// AchievementToastSync
// ──────────────────────────────────────────────────────────────────────────
// Mounted once in the franchize [slug] layout. Polls the user's franchize
// profile on mount and toasts any achievements unlocked since the user last
// saw them (localStorage set of "seen" ids). This covers achievements granted
// OUTSIDE the web app (rental closures, /shift streaks, bot flows) — the user
// gets a toast the next time they open the crew app.
//
// AchievementExplorer (page-level) toasts exploration badges immediately;
// this sync marks them as seen so they are not toasted twice.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { getFranchizeProfileBySlugAction } from "@/app/franchize/profile-actions";

const SEEN_STORAGE_PREFIX = "franchize-ach-seen:";

export function AchievementToastSync({ slug }: { slug: string }) {
  const { dbUser } = useAppContext();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !dbUser?.user_id || !slug) return;
    firedRef.current = true;

    let cancelled = false;
    const delay = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await getFranchizeProfileBySlugAction({ slug, userId: dbUser.user_id! });
          if (cancelled || !result.success || !result.data?.achievements) return;

          const storageKey = `${SEEN_STORAGE_PREFIX}${slug}`;
          let seen: string[] = [];
          try {
            seen = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
            if (!Array.isArray(seen)) seen = [];
          } catch {
            seen = [];
          }

          const unlocked = result.data.achievements;
          const unlockedIds = Object.keys(unlocked);
          const fresh = unlockedIds.filter((id) => !seen.includes(id));

          // Persist the full current set (also forgets stale ids).
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(unlockedIds));
          } catch {
            /* ignore quota errors */
          }

          if (fresh.length === 0) return;

          const catalogById = new Map((result.catalog ?? []).map((a) => [a.id, a]));
          // Cap at 3 toasts to avoid spam after a long absence.
          for (const id of fresh.slice(0, 3)) {
            const def = catalogById.get(id);
            const unlockedAt = unlocked[id]?.unlockedAt;
            // Only toast RECENT unlocks (14 days) — ancient badges from before
            // this feature are not worth announcing.
            const ageMs = unlockedAt ? Date.now() - Date.parse(unlockedAt) : Number.NaN;
            if (Number.isFinite(ageMs) && ageMs > 14 * 24 * 60 * 60 * 1000) continue;
            toast.success(`🏆 Достижение: ${def?.title ?? id}`, {
              description: def?.description ?? "Новое достижение разблокировано!",
              duration: 6000,
              icon: <Trophy className="h-4 w-4 text-amber-500" />,
            });
          }
        } catch {
          // silent — toast sync must never break navigation
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(delay);
    };
  }, [dbUser?.user_id, slug]);

  return null;
}
