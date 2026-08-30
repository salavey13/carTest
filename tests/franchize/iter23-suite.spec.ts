// tests/franchize/iter23-suite.spec.ts
//
// iter23 — ПЭП signature in ALL places of the rental doc + owner blank
// removal in ПЭП mode:
//   1. Template renders the renter's ПЭП line in all FIVE signature places
//      (main contract, Акт приёма-передачи, Инструкция, Тарифы, Согласие
//      на обработку ПД) — previously only the main block had the branch.
//   2. In ПЭП mode the OWNER side drops the «_____» handwritten placeholder
//      and renders the BARE representative name — «Воробьев Р.В.» instead of
//      «_____ / Воробьев Р.В.» (user clarification after the first iter23 cut;
//      the п. 12.3 ПЭП Арендодателя explanation lives on in the small-print
//      caption under the name).
//   3. Rental ACTIVATION re-render (rentals-dashboard.ts) carries the ПЭП
//      meta from rentals.metadata.pep_signature — previously the activated
//      DOCX silently lost the electronic signature.
//   4. Non-ПЭП rendering is byte-identical to the classic look: every blank
//      line, every «(подпись)» caption is still there.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { applyTemplateVariables } from "@/lib/markdownTemplate";
import { runLegalTemplateChecklist } from "@/app/franchize/lib/legalChecklist";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const TEMPLATES = [
  "docs/RENTAL_DEAL_TEMPLATE.html",
  "docs/crewDocs/vip-bike_RENTAL_DEAL_TEMPLATE.html",
];

const BASE_VARS = {
  renter_full_name: "Иван Иванович Тестов",
  issuer_representative: "Воробьев Р.В.",
  renter_signature: "Telegram ID 6714441279 (@ivan)",
  signature_timestamp: "30.08.2026 12:34 (МСК)",
  signature_fingerprint: "pep:tg:6714441279:abcdef0123456789",
  day: "30",
  month_num: "08",
  year: "2026",
  contract_number: "30.08/test-bike",
};

const PEP_VARS = { ...BASE_VARS, pep_signed: "1" };
const MANUAL_VARS = { ...BASE_VARS, pep_signed: "" };

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

// ── 1. ПЭП rendering: all five renter places + owner blanks removed ──────────

describe("iter23 · rental template renders ПЭП in ALL signature places", () => {
  for (const tplPath of TEMPLATES) {
    describe(tplPath, () => {
      const rendered = applyTemplateVariables(read(tplPath), PEP_VARS);

      it("renter ПЭП line appears in all 5 places (main + акт + инструкция + тарифы + согласие)", () => {
        // Main block has the full audit variant, the 4 appendix places use
        // the compact variant — together: 5 «Подписано ПЭП» occurrences.
        expect(count(rendered, "Подписано ПЭП")).toBe(5);
        // The full audit (timestamp + fingerprint) stays in the main block.
        expect(rendered).toContain("Отпечаток подписи (SHA-256 initData)");
        expect(rendered).toContain(PEP_VARS.signature_fingerprint);
        // Compact places carry the timestamp too.
        expect(count(rendered, "30.08.2026 12:34 (МСК)")).toBeGreaterThanOrEqual(4);
      });

      it("owner side: ПЭП mode renders the BARE name — «Воробьев Р.В.» instead of «_____ / Воробьев Р.В.»", () => {
        // iter23-fix (user): the owner signature line is just the name; the
        // verbose «ПЭП Арендодателя — файл Договора…» line is GONE, the
        // п. 12.3 reference stays in the small-print caption only.
        expect(count(rendered, `>Воробьев Р.В.</td>`)).toBe(2);
        expect(rendered).not.toContain("ПЭП Арендодателя — файл Договора, сформированный");
        expect(rendered).not.toContain("ПЭП Арендодателя — файл Договора, направленный");
        expect(count(rendered, "(ПЭП Арендодателя — файл Договора, п. 12.3)")).toBe(2);
        // The owner blank lines are GONE (name-bearing owner lines).
        expect(rendered).not.toContain("_________________ / Воробьев Р.В.");
        expect(rendered).not.toContain("_____________________ / Воробьев Р.В. /");
        // Renter blank lines are gone too — ПЭП replaces handwriting.
        expect(rendered).not.toContain("/ Иван Иванович Тестов&emsp;");
        expect(rendered).not.toContain("_____________/ Иван Иванович Тестов");
      });

      it("captions switch to ПЭП wording (no orphan «(подпись)» captions in signature blocks)", () => {
        expect(count(rendered, "(ПЭП Арендатора")).toBeGreaterThanOrEqual(5);
        expect(count(rendered, "(ПЭП Арендодателя")).toBeGreaterThanOrEqual(2);
        // Non-signature fill-in blanks (одометр, топливо, состояние…) stay.
        expect(rendered).toContain("Показания одометра при возврате: ____");
      });

      it("no unrendered pep_signed conditionals leak into the document", () => {
        expect(rendered).not.toContain("{{#if");
        expect(rendered).not.toContain("{{/if}}");
        expect(rendered).not.toContain("{{else}}");
        expect(rendered).not.toContain("{{pep_signed}}");
      });
    });
  }
});

// ── 2. Manual (non-ПЭП) rendering unchanged ─────────────────────────────────

describe("iter23 · manual-signature rendering keeps the classic look", () => {
  for (const tplPath of TEMPLATES) {
    it(`${tplPath}: blanks and captions intact, zero ПЭП text`, () => {
      const rendered = applyTemplateVariables(read(tplPath), MANUAL_VARS);
      expect(rendered).not.toContain("Подписано ПЭП");
      // The ПЭП wording (owner line OR caption) must be absent in manual
      // mode — clause 12.3 body text legitimately mentions «ПЭП Арендодателя»,
      // so we assert on the signature-block variants only.
      expect(rendered).not.toContain("(ПЭП Арендодателя — файл Договора, п. 12.3)");
      // Owner blanks (main + акт).
      expect(rendered).toContain("_________________ / Воробьев Р.В.");
      expect(rendered).toContain("_____________________ / Воробьев Р.В. /");
      // Renter blanks: main, акт, инструкция/тарифы (×2), согласие.
      expect(rendered).toContain("_________________ / Иван Иванович Тестов");
      expect(rendered).toContain("_____________________ / Иван Иванович Тестов /");
      expect(count(rendered, "_____________/ Иван Иванович Тестов")).toBe(2);
      expect(rendered).toContain("___________________________ / Иван Иванович Тестов");
      // Caption rows untouched.
      expect(count(rendered, "(подпись)")).toBeGreaterThanOrEqual(7);
    });
  }
});

// ── 3. Combined flags: ПЭП + СТС collateral (both conditionals active) ───────

describe("iter23 · ПЭП + СТС collateral render together cleanly", () => {
  it("both flag families resolve without leftover markers", () => {
    const vars = {
      ...PEP_VARS,
      sts_collateral: "1",
      sts_series: "1234",
      sts_number: "567890",
      sts_vehicle_model: "Kawasaki X650",
      sts_vehicle_plate: "А123ВС76",
      sts_owner_full_name: "Иван Иванович Тестов",
      sts_owner_relation: "сам арендатор",
      sts_deposit_amount_skipped: "20000",
      sts_pledge_return_days: "3",
      extra_km_fee_rub: "30",
    };
    const rendered = applyTemplateVariables(read(TEMPLATES[0]), vars);
    expect(rendered).not.toContain("{{#if");
    expect(rendered).not.toContain("{{sts_");
    expect(count(rendered, "Подписано ПЭП")).toBe(5);
    expect(rendered).toContain("(ПЭП Арендодателя — файл Договора, п. 12.3)");
    // СТС return receipt (a future-event field) intentionally keeps its
    // fill-in line even in ПЭП mode — documented decision.
    expect(rendered).toContain("СТС возвращён Арендатору: ____________");
  });
});

// ── 4. Template structural sanity + legal checklist ─────────────────────────

describe("iter23 · template structure and legal checklist", () => {
  for (const tplPath of TEMPLATES) {
    it(`${tplPath}: conditionals balanced, 14 pep_signed branches, legal checklist ok`, () => {
      // Strip HTML comments first — the header comments document the
      // conditional syntax itself and skew a raw count (mirror the renderer).
      const src = read(tplPath).replace(/<!--[\s\S]*?-->/g, "");
      expect(count(src, "{{#if")).toBe(count(src, "{{/if}}"));
      // 14 pep_signed branches: place 1 → 4 (owner line, renter line, owner
      // caption, renter caption), акт → 4, инструкция/тарифы/согласие → 2 each.
      expect(count(src, "{{#if pep_signed}}")).toBe(14);
      const checklist = runLegalTemplateChecklist(src);
      expect(checklist.ok).toBe(true);
      expect(checklist.criticalIssues).toHaveLength(0);
    });
  }

  it("general and vip-bike crew templates stay in sync on signature blocks", () => {
    const general = read(TEMPLATES[0]);
    const crew = read(TEMPLATES[1]);
    expect(count(crew, "{{#if pep_signed}}")).toBe(count(general, "{{#if pep_signed}}"));
    expect(count(crew, "ПЭП Арендодателя")).toBe(count(general, "ПЭП Арендодателя"));
  });
});

// ── 5. Activation re-render carries ПЭП (rentals-dashboard.ts) ──────────────

describe("iter23 · rental activation re-render keeps the ПЭП signature", () => {
  const src = read("app/franchize/server-actions/rentals-dashboard.ts");

  it("reads metadata.pep_signature and sets the ПЭП doc vars", () => {
    expect(src).toContain("pepMeta?.telegram_id && pepMeta.signed_at");
    expect(src).toContain('vars.pep_signed = "1"');
    expect(src).toContain("Telegram ID ${pepMeta.telegram_id}");
    expect(src).toContain("vars.signature_fingerprint = `pep:tg:");
  });

  it("the activation flow still renders the rental template (integrationScope rental-activation)", () => {
    expect(src).toContain('integrationScope: "rental-activation"');
    expect(src).toContain('join(process.cwd(), "docs", "RENTAL_DEAL_TEMPLATE.html")');
  });
});

// ── 6. Web checkout flow still passes pep meta into rental docs ─────────────

describe("iter23 · checkout flow wiring intact (no regressions)", () => {
  const src = read("app/franchize/actions-runtime.ts");

  it("per-line ПЭП gate for rental docs (mixed-cart CODEREVIEW FIX) kept", () => {
    expect(src).toContain('...(pepMeta && bikeFlowTypes[bikeIndex] === "rental" ? { pep: pepMeta } : {})');
  });

  it("contract vars builder still emits the ПЭП signature variables", () => {
    const varsSrc = read("app/lib/rental-contract-vars.ts");
    expect(varsSrc).toContain('pep_signed: "1"');
    // fingerprint = pep:tg:<id>:<initDataSha16> (built from meta.pep)
    expect(varsSrc).toContain("pep:tg:");
    expect(varsSrc).toContain("initDataSha256");
  });
});
