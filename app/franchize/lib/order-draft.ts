// /app/franchize/lib/order-draft.ts
// ─────────────────────────────────────────────────────────────────────────────
// Order-page DRAFT persistence (2026-09-17).
//
// THE PROBLEM:
//   A renter picks a bike, adds it to the cart, opens the order page and
//   starts typing passport / driver's-licence details. If the page then
//   crashes (or the Telegram WebView reloads, or the battery dies, or the
//   network drop forces a refresh) EVERYTHING they typed was gone — a very
//   expensive form to re-fill on a phone keyboard.
//
// THE FIX:
//   Every meaningful form value is mirrored into localStorage (debounced,
//   best-effort, never blocks typing) and restored on the next mount of the
//   same crew's order page — regardless of whether the orderId in the URL
//   changed (a new orderId is minted on every cart→order transition, so the
//   draft is keyed by the crew slug, not by orderId).
//
// DESIGN NOTES:
//   - Pure functions + injected storage → unit-testable without jsdom tricks.
//   - Everything is defensively sanitized field-by-field: a corrupted or
//     schema-drifted payload degrades to `null` (no restore), it must NEVER
//     throw — this module exists exactly because the page sometimes dies.
//   - Draft is intentionally LOCAL to the renter's device (the renter's own
//     passport data, their own browser). The cart already works the same way.
//   - TTL: drafts older than ORDER_DRAFT_TTL_MS are ignored AND removed, so
//     an abandoned phone never resurrects a three-week-old passport form.
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER_DRAFT_VERSION = 1;

/** 14 days — long enough to survive a weekend trip, short enough to not rot. */
export const ORDER_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const orderDraftStorageKey = (slug: string): string =>
  `franchize-order-draft:${slug}`;

export type OrderDraftPayment = "card" | "cash" | "sbp";

export type OrderDraftForm = {
  recipient: string;
  phone: string;
  comment: string;
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  passportIssueDate: string;
  passportIssuedBy: string;
  registrationAddress: string;
  hasLicense: boolean;
  licenseSeries: string;
  licenseNumber: string;
  licenseCategories: string;
  licenseExpiryDate: string;
  payment: OrderDraftPayment;
  deliveryMode: "pickup" | "delivery";
  selectedExtras: string[];
  promo: string;
};

export type OrderDraft = OrderDraftForm & {
  version: number;
  /** Crew slug the draft belongs to (double-check on load). */
  slug: string;
  /** orderId the draft was last typed on — informational. */
  orderId: string;
  /** Telegram user id when known — informational (shared-device hygiene). */
  tgUserId?: string;
  savedAt: number;
};

const PAYMENT_VALUES: OrderDraftPayment[] = ["card", "cash", "sbp"];

const asTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const sanitizeStringField = (raw: Record<string, unknown>, field: string): string =>
  asTrimmedString(raw[field]).slice(0, 2000);

/**
 * True when the draft carries at least one piece of information worth
 * restoring. Empty/near-empty drafts are dropped instead of being saved
 * over nothing.
 */
export function isOrderDraftMeaningful(form: OrderDraftForm): boolean {
  if (form.recipient || form.phone || form.comment) return true;
  if (
    form.birthDate ||
    form.passportSeries ||
    form.passportNumber ||
    form.passportIssueDate ||
    form.passportIssuedBy ||
    form.registrationAddress ||
    form.licenseSeries ||
    form.licenseNumber ||
    form.licenseCategories ||
    form.licenseExpiryDate
  ) {
    return true;
  }
  if (form.promo) return true;
  if (form.selectedExtras.length > 0) return true;
  return false;
}

/**
 * Field-by-field sanitizer. Returns null when there is nothing usable —
 * the caller simply skips the restore. NEVER throws.
 */
export function sanitizeOrderDraft(raw: unknown, slug: string): OrderDraft | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;

    if (record.version !== ORDER_DRAFT_VERSION) return null;
    if (typeof record.slug !== "string" || record.slug !== slug) return null;
    if (typeof record.savedAt !== "number" || !Number.isFinite(record.savedAt)) return null;

    // Field-by-field (no reduce over a key union — keeps TS happy and the
    // sanitizer grep-friendly).
    const form: OrderDraftForm = {
      recipient: sanitizeStringField(record, "recipient"),
      phone: sanitizeStringField(record, "phone"),
      comment: sanitizeStringField(record, "comment"),
      birthDate: sanitizeStringField(record, "birthDate"),
      passportSeries: sanitizeStringField(record, "passportSeries"),
      passportNumber: sanitizeStringField(record, "passportNumber"),
      passportIssueDate: sanitizeStringField(record, "passportIssueDate"),
      passportIssuedBy: sanitizeStringField(record, "passportIssuedBy"),
      registrationAddress: sanitizeStringField(record, "registrationAddress"),
      hasLicense: record.hasLicense === undefined ? true : Boolean(record.hasLicense),
      licenseSeries: sanitizeStringField(record, "licenseSeries"),
      licenseNumber: sanitizeStringField(record, "licenseNumber"),
      licenseCategories: sanitizeStringField(record, "licenseCategories"),
      licenseExpiryDate: sanitizeStringField(record, "licenseExpiryDate"),
      payment: PAYMENT_VALUES.includes(record.payment as OrderDraftPayment)
        ? (record.payment as OrderDraftPayment)
        : "card",
      deliveryMode: record.deliveryMode === "delivery" ? "delivery" : "pickup",
      selectedExtras: Array.isArray(record.selectedExtras)
        ? record.selectedExtras
            .filter((extra): extra is string => typeof extra === "string")
            .map((extra) => extra.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [],
      promo: sanitizeStringField(record, "promo"),
    };

    if (!isOrderDraftMeaningful(form)) return null;

    return {
      ...form,
      version: ORDER_DRAFT_VERSION,
      slug,
      orderId: asTrimmedString(record.orderId).slice(0, 120),
      tgUserId: typeof record.tgUserId === "string" ? record.tgUserId.slice(0, 64) : undefined,
      savedAt: record.savedAt,
    };
  } catch {
    return null;
  }
}

/** Minimal save payload built from live form values — trims + caps lengths. */
export function buildOrderDraft(
  form: OrderDraftForm,
  meta: { slug: string; orderId: string; tgUserId?: string; now?: number },
): OrderDraft {
  return {
    ...form,
    version: ORDER_DRAFT_VERSION,
    slug: meta.slug,
    orderId: (meta.orderId || "").slice(0, 120),
    tgUserId: meta.tgUserId ? String(meta.tgUserId).slice(0, 64) : undefined,
    savedAt: meta.now ?? Date.now(),
  };
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Reads + validates + TTL-checks the draft. Returns null when absent/expired/broken. */
export function loadOrderDraft(
  storage: DraftStorage | null | undefined,
  slug: string,
  now: number = Date.now(),
): OrderDraft | null {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(orderDraftStorageKey(slug));
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupted JSON — drop the payload instead of crashing (same policy
      // as the cart envelope parser).
      storage.removeItem(orderDraftStorageKey(slug));
      return null;
    }
    const draft = sanitizeOrderDraft(parsed, slug);
    if (!draft) return null;
    if (now - draft.savedAt > ORDER_DRAFT_TTL_MS) {
      storage.removeItem(orderDraftStorageKey(slug));
      return null;
    }
    return draft;
  } catch {
    // Privacy mode / storage disabled / quota — the draft is a nice-to-have.
    return null;
  }
}

/** Best-effort save. Never throws, never blocks typing. */
export function saveOrderDraft(
  storage: DraftStorage | null | undefined,
  draft: OrderDraft,
): void {
  if (!storage || typeof storage.setItem !== "function") return;
  try {
    storage.setItem(orderDraftStorageKey(draft.slug), JSON.stringify(draft));
  } catch {
    // Quota exceeded / private mode — ignore on purpose.
  }
}

/** Best-effort clear (used after successful checkout and explicit reset). */
export function clearOrderDraft(
  storage: DraftStorage | null | undefined,
  slug: string,
): void {
  if (!storage || typeof storage.removeItem !== "function") return;
  try {
    storage.removeItem(orderDraftStorageKey(slug));
  } catch {
    // Ignore on purpose.
  }
}
