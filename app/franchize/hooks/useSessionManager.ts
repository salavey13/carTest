"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { useMapRidersActions, useMapRidersState } from "@/hooks/useMapRidersContext";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";

interface UseSessionManagerOptions {
  startSuccessMessage?: string;
  stopSuccessMessage?: string;
  authErrorMessage?: string;
  refreshOnStart?: boolean;
  refreshOnStop?: boolean;
}

interface SessionManagerResult {
  isSubmitting: boolean;
  canStart: boolean;
  canStop: boolean;
  isRecording: boolean;
  startSession: () => Promise<boolean>;
  stopSession: () => Promise<boolean>;
  toggleSession: () => Promise<boolean>;
}

export function useSessionManager(options: UseSessionManagerOptions = {}): SessionManagerResult {
  const {
    startSuccessMessage = "MapRiders активирован!",
    stopSuccessMessage = "Заезд завершён!",
    authErrorMessage = "Авторизуйся в Telegram/VIP BIKE",
    refreshOnStart = true,
    refreshOnStop = true,
  } = options;
  const { dbUser } = useAppContext();
  const { state } = useMapRidersState();
  const { dispatch, crewSlug, fetchSnapshot } = useMapRidersActions();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startSession = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error(authErrorMessage);
      return false;
    }

    setIsSubmitting(true);
    try {
      const headers = await getMapRidersWriteHeaders();
      const response = await fetch("/api/map-riders/session", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "start",
          userId: dbUser.user_id,
          crewSlug,
          rideName: state.rideName,
          vehicleLabel: state.vehicleLabel,
          rideMode: state.rideMode,
          visibility: state.visibilityMode === "public" ? "all_auth" : "crew",
          privacy: {
            homeBlurEnabled: state.homeBlurEnabled,
            autoExpireMinutes: state.autoExpireMinutes,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Ошибка запуска");

      dispatch({
        type: "share/started",
        payload: {
          sessionId: json.data.id,
          rideName: state.rideName,
          vehicleLabel: state.vehicleLabel,
          rideMode: state.rideMode,
        },
      });
      if (refreshOnStart) await fetchSnapshot();
      toast.success(startSuccessMessage);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка запуска");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    authErrorMessage,
    crewSlug,
    dbUser?.user_id,
    dispatch,
    fetchSnapshot,
    refreshOnStart,
    startSuccessMessage,
    state.autoExpireMinutes,
    state.homeBlurEnabled,
    state.rideMode,
    state.rideName,
    state.vehicleLabel,
    state.visibilityMode,
  ]);

  const stopSession = useCallback(async () => {
    if (!dbUser?.user_id || !state.sessionId) {
      if (!dbUser?.user_id) toast.error(authErrorMessage);
      return false;
    }

    setIsSubmitting(true);
    try {
      const headers = await getMapRidersWriteHeaders();
      const response = await fetch("/api/map-riders/session", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "stop",
          sessionId: state.sessionId,
          userId: dbUser.user_id,
          crewSlug,
          routePoints: [],
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Ошибка остановки");

      dispatch({ type: "share/stopped" });
      if (refreshOnStop) await fetchSnapshot();
      toast.success(stopSuccessMessage);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка остановки");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [authErrorMessage, crewSlug, dbUser?.user_id, dispatch, fetchSnapshot, refreshOnStop, state.sessionId, stopSuccessMessage]);

  const toggleSession = useCallback(() => (state.shareEnabled ? stopSession() : startSession()), [startSession, state.shareEnabled, stopSession]);

  return useMemo(
    () => ({
      isSubmitting,
      canStart: !state.shareEnabled && !isSubmitting,
      canStop: state.shareEnabled && Boolean(state.sessionId) && !isSubmitting,
      isRecording: state.shareEnabled,
      startSession,
      stopSession,
      toggleSession,
    }),
    [dbUser?.user_id, isSubmitting, startSession, state.sessionId, state.shareEnabled, stopSession, toggleSession],
  );
}
