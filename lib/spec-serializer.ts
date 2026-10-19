// lib/spec-serializer.ts
// ── Specs jsonb ↔ editable text (admin catalog editor) ─────────────────────
// Regression (boss 2026-10-19): complex jsonb values (objects/arrays inside
// cars.specs) were loaded into the specs editor via String(value) → the field
// literally showed "[object Object]", and ANY save (even after editing an
// unrelated field) wrote that string BACK over the real value — silently
// corrupting the catalog row.
//
// These pure helpers keep type fidelity for every row:
//   - UNTOUCHED rows restore the EXACT original value (rawValue passthrough) —
//     editing other fields can never re-shape a row the operator did not touch;
//   - COMPLEX rows (object/array/null-of-object shape) are edited as pretty
//     JSON and parsed back with a NAMED validation error (fail loudly, never
//     corrupt);
//   - PRIMITIVE rows restore the original primitive type (number/boolean) —
//     no more "4" → "4" (string) drift;
//   - brand-new rows typed by the operator get an obvious-JSON smart parse
//     ({ / [ … ) so complex values can be added manually.
// Unit-tested in tests/franchize/spec-serializer.spec.ts.

export class SpecJsonError extends Error {
  constructor(
    public specKey: string,
    message: string,
  ) {
    super(message);
    this.name = "SpecJsonError";
  }
}

export interface EditableSpec {
  /** Editable text representation (pretty JSON for complex values). */
  text: string;
  /** Objects/arrays are edited in a JSON textarea instead of a one-line input. */
  isComplex: boolean;
}

/** jsonb value → editable text (+ whether it needs the JSON editor). */
export function specToEditable(value: unknown): EditableSpec {
  const isComplex = value !== null && typeof value === "object";
  if (isComplex) {
    try {
      return { text: JSON.stringify(value, null, 2), isComplex: true };
    } catch {
      // Circular / non-serialisable exotic value — open the JSON editor empty
      // and keep the raw value; an untouched row still round-trips as-is.
      return { text: "", isComplex: true };
    }
  }
  return { text: value === undefined || value === null ? "" : String(value), isComplex: false };
}

/**
 * Editable text → jsonb value for a row that CAME FROM THE DATABASE.
 *  - not dirty → rawValue passthrough (byte-exact, zero drift);
 *  - complex + dirty → JSON.parse with a named error;
 *  - primitive + dirty → restore the original primitive type.
 */
export function specFromEditable(input: {
  key: string;
  text: string;
  isComplex: boolean;
  isDirty: boolean;
  rawValue?: unknown;
}): unknown {
  const { key, text, isComplex, isDirty, rawValue } = input;

  // Untouched row → the EXACT original value. This is the whole point of the
  // fix: saving other fields must never re-write a row nobody edited.
  if (!isDirty && rawValue !== undefined) return rawValue;

  const trimmed = text.trim();

  // Complex row → parse back; a broken JSON must ABORT the save, not corrupt.
  if (isComplex) {
    const label = key || "(без ключа)";
    try {
      return JSON.parse(trimmed === "" ? "null" : trimmed);
    } catch {
      throw new SpecJsonError(
        label,
        `Поле «${label}»: некорректный JSON — исправьте значение, переключите поле в обычный режим или удалите строку.`,
      );
    }
  }

  // Edited primitive row → restore the ORIGINAL primitive type.
  if (typeof rawValue === "number") {
    const n = Number(trimmed);
    return trimmed !== "" && Number.isFinite(n) ? n : text;
  }
  if (typeof rawValue === "boolean") {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return text;
  }
  // rawValue was a string → keep a string; do NOT coerce numeric-looking
  // strings (phones / VINs / article numbers are strings on purpose).
  return text;
}

/**
 * Brand-new rows (no rawValue): smart-parse obvious JSON ({ or [ …) so the
 * operator can type a complex value manually; everything else stays a string.
 */
export function specFromNewRow(key: string, text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // falls through → plain string (the operator may still be typing)
    }
  }
  return text;
}
