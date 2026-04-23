// /components/map-riders/RiderFAB.tsx
// Floating Action Button — primary action for start/stop sharing.
// Transforms between gold "Start" and red pulsing "Stop".

"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useMapRiders } from "@/hooks/useMapRidersContext";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";

export function RiderFAB() {
  const { state, dispatch, crewSlug, fetchSnapshot } = useMapRiders();
  const { dbUser } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Авторизуйся в Telegram/VIP BIKE");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!state.shareEnabled) {
        // START
        const headers = await getMapRidersWriteHeaders();
        const res = await fetch("/api/map-riders/session", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "start",
            userId: dbUser.user_id,
            crewSlug,
            rideName: state.rideName,
            vehicleLabel: state.vehicleLabel,
            rideMode: state.rideMode,
            visibility: "crew",
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error);
        dispatch({
          type: "share/started",
          payload: { sessionId: json.data.id, rideName: state.rideName, vehicleLabel: state.vehicleLabel, rideMode: state.rideMode },
        });
        await fetchSnapshot();
        toast.success("MapRiders активирован!");
      } else {
        // STOP
        const headers = await getMapRidersWriteHeaders();
        const res = await fetch("/api/map-riders/session", {
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
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error);
        dispatch({ type: "share/stopped" });
        await fetchSnapshot();
        toast.success("Заезд завершён!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsSubmitting(false);
    }
  }, [dbUser, state.shareEnabled, state.sessionId, state.rideName, state.vehicleLabel, state.rideMode, crewSlug, dispatch, fetchSnapshot]);

  const isRecording = state.shareEnabled;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isSubmitting}
      className={`
        fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center
        rounded-full shadow-2xl transition-all duration-300
        md:bottom-8 md:right-8
        ${isRecording ? "bg-red-500 animate-pulse shadow-red-500/50" : "bg-amber-400 shadow-amber-400/50 hover:bg-amber-300"}
        ${isSubmitting ? "opacity-50" : ""}
      `}
      aria-label={isRecording ? "Stop sharing location" : "Start sharing location"}
    >
      {isRecording ? (
        <VibeContentRenderer content="::FaPowerOff::" className="text-xl text-white" />
      ) : (
        <VibeContentRenderer content="::FaLocationArrow::" className="text-xl text-black" />
      )}
      {/* Pulse ring when recording */}
      {isRecording && (
        <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75" />
      )}
    </button>
  );
}
