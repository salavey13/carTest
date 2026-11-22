// app/franchize/lib/bike-maintenance.ts
//
// PURE lib for the «Плановый сервис» checklist (Task 76, boss 2026-10-07):
// a checkbox list of planned maintenance per BIKE, living in
// cars.specs.maintenance_plan — pure JSONB, NO schema migration (same
// approach as specs.salary / specs.subrenter_chat_id).
//
// Boss's access matrix (verbatim intent):
//   • owner / admin (crew staff) — everything: create + check + delete;
//   • subrenter of THIS bike (specs.subrenter_chat_id) — can add + check,
//     can NOT delete («subrenter can add but can't delete»);
//   • crew members — read + mark checked;
//   • everyone else — nothing (the motopark wall itself is already gated).
//
// This module must stay client-safe (imported by both the server actions and
// the checklist component so the UI can never show a button the server would
// reject — and the server can never enforce something the UI contradicts).

/** specs key holding the plan. */
export const MAINTENANCE_PLAN_SPEC_KEY = "maintenance_plan";

/** Hard caps — a checklist, not a novel. */
export const MAINTENANCE_TEXT_MAX = 200;
export const MAINTENANCE_ITEMS_CAP = 50;

export interface MaintenanceItem {
  id: string;
  text: string;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
  doneByName: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
}

export interface MaintenancePlan {
  items: MaintenanceItem[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Viewer capability set for one bike's checklist. */
export interface MaintenancePerms {
  canRead: boolean;
  canAdd: boolean;
  canCheck: boolean;
  canDelete: boolean;
}

/** Coarse viewer role resolved server-side (never trusted from the client). */
export type MaintenanceViewerRole = "staff" | "subrenter" | "member" | "none";

const STAFF_PERMS: MaintenancePerms = { canRead: true, canAdd: true, canCheck: true, canDelete: true };
const SUBRENTER_PERMS: MaintenancePerms = { canRead: true, canAdd: true, canCheck: true, canDelete: false };
const MEMBER_PERMS: MaintenancePerms = { canRead: true, canAdd: false, canCheck: true, canDelete: false };
const NONE_PERMS: MaintenancePerms = { canRead: false, canAdd: false, canCheck: false, canDelete: false };

/** The boss's matrix, one function — the UI and the server actions share it. */
export function maintenancePermsForRole(role: MaintenanceViewerRole): MaintenancePerms {
  switch (role) {
    case "staff":
      return STAFF_PERMS;
    case "subrenter":
      return SUBRENTER_PERMS;
    case "member":
      return MEMBER_PERMS;
    default:
      return NONE_PERMS;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Stable-enough client id for a new item (crypto when present, else math). */
export function newMaintenanceItemId(): string {
  const c = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `mp-${Date.now().toString(36)}-${c}`;
}

/** Sanitize ONE item — anything malformed degrades field-by-field, never throws. */
function sanitizeItem(raw: unknown): MaintenanceItem | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const text = strOrNull(rec.text);
  if (!text) return null; // a checkbox without a label is noise — drop
  return {
    id: strOrNull(rec.id) ?? newMaintenanceItemId(),
    text: text.slice(0, MAINTENANCE_TEXT_MAX),
    done: rec.done === true,
    doneAt: rec.done === true ? isoOrNull(rec.doneAt) : null,
    doneBy: rec.done === true ? strOrNull(rec.doneBy) : null,
    doneByName: rec.done === true ? strOrNull(rec.doneByName) : null,
    createdAt: isoOrNull(rec.createdAt) ?? new Date(0).toISOString(),
    createdBy: strOrNull(rec.createdBy),
    createdByName: strOrNull(rec.createdByName),
  };
}

/**
 * Collapse ANY hostile/legacy shape of cars.specs.maintenance_plan into the
 * canonical bundle. Unknown fields are dropped, items cap at 50, text caps at
 * 200 — the DB may hold anything a human (or an old script) wrote there.
 */
export function sanitizeMaintenancePlan(raw: unknown): MaintenancePlan {
  const rec = asRecord(raw);
  const rawItems = Array.isArray(rec?.items) ? (rec!.items as unknown[]) : [];
  const items = rawItems
    .map(sanitizeItem)
    .filter((item): item is MaintenanceItem => item !== null)
    .slice(0, MAINTENANCE_ITEMS_CAP);
  return {
    items,
    updatedAt: isoOrNull(rec?.updatedAt),
    updatedBy: strOrNull(rec?.updatedBy),
  };
}

/** How many planned items are still open — the wall-card pill number. */
export function openMaintenanceCount(plan: unknown): number {
  return sanitizeMaintenancePlan(plan).items.filter((i) => !i.done).length;
}
