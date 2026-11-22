// tests/franchize/spec-serializer.spec.ts
// ── Admin catalog editor: jsonb specs round-trip (boss 2026-10-19) ──────────
// Regression: complex jsonb values in cars.specs were loaded via String(value)
// → the editor showed "[object Object]" and ANY save wrote that string back
// over the real value. The serializer keeps type fidelity:
//   untouched rows → rawValue passthrough (byte-exact),
//   complex rows   → pretty JSON in, JSON.parse back (named error on garbage),
//   primitives     → original type restored on edit,
//   new rows       → obvious-JSON smart parse.
import { describe, expect, it } from "vitest";
import {
  SpecJsonError,
  specFromEditable,
  specFromNewRow,
  specToEditable,
} from "../../lib/spec-serializer";

describe("specToEditable", () => {
  it("objects/arrays → pretty JSON + isComplex (was '[object Object]')", () => {
    const ed = specToEditable({ battery: "48V", ranges: [1, 2] });
    expect(ed.isComplex).toBe(true);
    const parsed = JSON.parse(ed.text);
    expect(parsed).toEqual({ battery: "48V", ranges: [1, 2] });

    const arr = specToEditable(["a", "b"]);
    expect(arr.isComplex).toBe(true);
    expect(JSON.parse(arr.text)).toEqual(["a", "b"]);
  });

  it("primitives stay one-line strings", () => {
    expect(specToEditable(4)).toEqual({ text: "4", isComplex: false });
    expect(specToEditable(true)).toEqual({ text: "true", isComplex: false });
    expect(specToEditable("JH2PC37A")).toEqual({ text: "JH2PC37A", isComplex: false });
    expect(specToEditable(null)).toEqual({ text: "", isComplex: false });
  });
});

describe("specFromEditable — untouched rows", () => {
  it("restores the EXACT original value (the boss's overwrite fear)", () => {
    const complex = { battery: "48V", schedule: { mon: "10:00" }, tags: ["a"] };
    const ed = specToEditable(complex);
    // Only an unrelated field was edited — this row was never touched.
    expect(
      specFromEditable({ key: "schedule", text: ed.text, isComplex: ed.isComplex, isDirty: false, rawValue: complex }),
    ).toBe(complex); // same reference — byte-exact, zero re-shape
  });

  it("untouched primitives also pass through untouched", () => {
    expect(specFromEditable({ key: "year", text: "2023", isComplex: false, isDirty: false, rawValue: 2023 })).toBe(2023);
    expect(specFromEditable({ key: "vin", text: "JH2", isComplex: false, isDirty: false, rawValue: "JH2" })).toBe("JH2");
  });
});

describe("specFromEditable — edited rows", () => {
  it("edited complex row parses back into an object", () => {
    const value = specFromEditable({
      key: "battery",
      text: '{ "v": "48V", "ah": 20 }',
      isComplex: true,
      isDirty: true,
      rawValue: { v: "60V" },
    });
    expect(value).toEqual({ v: "48V", ah: 20 });
  });

  it("edited complex row with broken JSON throws a NAMED error (never corrupts)", () => {
    expect(() =>
      specFromEditable({ key: "battery", text: "{ v: broken", isComplex: true, isDirty: true, rawValue: { v: "60V" } }),
    ).toThrow(SpecJsonError);
    try {
      specFromEditable({ key: "battery", text: "{ nope", isComplex: true, isDirty: true, rawValue: {} });
      expect.unreachable("must throw");
    } catch (e) {
      expect((e as SpecJsonError).specKey).toBe("battery");
      expect((e as Error).message).toContain("battery");
    }
  });

  it("edited empty complex row → null (explicit clearing)", () => {
    expect(
      specFromEditable({ key: "x", text: "   ", isComplex: true, isDirty: true, rawValue: { a: 1 } }),
    ).toBeNull();
  });

  it("edited number keeps number type", () => {
    expect(specFromEditable({ key: "year", text: "2024", isComplex: false, isDirty: true, rawValue: 2023 })).toBe(2024);
  });

  it("edited number with non-numeric text degrades to string (no NaN into jsonb)", () => {
    expect(specFromEditable({ key: "year", text: "unknown", isComplex: false, isDirty: true, rawValue: 2023 })).toBe("unknown");
  });

  it("edited boolean keeps boolean type", () => {
    expect(specFromEditable({ key: "available", text: "false", isComplex: false, isDirty: true, rawValue: true })).toBe(false);
    expect(specFromEditable({ key: "available", text: "true", isComplex: false, isDirty: true, rawValue: false })).toBe(true);
  });

  it("edited string NEVER coerces numeric-looking text (phones/VINs are strings)", () => {
    expect(specFromEditable({ key: "phone", text: "89001234567", isComplex: false, isDirty: true, rawValue: "8900123456" })).toBe("89001234567");
  });
});

describe("specFromNewRow — operator-typed rows", () => {
  it("obvious JSON objects/arrays are parsed", () => {
    expect(specFromNewRow("modes", '{ "eco": 1, "sport": 2 }')).toEqual({ eco: 1, sport: 2 });
    expect(specFromNewRow("tags", '["a","b"]')).toEqual(["a", "b"]);
  });

  it("plain text (incl. numeric-looking) stays a string", () => {
    expect(specFromNewRow("phone", "89001234567")).toBe("89001234567");
    expect(specFromNewRow("note", "{ not json")).toBe("{ not json");
    expect(specFromNewRow("empty", "   ")).toBe("   ");
  });
});
