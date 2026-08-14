"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type DisplayMode = "rent" | "sale" | "service";

interface DisplayModeContextValue {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  isTransitioning: boolean;
}

const DisplayModeContext = createContext<DisplayModeContextValue>({
  displayMode: "rent",
  setDisplayMode: () => {},
  isTransitioning: false,
});

export function DisplayModeProvider({
  children,
  initialMode = "rent",
  lockMode,
}: {
  children: ReactNode;
  initialMode?: DisplayMode;
  lockMode?: DisplayMode;
}) {
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(lockMode ?? initialMode);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // On mount, read the actual mode from the URL (handles deep-links / refreshes
  // where the server component doesn't pass searchParams down).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (lockMode) {
      setDisplayModeState(lockMode);
      if (params.has("mode")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("mode");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      return;
    }
    const urlMode = params.get("mode");
    if (urlMode === "sale" || urlMode === "rent" || urlMode === "service") {
      setDisplayModeState(urlMode);
    }
  }, [lockMode]);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    if (lockMode) return;
    if (mode === displayMode) return; // Skip if same mode

    setIsTransitioning(true);
    setDisplayModeState(mode);

    // Update URL without triggering Next.js server re-render
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (mode === "rent") {
        url.searchParams.delete("mode");
      } else {
        url.searchParams.set("mode", mode);
      }
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    // Clear transition flag after animation completes
    setTimeout(() => setIsTransitioning(false), 300);
  }, [displayMode, lockMode]);

  return (
    <DisplayModeContext.Provider value={{ displayMode, setDisplayMode, isTransitioning }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode() {
  return useContext(DisplayModeContext);
}
