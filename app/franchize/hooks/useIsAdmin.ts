"use client";

import { useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";

const ADMIN_ROLES = new Set(["admin", "vpradmin"]);

export function useIsAdmin(): boolean {
  const { isAdmin, dbUser } = useAppContext();

  return useMemo(() => {
    const hasGlobalAdmin = typeof isAdmin === "function" ? isAdmin() : false;
    if (hasGlobalAdmin) return true;

    const dbRole = String(dbUser?.role || "").toLowerCase();
    if (ADMIN_ROLES.has(dbRole)) return true;

    const dbStatus = String(dbUser?.status || "").toLowerCase();
    return dbStatus === "admin";
  }, [isAdmin, dbUser?.role, dbUser?.status]);
}
