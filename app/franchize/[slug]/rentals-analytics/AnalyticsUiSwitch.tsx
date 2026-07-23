"use client";

// /app/franchize/[slug]/rentals-analytics/AnalyticsUiSwitch.tsx
//
// Client-side feature-flag resolver for the analytics v2 rollout.
// v2 IS NOW THE DEFAULT.

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface AnalyticsUiSwitchProps {
  forceV2: boolean;
  forceV1: boolean;
  v1: ReactNode;
  v2: ReactNode;
}

const LS_KEY = "analytics_ui_v2";

export function AnalyticsUiSwitch({ forceV2, forceV1, v1, v2 }: AnalyticsUiSwitchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedPrefState = useState<string | null>(null);
  const storedPref = storedPrefState[0];
  const setStoredPref = storedPrefState[1];
  const hydratedState = useState(false);
  const isHydrated = hydratedState[0];
  const setHydrated = hydratedState[1];

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      setStoredPref(v);
    } catch {
      setStoredPref(null);
    }
    setHydrated(true);
  }, []);

  const useV2 = forceV2 || (!forceV1 && storedPref !== "false");

  const toggleUi = (nextV2: boolean) => {
    try {
      localStorage.setItem(LS_KEY, nextV2 ? "true" : "false");
    } catch {
      // ignore
    }
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextV2) params.set("ui", "v2");
    else params.set("ui", "v1");
    router.push("?" + params.toString(), { scroll: false });
  };

  return (
    <>
      {useV2 ? v2 : v1}

      {isHydrated && (
        <div
          className="fixed bottom-4 right-4 z-30 flex items-center gap-1 rounded-full border bg-black/60 px-1 py-1 text-xs backdrop-blur"
          role="group"
          aria-label="Переключатель версии интерфейса"
          style={{ borderColor: "rgba(255,255,255,0.15)" }}
        >
          <span className="px-2 text-white/60">UI</span>
          <button
            type="button"
            onClick={() => toggleUi(false)}
            aria-pressed={!useV2}
            className="rounded-full px-3 py-1 transition focus:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: !useV2 ? "rgba(255,255,255,0.18)" : "transparent",
              color: !useV2 ? "#ffffff" : "rgba(255,255,255,0.55)",
              minHeight: "32px",
            }}
          >
            v1
          </button>
          <button
            type="button"
            onClick={() => toggleUi(true)}
            aria-pressed={useV2}
            className="rounded-full px-3 py-1 transition focus:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: useV2 ? "rgba(34,197,94,0.25)" : "transparent",
              color: useV2 ? "#22c55e" : "rgba(255,255,255,0.55)",
              minHeight: "32px",
            }}
          >
            v2 (default)
          </button>
        </div>
      )}
    </>
  );
}
