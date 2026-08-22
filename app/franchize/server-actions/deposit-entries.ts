// /app/franchize/server-actions/deposit-entries.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/**
 * Deposit entries server actions.
 * Reads from public.deposit_entries table (created by migration 20260810000010).
 * Used by rental cards, admin deposits page, and the deposit-tracer-text skill.
 */

export interface DepositEntry {
  id: string;
  rental_id: string;
  entry_type: "deposit_collected" | "deposit_returned" | "penalty";
  amount: number;
  direction: "in" | "out";
  destination: "cash" | "tbank" | "sber";
  operator_chat_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface DepositSummary {
  totalCollected: number;
  totalReturned: number;
  totalPenalty: number;
  balance: number; // collected - returned - penalty
  destinations: Array<{
    destination: string;
    collected: number;
    returned: number;
    penalty: number;
    net: number;
  }>;
  entries: DepositEntry[];
}

/**
 * Get all deposit entries for a specific rental.
 * Used by rental card badge + deposit-tracer-text skill (deposit-rental command).
 */
export async function getDepositSummary(rentalId: string): Promise<DepositSummary | null> {
  if (!rentalId) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from("deposit_entries")
      .select("*")
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("[deposit-entries] getDepositSummary query failed:", error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const entries = data as DepositEntry[];

    // Aggregate by destination
    const destMap = new Map<string, { collected: number; returned: number; penalty: number }>();
    for (const e of entries) {
      if (!destMap.has(e.destination)) {
        destMap.set(e.destination, { collected: 0, returned: 0, penalty: 0 });
      }
      const d = destMap.get(e.destination)!;
      if (e.entry_type === "deposit_collected") d.collected += Number(e.amount);
      else if (e.entry_type === "deposit_returned") d.returned += Number(e.amount);
      else if (e.entry_type === "penalty") d.penalty += Number(e.amount);
    }

    const destinations = Array.from(destMap.entries()).map(([dest, d]) => ({
      destination: dest,
      collected: d.collected,
      returned: d.returned,
      penalty: d.penalty,
      net: d.collected - d.returned - d.penalty,
    }));

    const totalCollected = entries
      .filter((e) => e.entry_type === "deposit_collected")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalReturned = entries
      .filter((e) => e.entry_type === "deposit_returned")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPenalty = entries
      .filter((e) => e.entry_type === "penalty")
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      totalCollected,
      totalReturned,
      totalPenalty,
      balance: totalCollected - totalReturned - totalPenalty,
      destinations,
      entries,
    };
  } catch (err) {
    logger.error("[deposit-entries] getDepositSummary exception:", err);
    return null;
  }
}

/**
 * Get deposit entries for a date range, optionally filtered by destination.
 * Used by admin deposits page + deposit-tracer-text skill (deposit-list, deposit-balance).
 */
export async function getDepositEntriesForDate(
  date: string,
  destination?: "cash" | "tbank" | "sber",
  crewId?: string,
): Promise<DepositEntry[]> {
  try {
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    let query = supabaseAdmin
      .from("deposit_entries")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });

    if (destination) {
      query = query.eq("destination", destination);
    }

    // If crewId provided, filter by rentals that belong to this crew
    // (deposit_entries doesn't have crew_id — join through rentals)
    if (crewId) {
      query = query.filter("rental_id", "in", `(SELECT rental_id FROM rentals WHERE crew_id = '${crewId}')`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[deposit-entries] getDepositEntriesForDate query failed:", error);
      return [];
    }

    return (data || []) as DepositEntry[];
  } catch (err) {
    logger.error("[deposit-entries] getDepositEntriesForDate exception:", err);
    return [];
  }
}

/**
 * Get daily deposit summary per destination.
 * Used by evening digest + admin deposits page summary cards.
 */
export async function getDailyDepositSummary(
  date: string,
): Promise<Array<{ destination: string; collected: number; returned: number; penalty: number; net: number }>> {
  try {
    const entries = await getDepositEntriesForDate(date);
    if (entries.length === 0) return [];

    const destMap = new Map<string, { collected: number; returned: number; penalty: number }>();
    for (const e of entries) {
      if (!destMap.has(e.destination)) {
        destMap.set(e.destination, { collected: 0, returned: 0, penalty: 0 });
      }
      const d = destMap.get(e.destination)!;
      if (e.entry_type === "deposit_collected") d.collected += Number(e.amount);
      else if (e.entry_type === "deposit_returned") d.returned += Number(e.amount);
      else if (e.entry_type === "penalty") d.penalty += Number(e.amount);
    }

    return Array.from(destMap.entries()).map(([dest, d]) => ({
      destination: dest,
      collected: d.collected,
      returned: d.returned,
      penalty: d.penalty,
      net: d.collected - d.returned - d.penalty,
    }));
  } catch (err) {
    logger.error("[deposit-entries] getDailyDepositSummary exception:", err);
    return [];
  }
}
