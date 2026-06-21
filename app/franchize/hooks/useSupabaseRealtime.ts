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
}

export interface RealtimeState {
  status: RealtimeConnectionStatus;
  error: Error | null;
}

export function useSupabaseRealtime(options: UseSupabaseRealtimeOptions) {
  const { tableName, filter, onData, onError } = options;
  const [state, setState] = useState<RealtimeState>({
    status: "connecting",
    error: null,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const maxBackoff = 30000; // 30 seconds

  const calculateBackoff = (attempt: number): number => {
    const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s...
    return Math.min(backoff, maxBackoff);
  };

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabaseAnon.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    disconnect();

    setState({ status: "connecting", error: null });

    const channelName = `realtime-${tableName}-${filter || "all"}`;
    const channel = supabaseAnon.channel(channelName, {
      config: {
        presence: { key: "" },
      },
    });

    // Build subscription config
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
        retryCountRef.current = 0;
        onData?.({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setState({ status: "connected", error: null });
          retryCountRef.current = 0;
        } else if (status === "SUBSCRIPTION_FAILED" || status === "TIMED_OUT") {
          const error = new Error(`Subscription ${status}`);
          setState({ status: "connecting", error });
          onError?.(error);

          // Auto-reconnect with backoff
          if (retryCountRef.current < maxRetries) {
            const backoff = calculateBackoff(retryCountRef.current);
            setTimeout(() => {
              retryCountRef.current++;
              subscribe();
            }, backoff);
          } else {
            setState({ status: "disconnected", error });
          }
        }
      });

    channelRef.current = channel;
  }, [tableName, filter, onData, onError, disconnect]);

  useEffect(() => {
    subscribe();

    // Handle online event
    const handleOnline = () => {
      if (state.status === "disconnected") {
        retryCountRef.current = 0;
        subscribe();
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      disconnect();
    };
  }, [subscribe, disconnect, state.status]);

  return { state, disconnect, reconnect: subscribe };
}
