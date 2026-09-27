// tests/franchize/rental-selfservice-wiring.spec.ts
// 2026-09-28: source-level wiring assertions for the renter self-service batch:
//   - start-odometer editing (web-flow renter) on the rental page + API;
//   - end-odometer draft context (page editor → closure modal prefill flush);
//   - keyboard-aware modals (visualViewport padding + bottom-sheet on mobile);
//   - dynamic todos on the rental page (getRentalPageTodos + RentalTodosPanel);
//   - webhook parity: equipment snapshot / odometer hint / todos / achievements;
//   - renter self-service achievement grants + catalog entries.
// Wiring is asserted on SOURCE (mount drags the whole server graph — repo
// convention, see order-draft-wiring.spec.ts); pure logic is unit-tested.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

describe("rental page self-service wiring", () => {
  const page = read("app/franchize/[slug]/rental/[id]/page.tsx");

  it("wraps the editor + lifecycle actions in the shared draft provider", () => {
    expect(page.includes("<RentalOdometerDraftProvider initialDraft={odometerAfterDraft}>")).toBe(true);
    const providerOpen = page.indexOf("<RentalOdometerDraftProvider");
    const editor = page.indexOf("<RentalOdometerInput");
    const lifecycle = page.indexOf("<FranchizeRentalLifecycleActions");
    const providerClose = page.indexOf("</RentalOdometerDraftProvider>");
    expect(providerOpen).toBeGreaterThan(-1);
    expect(providerClose).toBeGreaterThan(providerOpen);
    expect(editor).toBeGreaterThan(providerOpen);
    expect(editor).toBeLessThan(providerClose);
    expect(lifecycle).toBeGreaterThan(providerOpen);
    expect(lifecycle).toBeLessThan(providerClose);
  });

  it("passes the start-odometer hint/freezes props to the editor", () => {
    expect(page.includes("odometerBeforeIsHint={!odometerBeforeConfirmed}")).toBe(true);
    expect(page.includes("hasPickupFreeze={hasPickupFreeze}")).toBe(true);
    // confirmed chain = freeze reading OR a real odometer_before
    expect(page.includes('typeof rentalMeta?.pickup_freeze?.odometer_km === "number"')).toBe(true);
    expect(page.includes('typeof rentalMeta?.odometer_before === "number"')).toBe(true);
  });

  it("fetches dynamic rental todos server-side and feeds RentalTodosPanel", () => {
    expect(page.includes("getRentalPageTodos(id, crew.id, { bootstrap: Boolean(viewerActorId) })")).toBe(true);
    expect(page.includes("<RentalTodosPanel")).toBe(true);
    expect(page.includes("initialTodos={rentalTodosData}")).toBe(true);
    // the static-fallback checklist is gone from the page
    expect(page.includes("<RentalReturnChecklist")).toBe(false);
  });

  it("provider nesting matches: provider opens before the boundary and closes after it", () => {
    const providerOpen = page.indexOf("<RentalOdometerDraftProvider");
    const boundaryOpen = page.indexOf('fallbackTitle="Блок аренды временно недоступен"');
    const boundaryClose = page.indexOf("</FranchizeErrorBoundary>", boundaryOpen);
    const providerClose = page.indexOf("</RentalOdometerDraftProvider>");
    expect(providerOpen).toBeLessThan(boundaryOpen);
    expect(providerClose).toBeGreaterThan(boundaryClose);
  });
});

describe("rental odometer API: start mode", () => {
  const route = read("app/api/franchize/rental-odometer/route.ts");

  it("accepts field=start and only in the pre-pickup phase", () => {
    expect(route.includes('field?: "start" | "end"')).toBe(true);
    expect(route.includes('rental.status !== "pending_confirmation" && rental.status !== "confirmed"')).toBe(true);
  });

  it("refuses to override a frozen handover reading", () => {
    expect(route.includes('Выдача уже зафиксирована — стартовый одометр изменить нельзя.')).toBe(true);
  });

  it("writes odometer_before + source + timestamp (doc-flow parity)", () => {
    expect(route.includes("odometer_before: startValue")).toBe(true);
    expect(route.includes("odometer_before_source: actorKind")).toBe(true);
    expect(route.includes("odometer_before_at: new Date().toISOString()")).toBe(true);
  });

  it("boss R1 #1: metadata writes are CAS-conditional on updated_at (no lost updates)", () => {
    expect(route.includes("const casUpdate = async (")).toBe(true);
    expect(route.includes('{ count: "exact" }')).toBe(true);
    expect(route.includes('updateQuery.is("updated_at", null)')).toBe(true);
    expect(route.includes('updateQuery.eq("updated_at", seenUpdatedAt)')).toBe(true);
    // both modes route their writes through the CAS helper
    expect((route.match(/await casUpdate\(/g) ?? []).length).toBe(2);
  });

  it("boss R1 #6: a start reading below the last-known odometer is flagged", () => {
    expect(route.includes("odometer_before_below_known: true")).toBe(true);
  });

  it("boss R1 #7: a null start value is an honest no-op (no metadata touch)", () => {
    expect(route.includes("noop: true")).toBe(true);
  });

  it("unknown field values are rejected, not silently defaulted", () => {
    expect(route.includes("field должен быть start или end.")).toBe(true);
  });

  it("grants the renter odometer achievement on the renter path only", () => {
    const grantIdx = route.indexOf("grantRenterStartOdometer");
    expect(grantIdx).toBeGreaterThan(-1);
    expect(route.includes("if (isRenterActor && !access.ok && cookieUserId) {")).toBe(true);
  });
});

describe("odometer editor component", () => {
  const input = read("app/franchize/components/RentalOdometerInput.tsx");

  it("renders the START editor pre-pickup (no freeze) and the END editor when active", () => {
    expect(input.includes("const canEditStart =")).toBe(true);
    expect(input.includes("(status === \"pending_confirmation\" || status === \"confirmed\") && !hasPickupFreeze")).toBe(true);
    expect(input.includes("<OdometerStartEditor")).toBe(true);
    expect(input.includes("<OdometerEditor")).toBe(true);
  });

  it("saves the start value via field:start and reports end saves to the draft store", () => {
    expect(input.includes('field: "start"')).toBe(true);
    expect(input.includes("draftStore?.reportSaved(value)")).toBe(true);
  });

  it("exposes a flush so a pending debounced save cannot be lost", () => {
    expect(input.includes("pendingRef")).toBe(true);
    expect(input.includes("draftStore.registerFlush(")).toBe(true);
  });
});

describe("closure modal robustness", () => {
  const lifecycle = read("app/franchize/components/FranchizeRentalLifecycleActions.tsx");

  it("prefills from the flushed draft store (falls back to the server prop)", () => {
    expect(lifecycle.includes("draftStore?.flushAndGetDraft()")).toBe(true);
    expect(lifecycle.includes("setDraftHint(draft ?? null)")).toBe(true);
  });

  it("shows the draft-source hint inside the modal", () => {
    expect(lifecycle.includes("Подставлен черновик со страницы")).toBe(true);
  });

  it("is keyboard-aware: bottom-sheet on mobile + visualViewport padding", () => {
    expect(lifecycle.includes("useKeyboardAwareOverlay(closureOverlayRef, closureModalOpen)")).toBe(true);
    expect(lifecycle.includes("useKeyboardAwareOverlay(abortOverlayRef, abortModalOpen)")).toBe(true);
    expect(lifecycle.includes("items-end justify-center overflow-y-auto sm:items-center sm:p-4")).toBe(true);
    expect(lifecycle.includes("paddingBottom: closureKeyboardPx > 0 ? closureKeyboardPx : undefined")).toBe(true);
  });

  it("hook tracks the visualViewport gap with a noise threshold", () => {
    const hook = read("app/franchize/components/useKeyboardAwareOverlay.ts");
    expect(hook.includes("window.innerHeight - vv.height - vv.offsetTop")).toBe(true);
    expect(hook.includes("gap > 120")).toBe(true);
  });

  it("root viewport opts Android WebView into resizes-content", () => {
    const layout = read("app/layout.tsx");
    expect(layout.includes("interactiveWidget: 'resizes-content'")).toBe(true);
  });
});

describe("dynamic todos", () => {
  const server = read("app/franchize/server-actions/rentals.ts");

  it("getRentalPageTodos matches by rental_id column OR description JSON", () => {
    const fn = server.slice(server.indexOf("export async function getRentalPageTodos"), server.indexOf("ensureRentalEquipmentReturnTodosForWebhook"));
    expect(fn.includes('typeof t.rental_id === "string" && t.rental_id === rentalId')).toBe(true);
    expect(fn.includes("desc.rental_id === rentalId")).toBe(true);
  });

  it("lazily bootstraps missing verification AND equipment-return todos", () => {
    const fn = server.slice(server.indexOf("export async function getRentalPageTodos"), server.indexOf("ensureRentalEquipmentReturnTodosForWebhook"));
    expect(fn.includes('t.category === "rental_verification"')).toBe(true);
    expect(fn.includes('t.category === "lead_followup"')).toBe(true);
    expect(fn.includes("ensureRentalEquipmentReturnTodos(rentalId, crewId)")).toBe(true);
  });

  it("boss R1 #3: crew-match guard + auth-gated bootstrap (no anonymous writes)", () => {
    const fn = server.slice(server.indexOf("export async function getRentalPageTodos"), server.indexOf("ensureRentalEquipmentReturnTodosForWebhook"));
    expect(fn.includes("const bootstrap =")).toBe(true);
    expect(fn.includes("opts.bootstrap === true && rentalCrewId != null && rentalCrewId === crewId")).toBe(true);
    const page = read("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page.includes("verifyTelegramActorCookieValue")).toBe(true);
    expect(page.includes("{ bootstrap: Boolean(viewerActorId) }")).toBe(true);
  });

  it("verification todo creation is idempotent (webhook retry-safe)", () => {
    const ver = read("app/franchize/server-actions/rental-verification-todos.ts");
    const fn = ver.slice(ver.indexOf("export async function createRentalVerificationTodos"));
    expect(fn.indexOf('eq("category", "rental_verification")')).toBeGreaterThan(-1);
    expect(fn.indexOf("return { success: true, created: 0 }")).toBeGreaterThan(-1);
  });

  it("panel is toggle-only for crew and read-only for the renter", () => {
    const panel = read("app/franchize/components/RentalTodosPanel.tsx");
    expect(panel.includes('["owner", "admin", "co_owner", "member"].includes(membership.role)')).toBe(true);
    expect(panel.includes("if (total === 0 && !canToggle) return null;")).toBe(true);
  });
});

describe("webhook XTR-path salary parity + side effects", () => {
  const hook = read("app/webhook-handlers/franchize-order.ts");

  it("derives metadata.equipment from the cart perk string (actions-runtime parity)", () => {
    expect(hook.includes("const equipmentSnapshot = (() => {")).toBe(true);
    expect(hook.includes("helmets: m ? Number(m[1]) : (/шлем/.test(perkStr) ? 1 : 0)")).toBe(true);
    expect(hook.includes("...equipmentSnapshot,")).toBe(true);
  });

  it("seeds the odometer hint from bike specs", () => {
    expect(hook.includes("...odometerHintSnapshot,")).toBe(true);
    expect(hook.includes("odometer_before_hint: Math.round(specOdometer)")).toBe(true);
  });

  it("spawns verification + equipment-return todos (non-fatal)", () => {
    expect(hook.includes("createRentalVerificationTodos(rentalId, crewUuid, userId)")).toBe(true);
    expect(hook.includes("ensureRentalEquipmentReturnTodosForWebhook(rentalId, crewUuid)")).toBe(true);
    expect(hook.includes("Promise.allSettled")).toBe(true);
  });

  it("grants the renter self-service achievement (non-fatal)", () => {
    expect(hook.includes("grantRenterWebRentCreated({ userId, slug, rentalId })")).toBe(true);
  });

  it("boss R1 #2: retry-safe — existing metadata wins, side effects skip on redelivery", () => {
    expect(hook.includes("const rentalAlreadyExisted = Boolean(existingRental);")).toBe(true);
    expect(hook.includes("...(rentalAlreadyExisted && existingRentalMetadata ? existingRentalMetadata : {}),")).toBe(true);
    expect(hook.includes("if (!rentalAlreadyExisted) {")).toBe(true);
    // the fetch-first pre-check exists right before the upsert
    const preIdx = hook.indexOf('from("rentals")');
    expect(preIdx).toBeGreaterThan(-1);
  });

  it("boss R1 #8: single-bike XTR assumption documented at firstItemId", () => {
    expect(hook.includes("Documented gap (boss R1 #8)")).toBe(true);
  });
});

describe("renter self-service achievements", () => {
  const mod = read("app/franchize/server-actions/renter-self-service-achievements.ts");
  const catalog = read("app/franchize/profile-actions.ts");

  it("catalog defines the five renter badges with matching ids", () => {
    for (const id of [
      "rental_self_created",
      "rental_self_created_3",
      "rental_own_photos_start",
      "rental_own_odometer_start",
      "rental_full_selfservice",
    ]) {
      expect(catalog.includes(`id: "${id}"`)).toBe(true);
    }
  });

  it("combo badge requires all three base conditions", () => {
    expect(mod.includes("webRentsCreated")).toBe(true);
    expect(mod.includes("selfServiceStartPhotos")).toBe(true);
    expect(mod.includes("selfServiceStartOdometer")).toBe(true);
    expect(mod.includes("COMBO_PARTS")).toBe(true);
  });

  it("3-web-rents streak badge fires from the stored counter", () => {
    expect(mod.includes("const created = (Number(counters.webRentsCreated) || 0) + 1;")).toBe(true);
    expect(mod.includes("if (created >= 3)")).toBe(true);
  });

  it("photo master counts DISTINCT rentals from rental_photos (≥10)", () => {
    expect(mod.includes('.from("rental_photos")')).toBe(true);
    expect(mod.includes("distinctRentals.size >= 10")).toBe(true);
  });

  it("slug resolution walks rental.crew_id → cars.crew_id → crews.slug", () => {
    expect(mod.includes('from("rentals")')).toBe(true);
    expect(mod.includes('from("cars")')).toBe(true);
    expect(mod.includes('from("crews")')).toBe(true);
  });

  it("photo upload hook fires achievements with the derived role (non-fatal)", () => {
    const photo = read("app/rentals/photo-actions.ts");
    expect(photo.includes("grantRentalPhotoAchievements({")).toBe(true);
    expect(photo.includes("isRenter: derivedRole === \"renter\"")).toBe(true);
  });

  it("renters with badges see toasts (hard crew skip became conditional)", () => {
    const sync = read("app/franchize/components/AchievementToastSync.tsx");
    expect(sync.includes("!access.canOpen && Object.keys(result.data.achievements).length === 0")).toBe(true);
  });
});

describe("winter storage boss-review fixes (R2)", () => {
  it("#2: photo deletion confirms via toast action, never window.confirm", () => {
    const story = read("app/franchize/[slug]/storage/StorageBikeStoryClient.tsx");
    expect(story.includes("if (!window.confirm")).toBe(false);
    expect((story.match(/window\.confirm\(/g) ?? []).length).toBe(0);
    expect(story.includes('toast("Удалить это фото из истории хранения?"')).toBe(true);
  });

  it("#6+#7: delete is staff-only, removes the file FIRST, logs a tamper event", () => {
    const actions = read("app/franchize/server-actions/storage-bikes.ts");
    const fn = actions.slice(actions.indexOf("export async function deleteStorageBikePhotoAction"));
    const body = fn.slice(0, fn.indexOf("/**") === -1 ? undefined : fn.indexOf("/**", 10));
    expect(body.includes("if (!loaded.isStaff)")).toBe(true);
    expect(body.indexOf("storage.from(STORAGE_PHOTO_BUCKET).remove")).toBeGreaterThan(-1);
    expect(body.indexOf("remove") < body.indexOf("contains(\"photo_paths\"")).toBe(true);
    expect(body.includes("Фото удалено из истории")).toBe(true);
  });

  it("#10: status move is conditional on the loaded status (CAS)", () => {
    const actions = read("app/franchize/server-actions/storage-bikes.ts");
    expect(actions.includes('.eq("status", currentStatus)')).toBe(true);
    expect(actions.includes("Статус уже изменён кем-то из экипажа")).toBe(true);
  });

  it("#9: initData fallback is freshness-capped", () => {
    const actions = read("app/franchize/server-actions/storage-bikes.ts");
    expect(actions.includes("isTelegramInitDataFresh(params.initData)")).toBe(true);
  });

  it("#12: storage mutations pass actorUserId alongside initData", () => {
    for (const client of [
      "app/franchize/[slug]/storage/StorageWallClient.tsx",
      "app/franchize/[slug]/storage/StorageBikeStoryClient.tsx",
    ]) {
      const src = read(client);
      expect((src.match(/actorUserId: dbUser\?\.user_id,/g) ?? []).length).toBeGreaterThan(0);
    }
  });

  it("#3+#5+#8: storage checkout gates identity, recomputes money server-side", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    // identity gate on the live checkout path (next to the testdrive gate)
    expect(runtime.includes("assertStorageIdentityDocs(payload);\n  // Storage config gate")).toBe(true);
    // server-recomputed contract + wall totals
    expect(runtime.includes("const storageTotalRub = storageMonthlyRub > 0 && storageSeasonMonths > 0")).toBe(true);
    expect(runtime.includes("total_price_rub: stMonthlyRub > 0 && stMonths > 0")).toBe(true);
    // months-label NaN fallback replaced by numeric season math
    expect(runtime.includes("const storageSeasonMonths = storageMonthsCount(storageStartRaw, storageEndRaw);")).toBe(true);
  });

  it("#4: unique-index migration exists for (crew_slug, order_id)", () => {
    const mig = read("supabase/migrations/20260928100000_storage_bikes_order_uniq.sql");
    expect(mig.includes("create unique index if not exists storage_bikes_crew_order_uniq")).toBe(true);
    expect(mig.includes("where order_id is not null")).toBe(true);
    const runtime = read("app/franchize/actions-runtime.ts");
    expect(runtime.includes("stDuplicateId")).toBe(true);
  });
});
