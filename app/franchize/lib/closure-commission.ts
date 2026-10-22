// app/franchize/lib/closure-commission.ts
// Task 124 — the closure modal's commissions summary («so operator can agree
// right away by keeping the ok checkbox marked by default»).
//
// The modal previously collected odometer/deposit/damage with ZERO money
// context: the сверка math only appeared AFTER closure, in the Telegram DM.
// The operator signed blind. This module computes the SAME canonical preview
// (computeRentalVerificationSnapshot — the exact math the сверка DM will
// freeze) BEFORE closure and hands it to the modal as a prop.
//
// Server-only (supabaseAdmin + crew salary config). The client component
// imports ONLY the ClosureCommissionPreview type (type-only import — erased
// at compile, nothing server-side leaks into the bundle).

import { supabaseAdmin } from "@/lib/supabase-server";
import { computeRentalVerificationSnapshot } from "./rental-verify";
import type { RentalVerificationSnapshot } from "./rental-verify-core";

export interface ClosureCommissionPaper {
  /** What the printed contract says (private.rental_contract_artifacts.total_sum). */
  totalSum: number;
  /** The залог on paper — the books may disagree (October sus-разбор). */
  depositRub: number;
}

export interface ClosureCommissionPreview {
  bikeName: string;
  /** What the client paid (rentals.total_cost). */
  totalCost: number;
  /** Commission parts (canonical computeRentalSalary output). */
  base: number;
  equipment: number;
  overprice: number;
  total: number;
  /** Frozen-shape formula block (эталон math) — may be null on fallback. */
  formula: RentalVerificationSnapshot["formula"] | null;
  equipmentFlags: string;
  /** Deposit in the BOOKS (0 = never mirrored — the pre-iter21 gap). */
  depositBooks: number;
  /** The printed contract numbers when the rental came from /doc. */
  paper: ClosureCommissionPaper | null;
}

export async function buildClosureCommissionPreview(
  rentalId: string,
  crewId: string,
): Promise<ClosureCommissionPreview | null> {
  try {
    const { data: rentalRow } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id, total_cost, metadata, deposit_amount,
        created_by_operator_chat_id, created_at,
        requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
        start_photo_count, end_photo_count,
        vehicle:cars(id, make, model, specs, daily_price, type, crew_id, is_test_result, image_url)
      `)
      .eq("rental_id", rentalId)
      .maybeSingle();
    const rental = rentalRow as unknown as {
      rental_id: string;
      total_cost: number | null;
      metadata: Record<string, unknown> | null;
      deposit_amount: number | null;
      created_by_operator_chat_id: string | null;
      created_at: string | null;
      requested_start_date: string | null;
      requested_end_date: string | null;
      agreed_start_date: string | null;
      agreed_end_date: string | null;
      start_photo_count: number | null;
      end_photo_count: number | null;
      vehicle: Array<Record<string, unknown>> | Record<string, unknown> | null;
    } | null;
    if (!rental || !crewId) return null;

    const meta = rental.metadata || {};
    const vehicle = Array.isArray(rental.vehicle) ? rental.vehicle[0] : rental.vehicle;

    const snapshot = await computeRentalVerificationSnapshot({
      rental: {
        rental_id: rental.rental_id,
        total_cost: rental.total_cost,
        metadata: meta,
        requested_start_date: rental.requested_start_date,
        requested_end_date: rental.requested_end_date,
        agreed_start_date: rental.agreed_start_date,
        agreed_end_date: rental.agreed_end_date,
        created_by_operator_chat_id: rental.created_by_operator_chat_id,
        created_at: rental.created_at,
        start_photo_count: rental.start_photo_count,
        end_photo_count: rental.end_photo_count,
        vehicle: vehicle ?? null,
      },
      crewId,
      requestedAtIso: new Date().toISOString(),
    });

    // Task 124 proposal B: catch «бумага ≠ книги» at CLOSURE time, not in the
    // DM afterwards — the printed contract numbers ride next to the books.
    let paper: ClosureCommissionPaper | null = null;
    if (meta.source === "doc_command" && Number(rental.total_cost) > 0) {
      try {
        const privateSchema = (supabaseAdmin as unknown as { schema: (s: string) => typeof supabaseAdmin }).schema("private");
        const { data: art } = await privateSchema
          .from("rental_contract_artifacts")
          .select("total_sum, deposit_rub")
          .eq("rental_id", rentalId)
          .maybeSingle();
        if (art && art.total_sum != null) {
          paper = { totalSum: Number(art.total_sum) || 0, depositRub: Number(art.deposit_rub) || 0 };
        }
      } catch {
        /* artifact table missing — paper stays null, modal degrades */
      }
    }

    return {
      bikeName: snapshot.bikeName,
      totalCost: snapshot.totalCost,
      base: snapshot.base,
      equipment: snapshot.equipment,
      overprice: snapshot.overprice,
      total: snapshot.total,
      formula: snapshot.formula ?? null,
      equipmentFlags: snapshot.equipmentFlags,
      depositBooks: Number(rental.deposit_amount) || 0,
      paper,
    };
  } catch {
    // Preview is a nicety — the modal must close a rental even when the
    // math/config fetch dies. null → the summary block simply doesn't render.
    return null;
  }
}
