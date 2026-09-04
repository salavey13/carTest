import { describe, expect, it } from "vitest";
import {
  escapeHtmlText,
  oneLine,
  sanitizeTelegramText,
} from "../../lib/tg-text";

describe("sanitizeTelegramText — «одна буква на строку» repair", () => {
  it("re-joins the reported per-character bike line (exact 2026-09-05 shape)", () => {
    // The exact shape reported by the operator: the whole bike line arrived
    // one character per line (bike name, " · ", dates, price included).
    const broken = [
      "🔑 Новая аренда ожидает активации (#order-mtn1yzbp-e4xzb8)",
      "",
      "🏍",
      " ",
      "R",
      "e",
      "g",
      "u",
      "l",
      "m",
      "o",
      "t",
      "o",
      " ",
      "N",
      "i",
      "b",
      "b",
      "l",
      "e",
      "r",
      " ",
      "3",
      "0",
      "0",
      " ",
      "4",
      "V",
      " ",
      "·",
      " ",
      "0",
      "4",
      ".",
      "0",
      "9",
      ".",
      "2",
      "0",
      "2",
      "6",
      " ",
      "1",
      "4",
      ":",
      "3",
      "0",
      " ",
      "→",
      " ",
      "0",
      "7",
      ".",
      "0",
      "9",
      ".",
      "2",
      "0",
      "2",
      "6",
      " ",
      "1",
      "4",
      ":",
      "3",
      "0",
      " ",
      "·",
      " ",
      "2",
      "2",
      " ",
      "0",
      "0",
      "0",
      " ",
      "₽",
      "",
      "Получатель: Александр Елихов",
    ].join("\n");

    const fixed = sanitizeTelegramText(broken);

    expect(fixed).toContain("🏍 Regulmoto Nibbler 300 4V · 04.09.2026 14:30 → 07.09.2026 14:30 · 22 000 ₽");
    // Untouched lines stay intact
    expect(fixed.startsWith("🔑 Новая аренда ожидает активации (#order-mtn1yzbp-e4xzb8)")).toBe(true);
    expect(fixed.endsWith("Получатель: Александр Елихов")).toBe(true);
  });

  it("strips CR-redundant and zero-width break helpers, keeps real newlines", () => {
    const input = "A\r\nB\rC\u0085D\u2028E\u2029F\u200bG\u2060H\ufeffI";
    const out = sanitizeTelegramText(input);
    // CR/CRLF collapse to LF (kept — they are line separators), everything
    // break-prone-but-invisible is stripped entirely.
    expect(out).toBe("A\nB\nCDEFGHI");
  });

  it("normalizes the nbsp family (U+00A0 / U+202F / U+2007) to plain spaces", () => {
    expect(sanitizeTelegramText("22\u00A0000\u202F₽\u2007x")).toBe("22 000 ₽ x");
  });

  it("re-joins a per-char run even when it starts with an astral emoji (🏍)", () => {
    // 🏍 is U+1F3CD — length 2 in UTF-16; run detection must count code points.
    const input = "🏍\n \nR\ne\ng\nu\nl\nm\no\nt\no\n \nN\ni\nb\n";
    expect(sanitizeTelegramText(input)).toBe("🏍 Regulmoto Nib\n");
  });

  it("keeps legit short lines (fewer than the run threshold) untouched", () => {
    const input = "1\n2\n3\nok\n•\n—";
    expect(sanitizeTelegramText(input)).toBe(input);
  });

  it("keeps paragraph breaks while repairing a long single-char run", () => {
    const input = "header\n\na\nb\nc\nd\ne\nf\ng\n\nfooter";
    expect(sanitizeTelegramText(input)).toBe("header\n\nabcdefg\n\nfooter");
  });

  it("handles empty / undefined-ish input", () => {
    expect(sanitizeTelegramText("")).toBe("");
  });
});

describe("oneLine — data fields never multiline", () => {
  it("repairs the per-char shape itself, not just whitespace", () => {
    expect(oneLine("R\ne\ng\nu\nl\nm\no\nt\no\n \nN\ni\nb\nb\nl\ne\nr")).toBe("Regulmoto Nibbler");
  });

  it("collapses CRLF and tabs, trims edges", () => {
    expect(oneLine("  Ducati\r\nHypermotard\t950 ")).toBe("Ducati Hypermotard 950");
  });

  it("maps null/undefined to empty string", () => {
    expect(oneLine(null)).toBe("");
    expect(oneLine(undefined)).toBe("");
  });
});

describe("escapeHtmlText — HTML parse_mode safety", () => {
  it("escapes & < > after collapsing whitespace", () => {
    expect(escapeHtmlText("A&B <x> <\ny>")).toBe("A&amp;B &lt;x&gt; &lt; y&gt;");
  });

  it("leaves plain names untouched", () => {
    expect(escapeHtmlText("Александр Елихов")).toBe("Александр Елихов");
  });
});
