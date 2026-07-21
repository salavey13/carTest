"use server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getFranchizeLeads } from "./leads";
import { isHotLead } from "@/app/franchize/[slug]/leads/lib/sla-signals";
import type { Mode } from "@/app/franchize/[slug]/leads/leads-constants";

export interface LeadsKpis {
  totalLeads: number;
  hotLeads: number;
  conversionRate: number;
  monthlyRevenue: number;
}

export async function getLeadsKpis(slug: string, mode: Mode): Promise<LeadsKpis> {
  const result = await getFranchizeLeads(slug);
  if (!result.success || !result.leads) {
    return { totalLeads: 0, hotLeads: 0, conversionRate: 0, monthlyRevenue: 0 };
  }

  const modeIntents: Record<Mode, string[]> = {
    rent: ["rent", "test_drive", "test_ride_click", "checkout_start", "prebuy", "trade_in", "finance", "hold_created", "payment_failure", "payment_success", "map_click", "contact_click"],
    sale: ["sale"],
    service: ["service"],
  };
  const leads = result.leads.filter((l) => modeIntents[mode].includes(l.intentType || ""));
  const todos = result.todos || [];

  const totalLeads = leads.filter((l) => l.stageKey !== "closed_lost").length;
  const hotLeads = leads.filter((l) => isHotLead(l, todos)).length;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 864e5);
  const recent = leads.filter((l) => l.createdAt && new Date(l.createdAt) >= thirtyDaysAgo);
  const recentWon = recent.filter((l) => l.stageKey === "closed_won").length;
  const conversionRate = recent.length > 0 ? (recentWon / recent.length) * 100 : 0;

  const monthlyRevenue = leads.reduce((sum, l) => {
    return sum + l.rentals
      .filter((r) => r.status === "active" || r.status === "completed")
      .reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
  }, 0);

  return { totalLeads, hotLeads, conversionRate: Math.round(conversionRate), monthlyRevenue };
}
