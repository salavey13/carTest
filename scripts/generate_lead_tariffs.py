#!/usr/bin/env python3
# scripts/generate_lead_tariffs.py
#
# Генерирует app/franchize/[slug]/leads/lib/lead-tariffs.generated.ts из
# public/docs/autoreply/vip-bike-rent.csv (зеркало Supabase, 27 моделей).
#
# Данные: точные тарифы по каждой модели — сутки (daily_price), будни
# (rent_weekday), выходные (rent_weekend), слои 2–4/5–10/11–30 суток
# (rent_2_4d / rent_5_10d / rent_11_30d), почасовые пакеты (price_per_hour,
# price_per_3h / 6h / 12h), залог (deposit_rub).
#
# Сопоставление: matchGroups — наборы токенов (lowercase, ё→е), любая группа
# которой полностью содержится в токенах bikeTitle, даёт совпадение:
#   G1 = make + model (без скобок)        — «79bike falcon gt»
#   G2 = model без make (если ≥2 токенов) — «falcon gt» без бренда
#   G3 = содержимое скобок (Ninja 650)    — «kawasaki ninja 650» / «ninja 650»

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "public/docs/autoreply/vip-bike-rent.csv"
OUT_PATH = ROOT / "app/franchize/[slug]/leads/lib/lead-tariffs.generated.ts"


def norm_tokens(text: str) -> list[str]:
    """lowercase, ё→е, разбивка по не-букво-цифрам."""
    text = text.lower().replace("ё", "е")
    return [t for t in re.split(r"[^a-z0-9а-я]+", text) if t]


def num(value: str) -> int | None:
    value = (value or "").strip()
    if not value:
        return None
    try:
        n = int(float(value))
        return n if n > 0 else None
    except ValueError:
        return None


def ts_str(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def match_groups(make: str, model: str) -> list[list[str]]:
    paren = ""
    paren_match = re.search(r"\(([^)]*)\)", model)
    if paren_match:
        paren = paren_match.group(1)
    main = model.replace(paren_match.group(0), "") if paren_match else model
    main_tokens = norm_tokens(main)
    make_tokens = norm_tokens(make)

    groups: list[list[str]] = []
    g1 = make_tokens + main_tokens  # make + model
    groups.append(g1)
    if len(main_tokens) >= 2:
        groups.append(main_tokens)  # model без бренда («Falcon GT»)
    paren_tokens = norm_tokens(paren)
    if paren_tokens:
        groups.append(make_tokens + paren_tokens)  # kawasaki ninja 650
        if len(paren_tokens) >= 2:
            groups.append(paren_tokens)  # ninja 650
    # Дедуп с сохранением порядка.
    seen: set[tuple[str, ...]] = set()
    unique: list[list[str]] = []
    for g in groups:
        key = tuple(g)
        if key not in seen:
            seen.add(key)
            unique.append(g)
    return unique


def main() -> None:
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    records: list[dict] = []
    for r in rows:
        records.append(
            {
                "id": r["id"],
                "make": r["make"],
                "model": r["model"],
                "displayName": f'{r["make"]} {r["model"]}'.strip(),
                "licenseClass": r["license_class"],
                "isElectric": "electric" in r["type"].lower() or "electro" in r["bike_subtype"].lower() or "electric" in r["bike_subtype"].lower(),
                "daily": num(r["daily_price"]),
                "weekday": num(r["rent_weekday"]),
                "weekend": num(r["rent_weekend"]),
                "days2to4": num(r["rent_2_4d"]),
                "days5to10": num(r["rent_5_10d"]),
                "days11to30": num(r["rent_11_30d"]),
                "hour1": num(r["price_per_hour"]),
                "hours3": num(r["price_per_3h"]),
                "hours6": num(r["price_per_6h"]),
                "hours12": num(r["price_per_12h"]),
                "deposit": num(r["deposit_rub"]),
                "matchGroups": match_groups(r["make"], r["model"]),
            }
        )

    lines: list[str] = []
    lines.append("// lead-tariffs.generated.ts")
    lines.append("//")
    lines.append("// АВТОГЕНЕРАЦИЯ из public/docs/autoreply/vip-bike-rent.csv — НЕ править руками.")
    lines.append("// Регенерация: python3 scripts/generate_lead_tariffs.py")
    lines.append("// Точные тарифы парка VIP BIKE (27 моделей): сутки, будни/выходные,")
    lines.append("// слои 2–4/5–10/11–30 суток, почасовые пакеты 1ч/3ч/6ч/12ч, залог.")
    lines.append("")
    lines.append("export interface BikeTariff {")
    lines.append("  id: string;")
    lines.append("  make: string;")
    lines.append("  model: string;")
    lines.append("  /** «79BIKE Falcon GT» — для вставки в тексты ответов. */")
    lines.append("  displayName: string;")
    lines.append("  /** Класс ТС из CSV (например, «Не требуются (электро-эндуро…)»). */")
    lines.append("  licenseClass: string;")
    lines.append("  /** Электро (для лимита пробега 150 км/сутки vs 200 км на бензине). */")
    lines.append("  isElectric: boolean;")
    lines.append("  daily: number | null;")
    lines.append("  /** Сутки в будни (базовая ставка объявления). */")
    lines.append("  weekday: number | null;")
    lines.append("  /** Сутки в выходные (обычно +15–20%). */")
    lines.append("  weekend: number | null;")
    lines.append("  /** Ставка суток при аренде 2–4 суток. */")
    lines.append("  days2to4: number | null;")
    lines.append("  /** Ставка суток при аренде 5–10 суток. */")
    lines.append("  days5to10: number | null;")
    lines.append("  /** Ставка суток при аренде 11–30 суток (максимум скидки). */")
    lines.append("  days11to30: number | null;")
    lines.append("  /** Аренда 1 часа. */")
    lines.append("  hour1: number | null;")
    lines.append("  /** Пакет 3 часа. */")
    lines.append("  hours3: number | null;")
    lines.append("  /** Пакет 6 часов (полдня). */")
    lines.append("  hours6: number | null;")
    lines.append("  /** Пакет 12 часов. */")
    lines.append("  hours12: number | null;")
    lines.append("  /** Залог по модели, ₽ (null — уточнять). */")
    lines.append("  deposit: number | null;")
    lines.append("  /**")
    lines.append("   * Наборы токенов для сопоставления с bikeTitle (lowercase, ё→е):")
    lines.append("   * совпадение — если ЛЮБАЯ группа целиком входит в токены заголовка.")
    lines.append("   */")
    lines.append("  matchGroups: readonly (readonly string[])[];")
    lines.append("}")
    lines.append("")
    lines.append("export const BIKE_TARIFFS: readonly BikeTariff[] = [")

    def opt(n: int | None) -> str:
        return str(n) if n is not None else "null"

    for rec in records:
        lines.append("  {")
        lines.append(f'    id: "{ts_str(rec["id"])}",')
        lines.append(f'    make: "{ts_str(rec["make"])}",')
        lines.append(f'    model: "{ts_str(rec["model"])}",')
        lines.append(f'    displayName: "{ts_str(rec["displayName"])}",')
        lines.append(f'    licenseClass: "{ts_str(rec["licenseClass"])}",')
        lines.append(f"    isElectric: {'true' if rec['isElectric'] else 'false'},")
        lines.append(f"    daily: {opt(rec['daily'])},")
        lines.append(f"    weekday: {opt(rec['weekday'])},")
        lines.append(f"    weekend: {opt(rec['weekend'])},")
        lines.append(f"    days2to4: {opt(rec['days2to4'])},")
        lines.append(f"    days5to10: {opt(rec['days5to10'])},")
        lines.append(f"    days11to30: {opt(rec['days11to30'])},")
        lines.append(f"    hour1: {opt(rec['hour1'])},")
        lines.append(f"    hours3: {opt(rec['hours3'])},")
        lines.append(f"    hours6: {opt(rec['hours6'])},")
        lines.append(f"    hours12: {opt(rec['hours12'])},")
        lines.append(f"    deposit: {opt(rec['deposit'])},")
        groups = "], [".join(", ".join(f'"{t}"' for t in g) for g in rec["matchGroups"])
        lines.append(f"    matchGroups: [[{groups}]],")
        lines.append("  },")

    lines.append("];")
    lines.append("")

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK: {len(records)} моделей → {OUT_PATH.relative_to(ROOT)}")
    for rec in records:
        groups = " | ".join(" ".join(g) for g in rec["matchGroups"])
        print(f'  {rec["id"]:40s} {groups}')
    return None


if __name__ == "__main__":
    sys.exit(main())
