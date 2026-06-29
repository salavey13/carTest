"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseAnon } from "@/hooks/supabase";

export type RealtimeConnectionStatus = "connected" | "connecting" | "disconnected";

export interface UseSupabaseRealtimeOptions {
  tableName: string;
  filter?: string; // Supabase filter syntax, e.g., "crew_id=eq.123"
  onData?: (payload: { eventType: string; new: any; old: any }) => void;
  onError?: (error: Error) => void;
  /**
   * When false, the hook is a complete no-op — no channel is created,
   * no WebSocket is opened, no timers are scheduled.
   *
   * Use this to gate realtime on authentication state so unauthenticated
   * visitors don't leak channels / memory. The rentals-analytics page
   * was burning 7GB of browser memory because even the password-entry
   * screen (not logged in) had two active subscriptions churning in an
   * infinite resubscribe loop.
   *
   * Default: true (backward compatible).
   */
  enabled?: boolean;
}

export interface RealtimeState {
  status: RealtimeConnectionStatus;
  error: Error | null;
}

export function useSupabaseRealtime(options: UseSupabaseRealtimeOptions) {
  const { tableName, filter, onData, onError, enabled = true } = options;
  const [state, setState] = useState<RealtimeState>({
    status: "connecting",
    error: null,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 10;
  const maxBackoff = 30000;
  const isConnectedRef = useRef(false);

  // ── Stabilize callbacks via refs ─────────────────────────────────────────
  // Store onData / onError / enabled in refs so the subscribe() function
  // doesn't change identity when the parent re-renders with new inline
  // closures. Without this, EVERY parent render creates a new onData
  // function → new subscribe useCallback → useEffect cleanup+resubscribe
  // → infinite loop that leaks channels and gobbles memory (7GB reported
  // on rentals-analytics, even when not logged in).
  //
  // The pattern: the ref is updated on every render (cheap), but
  // subscribe() reads .current at call-time (always latest) — so the
  // callback identity stays stable and subscribe's deps are minimal.
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const enabledRef = useRef(enabled);
  onDataRef.current = onData;
  onErrorRef.current = onError;
  enabledRef.current = enabled;

  // ── Retry timer ref ──────────────────────────────────────────────────────
  // Store the setTimeout handle so we can cancel pending retries during
  // cleanup. Previously, each TIMED_OUT/CLOSED callback scheduled a
  // setTimeout(() => subscribe(), backoff) that was never cancelled.
  // If the component unmounted or resubscribed, the orphaned timer
  // still fired and created a new channel that nobody tracked.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculateBackoff = (attempt: number): number => {
    const backoff = Math.pow(2, attempt) * 1000;
    return Math.min(backoff, maxBackoff);
  };

  const disconnect = useCallback(() => {
    // Cancel any pending retry — otherwise the timer fires after
    // unmount and creates a channel that nobody cleans up.
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (channelRef.current) {
      supabaseAnon.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // ── subscribe() ──────────────────────────────────────────────────────────
  // NOTE: onData / onError are intentionally NOT in the dependency array.
  // They are accessed via refs (onDataRef.current / onErrorRef.current)
  // inside the callbacks, so subscribe() always calls the latest version
  // without changing its own identity.
  const subscribe = useCallback(() => {
    // Bail out if the hook is disabled (e.g. user not authenticated).
    // This prevents unauthenticated visitors from opening WebSockets.
    if (!enabledRef.current) {
      setState({ status: "disconnected", error: null });
      return;
    }

    disconnect();

    setState({ status: "connecting", error: null });
    isConnectedRef.current = false;

    const channelName = `realtime-${tableName}-${filter || "all"}`;
    const channel = supabaseAnon.channel(channelName, {
      config: {
        presence: { key: "" },
      },
    });

    const subscriptionConfig: any = {
      event: "*",
      schema: "public",
      table: tableName,
    };

    if (filter) {
      subscriptionConfig.filter = filter;
    }

    channel
      .on("postgres_changes", subscriptionConfig, (payload) => {
        setState({ status: "connected", error: null });
        isConnectedRef.current = true;
        retryCountRef.current = 0;
        // Call via ref — always uses the latest callback without
        // destabilising subscribe()'s identity.
        onDataRef.current?.({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setState({ status: "connected", error: null });
          isConnectedRef.current = true;
          retryCountRef.current = 0;
        } else if (status === "SUBSCRIPTION_FAILED" || status === "TIMED_OUT" || status === "CLOSED") {
          isConnectedRef.current = false;
          const error = new Error(`Subscription ${status}`);
          setState({ status: "connecting", error });
          onErrorRef.current?.(error);

          // Auto-reconnect with backoff. The timer is tracked in
          // retryTimerRef so disconnect() can cancel it.
          const backoff = calculateBackoff(retryCountRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            retryCountRef.current++;
            subscribe();
          }, backoff);
        }
      });

    channelRef.current = channel;
  }, [tableName, filter, disconnect]);

  useEffect(() => {
    if (!enabled) {
      // When disabled, ensure we're in a clean disconnected state.
      setState({ status: "disconnected", error: null });
      return;
    }

    subscribe();

    const handleOnline = () => {
      if (!isConnectedRef.current) {
        retryCountRef.current = 0;
        subscribe();
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      disconnect();
    };
    // enabled is intentionally in deps so the effect re-runs when auth
    // state changes (e.g. user enters password → enabled flips true).
    // subscribe and disconnect are stable (tableName/filter don't change
    // during the component's life), so they don't cause re-runs.
  }, [subscribe, disconnect, enabled]);

  return { state, disconnect, reconnect: subscribe };
}
