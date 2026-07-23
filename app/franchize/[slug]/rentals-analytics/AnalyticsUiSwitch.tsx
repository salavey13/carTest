"use client";

// /app/franchize/[slug]/rentals-analytics/AnalyticsUiSwitch.tsx
//
// Client-side feature-flag resolver for the analytics v2 rollout.
//
// v2 IS NOW THE DEFAULT. v1 (RentalsAnalyticsClient) remains accessible
// via `?ui=v1` query param or `localStorage.analytics_ui_v2 = "false"`,
// but operators land on v2 by default.
//
// CRITICAL: this component receives `v1` and `v2` as ReactNode props (NOT a
// render-prop function). Next.js App Router cannot serialize function props
// from a Server Component to a Client Component — using `children: (props) => ReactNode`
// causes a runtime "Server Components render" error.
//
// Resolution order:
//   1. `forceV2` prop (from ?ui=v2) → render v2
//   2. `forceV1` prop (from ?ui=v1) → render v1 (escape hatch)
//   3. localStorage.analytics_ui_v2 === "false" → render v1 (sticky opt-out)
//   4. Default → v2
//
// Renders a small "v1/v2" toggle in the corner so operators can flip between
// them at runtime. The toggle writes to localStorage AND pushes the matching
// ?ui= query param so the choice survives refresh + share.

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface AnalyticsUiSwitchProps {
  forceV2: boolean;
  forceV1: boolean;
  /** The v1 client tree (RentalsAnalyticsClient). MUST be passed as a stable
   *  ReactNode from the server component — function-props are not serializable. */
  v1: ReactNode;
  /** The v2 client tree (AnalyticsClientV2). Same constraint as v1. */
  v2: ReactNode;
}

const LS_KEY = "analytics_ui_v2";

export function AnalyticsUiSwitch({ forceV2, forceV1, v1, v2 }: AnalyticsUiSwitchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // storedPref: null = not yet read from localStorage (treat as default = v2)
  //              "true" = user explicitly chose v2
  //              "false" = user explicitly chose v1 (sticky opt-out)
  const [storedPref, setStoredPref] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read localStorage on mount (client-only — NEVER during SSR).
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      setStoredPref(v); // "true" | "false" | null
    } catch {
      setStoredPref(null);
    }
    setHydrated(true);
  }, []);

  // v2 is default. forceV1 or storedPref === "false" opts out.
  const useV2 = forceV2 || (!forceV1 && storedPref !== "false");

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
      {/* Render the chosen client tree. Both v1 and v2 are ReactNodes
          pre-built by the server — no function calls here, just node
          substitution. */}
      {useV2 ? v2 : v1}

      {/* UI version toggle — bottom-right floating pill.
          Gated by `hydrated` to avoid SSR hydration mismatch. */}
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
            v2 (default)
          </button>
        </div>
      )}
    </>
  );
}
