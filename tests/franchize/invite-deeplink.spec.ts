// tests/franchize/invite-deeplink.spec.ts
//
// Фикс 2026-09-22 (boss-report №3): «crew invitation links broken — uses local
// path or v0-car-test.vercel.app, should be t.me/<bot>/app?startapp=join_…».
//
// Контракты:
//   1. FranchizeProfileButton: инвайт = join_<slug> через бота экипажа, а без
//      бота — ПЛАТФОРМЕННЫЙ бот (platformBotUsername). Мёртвый формат
//      crew_<slug>_join_crew и window.location.origin-фолбэк запрещены.
//   2. CrewOverviewClient: «быдовух»-инструкция выпилена; URL всегда t.me.
//   3. Резолвер: платформенный дефолт доезжает до инвайт-экшена
//      (getCrewInviteInfoAction читает resolveCrewBotUsername).
//   4. catalog-gps: парсер GPS-спеков (строка/объект/плоские ключи, lat-first).
//   5. Карта: слой catitem-* + тумблер «Техника» в MapRidersClientRefactored.
//   6. CSV: condition-колонка + сплит vip-bike-sale-new/used в py-скриптах.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  catalogGpsFromSpecs,
  gpsPairFromString,
} from "@/lib/catalog-gps";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("invite deeplink — FranchizeProfileButton (source contract)", () => {
  const src = read("app/franchize/components/FranchizeProfileButton.tsx");

  it("builds join_<slug> startapp via the crew bot", () => {
    expect(src).toContain("startapp=join_");
    expect(src).toContain("platformBotUsername()");
    expect(src).toContain("telegramBotUsername || \"\").trim().replace(/^@/, \"\") || platformBotUsername()");
  });

  it("no longer uses the dead crew_<slug>_join_crew format nor the web fallback", () => {
    // Проверяем ПАТТЕРН билдера, а не упоминания в комментариях (комментарий
    // документирует, что старый формат мёртв — это ок).
    expect(src).not.toContain("startapp=crew_${");
    expect(src).not.toContain("_join_crew`");
    expect(src).not.toContain("window.location.origin}/franchize/");
  });
});

describe("invite deeplink — CrewOverviewClient (source contract)", () => {
  const src = read("app/franchize/[slug]/crew/CrewOverviewClient.tsx");

  it("always builds the t.me/<bot>/app?startapp link", () => {
    expect(src).toContain("https://t.me/${info.botUsername}/app?startapp=${info.startParam}");
  });

  it("ditched the verbose instructional copy (boss: «ditch bullshit»)", () => {
    expect(src).not.toContain("Отправь ссылку будущему владельцу");
    expect(src).not.toContain("не задан — веб-ссылка");
    expect(src).not.toContain("он вступит");
  });

  it("server invite action still returns the last-resort web fallback contract", () => {
    const action = read("app/franchize/server-actions/update-crew-member-role.ts");
    expect(action).toContain("crewJoinStartParam(slug)");
    expect(action).toContain("resolveCrewBotUsername(slug)");
  });
});

describe("catalog-gps parser (unit)", () => {
  it("gpsPairFromString: comma/space/semicolon separated, lat-first", () => {
    expect(gpsPairFromString("56.3269, 44.0059")).toEqual([56.3269, 44.0059]);
    expect(gpsPairFromString("56.3269 44.0059")).toEqual([56.3269, 44.0059]);
    expect(gpsPairFromString("56.3269;44.0059")).toEqual([56.3269, 44.0059]);
    // RU-запятая в ДЕСЯТИЧНОЙ части одиночного токена (объектные/плоские формы)
    expect(catalogGpsFromSpecs({ lat: "56,3269", lon: "44,0059" })).toEqual([56.3269, 44.0059]);
  });

  it("gpsPairFromString: rejects garbage / out-of-range / single value", () => {
    expect(gpsPairFromString("")).toBeNull();
    expect(gpsPairFromString("56.3269")).toBeNull();
    expect(gpsPairFromString("abc, def")).toBeNull();
    expect(gpsPairFromString("120, 44.0")).toBeNull(); // lat > 90
    expect(gpsPairFromString("56.0, 200")).toBeNull(); // lon > 180
  });

  it("catalogGpsFromSpecs: string gps", () => {
    expect(catalogGpsFromSpecs({ gps: "56.32, 44.00" })).toEqual([56.32, 44.0]);
  });

  it("catalogGpsFromSpecs: object gps {lat, lon|lng|longitude}", () => {
    expect(catalogGpsFromSpecs({ gps: { lat: 56.3, lon: 44.0 } })).toEqual([56.3, 44.0]);
    expect(catalogGpsFromSpecs({ gps: { lat: 56.3, lng: 44.0 } })).toEqual([56.3, 44.0]);
    expect(catalogGpsFromSpecs({ gps: { lat: 56.3, longitude: 44.0 } })).toEqual([56.3, 44.0]);
  });

  it("catalogGpsFromSpecs: flat lat/lon keys", () => {
    expect(catalogGpsFromSpecs({ lat: 56.3, lon: 44.0 })).toEqual([56.3, 44.0]);
    expect(catalogGpsFromSpecs({ latitude: "56.3", longitude: "44.0" })).toEqual([56.3, 44.0]);
  });

  it("catalogGpsFromSpecs: null/empty/garbage specs → null", () => {
    expect(catalogGpsFromSpecs(null)).toBeNull();
    expect(catalogGpsFromSpecs(undefined)).toBeNull();
    expect(catalogGpsFromSpecs({})).toBeNull();
    expect(catalogGpsFromSpecs({ gps: "" })).toBeNull();
    expect(catalogGpsFromSpecs({ power_kw: 5 })).toBeNull();
  });
});

describe("map catalog layer (source contract)", () => {
  const src = read("components/map-riders/MapRidersClientRefactored.tsx");

  it("renders catitem-* points from item.rawSpecs GPS", () => {
    expect(src).toContain("catalogGpsFromSpecs(item.rawSpecs)");
    expect(src).toContain("catitem-${item.id}");
    expect(src).toContain("showCatalogItems ? itemPoints : []");
  });

  it("has the «Техника» toggle chip visible only when GPS items exist", () => {
    expect(src).toContain("itemPoints.length > 0");
    expect(src).toContain("setShowCatalogItems((cur) => !cur)");
  });
});

describe("CSV export — condition spec + new/used split (source contract)", () => {
  it("export script: condition column + sale-new/sale-used files + warning for missing", () => {
    const py = read("scripts/export_vip_bike_csv.py");
    expect(py).toContain('"condition"');
    expect(py).toContain("vip-bike-sale-new.csv");
    expect(py).toContain("vip-bike-sale-used.csv");
    expect(py).toContain("def normalize_condition");
    expect(py).toContain("sale_no_condition");
    // Старый единый sale-файл больше не пишется
    expect(py).not.toContain('"vip-bike-sale.csv"');
  });

  it("push script pushes the new/used pair", () => {
    const push = read("scripts/push_catalog_csvs.py");
    expect(push).toContain("vip-bike-sale-new.csv");
    expect(push).toContain("vip-bike-sale-used.csv");
    expect(push).not.toContain('("public/docs/autoreply/vip-bike-sale.csv"');
  });

  it("gold-standard schema documents the condition spec", () => {
    const doc = read("docs/gold-standard-electro-bike-spec-schema.md");
    expect(doc).toContain("| `condition` | Состояние | identity | — | — |");
    expect(doc).toContain("Set `condition`: `new` | `used`");
  });
});
