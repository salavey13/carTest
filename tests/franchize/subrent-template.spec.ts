// tests/franchize/subrent-template.spec.ts
// Subrent agreement template alignment with the reference paper contract
// («Договор аренды в парк Yamaha R7», июнь 2026):
//   1. §5.1.1 TIERED minimum prices (1 сутки / 2+ суток / 3+ суток) +
//      долгосрочная оговорка + сезонная оговорка (будни/выходные)
//   2. Шапка: регистрация собственника + телефоны обеих сторон
//   3. §18 Реквизиты: телефоны + инициалы в подписях («Молев Г.А.»)
//   4. Приложение №1 (акт приёма-передачи) и Приложение №2 (акт возврата)
//      с таблицами состояния и 10-строчными таблицами повреждений
//   5. Полный рендер: после подстановки всех переменных не остаётся
//      незаменённых {{var}} плейсхолдеров
//   6. vip-bike crew template синхронен базовому
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { applyTemplateVariables } from "@/lib/markdownTemplate";

const baseTemplate = readFileSync(join(process.cwd(), "docs", "SUBRENTAL_DEAL_TEMPLATE.html"), "utf8");
const crewTemplate = readFileSync(join(process.cwd(), "docs", "crewDocs", "vip-bike_SUBRENTAL_DEAL_TEMPLATE.html"), "utf8");

// Full variable set — mirrors what /subrent (subrent-manual.ts) and the
// partner web flow (subrent-contract-generator.ts) build. Values follow the
// reference paper contract (Yamaha R7, Молев ⇄ парк).
const FULL_VARS: Record<string, string> = {
  contract_number: "SR-2026-001",
  day: "15",
  month_num: "06",
  year: "2026",

  organization_name: "Мотосалон ВипБайкЭлектро",
  organization_short: "ИП Воробьев Р.В.",
  organization_representative: "ИП Воробьев Р.В.",
  organization_phone: "+7 920 078-98-88",
  organization_initials: "ИП Воробьев Р.В.",
  legal_address: "г. Нижний Новгород, пл. Комсомольская 2",
  ogrnip: "326527500025145",
  inn: "525813643035",
  bank_account: "40802810942710013083",
  bank_name: "Волго-Вятский Банк ПАО Сбербанк",
  bank_city: "г. Нижний Новгород",
  bank_corr_account: "30101810900000000603",
  email: "vip_bike@mail.ru",

  owner_full_name: "Молев Георгий Анатольевич",
  owner_birth_date: "05.10.2013",
  owner_passport_series: "2213",
  owner_passport_number: "132759",
  owner_passport_issued_by: "отделом ОУФМС России по Нижегородской области в Московском районе",
  owner_passport_issue_date: "01.01.2023",
  owner_registration: "Нижегородская обл, г.о город Нижний Новгород, ул Генкиной д 39А/16 кв 17",
  owner_phone: "+7 960 194-94-37",
  owner_email: "",
  owner_initials: "Молев Г.А.",

  bike_make: "Yamaha",
  bike_model: "YZF-R7",
  bike_vin: "RM39J-000348",
  bike_plate: "3323BE52",
  bike_year: "2022",
  bike_value_rub: "800000",
  bike_registration_cert: "99 87 356594",
  bike_insurance_policy: "ХХХ 0659225087",

  owner_percentage: "50",
  owner_percentage_text: "пятьдесят",
  min_daily_price_rub: "8000",
  min_daily_price_text: "восемь тысяч",
  min_2plus_daily_price_rub: "7000",
  min_2plus_daily_price_text: "семь тысяч",
  min_3plus_daily_price_rub: "6000",
  min_3plus_daily_price_text: "шесть тысяч",
  hourly_3h_price_rub: "6000",
  hourly_6h_price_rub: "7000",
  hourly_12h_price_rub: "8000",
  weekday_daily_price_rub: "10000",
  weekend_daily_price_rub: "12000",
  reporting_period: "неделя",
  payment_deadline_days: "2",
  payment_deadline_days_text: "двух",
  late_penalty_percent: "0.2",

  contract_start_date: "15.06.2026",
  contract_start_time: "10:00",
  contract_end_date: "15.11.2026",
  contract_end_time: "10:00",

  regular_client_deposit_rub: "10000",
  regular_client_deposit_text: "десять тысяч",
  new_client_deposit_rub: "20000",
  new_client_deposit_text: "двадцать тысяч",
  daily_km_allowance: "200",
  extra_km_fee_rub: "30",
  downtime_compensation_daily_rub: "4000",
  downtime_compensation_daily_text: "четыре тысячи",

  return_address: "г. Нижний Новгород, ул. Генкиной 39 А/16 кв 17",
  insurance_territory: "Нижегородской области",
};

describe("Subrent agreement template (aligned with the Yamaha R7 paper contract)", () => {
  for (const [label, template] of [["base", baseTemplate], ["vip-bike crew", crewTemplate]] as const) {
    it(`[${label}] §5.1.1 carries TIERED minimum prices (1 / 2+ / 3+ суток) + долгосрочная оговорка`, () => {
      expect(template).toContain("{{min_daily_price_rub}}");
      expect(template).toContain("{{min_2plus_daily_price_rub}}");
      expect(template).toContain("{{min_3plus_daily_price_rub}}");
      expect(template).toContain("при сроке аренды от 2 суток");
      expect(template).toContain("3 и более суток");
      expect(template).toContain("Долгосрочная аренда обсуждается в индивидуальном порядке");
    });

    it(`[${label}] seasonal clause uses weekday/weekend prices (was: dead variables before iter12)`, () => {
      expect(template).toContain("На старте сезона арендная плата составляет");
      expect(template).toContain("{{weekday_daily_price_rub}}");
      expect(template).toContain("{{weekend_daily_price_rub}}");
      // сезонные переменные раньше собирались ботом, но нигде не использовались
      expect(template.match(/{{weekday_daily_price_rub}}/g)?.length).toBeGreaterThanOrEqual(1);
    });

    it(`[${label}] party header includes owner registration + both phones`, () => {
      expect(template).toContain("зарегистрирован: {{owner_registration}}");
      expect(template).toContain("телефон: {{owner_phone}}");
      expect(template).toContain("телефон: {{organization_phone}}");
    });

    it(`[${label}] requisites §18 carry phones and initials in signature lines`, () => {
      expect(template).toContain("{{owner_initials}}");
      expect(template).toContain("{{organization_initials}}");
      // инициалы стоят в строках подписи, а не просто в реквизитах
      expect(template).toContain("Подпись: __________________ / {{organization_initials}} /");
      expect(template).toContain("Подпись: __________________ / {{owner_initials}} /");
    });

    it(`[${label}] quick-info box lists VIN / гос.номер / СТС / ОСАГО / стоимость`, () => {
      expect(template).toContain("VIN / номер рамы:");
      expect(template).toContain("Гос. номер:");
      expect(template).toContain("СТС:");
      expect(template).toContain("Полис ОСАГО:");
      expect(template).toContain("Оценочная стоимость:");
    });

    it(`[${label}] Приложение №1 (акт приёма-передачи) with condition + damage tables`, () => {
      expect(template).toContain("АКТ ПРИЕМА-ПЕРЕДАЧИ МОТОЦИКЛА");
      expect(template).toContain("Приложение № 1");
      expect(template).toContain("к договору аренды транспортного средства без экипажа № {{contract_number}}");
      // таблица состояния
      expect(template).toContain("Пробег на момент передачи");
      expect(template).toContain("Уровень топлива");
      expect(template).toContain("Количество ключей");
      expect(template).toContain("Состояние шин / тормозов / АКБ");
      // 10 строк таблицы повреждений
      expect(template).toContain("Вид повреждения");
      expect(template.match(/text-align: center;">10<\/td>/g)?.length).toBeGreaterThanOrEqual(1);
      // фотофиксация
      expect(template).toContain("Фото- и/или видеофиксация состояния мотоцикла произведена");
    });

    it(`[${label}] Приложение №2 (акт возврата) with return-specific rows`, () => {
      expect(template).toContain("АКТ ВОЗВРАТА МОТОЦИКЛА");
      expect(template).toContain("Пробег на момент возврата");
      expect(template).toContain("Пробег за период аренды");
      expect(template).toContain("Документы возвращены");
      expect(template).toContain("Общее состояние");
      expect(template).toContain("Предварительный размер задолженности");
    });

    it(`[${label}] full render leaves no unreplaced placeholders`, () => {
      const out = applyTemplateVariables(template, FULL_VARS);
      const leftovers = out.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [];
      expect(leftovers, `unreplaced placeholders: ${leftovers.join(", ")}`).toEqual([]);
    });

    it(`[${label}] full render carries the reference contract values`, () => {
      const out = applyTemplateVariables(template, FULL_VARS);
      // тирные тарифы
      expect(out).toContain("8000 (восемь тысяч) рублей за 1 сутки аренды");
      expect(out).toContain("7000 (семь тысяч) рублей за каждые сутки аренды при сроке аренды от 2 суток");
      expect(out).toContain("6000 (шесть тысяч) рублей за каждые сутки аренды при сроке аренды 3 и более суток");
      // сезонная оговорка
      expect(out).toContain("10000 рублей в будни и 12000 рублей в выходные");
      // реквизиты и инициалы
      expect(out).toContain("зарегистрирован: Нижегородская обл");
      expect(out).toContain("Молев Г.А.");
      // приложения с данными байка
      expect(out).toContain("Yamaha YZF-R7");
      expect(out).toContain("RM39J-000348");
      expect(out).toContain("99 87 356594");
    });

    it(`[${label}] render with EMPTY optional fields (no СТС/ОСАГО/phones) still completes`, () => {
      const sparseVars = { ...FULL_VARS, bike_registration_cert: "", bike_insurance_policy: "", organization_phone: "", owner_registration: "" };
      const out = applyTemplateVariables(template, sparseVars);
      const leftovers = out.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [];
      expect(leftovers, `unreplaced placeholders: ${leftovers.join(", ")}`).toEqual([]);
      expect(out).toContain("Yamaha YZF-R7");
    });
  }

  it("vip-bike crew template stays in sync with the base template", () => {
    expect(crewTemplate).toBe(baseTemplate);
  });

  it("template declares all variables the /subrent bot collects (no dead vars)", () => {
    // Каждая переменная, которую собирает subrent-manual.ts, должна
    // использоваться в шаблоне (раньше weekday/weekend собирались впустую).
    const usedVars = new Set(Array.from(baseTemplate.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), (m) => m[1]));
    const collectedByBot = [
      "contract_number", "day", "month_num", "year",
      "organization_name", "organization_short", "organization_representative",
      "organization_phone", "organization_initials",
      "legal_address", "ogrnip", "inn", "bank_account", "bank_name",
      "bank_city", "bank_corr_account", "email",
      "owner_full_name", "owner_birth_date", "owner_passport_series",
      "owner_passport_number", "owner_passport_issued_by", "owner_passport_issue_date",
      "owner_registration", "owner_phone", "owner_email", "owner_initials",
      "bike_make", "bike_model", "bike_vin", "bike_plate", "bike_year",
      "bike_value_rub", "bike_registration_cert", "bike_insurance_policy",
      "owner_percentage", "owner_percentage_text",
      "min_daily_price_rub", "min_daily_price_text",
      "min_2plus_daily_price_rub", "min_2plus_daily_price_text",
      "min_3plus_daily_price_rub", "min_3plus_daily_price_text",
      "hourly_3h_price_rub", "hourly_6h_price_rub", "hourly_12h_price_rub",
      "weekday_daily_price_rub", "weekend_daily_price_rub",
      "reporting_period", "payment_deadline_days", "payment_deadline_days_text",
      "late_penalty_percent",
      "contract_start_date", "contract_start_time", "contract_end_date", "contract_end_time",
      "regular_client_deposit_rub", "regular_client_deposit_text",
      "new_client_deposit_rub", "new_client_deposit_text",
      "daily_km_allowance", "extra_km_fee_rub",
      "downtime_compensation_daily_rub", "downtime_compensation_daily_text",
      "return_address", "insurance_territory",
    ];
    const dead = collectedByBot.filter((v) => !usedVars.has(v));
    expect(dead, `variables collected by the bot but not used in the template: ${dead.join(", ")}`).toEqual([]);
  });
});
