"use client";

// /app/franchize/[slug]/rentals-analytics/AnalyticsUiSwitch.tsx
//
// Client-side feature-flag resolver for the analytics v2 rollout.
//
// Resolution order:
//   1. `forceV2` prop (from ?ui=v2) → use v2
//   2. `forceV1` prop (from ?ui=v1) → use v1
//   3. localStorage.analytics_ui_v2 === "true" → use v2
//   4. Default → v1
//
// Also renders a small "v1/v2" toggle in the corner so operators can flip
// between them at runtime. The toggle writes to localStorage AND pushes
// the matching ?ui= query param so the choice survives refresh + share.

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface AnalyticsUiSwitchProps {
  forceV2: boolean;
  forceV1: boolean;
  children: (props: { useV2: boolean }) => ReactNode;
}

const LS_KEY = "analytics_ui_v2";

export function AnalyticsUiSwitch({ forceV2, forceV1, children }: AnalyticsUiSwitchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [storedPref, setStoredPref] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // Read localStorage on mount (client-only).
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      setStoredPref(v === "true");
    } catch {
      // localStorage unavailable — silently fall back to v1
    }
    setHydrated(true);
  }, []);

  const useV2 = forceV2 || (!forceV1 && storedPref);

  const toggleUi = (nextV2: boolean) => {
    try {
      localStorage.setItem(LS_KEY, nextV2 ? "true" : "false");
    } catch {
      // ignore
    }
    // Update the URL so the choice is shareable + survives refresh.
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextV2) params.set("ui", "v2");
    else params.set("ui", "v1");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      {/* UI version toggle — bottom-right floating pill, doesn't block content */}
      {hydrated && (
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
            v2
          </button>
        </div>
      )}

      {children({ useV2 })}
    </>
  );
}
