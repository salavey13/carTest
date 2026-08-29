import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// iter17 — two reported live bugs:
//   1. "bike rented second time same day blocked as busy" — the order-page
//      availability gate must be hour-precise, not day-granular.
//   2. "personal data not prefilled on the next web order" — the web checkout
//      must persist renter secrets to private.user_rental_secrets.
// ─────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  schema: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    schema: mocks.schema,
  },
}));

vi.mock("@/app/actions", () => ({
  notifyAdmin: vi.fn(),
  sendTelegramDocument: vi.fn(),
  sendTelegramInvoice: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/app/franchize/lib/docx-capability", () => ({
  buildFranchizeDocxFromTemplate: vi.fn(),
  uploadDocxToStorage: vi.fn(),
}));

vi.mock("@/lib/private-secrets", () => ({
  getUserSensitiveData: vi.fn(),
  getCrewSensitiveData: vi.fn(),
  saveCrewSensitiveData: vi.fn(),
}));

import {
  buildRequestedWindowMs,
  parseStoredRentalTs,
  rentalRowBlocksWindow,
  RENTAL_BLOCK_GRACE_MS,
} from "@/app/franchize/lib/rental-overlap";
import { checkFranchizeCarsAvailability } from "@/app/franchize/server-actions/rentals";
import { upsertWebOrderRenterSecret } from "@/app/lib/user-rental-secrets";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 2026-08-29T12:00:00+03:00 in epoch ms. */
const msk = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+03:00`);

describe("iter17 · hour-precise availability window (buildRequestedWindowMs)", () => {
  it("treats the cart times as Moscow local time (+03:00) like the checkout does", () => {
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "12:00", rentalEndTime: "15:00" });
    // 12:00 MSK == 09:00 UTC
    expect(w?.hourPrecise).toBe(true);
    expect(w?.startMs).toBe(Date.parse("2026-08-29T09:00:00.000Z"));
    expect(w?.endMs).toBe(Date.parse("2026-08-29T12:00:00.000Z"));
  });

  it("falls back to whole calendar days (UTC) when no times are given", () => {
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29" });
    expect(w?.hourPrecise).toBe(false);
    expect(w?.startMs).toBe(Date.parse("2026-08-29T00:00:00.000Z"));
    expect(w?.endMs).toBe(Date.parse("2026-08-29T23:59:59.999Z"));
  });

  it("falls back to the day window when only one of the two times is valid", () => {
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "12:00", rentalEndTime: "9am" });
    expect(w?.hourPrecise).toBe(false);
  });

  it("rejects inverted and unparseable windows", () => {
    expect(buildRequestedWindowMs({ rentalStartDate: "2026-08-30", rentalEndDate: "2026-08-29", rentalStartTime: "10:00", rentalEndTime: "12:00" })).toBeNull();
    expect(buildRequestedWindowMs({ rentalStartDate: "garbage", rentalEndDate: "2026-08-29" })).toBeNull();
  });
});

describe("iter17 · rentalRowBlocksWindow — the live same-day scenario", () => {
  // Live case 2026-08-29 (real DB values): Kawasaki was rented 09:30Z→11:30Z
  // (= 12:30→14:30 MSK, renter Морозов). The row stayed `pending_confirmation`
  // (duplicate submit) while its completed twin carried on. At 12:08Z
  // (= 15:08 MSK) the renter tried to order the SAME bike again for
  // 15:00→16:00 MSK and was rejected with "Часть байков уже занята" — the old
  // day-granular check saw two windows touching the same calendar DAY.
  const stalePendingRow = {
    vehicle_id: "kawasaki-ex650k",
    status: "pending_confirmation",
    requested_start_date: "2026-08-29T09:30:00+00:00",
    requested_end_date: "2026-08-29T11:30:00+00:00",
  };

  it("a rental that ended at 11:30Z does NOT block a new order starting at 15:00 MSK (12:00Z) the same day", () => {
    // Request picked in the UI: 15:00→16:00 Moscow time (like the R6 order
    // the same renter successfully placed at 12:08Z).
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "15:00", rentalEndTime: "16:00" })!;
    const now = Date.parse("2026-08-29T12:08:00Z");
    expect(rentalRowBlocksWindow(stalePendingRow, w, now)).toBe(false);
    // During the rental (now = 10:00Z) a request that overlaps its hours
    // (13:00→14:00 MSK = 10:00Z→11:00Z) is still blocked.
    const overlapping = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "13:00", rentalEndTime: "14:00" })!;
    expect(rentalRowBlocksWindow(stalePendingRow, overlapping, Date.parse("2026-08-29T10:00:00Z"))).toBe(true);
    // And blocked for a request that starts inside the 30-min late-return
    // grace right after the previous rental (11:45Z < 11:30Z+30m).
    const tight = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "14:45", rentalEndTime: "16:00" })!;
    expect(rentalRowBlocksWindow(stalePendingRow, tight, Date.parse("2026-08-29T11:00:00Z"))).toBe(true);
  });

  it("day-window callers are also unblocked once the rental's end has passed", () => {
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29" })!;
    // 15:08 MSK — the rental ended at 14:30 MSK, nothing may block the rest of the day.
    expect(rentalRowBlocksWindow(stalePendingRow, w, Date.parse("2026-08-29T12:08:00Z"))).toBe(false);
    // ...but during the rental it still blocks.
    expect(rentalRowBlocksWindow(stalePendingRow, w, Date.parse("2026-08-29T10:00:00Z"))).toBe(true);
  });

  it("an overlapping rental that is still running DOES block", () => {
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "13:00", rentalEndTime: "16:00" })!;
    const activeRow = {
      vehicle_id: "kawasaki-ex650k",
      status: "active",
      requested_start_date: "2026-08-29T12:00:00+00:00",
      requested_end_date: "2026-08-29T15:00:00+00:00",
    };
    expect(rentalRowBlocksWindow(activeRow, w, msk("2026-08-29", "13:05"))).toBe(true);
  });

  it("keeps a 30-minute late-return grace after the rental's end", () => {
    // Rental 09:00Z→12:00Z (= 12:00→15:00 MSK), request later the same day.
    const endsAt15Msk = {
      vehicle_id: "b",
      status: "active",
      requested_start_date: "2026-08-29T09:00:00+00:00",
      requested_end_date: "2026-08-29T12:00:00+00:00",
    };
    // Now = 11:00Z (rental still running). Request starting exactly at the
    // rental's end (15:00 MSK = 12:00Z) → still blocked (grace buffer).
    const backToBack = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "15:00", rentalEndTime: "18:00" })!;
    expect(rentalRowBlocksWindow(endsAt15Msk, backToBack, Date.parse("2026-08-29T11:00:00Z"))).toBe(true);
    // Request starting after end + grace (15:45 MSK = 12:45Z) → free.
    const later = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "15:45", rentalEndTime: "18:00" })!;
    expect(rentalRowBlocksWindow(endsAt15Msk, later, Date.parse("2026-08-29T11:00:00Z"))).toBe(false);
    expect(RENTAL_BLOCK_GRACE_MS).toBe(30 * 60 * 1000);
  });

  it("a future confirmed booking still blocks a window that overlaps it", () => {
    const tomorrow = "2026-08-30";
    const w = buildRequestedWindowMs({ rentalStartDate: tomorrow, rentalEndDate: tomorrow, rentalStartTime: "10:00", rentalEndTime: "12:00" })!;
    const booking = {
      vehicle_id: "b",
      status: "confirmed",
      requested_start_date: "2026-08-30T06:00:00+00:00", // 09:00 MSK
      requested_end_date: "2026-08-30T10:00:00+00:00",   // 13:00 MSK
    };
    expect(rentalRowBlocksWindow(booking, w, msk("2026-08-29", "20:00"))).toBe(true);
  });

  it("bare calendar dates occupy the whole day (end date 29.08 → blocks the 29th)", () => {
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-29", rentalEndDate: "2026-08-29", rentalStartTime: "18:00", rentalEndTime: "20:00" })!;
    const bareDateRow = {
      vehicle_id: "b",
      status: "active",
      agreed_start_date: "2026-08-28",
      agreed_end_date: "2026-08-29",
    };
    expect(rentalRowBlocksWindow(bareDateRow, w, msk("2026-08-29", "12:00"))).toBe(true);
  });

  it("missing end falls back to start + 24h; rows without any dates never block", () => {
    const w = buildRequestedWindowMs({ rentalStartDate: "2026-08-30", rentalEndDate: "2026-08-30", rentalStartTime: "10:00", rentalEndTime: "12:00" })!;
    const noEnd = {
      vehicle_id: "b",
      status: "active",
      requested_start_date: "2026-08-29T18:00:00+00:00",
    };
    expect(rentalRowBlocksWindow(noEnd, w, msk("2026-08-29", "12:00"))).toBe(true);
    expect(rentalRowBlocksWindow({ vehicle_id: "b", status: "active" }, w, Date.now())).toBe(false);
  });

  it("agreed_* dates are used as fallback when requested_* are absent", () => {
    expect(parseStoredRentalTs("2026-08-29T11:30:00+00:00", "end")).toBe(Date.parse("2026-08-29T11:30:00+00:00"));
    // Bare calendar dates occupy the whole day (Moscow):
    expect(parseStoredRentalTs("2026-08-29", "start")).toBe(Date.parse("2026-08-29T00:00:00.000+03:00"));
    expect(parseStoredRentalTs("2026-08-29", "end")).toBe(Date.parse("2026-08-29T23:59:59.999+03:00"));
    expect(parseStoredRentalTs(null, "end")).toBeNaN();
    expect(parseStoredRentalTs("", "start")).toBeNaN();
    expect(parseStoredRentalTs(42, "end")).toBeNaN();
  });
});

describe("iter17 · checkFranchizeCarsAvailability (server action)", () => {
  const rentalsResult = vi.fn();

  const makeRentalsChain = (rows: unknown[]) => ({
    select: () => ({
      in: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => {
      if (table === "rentals") return makeRentalsChain(rentalsResult());
      throw new Error(`unexpected table ${table}`);
    });
  });

  it("reports the bike as free when an earlier rental on the same day already ended (the reported bug)", async () => {
    // Mirrors the live case on a FUTURE date so Date.now() can't interfere:
    // rental 06:30Z→08:30Z, new order 12:00→15:00 MSK (09:00Z→12:00Z) —
    // same calendar day, non-overlapping hours → must be free.
    rentalsResult.mockReturnValue([
      {
        vehicle_id: "kawasaki-ex650k",
        status: "pending_confirmation",
        requested_start_date: "2026-09-15T06:30:00+00:00",
        requested_end_date: "2026-09-15T08:30:00+00:00",
      },
    ]);
    const result = await checkFranchizeCarsAvailability({
      carIds: ["kawasaki-ex650k"],
      rentalStartDate: "2026-09-15",
      rentalEndDate: "2026-09-15",
      rentalStartTime: "12:00",
      rentalEndTime: "15:00",
    });
    expect(result).toEqual({ success: true, unavailableCarIds: [] });
  });

  it("still blocks a genuinely overlapping rental and keeps other bikes free", async () => {
    rentalsResult.mockReturnValue([
      {
        vehicle_id: "kawasaki-ex650k",
        status: "active",
        requested_start_date: "2026-09-15T09:00:00+00:00", // 12:00 MSK
        requested_end_date: "2026-09-15T12:00:00+00:00",   // 15:00 MSK
      },
      {
        vehicle_id: "yamaha-r6-2007",
        status: "active",
        requested_start_date: "2026-09-15T09:00:00+00:00",
        requested_end_date: "2026-09-15T10:00:00+00:00",   // 13:00 MSK — 13:30+grace overlaps the 12:00 request
      },
    ]);
    const result = await checkFranchizeCarsAvailability({
      carIds: ["kawasaki-ex650k", "yamaha-r6-2007", "ducati-green"],
      rentalStartDate: "2026-09-15",
      rentalEndDate: "2026-09-15",
      rentalStartTime: "12:00",
      rentalEndTime: "15:00",
    });
    expect(result.success).toBe(true);
    expect(result.unavailableCarIds).toContain("kawasaki-ex650k");
    expect(result.unavailableCarIds).toContain("yamaha-r6-2007");
    expect(result.unavailableCarIds).not.toContain("ducati-green");
  });

  it("rejects malformed HH:MM times before touching the database", async () => {
    const result = await checkFranchizeCarsAvailability({
      carIds: ["bike-1"],
      rentalStartDate: "2026-08-29",
      rentalEndDate: "2026-08-29",
      rentalStartTime: "9am",
    });
    expect(result.success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects inverted date ranges before querying Supabase", async () => {
    const result = await checkFranchizeCarsAvailability({
      carIds: ["bike-1"],
      rentalStartDate: "2026-05-08",
      rentalEndDate: "2026-05-07",
    });
    expect(result).toEqual({ success: false, error: "Проверьте диапазон дат аренды." });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("iter17 · upsertWebOrderRenterSecret (web checkout prefill write)", () => {
  const findResult = vi.fn();
  const updateCall = vi.fn();
  const insertCall = vi.fn();
  const insertResults: Array<{ error: { code?: string; message?: string } | null }> = [];

  // Chain shapes used by the helper:
  //   find:   .select("*").eq().eq().eq().maybeSingle()
  //   update: .update(data).eq().eq().eq()          (awaited → {error})
  //   insert: .insert(data)                          (awaited → {error})
  const chainFor = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: findResult(), error: null }),
            error: null, // satisfies the awaited-update shape too
          }),
        }),
      }),
    }),
    update: (data: unknown) => ({
      eq: () => ({
        eq: () => ({
          eq: async () => (updateCall(data), { error: null }),
        }),
      }),
    }),
    insert: (data: unknown) => {
      insertCall(data);
      const result = insertResults.length ? insertResults.shift()! : { error: null };
      return { error: result.error } as { error: { code?: string; message?: string } | null };
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    insertResults.length = 0;
    mocks.schema.mockReset();
    mocks.schema.mockImplementation((s: string) => {
      if (s === "private") return { from: () => chainFor() };
      throw new Error(`unexpected schema ${s}`);
    });
    findResult.mockReturnValue(null);
  });

  it("inserts a verified profile_prefill row keyed by the renter's chat_id", async () => {
    const ok = await upsertWebOrderRenterSecret({
      chatId: "724277772",
      crewSlug: "vip-bike",
      fullName: "Морозов Сергей Александрович",
      phone: "+79991234567",
      passport: "1234 567890",
      driverLicense: "99 22 334455",
      sourceRentalId: "rental-1",
    });

    expect(ok).toBe(true);
    expect(insertCall).toHaveBeenCalledTimes(1);
    const inserted = insertCall.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.chat_id).toBe("724277772");
    expect(inserted.crew_slug).toBe("vip-bike");
    expect(inserted.source_doc_key).toBe("profile_prefill");
    expect(inserted.verification_status).toBe("verified");
    expect(inserted.source_rental_id).toBe("rental-1");
    expect(inserted.renter_full_name).toBe("Морозов Сергей Александрович");
    expect(inserted.renter_passport).toBe("1234 567890");
    // Same deterministic doc_sha256 as the profile-page flow — every existing
    // read path (getRentalDocsPrefillAction & co.) picks the row up as-is.
    expect(inserted.doc_sha256).toBe(
      createHash("sha256").update("profile_prefill_724277772_vip-bike").digest("hex"),
    );
  });

  it("merges over an existing row: empty incoming fields keep stored values", async () => {
    findResult.mockReturnValue({
      chat_id: "724277772",
      crew_slug: "vip-bike",
      source_doc_key: "profile_prefill",
      renter_full_name: "Морозов Сергей Александрович",
      renter_passport: "1234 567890",
      renter_registration: "г. Москва, ул. Ленина 1",
      renter_phone: "+79991234567",
    });

    const ok = await upsertWebOrderRenterSecret({
      chatId: "724277772",
      crewSlug: "vip-bike",
      phone: "+79991112233", // updated
      // fullName/passport omitted → must NOT erase stored values
    });

    expect(ok).toBe(true);
    expect(insertCall).not.toHaveBeenCalled();
    expect(updateCall).toHaveBeenCalledTimes(1);
    const updated = updateCall.mock.calls[0][0] as Record<string, unknown>;
    expect(updated.renter_full_name).toBe("Морозов Сергей Александрович");
    expect(updated.renter_passport).toBe("1234 567890");
    expect(updated.renter_registration).toBe("г. Москва, ул. Ленина 1");
    expect(updated.renter_phone).toBe("+79991112233");
    expect(updated.verification_status).toBe("verified");
  });

  it("refuses to write anything without a chat_id or personal data", async () => {
    expect(await upsertWebOrderRenterSecret({ chatId: "  ", crewSlug: "vip-bike", fullName: "X" })).toBe(false);
    expect(await upsertWebOrderRenterSecret({ chatId: "123", crewSlug: "vip-bike" })).toBe(false);
    expect(insertCall).not.toHaveBeenCalled();
    expect(updateCall).not.toHaveBeenCalled();
  });

  it("retries WITHOUT license columns when the live DB lacks them (PGRST204)", async () => {
    // Live DB snapshot 2026-08-29: user_rental_secrets has NO license_categories /
    // license_expiry_date until migration 20260708000000 is applied — every
    // write including them fails with "Could not find the column … schema cache".
    insertResults.push({ error: { code: "PGRST204", message: "Could not find the 'license_categories' column of 'user_rental_secrets' in the schema cache" } });

    const ok = await upsertWebOrderRenterSecret({
      chatId: "724277772",
      crewSlug: "vip-bike",
      fullName: "Морозов Сергей Александрович",
      phone: "+79991234567",
      licenseCategories: "А",
      licenseExpiryDate: "01.01.2030",
    });

    expect(ok).toBe(true);
    expect(insertCall).toHaveBeenCalledTimes(2);
    const first = insertCall.mock.calls[0][0] as Record<string, unknown>;
    const retry = insertCall.mock.calls[1][0] as Record<string, unknown>;
    expect(first.license_categories).toBe("А");
    expect(retry.license_categories).toBeUndefined();
    expect(retry.license_expiry_date).toBeUndefined();
    // Everything else still lands:
    expect(retry.chat_id).toBe("724277772");
    expect(retry.renter_full_name).toBe("Морозов Сергей Александрович");
    expect(retry.renter_phone).toBe("+79991234567");
    expect(retry.verification_status).toBe("verified");
  });
});

describe("iter17 · optional license column helpers", () => {
  it("detects PostgREST schema-cache misses", async () => {
    const { isSchemaCacheMiss, stripOptionalLicenseColumns } = await import("@/app/lib/user-rental-secrets-columns");
    expect(isSchemaCacheMiss({ code: "PGRST204", message: "nope" })).toBe(true);
    expect(isSchemaCacheMiss({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isSchemaCacheMiss({ code: null, message: "Could not find the column in the schema cache" })).toBe(true);
    expect(isSchemaCacheMiss(null)).toBe(false);

    const stripped = stripOptionalLicenseColumns({ chat_id: "1", license_categories: "A", license_expiry_date: "x", renter_phone: "+7" });
    expect(stripped).toEqual({ chat_id: "1", renter_phone: "+7" });
  });

  it("profile prefill save uses the same PGRST204 fallback (source guard)", () => {
    const src = readFileSync("app/franchize/profile-actions.ts", "utf8");
    expect(src).toContain("isSchemaCacheMiss(updateError)");
    expect(src).toContain("isSchemaCacheMiss(insertError)");
    // tryVerifyUserRentalDocs upgrade path as well
    expect((src.match(/isSchemaCacheMiss/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("iter17 · source guards (wiring)", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("OrderPageClient passes the cart's rent times to the availability check", () => {
    const src = read("app/franchize/components/OrderPageClient.tsx");
    expect(src).toContain("rentalStartTime: resolvedStartTime");
    expect(src).toContain("rentalEndTime: resolvedEndTime");
  });

  it("the checkout persists renter secrets (non-fatal, crew-guarded)", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src).toContain("upsertWebOrderRenterSecret");
    expect(src).toContain("isCrewMemberOfSlug");
    // Non-fatal wrapper around the upsert so a secrets failure can never
    // break an already-completed order.
    const callSite = src.slice(src.indexOf("web-order renter secret upsert threw"));
    expect(callSite.slice(0, 800)).toContain("non-fatal");
  });

  it("the availability schema accepts optional HH:MM times", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src).toContain("rentalStartTime: z.string().trim().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).optional()");
  });
});
