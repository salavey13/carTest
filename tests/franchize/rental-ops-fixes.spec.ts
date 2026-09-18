// tests/franchize/rental-ops-fixes.spec.ts
//
// 2026-09-19 rental-ops robustness pack:
//   1. rental-cascade.ts — auto-close linked equipment rentals when the bike
//      rental closes; extendRental supersede flow (close original with
//      "superseded" comment + re-link equipment to the new rental).
//   2. photo-actions uploadRentalPhoto — storage path collision retry
//      (concurrent uploads used to fail with 409 → photo never appeared).
//   3. listRentalPhotos — soft-deleted photos excluded.
//   4. RentalPhotoGallery — silent re-fetch of expired signed URLs
//      (<img> onError + visibilitychange) + hiddenCount surfacing.
//   5. avito webhook — notifyCrewOwnerAsync is AWAITED (Vercel freeze
//      used to cut the fire-and-forget delivery randomly).
//   6. Wiring assertions: confirmVehicleReturn / updateRentalStatus /
//      extendRental call the cascade; modal explains the auto-close.
//
// Run: npx vitest run tests/franchize/rental-ops-fixes.spec.ts

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Thenable chain (same pattern as equipment-rentals.spec.ts). */
function chain(result: { data: any; error: any } = { data: null, error: null }) {
  const c: any = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    is: vi.fn(() => c),
    in: vi.fn(() => c),
    order: vi.fn(() => c),
    limit: vi.fn(() => c),
    update: vi.fn(() => c),
    insert: vi.fn(() => c),
    delete: vi.fn(() => c),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return c;
}

const supabaseMock = vi.hoisted(() => {
  const storageApi = {
    listBuckets: vi.fn(async () => ({ data: [], error: null })),
    createBucket: vi.fn(async () => ({ data: {}, error: null })),
    upload: vi.fn(async () => ({ data: {}, error: null })),
    remove: vi.fn(async () => ({ data: {}, error: null })),
    download: vi.fn(async () => ({ data: {}, error: null })),
  };
  return {
    from: vi.fn(() => chain()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: { from: vi.fn(() => storageApi), ...storageApi },
  };
});

vi.mock("@/lib/supabase-server", () => ({ supabaseAdmin: supabaseMock }));

import { closeLinkedEquipmentRentals, supersedeRentalForExtension } from "@/app/rentals/rental-cascade";
import { uploadRentalPhoto, listRentalPhotos } from "@/app/rentals/photo-actions";
import { supabaseAdmin } from "@/lib/supabase-server";

const readRepo = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// rental-cascade: closeLinkedEquipmentRentals
// ─────────────────────────────────────────────────────────────────────────────

describe("rental-cascade.closeLinkedEquipmentRentals", () => {
  it("auto-closes open equipment rows linked via metadata.primary_rental_id and marks them auto_closed", async () => {
    const updatePayloads: any[] = [];
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "rentals") {
        const c = chain({
          data: [
            { rental_id: "gear-1", status: "active", metadata: { item_type: "equipment", equipment_title: "Шлем" } },
            { rental_id: "gear-2", status: "active", metadata: { item_type: "equipment", equipment_condition: "Есть повреждения" } },
          ],
          error: null,
        });
        const origUpdate = c.update;
        c.update = vi.fn((payload: any) => {
          updatePayloads.push(payload);
          return origUpdate(payload);
        });
        return c;
      }
      return chain(); // crew_todos etc.
    });

    const res = await closeLinkedEquipmentRentals("bike-1", "op-777", { reason: "bike_rental_returned" });

    expect(res.closed).toBe(2);
    expect(res.rentalIds).toEqual(["gear-1", "gear-2"]);
    expect(res.error).toBeUndefined();

    // Both rows closed as completed with auto_closed metadata (patch, not replace)
    expect(updatePayloads).toHaveLength(2);
    for (const p of updatePayloads) {
      expect(p.status).toBe("completed");
      expect(p.metadata.auto_closed.reason).toBe("bike_rental_returned");
      expect(p.metadata.auto_closed.primary_rental_id).toBe("bike-1");
      expect(p.metadata.auto_closed.by).toBe("op-777");
      expect(typeof p.metadata.returned_at).toBe("string");
      expect(p.metadata.item_type).toBe("equipment");
    }
    // Existing condition preserved / default set
    expect(updatePayloads[0].metadata.equipment_condition).toBe("Норм");
    expect(updatePayloads[1].metadata.equipment_condition).toBe("Есть повреждения");

    // Return todos closed
    const todosChain = supabaseMock.from.mock.results.length;
    void todosChain;
    expect(supabaseMock.from).toHaveBeenCalledWith("crew_todos");
  });

  it("returns closed=0 when nothing is linked (no-op)", async () => {
    supabaseMock.from.mockImplementation(() => chain({ data: [], error: null }));
    const res = await closeLinkedEquipmentRentals("bike-without-gear", "op-777");
    expect(res.closed).toBe(0);
    expect(res.rentalIds).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rental-cascade: supersedeRentalForExtension (extendRental flow)
// ─────────────────────────────────────────────────────────────────────────────

describe("rental-cascade.supersedeRentalForExtension", () => {
  /** Universal rentals chain: maybeSingle → original, awaited queries → linked
   *  list, update() → captured (with the eq("rental_id") bound to it).
   *  Order-independent. */
  function universalRentalsChain(opts: {
    original: any;
    linked: any[];
    onUpdate: (payload: any, rentalId: string | null) => void;
  }) {
    const c: any = chain({ data: null, error: null });
    let pendingUpdate: any = null;
    c.maybeSingle = vi.fn(async () => ({ data: opts.original, error: null }));
    const origUpdate = c.update;
    c.update = vi.fn((payload: any) => {
      pendingUpdate = payload;
      return origUpdate(payload);
    });
    const origEq = c.eq;
    c.eq = vi.fn((col: string, val: unknown) => {
      if (col === "rental_id" && pendingUpdate) {
        opts.onUpdate(pendingUpdate, typeof val === "string" ? val : null);
        pendingUpdate = null;
      }
      return origEq(col, val);
    });
    c.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: opts.linked, error: null }).then(resolve, reject);
    return c;
  }

  it("closes an ACTIVE original as superseded and re-links open equipment to the new rental", async () => {
    const updates: Array<{ payload: any; id: string | null }> = [];

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== "rentals") return chain();
      return universalRentalsChain({
        original: { rental_id: "orig-1", status: "active", metadata: { history: [{ status: "active", at: "t0" }] } },
        linked: [{ rental_id: "gear-1", status: "active", metadata: { item_type: "equipment" } }],
        onUpdate: (payload, id) => updates.push({ payload, id }),
      });
    });

    const res = await supersedeRentalForExtension({
      originalRentalId: "orig-1",
      newRentalId: "new-999",
      closedBy: "op-1",
    });

    expect(res.ok).toBe(true);
    expect(res.closedOriginal).toBe(true);
    expect(res.relinkedEquipment).toBe(1);

    // Exactly two updates: the original (supersede) + the gear re-link
    expect(updates).toHaveLength(2);
    const orig = updates.find((u) => u.id === "orig-1")!;
    expect(orig.payload.status).toBe("completed");
    expect(orig.payload.metadata.superseded_by).toBe("new-999");
    expect(orig.payload.metadata.superseded_reason).toBe("prolonged");
    expect(orig.payload.metadata.superseded_by_actor).toBe("op-1");
    const lastHistory = orig.payload.metadata.history[orig.payload.metadata.history.length - 1];
    expect(lastHistory.message).toContain("продлена");
    expect(lastHistory.message).toContain("new-999".slice(0, 8));

    // Re-link update: gear now points at the NEW rental
    const relink = updates.find((u) => u.id === "gear-1")!;
    expect(relink.payload.metadata.primary_rental_id).toBe("new-999");
    expect(relink.payload.metadata.relinked_from_primary).toBe("orig-1");
  });

  it("does NOT change status of an already-completed original (markers only)", async () => {
    const updates: Array<{ payload: any; id: string | null }> = [];

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== "rentals") return chain();
      return universalRentalsChain({
        original: { rental_id: "orig-2", status: "completed", metadata: {} },
        linked: [],
        onUpdate: (payload, id) => updates.push({ payload, id }),
      });
    });

    const res = await supersedeRentalForExtension({
      originalRentalId: "orig-2",
      newRentalId: "new-777",
      closedBy: "op-1",
    });

    expect(res.ok).toBe(true);
    expect(res.closedOriginal).toBe(false);
    expect(res.relinkedEquipment).toBe(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("orig-2");
    expect(updates[0].payload.status).toBeUndefined(); // markers only
    expect(updates[0].payload.metadata.superseded_by).toBe("new-777");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// photo-actions: collision retry + deleted filter
// ─────────────────────────────────────────────────────────────────────────────

describe("photo-actions robustness", () => {
  it("retries the storage upload on path collision and succeeds with a suffixed path", async () => {
    const smallJpeg = Buffer.from(
      "89504e470d0a1a0a0000000d494844520000000100000001080600000" + "01f15c4890000000a49444154789c6300010000050001" + "0d0a2db4",
      "hex",
    );
    // Real-ish flow needs sharp to accept the buffer; skip sharp by testing
    // through a tiny valid PNG via sharp is unnecessary — mock validateUpload
    // to pass and use a real 1x1 JPEG produced by sharp itself.
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#0f0" } })
      .jpeg()
      .toBuffer();

    void smallJpeg;

    // rentals lookup for validateUpload (renter matches)
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "rentals") {
        return chain({
          data: { rental_id: "r-1", user_id: "u-1", owner_id: "o-1", vehicle_id: "v-1", status: "active", agreed_start_date: null, metadata: null, updated_at: null },
          error: null,
        });
      }
      if (table === "cars") {
        return chain({ data: { crew_id: "crew-1", specs: {} }, error: null });
      }
      if (table === "crew_members") {
        return chain({ data: null, error: null });
      }
      if (table === "rental_photos") {
        const c = chain({ data: null, error: null });
        // dedup check → maybeSingle null (no dup); count query awaited (then) → 0;
        // insert.select().single() → photo row
        (c as any).single = vi.fn(async () => ({ data: { id: "photo-new" }, error: null }));
        return c;
      }
      return chain();
    });

    // Storage: first two uploads collide, third succeeds
    const storageFrom = supabaseAdmin.storage.from as unknown as ReturnType<typeof vi.fn>;
    const storageApi = storageFrom.mock.results.length ? storageFrom() : storageFrom();
    const upload = storageApi.upload as ReturnType<typeof vi.fn>;
    upload.mockReset();
    upload
      .mockResolvedValueOnce({ data: null, error: { message: "Duplicate", statusCode: "409" } })
      .mockResolvedValueOnce({ data: null, error: { message: "The resource already exists" } })
      .mockResolvedValueOnce({ data: { path: "ok" }, error: null });

    const res = await uploadRentalPhoto({
      rentalId: "r-1",
      photoType: "end",
      file: jpeg,
      mimeType: "image/jpeg",
      uploaderUserId: "u-1",
      source: "webapp",
    });

    expect(res.success).toBe(true);
    expect(res.deduped).toBeUndefined();
    expect(upload).toHaveBeenCalledTimes(3);
    // The successful path differs from the first (collided) path
    const firstPath = upload.mock.calls[0][0] as string;
    const lastPath = upload.mock.calls[2][0] as string;
    expect(lastPath).not.toBe(firstPath);
    expect(lastPath.endsWith(".jpg")).toBe(true);
  });

  it("listRentalPhotos query excludes soft-deleted photos (deleted_at IS NULL)", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "rentals") {
        return chain({ data: { rental_id: "r-1", user_id: "u-1", owner_id: null, vehicle_id: null }, error: null });
      }
      if (table === "rental_photos") {
        return chain({ data: [], error: null });
      }
      return chain();
    });

    const res = await listRentalPhotos("r-1", undefined, "u-1");
    expect(res.success).toBe(true);
    expect(res.photos).toEqual([]);

    // Find the rental_photos chain and assert .is("deleted_at", null) was applied
    const photosCalls = supabaseMock.from.mock.calls.filter(([t]) => t === "rental_photos");
    expect(photosCalls.length).toBeGreaterThan(0);
    const lastPhotosResult = supabaseMock.from.mock.results
      .map((r) => r.value)
      .reverse()
      .find((c: any) => typeof c?.is === "function");
    expect(lastPhotosResult).toBeDefined();
    expect(lastPhotosResult.is).toHaveBeenCalledWith("deleted_at", null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wiring / source assertions
// ─────────────────────────────────────────────────────────────────────────────

describe("rental-ops wiring (source assertions)", () => {
  it("extendRental supersedes the original and reports it to operator/renter/admin", () => {
    const src = readRepo("app/rentals/actions.ts");
    expect(src).toContain("supersedeRentalForExtension");
    expect(src).toContain("supersedeNote");
    expect(src).toContain("закрыта автоматически (продлена)");
    expect(src).toContain("(закрыт как продлённый)");
  });

  it("confirmVehicleReturn auto-closes linked equipment rentals", () => {
    const src = readRepo("app/rentals/actions.ts");
    expect(src).toContain("closeLinkedEquipmentRentals");
    expect(src).toContain("bike_rental_returned");
  });

  it("updateRentalStatus (dashboard) auto-closes linked equipment on completion only", () => {
    const src = readRepo("app/franchize/server-actions/rentals-dashboard.ts");
    expect(src).toContain("closeLinkedEquipmentRentals");
    expect(src).toContain('status === "completed" && previousStatus !== "completed"');
    expect(src).toContain("bike_rental_completed");
  });

  it("avito webhook awaits the new-lead notification (no more fire-and-forget)", () => {
    const src = readRepo("app/api/webhooks/avito/route.ts");
    expect(src).toContain("await notifyCrewOwnerAsync(");
    expect(src).not.toContain("void notifyNewLead(");
    // notifyCrewOwnerAsync returns the promise instead of void
    expect(src).toContain("): Promise<unknown> {");
  });

  it("callback-lead (website) notification stays awaited with owner+admins+global admin recipients", () => {
    const src = readRepo("app/api/franchize/callback-lead/route.ts");
    expect(src).toContain("await notifyNewLead(");
    expect(src).toContain("includeMembers: false");
  });

  it("RentalPhotoGallery silently re-fetches expired signed URLs and surfaces hidden photos", () => {
    const src = readRepo("app/franchize/components/RentalPhotoGallery.tsx");
    expect(src).toContain("visibilitychange");
    expect(src).toContain("scheduleSilentRefresh");
    expect(src).toContain("markPhotoBroken");
    expect(src).toContain("onError");
    expect(src).toContain("hiddenCount");
  });

  it("RentalExtendModal explains the automatic supersede close", () => {
    const src = readRepo("app/franchize/components/RentalExtendModal.tsx");
    expect(src).toContain("закроется");
    expect(src).toContain("продлена");
  });
});
