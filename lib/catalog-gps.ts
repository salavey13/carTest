// lib/catalog-gps.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure-хелперы GPS-координат из specs каталога (cars.specs JSONB).
//
// Зачем: «show catalog items on map in case it has gps coordinates in specs»
// (2026-09-22). Спеки пишутся вручную/гидрацией, поэтому формат значения
// толерантный — принимаем ВСЕ разумные формы:
//   · gps: "56.3269, 44.0059" / "56.3269 44.0059" / "56.3269;44.0059"
//   · gps: { lat: 56.3269, lon: 44.0059 } (или lng/longitude)
//   · верхнеуровневые ключи specs: lat/latitude + lon/lng/longitude
//
// Порядок парсинга — lat ПЕРВЫМ (тот же контракт, что у MotoSpot.coords и
// PointOfInterest.coords: [lat, lon]).
// Клиентски-безопасно (без серверных импортов) — вызывается из map-клиента.
// ─────────────────────────────────────────────────────────────────────────────

/** Разумный диапазон по Земле: lat −90..90, lon −180..180. */
function isValidLat(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) <= 90;
}
function isValidLon(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) <= 180;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Достать [lat, lon] из GPS-строки ("56.3269, 44.0059").
 * Возвращает null, если значений нет / они вне диапазона / склеены без разделителя.
 */
export function gpsPairFromString(raw: string): [number, number] | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[,;\s]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = num(parts[0]);
  const lon = num(parts[1]);
  if (lat === null || lon === null) return null;
  if (!isValidLat(lat) || !isValidLon(lon)) return null;
  return [lat, lon];
}

/**
 * Достать [lat, lon] из произвольного specs-объекта. См. шапку файла — формы.
 * Ключи проверяются в порядке приоритета: gps → lat/lon-пара.
 */
export function catalogGpsFromSpecs(
  specs: Record<string, unknown> | null | undefined,
): [number, number] | null {
  if (!specs || typeof specs !== "object") return null;

  // 1. specs.gps — строка или объект.
  const gps = specs.gps;
  if (typeof gps === "string") {
    const pair = gpsPairFromString(gps);
    if (pair) return pair;
  } else if (gps && typeof gps === "object" && !Array.isArray(gps)) {
    const obj = gps as Record<string, unknown>;
    const lat = num(obj.lat ?? obj.latitude);
    const lon = num(obj.lon ?? obj.lng ?? obj.longitude);
    if (lat !== null && lon !== null && isValidLat(lat) && isValidLon(lon)) return [lat, lon];
  }

  // 2. Плоские ключи specs: lat + lon/lng (+ latitude/longitude алиасы).
  const lat = num(specs.lat ?? specs.latitude);
  if (lat !== null && isValidLat(lat)) {
    const lon = num(specs.lon ?? specs.lng ?? specs.longitude);
    if (lon !== null && isValidLon(lon)) return [lat, lon];
  }

  return null;
}
