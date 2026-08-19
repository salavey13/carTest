// tests/franchize/equipment-template-vars.spec.ts
//
// Code review of faadb259 (/ekip equipment flow):
// - Bug #1: TEMPLATE_FILES lacked equipment keys (fixed in crew-access.ts)
// - Bug #2: manual vars object in ekip-manual.ts didn't match template vars
//   (fixed by switching rent flow to buildRentalContractVariables)
//
// This test proves the shared builder covers ALL {{vars}} used by the
// equipment templates, so both the web-app flow and the /ekip bot flow
// produce complete contracts.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRentalContractVariables } from "@/app/lib/rental-contract-vars";

const DOCS_DIR = join(process.cwd(), "docs");

function extractTemplateVars(html: string): string[] {
  const vars = new Set<string>();
  const re = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    // Skip control tokens {{#if}}, {{else}}, {{/if}}
    if (m[1] === "#if" || m[1] === "else" || m[1] === "/if") continue;
    vars.add(m[1]);
  }
  return [...vars].sort();
}

const CREW_SECRETS = {
  organizationName: "Мотосалон ВипБайкЭлектро",
  organizationShort: "ИП Воробьев Р.В.",
  organizationRepresentative: "ИП Воробьев Р.В.",
  issuerRepresentative: "Сидоров Илья Олегович",
  ogrnip: "326527500025145",
  inn: "525813643035",
  bankAccount: "40802810942710013083",
  bankName: "Волго-Вятский Банк ПАО Сбербанк",
  bankCity: "г. Нижний Новгород",
  bankCorrAccount: "30101810900000000603",
  email: "vip_bike@mail.ru",
  legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
  issuerName: "Воробьев Р.В.",
  signatoryRole: "Менеджер Мотосалона",
  returnAddress: "г. Нижний Новгород, пл. Комсомольская 2",
  contractDefaults: {} as Record<string, string>,
};

describe("EQUIPMENT_RENTAL_DEAL_TEMPLATE.html variable coverage", () => {
  const template = readFileSync(join(DOCS_DIR, "EQUIPMENT_RENTAL_DEAL_TEMPLATE.html"), "utf8");
  const templateVars = extractTemplateVars(template);

  it("template uses template-style variables only", () => {
    expect(templateVars.length).toBeGreaterThan(10);
    expect(templateVars).toContain("contract_number");
    expect(templateVars).toContain("equipment_summary");
    expect(templateVars).toContain("subtotal_rub");
  });

  it("buildRentalContractVariables (equipmentMode) covers every template var", () => {
    const vars = buildRentalContractVariables({
      renter: {
        fullName: "Иванов Иван Иванович",
        birthDate: "15.03.1990",
        phone: "+7 900 000-00-00",
        email: "client@mail.ru",
        passportSeries: "4509",
        passportNumber: "123456",
        passportIssueDate: "15.03.2020",
        passportIssuedBy: "ОМВД по Н.Новгороду",
        registration: "г. Н.Новгород, ул. Пушкина, 1",
      },
      bike: {
        id: "equip-1",
        make: "VIP BIKE",
        model: "Шлем FullFace",
        type: "equipment",
        specs: { category: "Шлем", dailyPrice: 500 },
      },
      period: {
        startDate: "01.06.2026",
        startTime: "18:00",
        endDate: "02.06.2026",
        endTime: "10:00",
        dailyPrice: 500,
        depositOverride: 5000,
      },
      crewSecrets: CREW_SECRETS,
      meta: {
        signatureTimestamp: "01.06.2026, 12:00",
        signatureFingerprint: "manual-telegram-ekip",
        renterSignature: "согласие через Telegram",
        documentKey: "ekip-rental-equip-1-123",
        contractNumber: "1.6/equip-1",
      },
      equipmentMode: true,
      equipmentItems: [
        { id: "equip-1", make: "VIP BIKE", model: "Шлем FullFace", dailyPrice: 500, specs: { material: "Шлем" } },
      ],
      paymentSplit: { cashAmount: 5000, bankAmount: 500 },
    });

    const missing = templateVars.filter((v) => !(v in vars));
    expect(missing).toEqual([]);

    const emptyCritical = templateVars.filter((v) => {
      const val = String(vars[v] ?? "");
      return val.trim() === "";
    });
    // rental-template critical vars must be non-empty
    expect(emptyCritical).toEqual([]);
    expect(vars.equipment_list).toContain("Шлем");
    expect(vars.equipment_price_list).toContain("VIP BIKE");
    expect(vars.subtotal_rub).toBeTruthy();
    expect(vars.renter_phone).toContain("+7");
    expect(vars.lessor_address).toContain("Комсомольская");
    expect(vars.return_address).toContain("Комсомольская");
  });

  it("rendered output contains no unfilled {{placeholders}}", async () => {
    const { applyTemplateVariables } = await import("@/lib/markdownTemplate");
    const vars = buildRentalContractVariables({
      renter: {
        fullName: "Иванов Иван Иванович",
        birthDate: "15.03.1990",
        phone: "+7 900 000-00-00",
        email: "client@mail.ru",
        passportSeries: "4509",
        passportNumber: "123456",
        passportIssueDate: "15.03.2020",
        passportIssuedBy: "ОМВД по Н.Новгороду",
        registration: "г. Н.Новгород, ул. Пушкина, 1",
      },
      bike: { id: "equip-1", make: "VIP BIKE", model: "Шлем", type: "equipment", specs: {} },
      period: {
        startDate: "01.06.2026", startTime: "18:00",
        endDate: "02.06.2026", endTime: "10:00",
        dailyPrice: 500, depositOverride: 5000,
      },
      crewSecrets: CREW_SECRETS,
      meta: { documentKey: "ekip-rental-equip-1-123", contractNumber: "1.6/equip-1" },
      equipmentMode: true,
      equipmentItems: [{ id: "equip-1", make: "VIP BIKE", model: "Шлем", dailyPrice: 500 }],
    });
    const rendered = applyTemplateVariables(template, vars);
    const leftover = rendered.match(/{{\s*[a-zA-Z0-9_]+\s*}}/g) || [];
    expect(leftover).toEqual([]);
  });
});

describe("EQUIPMENT_SALE_DEAL_TEMPLATE.html variable coverage", () => {
  const template = readFileSync(join(DOCS_DIR, "EQUIPMENT_SALE_DEAL_TEMPLATE.html"), "utf8");
  const templateVars = extractTemplateVars(template);

  it("sale template vars are a subset of /ekip sale vars", () => {
    const ekipSaleVars = new Set([
      "contract_number", "day", "month", "month_num", "year",
      "buyer_full_name", "buyer_passport", "buyer_passport_issued_by",
      "buyer_passport_issue_date", "buyer_birth_date", "buyer_registration",
      "buyer_phone", "equipment_name", "price_digits", "price_words",
      "signature_timestamp", "document_key",
    ]);
    const missing = templateVars.filter((v) => !ekipSaleVars.has(v));
    expect(missing).toEqual([]);
  });
});