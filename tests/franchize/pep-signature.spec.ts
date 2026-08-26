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
      // TWO blank underscores lines remain: the lessor's side (section 13) +
      // the personal-data consent appendix — but NOT the renter's section-13 line
      expect(out.match(/_________________ \/ _______________/g)?.length).toBe(2);
      // template keeps the HTML entity — htmlToDocx converts &emsp; later
      expect(out).not.toContain("(подпись)&emsp;(Ф.И.О. Арендатора)");
    });

    it(`[${label}] unsigned → classic blank signature lines for both parties`, () => {
      const vars = buildVars(undefined);
      const out = applyTemplateVariables(template, vars);

      expect(out).not.toContain("Подписано ПЭП");
      // THREE blank underscore lines: lessor + renter (section 13) + consent appendix
      expect(out.match(/_________________ \/ _______________/g)?.length).toBe(3);
      expect(out).toContain("(подпись)&emsp;(Ф.И.О. Арендатора)");
    });
  }
});
