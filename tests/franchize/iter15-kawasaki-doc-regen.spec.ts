// tests/franchize/iter15-kawasaki-doc-regen.spec.ts
//
// iter15 TEST ARTIFACT GENERATOR — regenerates the kawasaki EX650K rental
// contract (order-mtbnsf97-zukmfy) with:
//   - corrected total: 12 000 ₽ (bike 10 000 + 2 helmets × 1 000, price override)
//   - equipment: Шлем ×2, Перчатки (в подарок), Куртка (в подарок), Зарядка
//   - deposit: 20 000 ₽ from bike specs (NOT the 500₽ reservation hold)
//   - ПЭП SIGNED branch (renter Telegram ID 1062465800) — preview render the
//     user asked for; saved to /home/z/my-project/download for manual inspection.
//
// The generated DOCX is also uploaded by scripts/iter15-retrofix.mjs (plain node).

import { describe, it, expect, vi } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { buildRentalContractVariables } from "@/app/lib/rental-contract-vars";

// docx-capability pulls server-only modules; mock them like doc-generation.spec.ts
vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    schema: () => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
  upsertRow: async () => ({}),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

const DOCS = join(process.cwd(), "docs");
const OUT_DIR = "/home/z/my-project/download";
const OUT_PATH = join(OUT_DIR, "rental-kawasaki-ex650k-2026-08-27-signed-preview.docx");

// Live context (fetched via REST so the vitest supabase mocks don't interfere)
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function rest(path: string, schema = "public"): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Accept-Profile": schema,
    },
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  return Array.isArray(body) ? body[0] : body;
}

describe("iter15: kawasaki doc regeneration (signed ПЭП preview)", () => {
  it("generates the corrected contract DOCX", async () => {
    const { buildFranchizeDocxFromTemplate } = await import("@/app/franchize/lib/docx-capability");

    // Crew template (vip-bike override first, base fallback)
    const crewTplPath = join(DOCS, "crewDocs", "vip-bike_RENTAL_DEAL_TEMPLATE.html");
    const tplPath = join(DOCS, "RENTAL_DEAL_TEMPLATE.html");
    const template = readFileSync(existsSync(crewTplPath) ? crewTplPath : tplPath, "utf8");

    // Live crew contract defaults (issuer, ИНН, bank…) — same source as /doc
    const crewSecretsRow = await rest("crew_secrets?select=contract_defaults&crew_slug=eq.vip-bike", "private");
    const crewSecrets: any = {
      contractDefaults: crewSecretsRow?.contract_defaults ?? {},
    };

    // Live bike specs (deposit 20000, odometer, VIN…)
    const car = await rest("cars?select=id,make,model,type,specs&id=eq.kawasaki-ex650k");
    expect(car?.specs?.deposit_rub).toBeTruthy();

    const baseVariables = buildRentalContractVariables({
      renter: {
        fullName: "Андрей Жиляев",
        phone: "+79144626758",
        birthDate: "03.09.1997",
        email: "",
        passportSeries: "7617",
        passportNumber: "962766",
        passportIssueDate: "04.10.2017",
        passportIssuedBy: "МП УФМС РОССИИ ПО ЗАБАЙКАЛЬСКОМУ КРАЮ В НЕРЧИНСКОМ РАЙОНЕ",
        registration: "Забайкальский край, г. Нерчинск, ул. Красноармейская, д. 88, кв. 43",
        address: "Забайкальский край, г. Нерчинск, ул. Красноармейская, д. 88, кв. 43",
        driverLicenseSeries: "9922",
        driverLicenseNumber: "119493",
      },
      bike: {
        id: car.id,
        make: car.make,
        model: car.model,
        type: String(car.specs?.type || ""),
        specs: car.specs,
      },
      period: {
        startDate: "27.08.2026",
        startTime: "18:30",
        endDate: "28.08.2026",
        endTime: "18:30",
        dailyPrice: 10000,
        hourlyPrice: Number(car.specs?.price_per_hour || 0),
      },
      crewSecrets,
      meta: {
        contractNumber: "27.8/kawasaki-ex650k",
        contractDate: "27.08.2026",
        documentKey: "rental-kawasaki-ex650k-signed-preview",
        // ПЭП signed branch — preview of the fully-signed doc
        pep: { telegramId: "1062465800", signedAt: "2026-08-27T15:13:04.896Z" },
      },
      equipment: {
        helmets: 2,
        gloves: 1,
        jacket: true,
        boots: false,
        net: false,
        backpack: false,
        bag: false,
        charger: true,
      },
      // Cart-style breakdown: bike 10 000 + helmets 2 000 (jacket/gloves = gift)
      priceBreakdown: {
        totalRub: 10000,
        basePriceRub: 10000,
        helmetRub: 2000,
        depositRub: 20000,
        savingsRub: 0,
        savingsPercent: 0,
        tier: "day",
      },
      // Operator override: bike 10 000 + 2 helmets 2 000 = 12 000 (jacket and
      // gloves are a gift — recorded as a note on the rental page).
      paymentSplit: { cashAmount: 0, bankAmount: 12000 },
      priceOverridden: true,
    });

    const variables = {
      ...baseVariables,
      // Gift note + override explanations so the doc itself explains the pricing
      price_override_note:
        "Итоговая сумма скорректирована оператором: байк 10 000 ₽ + шлем ×2 — 2 000 ₽. Куртка и перчатки — в подарок.",
      equipment_total_cost: "2 000 (куртка и перчатки — в подарок)",
    };

    const result = await buildFranchizeDocxFromTemplate({
      integrationScope: "iter15-kawasaki-signed-preview",
      uploadedBy: "iter15-test",
      documentKey: "rental-kawasaki-ex650k-signed-preview",
      fileName: "rental-kawasaki-ex650k-2026-08-27-signed-preview.docx",
      template,
      variables,
      flowType: "rental",
      templateMode: "html",
    });

    // Rendered HTML must contain the signed ПЭП block + corrected values.
    // NOTE: the override path prints raw numbers ("12000"), formatted ones
    // elsewhere ("20 000") — assert both spellings where they occur.
    const html = result.renderedHtml || "";
    writeFileSync(OUT_PATH.replace(/\.docx$/, ".rendered.html"), html);
    expect(html).toContain("Подписано ПЭП:");
    expect(html).toContain("1062465800");
    expect(html).toContain("12000"); // rent+equipment override
    expect(html).toContain("20 000"); // deposit from specs
    expect(html).toContain("32000"); // total payable incl. deposit
    expect(html).toContain("в подарок");

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_PATH, Buffer.from(result.bytes));
    console.log(`[iter15] signed preview DOCX → ${OUT_PATH} (${result.bytes.length} bytes, sha256 ${result.sha256.slice(0, 12)}…)`);
    expect(result.bytes.length).toBeGreaterThan(10000);
  }, 60000);
});
