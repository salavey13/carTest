"use server";

// app/franchize/server-actions/owner-cash.ts
// ──────────────────────────────────────────────────────────────────────────
// Личный кошелёк владельца экипажа (owner_cash_entries): движения денег «на
// все подряд» мимо автоматических систем — наличные приходы (клиент отдал
// владельцу в руки), личные траты, выплаты субарендаторам.
//
// Доступ: только crew owner / co_owner / admin / owner-at-large
// (canManageSubrenters — тот же гейт, что у панели «Субарендаторы»).
// API-роут для ассистента: /api/franchize/owner-cash (секрет OWNER_CASH_SECRET).

import { z } from "zod";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { canManageSubrenters } from "./bike-subrenter";

export type OwnerCashDirection = "in" | "out";
export type OwnerCashKind = "personal" | "subrenter_payout" | "other";

export interface OwnerCashEntry {
  id: string;
  direction: OwnerCashDirection;
  kind: OwnerCashKind;
  amount: number;
  title: string;
  person: string | null;
  entryDate: string; // YYYY-MM-DD
  createdAt: string;
}

export interface OwnerCashMonthData {
  month: string; // YYYY-MM
  entries: OwnerCashEntry[];
  totalIn: number;
  totalOut: number;
  totalPayouts: number;
  net: number;
  /** Субренд-выплаты, ещё не записанные в кошелёк, подсказываются панелью выплат. */
}

function monthWindow(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map((v) => Number(v));
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  const mon = Number.isFinite(m) && m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
  const from = `${year}-${String(mon).padStart(2, "0")}-01`;
  const nextY = mon === 12 ? year + 1 : year;
  const nextM = mon === 12 ? 1 : mon + 1;
  const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { from, to };
}

async function resolveCrew(slug: string) {
  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", slug.trim())
    .maybeSingle();
  return crew ?? null;
}

/** Месячная выборка кошелька владельца. null → нет прав (панель скрыта). */
export async function getOwnerCashMonthAction(input: {
  slug: string;
  actorUserId: string;
  month?: string;
}): Promise<{ success: boolean; data?: OwnerCashMonthData; error?: string }> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      month: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}$/, "YYYY-MM")
        .optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, actorUserId } = parsed.data;
  const now = new Date();
  const month =
    parsed.data.month ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  try {
    const crew = await resolveCrew(slug);
    if (!crew) return { success: false, error: "Экипаж не найден." };
    const allowed = await canManageSubrenters(crew.id, crew.owner_id, actorUserId);
    if (!allowed) return { success: false, error: "Недостаточно прав." };

    const { from, to } = monthWindow(month);
    const { data: rows, error } = await supabaseAdmin
      .from("owner_cash_entries")
      .select("id,direction,kind,amount,title,person,entry_date,created_at")
      .eq("crew_id", crew.id)
      .gte("entry_date", from)
      .lt("entry_date", to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const entries: OwnerCashEntry[] = (rows ?? []).map((r: {
      id: string;
      direction: string;
      kind: string;
      amount: number | string;
      title: string;
      person?: string | null;
      entry_date: string;
      created_at: string;
    }) => ({
      id: String(r.id),
      direction: r.direction === "in" ? "in" : "out",
      kind: (r.kind === "subrenter_payout" || r.kind === "other" ? r.kind : "personal") as OwnerCashKind,
      amount: Number(r.amount) || 0,
      title: r.title || "",
      person: r.person || null,
      entryDate: r.entry_date,
      createdAt: r.created_at,
    }));

    const totalIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
    const totalOut = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
    const totalPayouts = entries
      .filter((e) => e.kind === "subrenter_payout")
      .reduce((s, e) => s + e.amount, 0);

    return {
      success: true,
      data: { month, entries, totalIn, totalOut, totalPayouts, net: totalIn - totalOut },
    };
  } catch (error) {
    logger.warn("[getOwnerCashMonthAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const addSchema = z.object({
  slug: z.string().trim().min(1),
  actorUserId: z.string().trim().min(1),
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive().max(10_000_000),
  title: z.string().trim().min(1).max(300),
  person: z.string().trim().max(200).optional(),
  kind: z.enum(["personal", "subrenter_payout", "other"]).optional(),
  entryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional(),
  source: z.enum(["manual", "assistant_bot", "profile", "api"]).optional(),
});

/** Добавить запись в кошелёк владельца. */
export async function addOwnerCashEntryAction(input: unknown): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Некорректные данные." };
  }
  const { slug, actorUserId, direction, amount, title, person, kind, entryDate, source } =
    parsed.data;

  try {
    const crew = await resolveCrew(slug);
    if (!crew) return { success: false, error: "Экипаж не найден." };
    const allowed = await canManageSubrenters(crew.id, crew.owner_id, actorUserId);
    if (!allowed) return { success: false, error: "Недостаточно прав." };

    const { data, error } = await supabaseAdmin
      .from("owner_cash_entries")
      .insert({
        crew_id: crew.id,
        owner_user_id: crew.owner_id ? String(crew.owner_id) : null,
        direction,
        kind: kind || "personal",
        amount,
        title,
        person: person || null,
        entry_date: entryDate || new Date().toISOString().slice(0, 10),
        created_by: actorUserId,
        source: source || "profile",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { success: true, id: String(data.id) };
  } catch (error) {
    logger.warn("[addOwnerCashEntryAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Удалить ошибочную запись (только owner/admin). */
export async function deleteOwnerCashEntryAction(input: {
  slug: string;
  actorUserId: string;
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      id: z.string().uuid(),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, actorUserId, id } = parsed.data;

  try {
    const crew = await resolveCrew(slug);
    if (!crew) return { success: false, error: "Экипаж не найден." };
    const allowed = await canManageSubrenters(crew.id, crew.owner_id, actorUserId);
    if (!allowed) return { success: false, error: "Недостаточно прав." };
    const { error } = await supabaseAdmin
      .from("owner_cash_entries")
      .delete()
      .eq("id", id)
      .eq("crew_id", crew.id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    logger.warn("[deleteOwnerCashEntryAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
