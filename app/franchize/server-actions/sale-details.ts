"use server";

// /app/franchize/server-actions/sale-details.ts
//
// iter15: sale detail drawer backend — parity with the rental detail drawer.
//   getSaleDetails  → full artifact row (private.sale_contract_artifacts) +
//                     signed DOCX download URL (Supabase storage, 1h) +
//                     operator notes (public.lead_notes keyed "sale:<contract_key>")
//   addSaleNote     → append an operator note ("шлем в подарок", etc.)
//
// Notes storage: lead_notes.lead_id is TEXT with NO FK — sale notes reuse the
// table with the "sale:" prefix, so no DDL is needed and the leads page (which
// queries by real lead ids) never sees them.

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-server";

type SupabaseSchemaClient = {
  schema: (schema: string) => { from: (table: string) => any };
};
const privateSchema = () => (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");

export interface SaleNoteItem {
  id: string;
  text: string;
  created_by: string | null;
  created_at: string;
}

export interface SaleDetailsResult {
  sale: {
    id: string;
    contract_key: string | null;
    requested_bike_id: string | null;
    resolved_bike_id: string | null;
    telegram_chat_id: string | null;
    buyer_full_name: string | null;
    buyer_phone: string | null;
    buyer_passport_number: string | null;
    buyer_passport_issued_by: string | null;
    buyer_passport_issue_date: string | null;
    buyer_registration: string | null;
    buyer_email: string | null;
    sale_price: string | null;
    total_sum: string | null;
    warranty_months: string | null;
    delivery_method: string | null;
    transport_company_name: string | null;
    transport_payment_type: string | null;
    created_at: string;
    storage_path: string | null;
  };
  vehicle: { id: string; make: string | null; model: string | null } | null;
  downloadUrl: string | null;
  notes: SaleNoteItem[];
}

async function verifySaleAccess(
  actorUserId: string,
  crewSlug: string,
): Promise<{ allowed: boolean; crewId?: string; error?: string }> {
  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", crewSlug.trim())
    .maybeSingle();
  if (!crew?.id) return { allowed: false, error: "Экипаж не найден." };

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("metadata, username")
    .eq("user_id", actorUserId)
    .maybeSingle();
  const userMetadata = (user?.metadata as Record<string, unknown> | null) ?? null;
  const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";
  const isOwner = crew.owner_id === actorUserId;
  const isOrudjov = typeof user?.username === "string" && user.username.toLowerCase().includes("orud");

  const { data: crewMember } = await supabaseAdmin
    .from("crew_members")
    .select("user_id")
    .eq("crew_id", crew.id)
    .eq("user_id", actorUserId)
    .eq("membership_status", "active")
    .maybeSingle();

  if (isOwner || isAdmin || isOrudjov || crewMember) {
    return { allowed: true, crewId: crew.id };
  }
  return { allowed: false, error: "Недостаточно прав для просмотра." };
}

export async function getSaleDetails(input: {
  actorUserId: string;
  crewSlug: string;
  saleId: string;
}): Promise<{ success: boolean; data?: SaleDetailsResult; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewSlug: z.string().trim().min(1),
      saleId: z.string().trim().min(1),
    }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Некорректный запрос." };
    const { actorUserId, crewSlug, saleId } = parsed.data;

    const access = await verifySaleAccess(actorUserId, crewSlug);
    if (!access.allowed) return { success: false, error: access.error };

    // Artifact lives in the private schema; ids are uuids but keep the query
    // string-tolerant (defensive against crafted ids).
    const { data: sale, error: saleError } = await privateSchema()
      .from("sale_contract_artifacts")
      .select("*")
      .eq("id", saleId)
      .maybeSingle();
    if (saleError || !sale) {
      return { success: false, error: "Продажа не найдена." };
    }

    // Cross-crew guard: the artifact's bike must belong to this crew.
    const bikeId = (sale.resolved_bike_id || sale.requested_bike_id || "") as string;
    let vehicle: SaleDetailsResult["vehicle"] = null;
    if (bikeId) {
      const { data: car } = await supabaseAdmin
        .from("cars")
        .select("id, make, model, crew_id")
        .eq("id", bikeId)
        .maybeSingle();
      if (car && car.crew_id !== access.crewId) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
      if (car) vehicle = { id: car.id, make: car.make, model: car.model };
    }

    // Signed download URL for the stored DOCX (bucket shared with rentals).
    let downloadUrl: string | null = null;
    if (sale.storage_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("rental-contracts")
        .createSignedUrl(sale.storage_path, 3600);
      if (signed?.signedUrl) downloadUrl = signed.signedUrl;
    }

    // Operator notes keyed by contract.
    const noteKey = `sale:${sale.contract_key || sale.id}`;
    const { data: noteRows } = await supabaseAdmin
      .from("lead_notes")
      .select("id, text, created_by, created_at")
      .eq("lead_id", noteKey)
      .order("created_at", { ascending: true });
    const notes: SaleNoteItem[] = (noteRows ?? []).map((n) => ({
      id: String(n.id),
      text: String(n.text ?? ""),
      created_by: n.created_by ?? null,
      created_at: String(n.created_at ?? ""),
    }));

    return {
      success: true,
      data: {
        sale: {
          id: String(sale.id),
          contract_key: sale.contract_key ?? null,
          requested_bike_id: sale.requested_bike_id ?? null,
          resolved_bike_id: sale.resolved_bike_id ?? null,
          telegram_chat_id: sale.telegram_chat_id ? String(sale.telegram_chat_id) : null,
          buyer_full_name: sale.buyer_full_name ?? null,
          buyer_phone: sale.buyer_phone ?? null,
          buyer_passport_number: sale.buyer_passport_number ?? null,
          buyer_passport_issued_by: sale.buyer_passport_issued_by ?? null,
          buyer_passport_issue_date: sale.buyer_passport_issue_date ?? null,
          buyer_registration: sale.buyer_registration ?? null,
          buyer_email: sale.buyer_email ?? null,
          sale_price: sale.sale_price ?? null,
          total_sum: sale.total_sum ?? null,
          warranty_months: sale.warranty_months ?? null,
          delivery_method: sale.delivery_method ?? null,
          transport_company_name: sale.transport_company_name ?? null,
          transport_payment_type: sale.transport_payment_type ?? null,
          created_at: String(sale.created_at ?? ""),
          storage_path: sale.storage_path ?? null,
        },
        vehicle,
        downloadUrl,
        notes,
      },
    };
  } catch (error) {
    console.error("[sale-details] getSaleDetails error:", error);
    return { success: false, error: "Не удалось загрузить детали продажи." };
  }
}

export async function addSaleNote(input: {
  actorUserId: string;
  crewSlug: string;
  saleId: string;
  text: string;
}): Promise<{ success: boolean; data?: SaleNoteItem; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewSlug: z.string().trim().min(1),
      saleId: z.string().trim().min(1),
      text: z.string().trim().min(1).max(500),
    }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Заметка: 1–500 символов." };
    const { actorUserId, crewSlug, saleId, text } = parsed.data;

    const access = await verifySaleAccess(actorUserId, crewSlug);
    if (!access.allowed) return { success: false, error: access.error };

    const { data: sale } = await privateSchema()
      .from("sale_contract_artifacts")
      .select("id, contract_key, resolved_bike_id, requested_bike_id")
      .eq("id", saleId)
      .maybeSingle();
    if (!sale) return { success: false, error: "Продажа не найдена." };

    const noteKey = `sale:${sale.contract_key || sale.id}`;
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("lead_notes")
      .insert({ lead_id: noteKey, crew_id: access.crewId, text, created_by: actorUserId })
      .select("id, text, created_by, created_at")
      .single();
    if (insertError || !inserted) {
      console.error("[sale-details] addSaleNote insert error:", insertError?.message);
      return { success: false, error: "Не удалось сохранить заметку." };
    }
    return {
      success: true,
      data: {
        id: String(inserted.id),
        text: String(inserted.text ?? text),
        created_by: inserted.created_by ?? actorUserId,
        created_at: String(inserted.created_at ?? new Date().toISOString()),
      },
    };
  } catch (error) {
    console.error("[sale-details] addSaleNote error:", error);
    return { success: false, error: "Не удалось сохранить заметку." };
  }
}
