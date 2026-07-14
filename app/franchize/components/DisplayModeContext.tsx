"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type DisplayMode = "rent" | "sale";

interface DisplayModeContextValue {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
}

const DisplayModeContext = createContext<DisplayModeContextValue>({
  displayMode: "rent",
  setDisplayMode: () => {},
});

export function DisplayModeProvider({
  children,
  initialMode = "rent",
}: {
  children: ReactNode;
  initialMode?: DisplayMode;
}) {
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(initialMode);

  // On mount, read the actual mode from the URL (handles deep-links / refreshes
  // where the server component doesn't pass searchParams down).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode");
    if (urlMode === "sale" || urlMode === "rent") {
      setDisplayModeState(urlMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
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
  }, []);

  return (
    <DisplayModeContext.Provider value={{ displayMode, setDisplayMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode() {
  return useContext(DisplayModeContext);
}
