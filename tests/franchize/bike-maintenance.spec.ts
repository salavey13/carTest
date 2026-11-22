// tests/franchize/bike-maintenance.spec.ts
//
// Task 76 (boss 2026-10-07): «planned service checkbox list in мотопарк for
// bikes — owner/admin all, subrenter can add but can't delete, members can
// read and mark checked, etc.»
//
// Storage = cars.specs.maintenance_plan (pure JSONB — NO migration, NO SQL
// file for Paul; same discipline as specs.salary / specs.subrenter_chat_id).
// The demo plan for suzuki-vzr1800-boulevard-2006 («правка диска», «ремонт
// второй передачи») is seeded by scripts/task76-seed-maintenance-plan.mjs
// (idempotent, service-role, audit block specs.owner_fix_20261007_mplan).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MAINTENANCE_ITEMS_CAP,
  MAINTENANCE_PLAN_SPEC_KEY,
  MAINTENANCE_TEXT_MAX,
  maintenancePermsForRole,
  newMaintenanceItemId,
  openMaintenanceCount,
  sanitizeMaintenancePlan,
  type MaintenanceViewerRole,
} from "@/app/franchize/lib/bike-maintenance";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const actions = read("app/franchize/server-actions/bike-maintenance.ts");
const checklist = read("app/franchize/[slug]/bikes/[bikeId]/MaintenanceChecklist.tsx");
const story = read("app/franchize/[slug]/bikes/[bikeId]/BikeStoryClient.tsx");
const wall = read("app/franchize/server-actions/bike-wall.ts");

describe("bike-maintenance: sanitizer (hostile shapes never throw)", () => {
  it("canonical plan passes through", () => {
    const plan = sanitizeMaintenancePlan({
      items: [
        { id: "mp-1", text: "правка диска", done: false, createdAt: "2026-10-07T08:00:00.000Z", createdBy: "356282674", createdByName: "Paul" },
        { id: "mp-2", text: "ремонт второй передачи", done: true, doneAt: "2026-10-07T09:00:00.000Z", doneBy: "356282674", doneByName: "Paul", createdAt: "2026-10-07T08:00:00.000Z" },
      ],
      updatedAt: "2026-10-07T09:00:00.000Z",
      updatedBy: "356282674",
    });
    expect(plan.items).toHaveLength(2);
    expect(plan.items[0].text).toBe("правка диска");
    expect(plan.items[1].done).toBe(true);
    expect(plan.updatedBy).toBe("356282674");
  });

  it("null / garbage / arrays collapse to an empty plan", () => {
    expect(sanitizeMaintenancePlan(null).items).toEqual([]);
    expect(sanitizeMaintenancePlan("nonsense").items).toEqual([]);
    expect(sanitizeMaintenancePlan([1, 2, 3]).items).toEqual([]);
    expect(sanitizeMaintenancePlan({ items: "nope" }).items).toEqual([]);
  });

  it("malformed items degrade field-by-field; textless items are dropped", () => {
    const plan = sanitizeMaintenancePlan({
      items: [
        null,
        42,
        { text: "" }, // no label → drop
        { text: "текст", done: "yes", createdAt: "not-a-date", id: "" },
      ],
    });
    expect(plan.items).toHaveLength(1);
    const item = plan.items[0];
    expect(item.text).toBe("текст");
    expect(item.done).toBe(false); // only boolean true counts
    expect(item.createdAt).toBe(new Date(0).toISOString()); // bad date → epoch
    expect(item.id).toMatch(/^mp-/); // regenerated
  });

  it("text is capped at MAINTENANCE_TEXT_MAX; items capped at MAINTENANCE_ITEMS_CAP", () => {
    const long = sanitizeMaintenancePlan({ items: [{ text: "ж".repeat(999) }] });
    expect(long.items[0].text.length).toBe(MAINTENANCE_TEXT_MAX);
    const many = sanitizeMaintenancePlan({
      items: Array.from({ length: MAINTENANCE_ITEMS_CAP + 20 }, (_, i) => ({ text: `p${i}` })),
    });
    expect(many.items).toHaveLength(MAINTENANCE_ITEMS_CAP);
  });

  it("done=true requires done fields; done=false clears them", () => {
    const plan = sanitizeMaintenancePlan({
      items: [
        { text: "a", done: true, doneAt: "nope", doneBy: "", doneByName: "X" },
        { text: "b", done: false, doneAt: "2026-10-07T09:00:00.000Z", doneBy: "1", doneByName: "X" },
      ],
    });
    expect(plan.items[0].doneAt).toBeNull(); // bad date stays null but only when done
    expect(plan.items[0].doneByName).toBe("X");
    expect(plan.items[1].doneAt).toBeNull(); // undone → audit fields cleared
    expect(plan.items[1].doneBy).toBeNull();
  });
});

describe("bike-maintenance: the boss's access matrix, one shared fn", () => {
  const cases: Array<[MaintenanceViewerRole, boolean, boolean, boolean, boolean]> = [
    // role, read, add, check, delete
    ["staff", true, true, true, true],
    ["subrenter", true, true, true, false], // «subrenter can add but can't delete»
    ["member", true, false, true, false], // «members can read and mark checked»
    ["none", false, false, false, false],
  ];
  for (const [role, r, a, c, d] of cases) {
    it(`${role}: read=${r} add=${a} check=${c} delete=${d}`, () => {
      const p = maintenancePermsForRole(role);
      expect([p.canRead, p.canAdd, p.canCheck, p.canDelete]).toEqual([r, a, c, d]);
    });
  }
});

describe("bike-maintenance: wiring pins (server enforces what the UI shows)", () => {
  it("all four actions exist and go through the shared matrix", () => {
    expect(actions).toContain("export async function getBikeMaintenanceAction");
    expect(actions).toContain("export async function addBikeMaintenanceItemAction");
    expect(actions).toContain("export async function toggleBikeMaintenanceItemAction");
    expect(actions).toContain("export async function deleteBikeMaintenanceItemAction");
    // every action resolves the role server-side, then asks the shared matrix
    expect((actions.match(/maintenancePermsForRole\(gate\.role\)/g) || []).length).toBe(4);
  });

  it("identity is verified server-side (cookie / HMAC initData / owner-or-admin password path)", () => {
    expect(actions).toContain("resolveServerActorUserId");
    expect(actions).toContain("isPasswordAuth");
    // the claimed password actor must BE the owner or a global admin
    expect(actions).toContain("crew.owner_id === params.actorUserId || isGlobalAdminRow(actorUser ?? null)");
  });

  it("delete is staff-only on the server; add blocks members", () => {
    expect(actions).toContain("Удалять пункты может только владелец или админ экипажа.");
    expect(actions).toContain("Добавлять пункты может владелец, админ или партнёр этого мото.");
    expect(actions).toContain("Отмечать выполнение могут только члены экипажа и партнёр этого мото.");
  });

  it("writes touch only specs.maintenance_plan and stamp the audit fields", () => {
    expect(actions).toContain('specs[MAINTENANCE_PLAN_SPEC_KEY]');
    expect(actions).toContain("updatedAt: new Date().toISOString()");
    expect(actions).toContain("updatedBy: actorUserId");
  });

  it("staff gate mirrors bike-subrenter's canManageSubrenters roles (owner/admin/co_owner)", () => {
    expect(actions).toContain('["owner", "admin", "co_owner"].includes(membership.role || "")');
  });

  it("the checklist renders exactly the matrix (no button the server would reject)", () => {
    expect(checklist).toContain("perms.canAdd");
    expect(checklist).toContain("perms.canCheck");
    expect(checklist).toContain("perms.canDelete");
    expect(checklist).toContain("role=\"checkbox\"");
    // delete button only renders under canDelete — the subrenter never sees it
    expect(checklist).toMatch(/\{perms\.canDelete \? \(/);
  });

  it("the story page mounts the checklist; the wall card shows the open-items pill", () => {
    expect(story).toContain("<MaintenanceChecklist");
    expect(story).toContain("isPasswordAuth={!!passwordAuthOwnerId}");
    expect(wall).toContain("openMaintenanceCount(specs?.maintenance_plan)");
  });

  it("storage key + caps are pinned", () => {
    expect(MAINTENANCE_PLAN_SPEC_KEY).toBe("maintenance_plan");
    expect(MAINTENANCE_TEXT_MAX).toBe(200);
    expect(MAINTENANCE_ITEMS_CAP).toBe(50);
  });

  it("item ids are unique enough (time + random suffix)", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newMaintenanceItemId()));
    expect(ids.size).toBe(200);
    expect([...ids][0]).toMatch(/^mp-/);
  });
});

describe("bike-maintenance: open count for the wall pill", () => {
  it("counts only undone items and survives garbage", () => {
    expect(openMaintenanceCount({ items: [{ text: "a", done: false }, { text: "b", done: true }, { text: "c", done: false }] })).toBe(2);
    expect(openMaintenanceCount(null)).toBe(0);
    expect(openMaintenanceCount("junk")).toBe(0);
    expect(openMaintenanceCount({ items: [] })).toBe(0);
  });
});
