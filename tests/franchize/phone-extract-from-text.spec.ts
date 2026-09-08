import { describe, test, expect } from "vitest";

import {
  extractPhoneFromText,
  normalizePhone,
} from "@/app/franchize/lib/phone-utils";

describe("extractPhoneFromText", () => {
  test("extracts phones in the common RU formats buyers type", () => {
    const cases: Array<[string, string]> = [
      ["звоните +7 912 345-67-89", "+79123456789"],
      ["мой номер 8-912-345-67-89", "+79123456789"],
      ["пишите или звоните: 89123456789", "+79123456789"],
      ["тел: +79123456789", "+79123456789"],
      ["номер (912) 345-67-89", "+79123456789"],
      ["8 912 345 67 89 — с 10 до 20", "+79123456789"],
      ["без кода: 9123456789", "+79123456789"],
      ["Привет! Хочу аренду. 89991234567, звоните", "+79991234567"],
    ];
    for (const [text, expected] of cases) {
      expect(extractPhoneFromText(text)).toBe(expected);
    }
  });

  test("returns the first candidate when several are present", () => {
    expect(
      extractPhoneFromText("сначала +7 900 111-22-33, потом 8 900 444-55-66"),
    ).toBe("+79001112233");
  });

  test("ignores prices, dates, counters and card-like digit runs", () => {
    const junk = [
      "аренда 8000 руб в сутки",
      "с 9 до 21, цена 15000",
      "заказ 1788611177 обработан",
      "артикул 1234567890",
      "карта 2202 2070 1234 5678",
      "инвойс № 2026090812 от 8 сентября",
      "чат u2i-gbH0PIx3nV0ycD7U_5Tmdg",
      "объявление 3125040776",
    ];
    for (const text of junk) {
      expect(extractPhoneFromText(text)).toBeNull();
    }
  });

  test("rejects empty and degenerate inputs", () => {
    expect(extractPhoneFromText(null)).toBeNull();
    expect(extractPhoneFromText(undefined)).toBeNull();
    expect(extractPhoneFromText("")).toBeNull();
    expect(extractPhoneFromText("телефон не скажу")).toBeNull();
  });

  test("does not match phones glued to letters (ids, hashes)", () => {
    expect(extractPhoneFromText("abc89123456789")).toBeNull();
    expect(extractPhoneFromText("id=89123456789x")).toBeNull();
  });

  test("composes with normalizePhone (same canonical output)", () => {
    const extracted = extractPhoneFromText("звоните +7 (912) 345-67-89");
    expect(extracted).toBe(normalizePhone("89123456789"));
  });
});
