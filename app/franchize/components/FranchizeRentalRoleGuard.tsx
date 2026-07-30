"use client";

import type React from "react";
import { useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";

/**
 * FranchizeRentalRoleGuard
 * ──────────────────────────────────────────────────────────────────────────
 * Hides its children unless the current user has one of the allowed roles
 * for this rental. Used on the dedicated /franchize/[slug]/rental/[id] page
 * to keep operator-only panels (verification checklist, return checklist
 * toggle UI, internal documents) out of the renter's view.
 *
 * Roles:
 *   - "owner"    : rental.owner_id === dbUser.user_id
 *   - "renter"   : rental.renterId === dbUser.user_id
 *                  OR (fallback) rental.renterTelegramChatId === dbUser.user_id
 *                  (the fallback handles bot/QR-flow rentals where
 *                   rentals.user_id is null but rental_contract_artefacts.telegram_chat_id
 *                   holds the renter's chat ID)
 *   - "operator" : crew member with role owner/admin/co_owner
 *   - "admin"    : user.metadata.role === "admin" (global admin)
 *   - "guest"    : none of the above
 *
 * Props:
 *   - allowedRoles: array of roles that can see the children
 *   - ownerId, renterId, renterTelegramChatId, crewId: identity inputs for role detection
 *
 * Example:
 *   <FranchizeRentalRoleGuard
 *     allowedRoles={["operator", "admin"]}
 *     ownerId={rental.ownerId}
 *     renterId={rental.renterId}
 *     renterTelegramChatId={rental.renterTelegramChatId}
 *     crewId={crew.id}
 *   >
 *     <RentalChecklistPanel ... />  // hidden from renters + guests
 *   </FranchizeRentalRoleGuard>
 */
interface FranchizeRentalRoleGuardProps {
  allowedRoles: Array<"owner" | "renter" | "operator" | "admin" | "guest">;
  ownerId?: string;
  renterId?: string;
  renterTelegramChatId?: string;
  crewId?: string;
  children: React.ReactNode;
  /** Optional fallback to render when the user's role is not in allowedRoles */
  fallback?: React.ReactNode;
}

export function FranchizeRentalRoleGuard({
  allowedRoles,
  ownerId,
  renterId,
  renterTelegramChatId,
  crewId,
  children,
  fallback = null,
}: FranchizeRentalRoleGuardProps) {
  const { dbUser, userCrewMemberships } = useAppContext();

  const role = useMemo<"owner" | "renter" | "operator" | "admin" | "guest">(() => {
    if (!dbUser?.user_id) return "guest";

    // Owner of this rental
    if (ownerId && dbUser.user_id === ownerId) return "owner";

    // Renter of this rental — check both rentals.user_id (renterId) AND
    // the fallback renterTelegramChatId from rental_contract_artefacts
    if (renterId && dbUser.user_id === renterId) return "renter";
    if (renterTelegramChatId && dbUser.user_id === renterTelegramChatId) return "renter";

    // Crew operator (owner/admin/co_owner of the crew that owns this rental)
    if (crewId) {
      const membership = userCrewMemberships.find((m) => m.crewId === crewId);
      if (membership && ["owner", "admin", "co_owner"].includes(membership.role)) {
        return "operator";
      }
    }

    // Global admin (user.metadata.role === "admin")
    const userMeta = (dbUser.metadata as Record<string, unknown> | null) ?? null;
    if (userMeta?.role === "admin" || userMeta?.status === "admin") {
      return "admin";
    }

    return "guest";
  }, [dbUser?.user_id, dbUser?.metadata, ownerId, renterId, renterTelegramChatId, crewId, userCrewMemberships]);

  if (allowedRoles.includes(role)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
