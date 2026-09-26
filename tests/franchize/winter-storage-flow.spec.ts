// tests/franchize/winter-storage-flow.spec.ts
// 2026-09-27: winter-storage (flowType="storage") flow — the contract engine
// path mirrors service/testdrive (single consolidated doc before the per-bike
// loop), the season math is unit-tested in lib/storage-season, and the
// crewDocs template encodes the 14-defect legal audit (canonical vip-bike
// requisites, one season, ст. 899/359 mechanism instead of «утилизация»,
// acts + photo fixation, ПЭП 10.2 + 152-ФЗ 10.6).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { formatStorageMonthsLabel, storageValidUntilISO } from "@/app/franchize/lib/storage-season";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

/**
 * Mirrors the doc engine (lib/markdownTemplate strips HTML comments FIRST),
 * so assertions run against what would actually render into the DOCX —
 * defect-documentation comments in the template header never leak in.
 */
const renderable = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");

describe("storage season math (lib/storage-season)", () => {
  it("17.10.2025 → 1.06.2026 inclusive = «7,5 месяца» (the manual's 6.5 defect)", () => {
    expect(formatStorageMonthsLabel("2025-10-17", "2026-06-01")).toBe("7,5 месяца");
  });

  it("Russian plural rules: 1 месяц / 2 месяца / 5 месяцев", () => {
    expect(formatStorageMonthsLabel("2025-11-01", "2025-12-01")).toBe("1 месяц");
    expect(formatStorageMonthsLabel("2025-11-01", "2026-01-01")).toBe("2 месяца");
    expect(formatStorageMonthsLabel("2025-11-01", "2026-04-01")).toBe("5 месяцев");
  });

  it("fractional seasons render with a comma: «2,5 месяца»", () => {
    expect(formatStorageMonthsLabel("2025-11-15", "2026-01-31")).toBe("2,5 месяца");
  });

  it("returns \"\" for unusable ranges (missing / reversed dates)", () => {
    expect(formatStorageMonthsLabel("", "2026-06-01")).toBe("");
    expect(formatStorageMonthsLabel("2026-06-01", "")).toBe("");
    expect(formatStorageMonthsLabel("2026-06-01", "2025-10-17")).toBe("");
    expect(formatStorageMonthsLabel("2025-10-17", "2025-10-17")).toBe("");
  });

  it("valid-until buffer: season end + 2 days (the «до 3.06» rule)", () => {
    expect(storageValidUntilISO("2026-06-01")).toBe("2026-06-03");
    expect(storageValidUntilISO("garbage")).toBe("");
  });
});

describe("winter storage template (crewDocs)", () => {
  const template = renderable(read("docs/crewDocs/vip-bike_WINTER_STORAGE_TEMPLATE.html"));

  it("keeper = canonical vip-bike requisites via {{vars}} (ИП Воробьев, not Сидоров ИП)", () => {
    expect(template.includes("{{issuer_name}}")).toBe(true);
    expect(template.includes("{{issuer_representative}}")).toBe(true);
    expect(template.includes("{{ogrnip}}")).toBe(true);
    expect(template.includes("{{inn}}")).toBe(true);
    expect(template.includes("{{legal_address}}")).toBe(true);
    // The old manual contract named ИП «Сидоров Илья Олегович» as the keeper —
    // the literal must not come back hard-coded.
    expect(template.includes("Сидоров Илья Олегович")).toBe(false);
    expect(template.includes("Тимирязева")).toBe(false);
  });

  it("labels the parties «Хранитель»/«Владелец», not «Исполнитель»", () => {
    expect(template.includes("Исполнитель")).toBe(false);
    expect(template.includes("Хранитель")).toBe(true);
    expect(template.includes("Владелец")).toBe(true);
  });

  it("one consistent season (п. 2.1/2.2) — dates from vars, no hard-coded months", () => {
    expect(template.includes("{{storage_start_date}}")).toBe(true);
    expect(template.includes("{{storage_end_date}}")).toBe(true);
    expect(template.includes("{{storage_months}}")).toBe(true);
    expect(template.includes("{{contract_valid_until}}")).toBe(true);
    // The arithmetic defects of the manual: no literal «6.5 месяцев», no
    // stray «3.06. 2026», no «200тр», no «скрывшимся» typo.
    expect(template.includes("6.5")).toBe(false);
    expect(template.includes("200тр")).toBe(false);
    expect(template.includes("скрывшимся")).toBe(false);
  });

  it("unclaimed-bike mechanism is legal: ст. 899 п. 2 + удержание ст. 359, NOT «утилизация»", () => {
    expect(template.includes("ст. 359 ГК РФ")).toBe(true);
    expect(template.includes("ст. 899 ГК РФ")).toBe(true);
    expect(template.includes("остаток перечисляется Владельцу")).toBe(true);
    // The old clause granted the keeper the right to destroy the bike.
    expect(template.includes("утилизацию")).toBe(false);
    expect(template.includes("право на утилизацию")).toBe(false);
  });

  it("has the ПЭП clause (10.2) and 152-ФЗ consent (10.6) + {{#if pep_signed}} blocks", () => {
    expect(template.includes("10.2. Стороны признают возможность заключения Договора")).toBe(true);
    expect(template.includes("63-ФЗ")).toBe(true);
    expect(template.includes("152-ФЗ")).toBe(true);
    expect(template.includes("{{#if pep_signed}}")).toBe(true);
    expect(template.includes("{{owner_signature}}")).toBe(true);
    expect(template.includes("{{signature_timestamp}}")).toBe(true);
  });

  it("includes the acts: приёма-передачи (with notice address + photo fixation) and возврата", () => {
    expect(template.includes("АКТ ПРИЁМА-ПЕРЕДАЧИ")).toBe(true);
    expect(template.includes("АКТ ВОЗВРАТА")).toBe(true);
    expect(template.includes("Адрес для уведомлений Владельца")).toBe(true);
    expect(template.includes("Фотофиксация")).toBe(true);
  });

  it("doc-engine compatible: {{var}} + {{#if}}…{{else}}…{{/if}} only, balanced if/close", () => {
    const ifs = (template.match(/{{#if\s+[a-zA-Z0-9_]+}}/g) ?? []).length;
    const closes = (template.match(/{{\/if}}/g) ?? []).length;
    expect(ifs).toBeGreaterThan(0);
    expect(ifs).toBe(closes);
  });
});

describe("storage flow wiring (actions-runtime)", () => {
  const src = read("app/franchize/actions-runtime.ts");

  it("flowType = \"storage\" is accepted end-to-end (type union + zod schema)", () => {
    expect(src.includes('type FranchizeOrderFlowType = "rental" | "sale" | "mixed" | "testdrive" | "service" | "equipment" | "storage"')).toBe(true);
    expect(src.includes('z.enum(["rental", "sale", "mixed", "testdrive", "service", "storage"])')).toBe(true);
  });

  it("schema carries optional storageDetails (bike identity + estimated value + place)", () => {
    expect(src.includes("storageDetails: z.object({")).toBe(true);
    expect(src.includes("bikeEstimatedValueRub: z.number().finite().nonnegative().optional()")).toBe(true);
    expect(src.includes("storageAddress: z.string().trim().max(300).optional()")).toBe(true);
  });

  it("storage identity gate: owner passport + bike make/value, called before any writes", () => {
    expect(src.includes("function assertStorageIdentityDocs(payload: {")).toBe(true);
    const callSite = src.indexOf("assertStorageIdentityDocs(payload);");
    const callDef = src.indexOf("assertTestdriveIdentityDocs(payload);");
    expect(callSite).toBeGreaterThan(-1);
    expect(callSite).toBeGreaterThan(callDef);
  });

  it("loadFranchizeDealTemplate maps storage → WINTER_STORAGE_TEMPLATE.html (crewDocs first)", () => {
    expect(src.includes('"WINTER_STORAGE_TEMPLATE.html"')).toBe(true);
    expect(src.includes('flowType === "storage" ? "storageDealTemplate"')).toBe(true);
  });

  it("storage doc is a consolidated pre-loop branch (service pattern) and is skipped in the loop", () => {
    const serviceBranch = src.indexOf("if (isServiceFlow && serviceTemplate) {");
    const storageBranch = src.indexOf("if (isStorageFlow && storageTemplate) {");
    const loopStart = src.indexOf("for (let bikeIndex = 0; bikeIndex < payload.cartLines.length; bikeIndex++) {", storageBranch);
    expect(serviceBranch).toBeGreaterThan(-1);
    expect(storageBranch).toBeGreaterThan(serviceBranch);
    expect(loopStart).toBeGreaterThan(storageBranch);
    const loopSkip = src.indexOf('if (bikeFlowTypes[bikeIndex] === "storage") {\n        continue;\n      }', loopStart);
    expect(loopSkip).toBeGreaterThan(-1);
  });

  it("ПЭП vars for storage use owner_signature (signer = Владелец) + MSK timestamp", () => {
    const storageBranch = src.slice(src.indexOf("if (isStorageFlow && storageTemplate) {"), src.indexOf("for (let bikeIndex = 0; bikeIndex < payload.cartLines.length; bikeIndex++) {", src.indexOf("if (isStorageFlow && storageTemplate) {")));
    expect(storageBranch.includes('pep_signed: "1"')).toBe(true);
    expect(storageBranch.includes("owner_signature:")).toBe(true);
    expect(storageBranch.includes("(МСК)")).toBe(true);
    expect(storageBranch.includes("owner_passport: storagePassportStr")).toBe(true);
    expect(storageBranch.includes("bike_estimated_value_words:")).toBe(true);
    expect(storageBranch.includes("storage_months: storageMonthsLabel")).toBe(true);
    expect(storageBranch.includes("contract_valid_until: storageValidUntilRu")).toBe(true);
  });

  it("storage orders create NO rental row (insert stays gated to rental/mixed)", () => {
    const gate = src.indexOf('(flowType === "rental" || flowType === "mixed")');
    expect(gate).toBeGreaterThan(-1);
  });

  it("notifications: ❄️ winter-storage labels and no rent-template/analytics-deeplink path", () => {
    expect(src.includes('isStorageFlow ? "❄️"')).toBe(true);
    expect(src.includes('"Новый заказ на зимнее хранение"')).toBe(true);
    expect(src.includes('"Заявка на зимнее хранение"')).toBe(true);
    expect(src.includes('flowType !== "mixed" && flowType !== "storage"')).toBe(true);
    expect(src.includes("// Winter storage has no analytics wall yet — deeplinks would 404.")).toBe(true);
  });
});

describe("catalog: «Зимнее Хранение» pill + «Место хранения» modal", () => {
  it("CatalogClient wires the pill (vip-bike only) and renders the modal", () => {
    const src = read("app/franchize/components/CatalogClient.tsx");
    expect(src.includes('showWinterStoragePill = resolvedSlug === "vip-bike" || slug === "vip-bike"')).toBe(true);
    expect(src.includes("<WinterStorageModal")).toBe(true);
    expect(src.includes("Зимнее хранение")).toBe(true);
  });

  it("modal carries the storage place (Стригинский 13Б), care duties, price and ПЭП promise", () => {
    const src = read("app/franchize/components/WinterStorageModal.tsx");
    expect(src.includes("Стригинский переулок, 13Б")).toBe(true);
    expect(src.includes("подзарядка аккумулятора")).toBe(true);
    expect(src.includes("от 2 000 ₽ / месяц")).toBe(true);
    expect(src.includes("ПЭП")).toBe(true);
    expect(src.includes("Оставить заявку")).toBe(true);
  });
});
