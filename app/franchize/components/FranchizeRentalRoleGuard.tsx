"use client";

import type React from "react";
import { useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";

/**
 * FranchizeRentalRoleGuard
 * ──────────────────────────────────────────────────────────────────────────
 * Hides its children unless the current user has one of the allowed roles
 * for this rental.
 *
 * Roles:
 *   - "owner"     : rental.owner_id === dbUser.user_id
 *   - "renter"    : rental.renterId === dbUser.user_id
 *                   OR rental.renterTelegramChatId === dbUser.user_id
 *   - "operator"  : crew member with role owner/admin/co_owner
 *   - "admin"     : user.metadata.role === "admin" (global admin)
 *   - "subrenter" : dbUser.user_id === subrenterChatId — the partner who
 *                   owns THIS bike (specs.subrenter_chat_id). Treated as a
 *                   mini admin for his own bike's rentals.
 *   - "guest"     : none of the above
 *
 * BUGFIX (goodmorning-fixes): added crewSlug fallback prop.
 * Previously only matched by crewId (UUID), but AppContext's
 * userCrewMemberships sometimes uses a different crewId format than the
 * rental's crew.id. The crewSlug fallback is more reliable because slugs
 * are stable strings. Mirror of FIX 4 from analytics-46 (which was applied
 * to FranchizeRentalLifecycleActions but never made it to the role guard).
 *
 * Also: broadened "operator" to include ALL crew roles (owner/admin/co_owner/
 * member). Previously "member" role was excluded → regular crew members
 * couldn't see checklist or close button. The server-side auth still gates
 * the actual mutations, so showing the UI is safe.
 */
type RentalRole = "owner" | "renter" | "operator" | "admin" | "subrenter" | "guest";

interface FranchizeRentalRoleGuardProps {
  allowedRoles: Array<"owner" | "renter" | "operator" | "admin" | "subrenter" | "guest">;
  ownerId?: string;
  renterId?: string;
  renterTelegramChatId?: string;
  /** Bike's partner owner (specs.subrenter_chat_id) — mini admin for this bike */
  subrenterChatId?: string;
  crewId?: string;
  /** Crew slug — more reliable than crewId for matching (use both when available) */
  crewSlug?: string;
  children: React.ReactNode;
  /** Optional fallback to render when the user's role is not in allowedRoles */
  fallback?: React.ReactNode;
}

export function FranchizeRentalRoleGuard({
  allowedRoles,
  ownerId,
  renterId,
  renterTelegramChatId,
  subrenterChatId,
  crewId,
  crewSlug,
  children,
  fallback = null,
}: FranchizeRentalRoleGuardProps) {
  const { dbUser, userCrewMemberships } = useAppContext();

  const role = useMemo<RentalRole>(() => {
    if (!dbUser?.user_id) return "guest";

    // Owner of this rental
    if (ownerId && dbUser.user_id === ownerId) return "owner";

    // Renter of this rental — check both rentals.user_id (renterId) AND
    // the fallback renterTelegramChatId from rental_contract_artefacts
    if (renterId && dbUser.user_id === renterId) return "renter";
    if (renterTelegramChatId && dbUser.user_id === renterTelegramChatId) return "renter";

    // Crew operator — try matching by crewId first, then by crewSlug (more reliable).
    // Broadened to include ALL crew roles (member, owner, admin, co_owner) —
    // the server-side auth still gates mutations, so showing the UI is safe.
    if (crewId || crewSlug) {
      const membership = userCrewMemberships.find((m) => {
        if (crewId && m.crewId === crewId) return true;
        if (crewSlug && m.slug === crewSlug) return true;
        return false;
      });
      if (membership && ["owner", "admin", "co_owner", "member"].includes(membership.role)) {
        return "operator";
      }
    }

    // Global admin (user.metadata.role === "admin")
    const userMeta = (dbUser.metadata as Record<string, unknown> | null) ?? null;
    if (userMeta?.role === "admin" || userMeta?.status === "admin") {
      return "admin";
    }

    // Subrenter — partner owner of THIS bike (checked after stronger roles so
    // a subrenter who is also a crew member gets the full operator treatment).
    if (subrenterChatId && dbUser.user_id === subrenterChatId) {
      return "subrenter";
    }

    return "guest";
  }, [dbUser?.user_id, dbUser?.metadata, ownerId, renterId, renterTelegramChatId, subrenterChatId, crewId, crewSlug, userCrewMemberships]);

  // "subrenter" is a VIEW-oriented mini admin: it passes only guards that
  // explicitly list it. Lifecycle mutations (activate/extend/complete) stay
  // operator-only — their server actions gate permissions anyway.
  if (allowedRoles.includes(role)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
