// /app/franchize/server-actions/network-role-manager.ts
// "use server" actions behind the «Роли экипажей» manager on the map-riders
// network tab (boss 2026-10-14).
//
// WHO may act: the hardcoded network role operators (I_O_S_NN + salavey13 —
// see ../lib/network-role-operators) OR a platform admin (users.role
// admin|vpradmin / status admin — same predicate the members page uses).
//
// WHAT it does that the members-page actions do NOT:
//   · works on ANY crew by slug (prefabricated crews included) without the
//     operator being a member;
//   · can target a user who is NOT yet a crew member — the membership row is
//     created on the fly (membership_status='active'), so «назначить владельца
//     заранее» does not require the invite round-trip first;
//   · `owner` transfer mirrors promoteCrewMemberToOwnerAction: crews.owner_id
//     is the effective ownership source, previous owner keeps seniority as
//     co_owner (critical for prefab crews where that previous owner is
//     I_O_S_NN himself).

"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  isNetworkAssignableRole,
  isNetworkRoleOperator,
  networkRoleLabel,
  parseNetworkTargetQuery,
  type NetworkAssignableRole,
} from "@/app/franchize/lib/network-role-operators";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type NetworkActorRoleCheck = { ok: boolean };

async function assertNetworkOperator(supabase: SupabaseClient, actorId: string): Promise<boolean> {
  if (isNetworkRoleOperator(actorId)) return true;
  const { data } = await supabase
    .from("users")
    .select("role, status")
    .eq("user_id", actorId)
    .maybeSingle();
  const u = (data ?? null) as { role?: string | null; status?: string | null } | null;
  const role = String(u?.role ?? "").toLowerCase();
  const status = String(u?.status ?? "").toLowerCase();
  return role === "admin" || role === "vpradmin" || status === "admin";
}

async function resolveTargetUserId(
  supabase: SupabaseClient,
  query: string,
): Promise<{ user_id: string; name: string; username: string | null } | null> {
  const parsed = parseNetworkTargetQuery(query);
  if (!parsed) return null;
  let req = supabase.from("users").select("user_id, username, full_name").limit(1);
  req = parsed.kind === "id" ? req.eq("user_id", parsed.value) : req.ilike("username", parsed.value);
  const { data } = await req;
  const row = (data ?? [])[0] as { user_id: string; username: string | null; full_name: string | null } | undefined;
  if (!row) return null;
  const name = (row.full_name ?? "").trim() || (row.username ? `@${row.username.replace(/^@/, "")}` : "Райдер");
  return { user_id: row.user_id, name, username: row.username };
}

// ── snapshot (what the UI renders) ──────────────────────────────────────────

export interface NetworkRoleSnapshotMember {
  userId: string;
  name: string;
  username: string | null;
  role: string; // '' = plain member row without a role
  isCrewOwner: boolean;
  membershipStatus: string;
}

export type NetworkRoleSnapshotResult =
  | {
      success: true;
      crew: { id: string; slug: string; name: string; ownerId: string | null };
      members: NetworkRoleSnapshotMember[];
    }
  | { success: false; error: string };

export async function listNetworkRoleSnapshotAction(input: {
  slug: string;
  actorTelegramUserId: string;
}): Promise<NetworkRoleSnapshotResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const slug = String(input.slug ?? "").trim().slice(0, 64);
    if (!slug) return { success: false, error: "Экипаж не найден" };
    if (!(await assertNetworkOperator(supabase, input.actorTelegramUserId))) {
      return { success: false, error: "Недостаточно прав" };
    }
    const { data: crew } = await supabase
      .from("crews")
      .select("id, slug, name, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    const crewRow = (crew ?? null) as { id: string; slug: string; name: string; owner_id: string | null } | null;
    if (!crewRow) return { success: false, error: "Экипаж не найден" };

    const { data: memberRows } = await supabase
      .from("crew_members")
      .select("user_id, role, membership_status")
      .eq("crew_id", crewRow.id)
      .order("joined_at", { ascending: true })
      .limit(200);
    const rows = (memberRows ?? []) as Array<{ user_id: string; role: string | null; membership_status: string | null }>;

    const ids = [...new Set([...rows.map((r) => r.user_id), ...(crewRow.owner_id ? [crewRow.owner_id] : [])])].filter(Boolean);
    const names = new Map<string, { name: string; username: string | null }>();
    if (ids.length) {
      const { data: userRows } = await supabase
        .from("users")
        .select("user_id, username, full_name")
        .in("user_id", ids);
      for (const u of (userRows ?? []) as Array<{ user_id: string; username: string | null; full_name: string | null }>) {
        names.set(u.user_id, {
          name: (u.full_name ?? "").trim() || (u.username ? `@${u.username.replace(/^@/, "")}` : "Райдер"),
          username: u.username,
        });
      }
    }

    const members: NetworkRoleSnapshotMember[] = rows.map((r) => ({
      userId: r.user_id,
      name: names.get(r.user_id)?.name ?? "Райдер",
      username: names.get(r.user_id)?.username ?? null,
      role: r.role ?? "",
      isCrewOwner: crewRow.owner_id === r.user_id,
      membershipStatus: r.membership_status ?? "",
    }));
    // The effective owner may have no membership row yet (fresh prefab) —
    // surface them anyway so the manager shows who holds the keys.
    if (crewRow.owner_id && !members.some((m) => m.userId === crewRow.owner_id)) {
      members.unshift({
        userId: crewRow.owner_id,
        name: names.get(crewRow.owner_id)?.name ?? "Райдер",
        username: names.get(crewRow.owner_id)?.username ?? null,
        role: "owner",
        isCrewOwner: true,
        membershipStatus: "owner-only",
      });
    }
    return { success: true, crew: { id: crewRow.id, slug: crewRow.slug, name: crewRow.name, ownerId: crewRow.owner_id }, members };
  } catch (error) {
    logger.error("listNetworkRoleSnapshotAction error", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" };
  }
}

// ── assign ──────────────────────────────────────────────────────────────────

export type AssignNetworkRoleResult =
  | { success: true; message: string; createdMembership: boolean; transferredOwnership: boolean }
  | { success: false; error: string };

export async function assignNetworkCrewRoleAction(input: {
  crewSlug: string;
  /** Numeric TG id or @username — resolved against the users table. */
  targetQuery: string;
  newRole: NetworkAssignableRole;
  actorTelegramUserId: string;
}): Promise<AssignNetworkRoleResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const slug = String(input.crewSlug ?? "").trim().slice(0, 64);
    if (!slug) return { success: false, error: "Экипаж не найден" };
    if (!isNetworkAssignableRole(input.newRole)) {
      return { success: false, error: "Недопустимая роль" };
    }
    if (!(await assertNetworkOperator(supabase, input.actorTelegramUserId))) {
      return { success: false, error: "Недостаточно прав" };
    }

    const { data: crew } = await supabase
      .from("crews")
      .select("id, name, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    const crewRow = (crew ?? null) as { id: string; name: string; owner_id: string | null } | null;
    if (!crewRow) return { success: false, error: "Экипаж не найден" };

    const target = await resolveTargetUserId(supabase, input.targetQuery);
    if (!target) {
      return { success: false, error: "Пользователь не найден — проверь @username или числовой Telegram ID" };
    }
    if (target.user_id === crewRow.owner_id && input.newRole === "owner") {
      return { success: false, error: "Он уже владелец этого экипажа" };
    }

    // Existing membership?
    const { data: existing } = await supabase
      .from("crew_members")
      .select("user_id, role, membership_status")
      .eq("user_id", target.user_id)
      .eq("crew_id", crewRow.id)
      .maybeSingle();
    const existingRow = (existing ?? null) as { user_id: string; role: string | null; membership_status: string | null } | null;

    let createdMembership = false;
    let transferredOwnership = false;

    if (input.newRole === "owner") {
      // 1) crews.owner_id — the effective ownership source.
      const { error: crewUpdateError } = await supabase
        .from("crews")
        .update({ owner_id: target.user_id })
        .eq("id", crewRow.id);
      if (crewUpdateError) {
        logger.error("[networkRoles] crews.owner_id update failed", crewUpdateError);
        return { success: false, error: "Ошибка при передаче владения" };
      }
      transferredOwnership = true;

      // 2) Membership row for the new owner (create when missing).
      if (existingRow) {
        await supabase
          .from("crew_members")
          .update({ role: "owner", membership_status: "active" })
          .eq("user_id", target.user_id)
          .eq("crew_id", crewRow.id);
      } else {
        const { error: insertError } = await supabase
          .from("crew_members")
          .insert({ crew_id: crewRow.id, user_id: target.user_id, role: "owner", membership_status: "active" });
        if (insertError) logger.warn("[networkRoles] owner membership insert failed", insertError);
        createdMembership = true;
      }

      // 3) Previous owner keeps seniority as co_owner (prefab default: I_O_S_NN).
      const previousOwnerId = crewRow.owner_id && crewRow.owner_id !== target.user_id ? crewRow.owner_id : null;
      if (previousOwnerId) {
        await supabase
          .from("crew_members")
          .update({ role: "co_owner" })
          .eq("user_id", previousOwnerId)
          .eq("crew_id", crewRow.id);
      }
    } else {
      // co_owner / admin: upsert the membership row.
      if (existingRow) {
        const { error: updateError } = await supabase
          .from("crew_members")
          .update({ role: input.newRole, membership_status: "active" })
          .eq("user_id", target.user_id)
          .eq("crew_id", crewRow.id);
        if (updateError) {
          logger.error("[networkRoles] role update failed", updateError);
          return { success: false, error: "Ошибка при обновлении роли" };
        }
      } else {
        const { error: insertError } = await supabase
          .from("crew_members")
          .insert({ crew_id: crewRow.id, user_id: target.user_id, role: input.newRole, membership_status: "active" });
        if (insertError) {
          logger.error("[networkRoles] membership insert failed", insertError);
          return { success: false, error: "Ошибка при добавлении участника" };
        }
        createdMembership = true;
      }
    }

    // Best-effort Telegram heads-up (never blocks the operation).
    try {
      const what = input.newRole === "owner" ? "владельцем" : input.newRole === "co_owner" ? "совладельцем" : "админом";
      let openUrl = "";
      try {
        const { resolveCrewBotUsername, crewBotAppLink } = await import("@/app/franchize/lib/crew-bot");
        const botUsername = await resolveCrewBotUsername(slug);
        openUrl = crewBotAppLink(botUsername, `crew_${slug}`) ?? "";
      } catch {
        openUrl = "";
      }
      await sendTelegramMessage(
        target.user_id,
        `👑 Ты назначен ${what} экипажа «${crewRow.name}».${openUrl ? ` Открыть: ${openUrl}` : ""}`,
      );
    } catch (notifyError) {
      logger.warn("[networkRoles] notification failed", notifyError);
    }

    const message =
      input.newRole === "owner"
        ? `${target.name} — владелец «${crewRow.name}»${createdMembership ? " (участие создано)" : ""}`
        : `${target.name} — ${networkRoleLabel(input.newRole)} «${crewRow.name}»${createdMembership ? " (участие создано)" : ""}`;
    logger.info(`[networkRoles] ${message} by ${input.actorTelegramUserId}`);
    return { success: true, message, createdMembership, transferredOwnership };
  } catch (error) {
    logger.error("assignNetworkCrewRoleAction error", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" };
  }
}

// ── user lookup for the «добавить человека» input ───────────────────────────

export type SearchNetworkUsersResult =
  | { success: true; users: Array<{ userId: string; name: string; username: string | null }> }
  | { success: false; error: string };

export async function searchNetworkUsersAction(input: {
  query: string;
  actorTelegramUserId: string;
}): Promise<SearchNetworkUsersResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    if (!(await assertNetworkOperator(supabase, input.actorTelegramUserId))) {
      return { success: false, error: "Недостаточно прав" };
    }
    const parsed = parseNetworkTargetQuery(input.query);
    if (!parsed) return { success: false, error: "Введи числовой Telegram ID или @username" };
    let req = supabase.from("users").select("user_id, username, full_name").limit(5);
    req =
      parsed.kind === "id"
        ? req.eq("user_id", parsed.value)
        : req.ilike("username", `%${parsed.value}%`);
    const { data } = await req;
    const users = ((data ?? []) as Array<{ user_id: string; username: string | null; full_name: string | null }>).map((u) => ({
      userId: u.user_id,
      name: (u.full_name ?? "").trim() || (u.username ? `@${u.username.replace(/^@/, "")}` : "Райдер"),
      username: u.username,
    }));
    return { success: true, users };
  } catch (error) {
    logger.error("searchNetworkUsersAction error", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка сервера" };
  }
}
