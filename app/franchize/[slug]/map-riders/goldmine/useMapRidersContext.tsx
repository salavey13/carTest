// /hooks/useMapRidersContext.tsx
// Centralized state provider — replaces the 20+ useState in MapRidersClient

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAppContext } from "@/contexts/AppContext";
import {
  mapRidersReducer,
  initialMapRidersState,
  type MapRidersState,
  type MapRidersAction,
  type SnapshotData,
  type SessionDetail,
} from "@/lib/map-riders-reducer";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

interface MapRidersContextValue {
  state: MapRidersState;
  dispatch: React.Dispatch<MapRidersAction>;
  crewSlug: string;
  crew: FranchizeCrewVM;
  // Convenience actions
  fetchSnapshot: () => Promise<void>;
  fetchSessionDetail: (sessionId: string) => Promise<void>;
}

const MapRidersContext = createContext<MapRidersContextValue | null>(null);

export function useMapRiders() {
  const ctx = useContext(MapRidersContext);
  if (!ctx) throw new Error("useMapRiders must be used within MapRidersProvider");
  return ctx;
}

export function MapRidersProvider({
  children,
  crew,
  slug,
}: {
  children: React.ReactNode;
  crew: FranchizeCrewVM;
  slug: string;
}) {
  const { dbUser } = useAppContext();
  const crewSlug = crew.slug || slug;
  const selfUserId = dbUser?.user_id;
  const [state, dispatch] = useReducer(mapRidersReducer, initialMapRidersState);

  // ── Snapshot fetch (split into overview only) ──
  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/map-riders/overview?slug=${encodeURIComponent(crewSlug)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load overview");
      dispatch({ type: "snapshot/loaded", payload: json.data as SnapshotData, selfUserId });
    } catch (err) {
      dispatch({ type: "error", payload: err instanceof Error ? err.message : "Load failed" });
    }
  }, [crewSlug, selfUserId]);

  // ── Session detail fetch ──
  const fetchSessionDetail = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/map-riders/sessions/${sessionId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load session");
      dispatch({ type: "session/detail-loaded", payload: json.data as SessionDetail });
    } catch (err) {
      dispatch({ type: "error", payload: err instanceof Error ? err.message : "Session load failed" });
    }
  }, []);

  // ── Initial load ──
  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // ── Broadcast subscription (replaces postgres_changes on sessions/meetups) ──
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`map-riders:${crewSlug}`)
      .on("broadcast", { event: "rider:move" }, ({ payload }) => {
        dispatch({
          type: "rider/moved",
          payload: payload as {
            user_id: string;
            lat: number;
            lng: number;
            speed_kmh: number;
            heading: number | null;
            updated_at: string;
          },
          selfUserId,
        });
      })
      .on("broadcast", { event: "rider:stop" }, ({ payload }) => {
        dispatch({ type: "rider/evicted", payload: { userId: (payload as any).user_id } });
      })
      .on("broadcast", { event: "meetup:created" }, ({ payload }) => {
        dispatch({ type: "meetup/created", payload: payload as any });
      })
      .on("broadcast", { event: "session:ended" }, () => {
        // Session ended — refresh stats
        fetchSnapshot();
      })
      // Fallback: listen to live_locations changes only (not sessions/meetups)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_locations", filter: `crew_slug=eq.${crewSlug}` },
        () => {
          // Delta: only re-fetch overview on live_locations change (throttled)
          fetchSnapshot();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewSlug, selfUserId, fetchSnapshot]);

  // ── Eviction timer (runs every 5s) ──
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "eviction/tick" });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, crewSlug, crew, fetchSnapshot, fetchSessionDetail }),
    [state, dispatch, crewSlug, crew, fetchSnapshot, fetchSessionDetail],
  );

  return <MapRidersContext.Provider value={value}>{children}</MapRidersContext.Provider>;
}
