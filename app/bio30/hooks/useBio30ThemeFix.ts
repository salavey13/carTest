"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const useBio30ThemeFix = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/bio30")) return;

    const root = document.documentElement;
    root.style.setProperty("--background", "hsl(0 0% 6%)");
    root.style.setProperty("--foreground", "hsl(0 0% 100%)");
    root.style.setProperty("--card", "hsl(0 0% 10%)");
    root.style.setProperty("--card-foreground", "hsl(0 0% 100%)");
    root.style.setProperty("--muted", "hsl(0 0% 15%)");
    root.style.setProperty("--muted-foreground", "hsl(0 0% 80%)");
    root.style.setProperty("--border", "hsl(0 0% 20%)");
    document.body.style.overflowX = "hidden";
    document.body.style.margin = "0";
    document.body.style.padding = "0";

    return () => {
      root.style.removeProperty("--background");
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--card");
      root.style.removeProperty("--card-foreground");
      root.style.removeProperty("--muted");
      root.style.removeProperty("--muted-foreground");
      root.style.removeProperty("--border");
      document.body.style.overflowX = "";
      document.body.style.margin = "";
      document.body.style.padding = "";
    };
  }, [pathname]);
};