"use client";

import { useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";

const CREW_ADMIN_ROLES = new Set(["owner", "admin", "manager"]);

export function useIsAdmin(): boolean {
  const { isAdmin, dbUser, userCrewInfo } = useAppContext();

  return useMemo(() => {
    const hasGlobalAdmin = typeof isAdmin === "function" ? isAdmin() : false;
    if (hasGlobalAdmin) return true;

    const dbRole = String(dbUser?.role || "").toLowerCase();
    if (dbRole === "admin" || dbRole === "vpradmin") return true;

    const crewRole = String((userCrewInfo as { role?: string } | null)?.role || "").toLowerCase();
    return CREW_ADMIN_ROLES.has(crewRole);
  }, [isAdmin, dbUser?.role, userCrewInfo]);
}
