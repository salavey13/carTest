// tests/franchize/task193-tableview-newtab-finance-edit.spec.ts
//
// task193 (boss, 2026-11-19 — blockers for the salary calculation):
//   1. Tableview rows open the rental in a NEW TAB (plain click + middle
//      click via onAuxClick + a REAL <a> in «Марка» for the browser context
//      menu) — the analytics session (table + dates) survives the click.
//   2. The date range AND the tableview-open regime persist (localStorage):
//      a refresh / reopen restores both.
//   3. ✍️ finance edit: owner-tier pencil on the «Цена» cell (table view) and
//      on the rental-page сверка card — new price/deposit + a comment that
//      APPENDS to metadata.comments (never overwrites).
//   4. Password-auth (PC, new tab) resolves on ANY rental status and the
//      lifecycle actions accept a passwordActorId — the owner can close/
//      finish old rentals from the rental page (the «сверка не заводится —
//      аренда не закрыта» loop breaker).
//   5. telegram-transport retries via the backup deployment
//      (v0-car-test.vercel.app) when the primary forward endpoint is down
//      (vip-bike.ru domain is unpaid and may die).
import { readFileSync } from "node:fs";

const src = (p: string) => readFileSync(p, "utf8");

describe("task193 · tableview: new-tab tap-through + persistence", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
  const client = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");

  it("plain click opens the rental in a NEW TAB (window.open, noopener)", () => {
    expect(modal).toContain('window.open(rentalUrlFor(rentalId), "_blank", "noopener,noreferrer")');
    // router.push is GONE from the modal — no same-tab navigation.
    expect(modal).not.toContain("router.push(`/franchize/${slug}/rental/");
  });

  it("middle-click opens a new tab WITHOUT the autoscroll icon (both renderers)", () => {
    expect(modal.match(/onAuxClick=/g)?.length).toBe(2); // sectioned + legacy
    expect(modal).toContain("e.preventDefault();");
    expect(modal).toContain('if (e.button === 1)');
  });

  it("«Марка» carries a REAL <a target=_blank> — browser context menu works", () => {
    // sectioned (dataIdx === 7) + legacy (ci === 7)
    expect(modal.match(/target="_blank"\n\s+rel="noopener noreferrer"/g)?.length).toBe(2);
    expect(modal).toContain('title="Открыть аренду в новой вкладке (средняя кнопка / правая кнопка мыши работают)"');
  });

  it("date range persists per slug+variant and is RESTORED on open", () => {
    expect(modal).toContain('const tableStateKey = (slug?: string, variant?: string) =>');
    expect(modal).toContain("rentalsAnalytics.csvTableState:");
    expect(modal).toContain("loadStoredTableRange(slug, variant)");
    expect(modal).toContain("writeStoredTableRange(slug, variant, e.target.value, to)");
    expect(modal).toContain("writeStoredTableRange(slug, variant, from, e.target.value)");
    // the month→today reset is only the FALLBACK now
    expect(modal).toContain("storedRange?.from || firstDayOfMonthIso()");
    expect(modal).toContain("storedRange?.to || todayIso()");
  });

  it("the tableview open-regime persists (refresh re-opens the modal)", () => {
    expect(modal).toContain("isTableviewOpenStored");
    expect(modal).toContain("setTableviewOpenStored");
    expect(client).toContain("isTableviewOpenStored(initialSlug)");
    expect(client).toContain("handleCsvModalChange(true)");
    expect(client).toContain('setTableviewOpenStored(initialSlug, open)');
  });
});

describe("task193 · ✍️ finance edit (owner-tier, price + deposit + comment)", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
  const action = src("app/franchize/server-actions/rental-verify-actions.ts");
  const card = src("app/franchize/components/CommissionVerificationCard.tsx");

  it("server action exists, owner-tier gated, appends to metadata.comments", () => {
    expect(action).toContain("export async function updateRentalFinanceAction(");
    expect(action).toContain("Править деньги аренды может владелец или администратор экипажа.");
    expect(action).toContain("resolveVerifyOwnerActor");
    // the comment APPENDS — never overwrites the existing notes
    expect(action).toContain("const comments = Array.isArray(meta.comments) ? [...(meta.comments as unknown[])] : [];"); 
    expect(action).toContain('kind: "finance_edit"');
    // money writes: total_cost + metadata.deposit_amount
    expect(action).toContain("if (totalCost !== undefined) patch.total_cost = totalCost;");
    expect(action).toContain("if (depositAmount !== undefined) meta.deposit_amount = depositAmount;");
    // honesty: verified rows get a warning, not a silent stale snapshot
    expect(action).toContain("verificationWarning");
    // cross-crew guard: the rental must belong to the slug's crew
    expect(action).toContain("rental.crew_id !== crew.id");
  });

  it("table view: pencil rides the owner-tier gate and hands context to the modal", () => {
    expect(modal).toContain("onEditFinance={\n                      canQuickVerify");
    expect(modal).toContain('aria-label="Изменить цену и залог аренды"');
    // task127 invariant: the finEdit modal close button must NOT reuse the
    // header's aria-label="Закрыть" (exactly-two header close buttons).
    expect(modal).toContain('aria-label="Закрыть правку цены"');
    expect(modal).toContain("updateRentalFinanceAction({");
    expect(modal).toContain("void loadTable({ silent: true });");
  });

  it("rental page сверка card: inline ✍️ цена (both TG and password branches)", () => {
    expect(card).toContain("const handleFinanceSave = async () => {");
    expect(card).toContain("updateRentalFinanceAction({");
    expect(card).toContain("currentTotalCost?: number | null;");
    const page = src("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page.match(/currentTotalCost=\{rental\.totalCost \?\? null\}/g)?.length).toBe(2);
  });
});

describe("task193 · password session: new-tab rental page can close/finish", () => {
  const page = src("app/franchize/[slug]/rental/[id]/page.tsx");
  const lifecycle = src("app/franchize/components/FranchizeRentalLifecycleActions.tsx");

  it("password owner resolves on ANY status (not completed-only)", () => {
    expect(page).toContain("if (rental.found && !isCrewStaff) {");
    expect(page).not.toContain('if (rental.found && status === "completed" && !isCrewStaff)');
  });

  it("lifecycle actions render for the password owner with passwordActorId", () => {
    expect(page).toContain("passwordActorId={passwordAuthOwnerId}");
    expect(lifecycle).toContain("passwordActorId?: string | null;");
    expect(lifecycle).toContain('if (passwordActorId) return "owner" as const;');
    expect(lifecycle).toContain("const actorId = passwordActorId || dbUser?.user_id || null;");
    // every mutation call site uses the fallback actor, not the bare dbUser
    expect(lifecycle).toContain("await confirmVehiclePickup(rentalId, actorId)");
    expect(lifecycle).toContain("await confirmVehicleReturn(rentalId, actorId, {");
    expect(lifecycle).toContain("actorUserId: actorId,");
    expect(lifecycle.match(/await initiateTelegramRentalPhotoUpload\(rentalId, actorId/g)?.length).toBe(2);
  });

  it("сверка stays completed-only on the page (the rule itself is right)", () => {
    expect(page).toContain('status === "completed" && (isCrewStaff || passwordAuthOwnerId)');
  });
});

describe("task193 · telegram transport: backup deployment retry", () => {
  const transport = src("lib/telegram-transport.ts");

  it("backup endpoint is the default Vercel deployment and is tried on failure", () => {
    expect(transport).toContain('const BACKUP_FORWARD_URL = "https://v0-car-test.vercel.app/api/forward-telegram";');
    expect(transport).toContain("callForwardOnce(FORWARD_URL, FORWARD_ORIGIN");
    expect(transport).toContain("callForwardOnce(BACKUP_FORWARD_URL, BACKUP_FORWARD_ORIGIN");
    // no double retry when the primary IS the backup (default config)
    expect(transport).toContain("if (BACKUP_FORWARD_URL === FORWARD_URL) return first;");
  });
});
