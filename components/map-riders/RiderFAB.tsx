// /components/map-riders/RiderFAB.tsx
// Floating Action Button — primary action for start/stop sharing.
// Transforms between gold "Start" and red pulsing "Stop".

"use client";

import { useMapRiders } from "@/hooks/useMapRidersContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useSessionManager } from "@/app/franchize/hooks/useSessionManager";

export function RiderFAB() {
  const { state } = useMapRiders();
  const { isSubmitting, toggleSession } = useSessionManager();

  const isRecording = state.shareEnabled;

  return (
    <button
      type="button"
      onClick={toggleSession}
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
