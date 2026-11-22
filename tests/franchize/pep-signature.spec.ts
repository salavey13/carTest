// tests/franchize/pep-signature.spec.ts
// ПЭП (простая электронная подпись, ст. 5–6 ФЗ-63) — unit tests for the
// pure pipeline pieces (no DB):
//   1. buildRentalContractVariables: meta.pep → pep_signed/renter_signature/
//      signature_timestamp/signature_fingerprint variables
//   2. RENTAL_DEAL_TEMPLATE.html + crew vip-bike template: clause 12.3 present,
//      {{#if pep_signed}} signature block renders both branches correctly
//   3. Template-engine truthiness contract for pep_signed ("" → falsy, "1" → truthy)
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildRentalContractVariables } from "@/app/lib/rental-contract-vars";
import { applyTemplateVariables } from "@/lib/markdownTemplate";
import { isTelegramInitDataFresh, getTelegramInitDataAuthDate } from "@/lib/telegram-webapp-auth";

const CREW_SECRETS = {
  legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
  returnAddress: "г. Нижний Новгород, пл. Комсомольская 2",
  issuerName: "ИП Воробьев Р.В.",
  signatoryRole: "Менеджер Мотосалона",
  organizationRepresentative: "ИП Воробьев Р.В.",
  organizationName: "Мотосалон ВипБайкЭлектро",
  organizationShort: "ИП Воробьев Р.В.",
  ogrnip: "326527500025145",
  inn: "525813643035",
  bankAccount: "40802810942710013083",
  bankName: "Волго-Вятский Банк ПАО Сбербанк",
  bankCity: "г. Нижний Новгород",
  bankCorrAccount: "30101810900000000603",
  email: "vip_bike@mail.ru",
};

const RENTER = {
  fullName: "Наумов Кирилл Николаевич",
  birthDate: "11.03.2002",
  phone: "89960430155",
  passportSeries: "2222",
  passportNumber: "424793",
  passportIssueDate: "04.06.2022",
  passportIssuedBy: "ГУ МВД РОССИИ ПО НИЖЕГОРОДСКОЙ ОБЛАСТИ",
  registration: "Нижегородская обл. Город Бор ул. Максима д.16 кв 3",
};

const BIKE = {
  id: "ducati-panigale-s-electro-black-aero",
  make: "Ducati",
  model: "Panigale S Electro Black Aero",
  type: "bike",
  specs: {
    type: "electro",
    power_kw: 5,
    last_known_odometer: 2465,
    deposit_rub: 20000,
    dailyPrice: 10000,
  } as Record<string, unknown>,
};

const PERIOD = {
  startDate: "26.08.2026",
  startTime: "20:00",
  endDate: "27.08.2026",
  endTime: "20:00",
  dailyPrice: 10000,
};

describe("ПЭП (ст. 5–6 ФЗ-63) contract variables", () => {
  const PRICE_BREAKDOWN = {
    totalRub: 10000,
    basePriceRub: 10000,
    helmetRub: 0,
    depositRub: 20000,
    savingsRub: 0,
    savingsPercent: 0,
    tier: "day",
  };

  it("meta.pep → pep_signed truthy + ПЭП signature line variables", () => {
    const vars = buildRentalContractVariables({
      renter: RENTER,
      bike: BIKE,
      period: PERIOD,
      crewSecrets: CREW_SECRETS,
      // signed at 16:42 UTC → 19:42 МСК
      meta: { pep: { telegramId: "8935491576", username: "liki2222", signedAt: "2026-08-27T16:42:11.000Z" } },
      equipment: {},
      priceBreakdown: PRICE_BREAKDOWN,
    });

    expect(vars.pep_signed).toBe("1");
    expect(vars.renter_signature).toBe("Telegram ID 8935491576 (@liki2222)");
    expect(vars.signature_timestamp).toBe("27.08.2026 19:42 (МСК)");
    expect(vars.signature_fingerprint).toBe("pep:tg:8935491576");
  });

  it("meta.pep without username → signature line shows bare Telegram ID", () => {
    const vars = buildRentalContractVariables({
      renter: RENTER,
      bike: BIKE,
      period: PERIOD,
      crewSecrets: CREW_SECRETS,
      meta: { pep: { telegramId: "8935491576", signedAt: "2026-08-27T16:42:11.000Z" } },
      equipment: {},
      priceBreakdown: PRICE_BREAKDOWN,
    });

    expect(vars.pep_signed).toBe("1");
    expect(vars.renter_signature).toBe("Telegram ID 8935491576");
  });

  it("no meta.pep → pep_signed empty (classic blank signature line)", () => {
    const vars = buildRentalContractVariables({
      renter: RENTER,
      bike: BIKE,
      period: PERIOD,
      crewSecrets: CREW_SECRETS,
      meta: { renterSignature: "электронное согласие в Telegram WebApp" },
      equipment: {},
      priceBreakdown: PRICE_BREAKDOWN,
    });

    expect(vars.pep_signed).toBe("");
    expect(vars.renter_signature).toBe("электронное согласие в Telegram WebApp");
  });

  it("meta.pep with INVALID signedAt → timestamp falls back to now, never NaN", () => {
    const vars = buildRentalContractVariables({
      renter: RENTER,
      bike: BIKE,
      period: PERIOD,
      crewSecrets: CREW_SECRETS,
      // @ts-expect-error — runtime garbage defense
      meta: { pep: { telegramId: "8935491576", signedAt: "not-a-date" } },
      equipment: {},
      priceBreakdown: PRICE_BREAKDOWN,
    });

    expect(vars.pep_signed).toBe("1");
    expect(vars.signature_timestamp).toMatch(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2} \(МСК\)/);
    expect(vars.signature_timestamp).not.toContain("NaN");
  });
});

describe("ПЭП template rendering (RENTAL_DEAL_TEMPLATE + vip-bike crew template)", () => {
  const baseTemplate = readFileSync(join(process.cwd(), "docs", "RENTAL_DEAL_TEMPLATE.html"), "utf8");
  const crewTemplate = readFileSync(join(process.cwd(), "docs", "crewDocs", "vip-bike_RENTAL_DEAL_TEMPLATE.html"), "utf8");

  const buildVars = (pep?: { telegramId: string; username?: string; signedAt: string }) =>
    buildRentalContractVariables({
      renter: RENTER,
      bike: BIKE,
      period: PERIOD,
      crewSecrets: CREW_SECRETS,
      meta: pep ? { pep } : { renterSignature: "электронное согласие в Telegram WebApp" },
      equipment: {},
      // priceBreakdown skips the tier calculator (whose CJS require of
      // date-utils does not resolve in the vitest ESM environment)
      priceBreakdown: {
        totalRub: 10000,
        basePriceRub: 10000,
        helmetRub: 0,
        depositRub: 20000,
        savingsRub: 0,
        savingsPercent: 0,
        tier: "day",
      },
    });

  for (const [label, template] of [["base", baseTemplate], ["vip-bike crew", crewTemplate]] as const) {
    it(`[${label}] contains ПЭП clause 12.3 with ФЗ-63 reference`, () => {
      expect(template).toContain("12.3");
      expect(template).toContain("простыми электронными подписями");
      expect(template).toContain("63-ФЗ");
      expect(template).toContain("Telegram Mini App");
    });

    it(`[${label}] signed → renders ПЭП signature block, no blank renter line`, () => {
      const vars = buildVars({ telegramId: "8935491576", username: "liki2222", signedAt: "2026-08-27T16:42:11.000Z" });
      const out = applyTemplateVariables(template, vars);

      expect(out).toContain("Подписано ПЭП");
      expect(out).toContain("Telegram ID 8935491576 (@liki2222)");
      expect(out).toContain("27.08.2026 19:42 (МСК)");
      expect(out).toContain("(ПЭП Арендатора — акцепт в Telegram, п. 12.3 Договора)");
      // iter14: name-prefilled signature lines. Signed → the renter's ПЭП
      // block replaces his line; the personal-data consent line prefills
      // the renter's name. No fully-blank 17-underscore pair remains in
      // section 13.
      expect(out.match(/_________________ \/ _______________/g)?.length ?? 0).toBe(0);
      // iter23: in ПЭП mode the ISSUER's blank placeholder is gone — his
      // line is the BARE representative name («Воробьев Р.В.» instead of
      // «_____ / Воробьев Р.В.»); the п. 12.3 ПЭП Арендодателя explanation
      // stays in the small-print caption under the name.
      expect(out).not.toContain("_________________ / " + (vars.issuer_representative ?? ""));
      expect(out.split(`>${vars.issuer_representative ?? ""}</td>`).length - 1).toBe(2);
      expect(out).toContain("(ПЭП Арендодателя — файл Договора, п. 12.3)");
      expect(out).not.toContain("ПЭП Арендодателя — файл Договора, сформированный");
      expect(out).not.toContain("ПЭП Арендодателя — файл Договора, направленный");
      // template keeps the HTML entity — htmlToDocx converts &emsp; later
      expect(out).not.toContain("(подпись)&emsp;(Ф.И.О. Арендатора)");
    });

    it(`[${label}] unsigned → classic blank signature lines for both parties`, () => {
      const vars = buildVars(undefined);
      const out = applyTemplateVariables(template, vars);

      expect(out).not.toContain("Подписано ПЭП");
      // iter14: unsigned keeps BOTH section-13 lines, now with pre-printed
      // names (issuer + renter) — only the pen stroke stays blank.
      expect(out.match(/_________________ \/ _______________/g)?.length ?? 0).toBe(0);
      expect(out).toContain("_________________ / " + (vars.issuer_representative ?? ""));
      expect(out).toContain("_________________ / " + (vars.renter_full_name ?? ""));
      expect(out).toContain("(подпись)&emsp;(Ф.И.О. Арендатора)");
    });
  }
});

// CODEREVIEW: equipment-rental docs share buildRentalContractVariables with
// rental docs (equipmentMode) — a mixed cart (bike + equipment-only lines)
// passes meta.pep to ALL rental-flow docs, so the equipment templates MUST
// carry the same ПЭП clause + conditional signature block.
describe("ПЭП template rendering (EQUIPMENT_RENTAL templates)", () => {
  const baseTemplate = readFileSync(join(process.cwd(), "docs", "EQUIPMENT_RENTAL_DEAL_TEMPLATE.html"), "utf8");
  const crewTemplate = readFileSync(join(process.cwd(), "docs", "crewDocs", "vip-bike_EQUIPMENT_RENTAL_DEAL_TEMPLATE.html"), "utf8");

  const buildVars = (pep?: { telegramId: string; username?: string; signedAt: string }) =>
    buildRentalContractVariables({
      renter: RENTER,
      bike: BIKE,
      period: PERIOD,
      crewSecrets: CREW_SECRETS,
      meta: pep ? { pep } : {},
      equipment: {},
      priceBreakdown: {
        totalRub: 2000,
        basePriceRub: 2000,
        helmetRub: 0,
        depositRub: 0,
        savingsRub: 0,
        savingsPercent: 0,
        tier: "day",
      },
    });

  for (const [label, template] of [["base", baseTemplate], ["vip-bike crew", crewTemplate]] as const) {
    it(`[${label}] contains ПЭП clause 12.3 with ФЗ-63 reference`, () => {
      expect(template).toContain("12.3");
      expect(template).toContain("простыми электронными подписями");
      expect(template).toContain("63-ФЗ");
      expect(template).toContain("Telegram Mini App");
    });

    it(`[${label}] signed → renders ПЭП signature block`, () => {
      const vars = buildVars({ telegramId: "8935491576", username: "liki2222", signedAt: "2026-08-27T16:42:11.000Z" });
      const out = applyTemplateVariables(template, vars);

      expect(out).toContain("Подписано ПЭП");
      expect(out).toContain("Telegram ID 8935491576 (@liki2222)");
      expect(out).toContain("27.08.2026 19:42 (МСК)");
      expect(out).toContain("(ПЭП Арендатора — акцепт в Telegram, п. 12.3 Договора)");
      // iter14: signed → renter's line becomes the ПЭП block, issuer's line
      // prefills his name; the appendix act lines prefill both names.
      expect(out.match(/_________________ \/ _______________/g)?.length ?? 0).toBe(0);
      // iter23-fix: ПЭП now fills ALL FOUR renter places (main full audit +
      // акт + прайс-приложение + согласие, compact form) and the OWNER line
      // is the bare representative name in both his places (main + акт) —
      // same «Воробьев Р.В.» instead of «_____ / Воробьев Р.В.» rule as the
      // rental doc, because mixed carts ПЭП-sign equipment docs too.
      expect(out.split("Подписано ПЭП").length - 1).toBe(4);
      expect(out.split(`>${vars.issuer_representative ?? ""}</td>`).length - 1).toBe(2);
      expect(out).toContain("(ПЭП Арендодателя — файл Договора, п. 12.3)");
      expect(out).not.toContain(`_________________ / ${vars.issuer_representative ?? ""}`);
      expect(out).not.toContain(`_____________________ / ${vars.issuer_representative ?? ""} /`);
      expect(out).not.toContain("{{#if");
      expect(out).not.toContain("{{/if}}");
    });

    it(`[${label}] unsigned → classic blank signature lines for both parties`, () => {
      const vars = buildVars(undefined);
      const out = applyTemplateVariables(template, vars);

      expect(out).not.toContain("Подписано ПЭП");
      // iter14: unsigned keeps both section-13 lines with pre-printed names.
      expect(out.match(/_________________ \/ _______________/g)?.length ?? 0).toBe(0);
      // Owner blanks are back in manual mode (main + akt).
      expect(out).toContain(`_________________ / ${vars.issuer_representative ?? ""}`);
      expect(out).toContain(`_____________________ / ${vars.issuer_representative ?? ""} /`);
      expect(out).toContain("_________________ / " + (vars.renter_full_name ?? ""));
      expect(out).toContain("(подпись)&emsp;(Ф.И.О. Арендатора)");
    });
  }
});

// CODEREVIEW: ПЭП is signature-grade — Telegram initData is signed once per
// Mini App session and NEVER expires, so both verify sites (checkout +
// post-hoc signing) enforce a 24h freshness window on Telegram's auth_date.
describe("Telegram initData freshness (replay protection)", () => {
  const NOW_MS = 1787666400000; // fixed clock: 2026-08-27T18:00:00Z
  const mkInitData = (authDateSeconds?: number) =>
    `user=${encodeURIComponent(JSON.stringify({ id: 8935491576 }))}&auth_date=${authDateSeconds ?? ""}&hash=abc`;

  it("auth_date 1h old → fresh", () => {
    expect(isTelegramInitDataFresh(mkInitData(NOW_MS / 1000 - 3600), undefined, NOW_MS)).toBe(true);
  });

  it("auth_date 23h old → still fresh (24h window)", () => {
    expect(isTelegramInitDataFresh(mkInitData(NOW_MS / 1000 - 23 * 3600), undefined, NOW_MS)).toBe(true);
  });

  it("auth_date 25h old → stale (replay refused)", () => {
    expect(isTelegramInitDataFresh(mkInitData(NOW_MS / 1000 - 25 * 3600), undefined, NOW_MS)).toBe(false);
  });

  it("missing auth_date → NOT fresh (defensive default)", () => {
    expect(isTelegramInitDataFresh("user=%7B%22id%22%3A1%7D&hash=abc", undefined, NOW_MS)).toBe(false);
  });

  it("auth_date in the future beyond 5min skew → not fresh", () => {
    expect(isTelegramInitDataFresh(mkInitData(NOW_MS / 1000 + 600), undefined, NOW_MS)).toBe(false);
  });

  it("auth_date slightly ahead (clock skew) → fresh", () => {
    expect(isTelegramInitDataFresh(mkInitData(NOW_MS / 1000 + 120), undefined, NOW_MS)).toBe(true);
  });

  it("custom maxAge is respected", () => {
    expect(isTelegramInitDataFresh(mkInitData(NOW_MS / 1000 - 30 * 60), 10 * 60 * 1000, NOW_MS)).toBe(false);
    expect(isTelegramInitDataFresh(mkInitData(NOW_MS / 1000 - 5 * 60), 10 * 60 * 1000, NOW_MS)).toBe(true);
  });

  it("getTelegramInitDataAuthDate parses seconds and rejects garbage", () => {
    expect(getTelegramInitDataAuthDate(mkInitData(1787662800))).toBe(1787662800);
    expect(getTelegramInitDataAuthDate("auth_date=not-a-number&hash=x")).toBeNull();
    expect(getTelegramInitDataAuthDate("hash=x")).toBeNull();
  });
});
