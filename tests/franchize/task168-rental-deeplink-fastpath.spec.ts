// tests/franchize/task168-rental-deeplink-fastpath.spec.ts
//
// task168 (boss 2026-10-30):
//   «deeplinks like t.me/oneBikePlsBot/app?startapp=rental_<uuid> stopped
//    working, check startappparamrouter»
//   «on some phones franchize catalog page hangs … while i was waiting for
//    deeplink to trigger routing app hanged»
//   «show photos in rental page even for not authenticated users (rental
//    page opened on PC from rentals-analytics via password, nearby tab →
//    only partial info)»
//
// ROOT CAUSE (routing): rental_ params were routed ONLY behind the auth
// gate (isAppLoading || isAuthenticating) — the branch needed
// userCrewInfo.slug. The auth window = /api/validate-telegram-auth (NO
// timeout) + legacy server-action chain (NO timeout). On a stalled mobile
// network that window stretches to minutes: the deeplink «never» routes and
// the app looks hung. Rental pages are PUBLIC — the crew resolves
// server-side from the rental row, so the param now fast-paths BEFORE the
// auth gate.
//
// FIX UNDER CONTRACT:
//   1. parseRentalDetailFastParam (pure) — decision table for every
//      rental-detail param shape, with hard exclusions for the families
//      that must stay on their own gated branches.
//   2. /api/startapp/rental — crew resolver mirroring /api/startapp/vehicle
//      (rentals → cars.crew_id → crews.slug, owner fallbacks, vip-bike
//      default).
//   3. useStartParamRouter — the rental fast path sits between the wall
//      fast path and the auth gate, with the same dedupe-guard dance and
//      an honest vip-bike fallback when the lookup fails.
//   4. useTelegramAuth — AbortSignal.timeout on the validate fetch +
//      Promise.race(12s) on the legacy chain: isAuthenticating always
//      settles, the router can never be wedged behind auth forever.
//   5. Photo access — /api/franchize/rental-photos GET accepts a missing
//      actor cookie (rental-capability gate); listRentalPhotos routes a
//      null requesterUserId to the extracted isRentalPhotoViewer helper;
//      the rental page guard admits "guest" and canUpload comes from the
//      server-side cookie check.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseRentalDetailFastParam } from "@/hooks/use-start-param-target";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const UUID = "3c959da3-8bc5-4080-a136-d1a448f4bf83";
const UUID2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const ACTION = "confirm-return";

describe("task168: parseRentalDetailFastParam decision table", () => {
  it("rental_{uuid} → lookup (the boss's exact link shape)", () => {
    expect(parseRentalDetailFastParam(`rental_${UUID}`)).toEqual({
      kind: "lookup",
      rentalId: UUID,
    });
  });

  it("rental_{action}_{uuid} → lookup with the LAST segment as id (notify links)", () => {
    expect(parseRentalDetailFastParam(`rental_${ACTION}_${UUID}`)).toEqual({
      kind: "lookup",
      rentalId: UUID,
    });
    expect(parseRentalDetailFastParam(`rental_confirm-pickup_${UUID}`)).toEqual({
      kind: "lookup",
      rentalId: UUID,
    });
    expect(parseRentalDetailFastParam(`rental_view_${UUID}`)).toEqual({
      kind: "lookup",
      rentalId: UUID,
    });
  });

  it("rental-{id} / rentals-{id} (dash family) → lookup", () => {
    expect(parseRentalDetailFastParam(`rental-${UUID}`)).toEqual({ kind: "lookup", rentalId: UUID });
    expect(parseRentalDetailFastParam(`rentals-${UUID}`)).toEqual({ kind: "lookup", rentalId: UUID });
  });

  it("rentals_{id} (two segments) → bare /rentals/{id}", () => {
    expect(parseRentalDetailFastParam(`rentals_${UUID}`)).toEqual({
      kind: "bare",
      rentalId: UUID,
    });
  });

  it("rentals_{slug}_{id} (three segments) → carried, slug from the param", () => {
    expect(parseRentalDetailFastParam(`rentals_vip-bike_${UUID}`)).toEqual({
      kind: "carried",
      slug: "vip-bike",
      rentalId: UUID,
    });
  });

  it("?slug= query promotes lookup → carried (legacy searchParams behaviour)", () => {
    expect(parseRentalDetailFastParam(`rental_${UUID}`, "moto-selection")).toEqual({
      kind: "carried",
      slug: "moto-selection",
      rentalId: UUID,
    });
    expect(parseRentalDetailFastParam(`rentals_${UUID}`, "moto-selection")).toEqual({
      kind: "carried",
      slug: "moto-selection",
      rentalId: UUID,
    });
  });

  it("NEVER captures analytics family (operator drawer stays auth-gated)", () => {
    expect(parseRentalDetailFastParam(`analytics_rental_${UUID}`)).toBeNull();
    expect(parseRentalDetailFastParam("rentals_analytics")).toBeNull();
    expect(parseRentalDetailFastParam("rentals_analytics_2026-10-30")).toBeNull();
  });

  it("NEVER captures the QR claim family (rent_ / testdrive_ need auth)", () => {
    expect(parseRentalDetailFastParam("rent_kawasaki-ex650k")).toBeNull();
    expect(parseRentalDetailFastParam(`rent_kawasaki_${"a".repeat(64)}`)).toBeNull();
    expect(parseRentalDetailFastParam(`testdrive_kawasaki_${"a".repeat(64)}`)).toBeNull();
  });

  it("NEVER captures the sale family (legacy, untouched)", () => {
    expect(parseRentalDetailFastParam(`sale-${UUID}`)).toBeNull();
    expect(parseRentalDetailFastParam(`sale_${UUID}`)).toBeNull();
  });

  it("unrelated params → null", () => {
    expect(parseRentalDetailFastParam("profile")).toBeNull();
    expect(parseRentalDetailFastParam("rental")).toBeNull();
    expect(parseRentalDetailFastParam("rentals")).toBeNull();
    expect(parseRentalDetailFastParam("rental_")).toBeNull();
    expect(parseRentalDetailFastParam("crew_vip-bike")).toBeNull();
  });

  it("invalid carried slug (uppercase/underscore) degrades to lookup, never to a 404 slug URL", () => {
    expect(parseRentalDetailFastParam(`rentals_VIP-BIKE_${UUID}`)).toEqual({
      kind: "lookup",
      rentalId: UUID,
    });
  });
});

describe("task168: /api/startapp/rental crew resolver contract", () => {
  const src = read("app/api/startapp/rental/route.ts");

  it("mirrors the vehicle resolver: rentals → cars.crew_id → crews.slug", () => {
    expect(src).toContain('.from("rentals")');
    expect(src).toContain('.from("cars")');
    expect(src).toContain('.from("crews")');
    expect(src).toContain('eq("rental_id", rentalId)');
    expect(src).toContain('eq("id", rental.vehicle_id)');
    expect(src).toContain('eq("id", car.crew_id)');
  });

  it("keeps the owner fallbacks and the vip-bike default", () => {
    expect(src).toContain('eq("owner_id", car.owner_id)');
    expect(src).toContain('eq("owner_id", rental.owner_id)');
    expect(src).toContain('slug = "vip-bike"');
  });

  it("never leaks rental payload — only the slug + found flag", () => {
    expect(src).toContain("found: false");
    expect(src).toContain("found: true");
    // No rental row fields in the response bodies
    expect(src).not.toMatch(/NextResponse\.json\(\{[^}]*(user_id|owner_id|vehicle_id)/);
  });
});

describe("task168: router wiring — rental fast path precedes the auth gate", () => {
  const src = read("hooks/useStartParamRouter.ts");

  it("fast path block sits BEFORE the isAppLoading/isAuthenticating gate", () => {
    const fastIdx = src.indexOf("parseRentalDetailFastParam(paramToProcess");
    const gateIdx = src.indexOf("if (isAppLoading || isAuthenticating)");
    expect(fastIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(fastIdx);
  });

  it("uses the same dedupe-guard dance as the static/wall fast paths", () => {
    expect(src).toContain(
      "lastHandledStartParamRef.current !== paramToProcess && activeStartParamRef.current !== paramToProcess",
    );
  });

  it("marks the param handled SYNCHRONOUSLY before the await (no double navigation)", () => {
    const block = src.slice(
      src.indexOf("const rentalFastLink = parseRentalDetailFastParam"),
      src.indexOf("if (isAppLoading || isAuthenticating)"),
    );
    const markIdx = block.indexOf("lastHandledStartParamRef.current = paramToProcess;");
    const awaitIdx = block.indexOf("await fetch(");
    expect(markIdx).toBeGreaterThan(-1);
    expect(awaitIdx).toBeGreaterThan(markIdx);
  });

  it("falls back to the honest vip-bike rental page when the lookup fails", () => {
    expect(src).toContain("/franchize/vip-bike/rental/");
  });

  it("clears the start param after the fast-path route", () => {
    const block = src.slice(
      src.indexOf("const rentalFastLink = parseRentalDetailFastParam"),
      src.indexOf("if (isAppLoading || isAuthenticating)"),
    );
    expect(block).toContain("clearStartParam?.()");
  });
});

describe("task168: auth window always settles (no more wedged router)", () => {
  const src = read("hooks/telegram/useTelegramAuth.ts");

  it("validate fetch carries AbortSignal.timeout", () => {
    expect(src).toContain("AbortSignal.timeout(10_000)");
  });

  it("legacy chain races a 12s timeout instead of hanging forever", () => {
    expect(src).toContain("Promise.race");
    expect(src).toContain("12_000");
  });

  it("timeout produces an honest thrown error (→ catch → finally releases the gate)", () => {
    expect(src).toContain('throw new Error("Telegram authentication timed out.")');
  });
});

describe("task168: photos visible for unauthenticated viewers", () => {
  it("rental-photos GET no longer 401s on a missing cookie", () => {
    const src = read("app/api/franchize/rental-photos/route.ts");
    expect(src).not.toContain("status: 401");
    expect(src).toContain("callerUserId = verifyTelegramActorCookieValue(actorCookie)");
  });

  it("listRentalPhotos accepts a null requesterUserId (capability gate)", () => {
    const src = read("app/rentals/photo-actions.ts");
    expect(src).toContain("requesterUserId?: string | null");
    expect(src).toContain("await isRentalPhotoViewer(rental, requesterUserId)");
  });

  it("per-user authorization extracted verbatim into isRentalPhotoViewer", () => {
    const src = read("app/rentals/photo-actions.ts");
    expect(src).toContain("async function isRentalPhotoViewer(");
    // The subrenter + crew-member grants survived the extraction
    expect(src).toContain('specs["subrenter_chat_id"]');
    expect(src).toContain('"co_owner"');
    expect(src).toContain('membership?.membership_status === "active"');
  });

  it("rental page guard admits guests; upload stays signed-actor-only", () => {
    const src = read("app/franchize/[slug]/rental/[id]/page.tsx");
    const galleryIdx = src.indexOf('id="rental-photo-gallery"');
    const block = src.slice(Math.max(0, galleryIdx - 1400), galleryIdx + 600);
    expect(block).toContain('"guest"');
    expect(block).toContain("canUpload={Boolean(viewerActorId)}");
  });

  it("upload endpoint keeps requiring the actor cookie (not loosened)", () => {
    const upload = read("app/api/franchize/rental-photo-upload/route.ts");
    expect(upload).toContain("verifyTelegramActorCookieValue");
  });
});
