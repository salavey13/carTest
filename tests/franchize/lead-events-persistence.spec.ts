/**
 * tests/franchize/lead-events-persistence.spec.ts
 *
 * Багфикс 2026-09-08: журнал public.lead_events оставался ПУСТЫМ, хотя все
 * маршруты были «покрыты» вызовами recordLeadEvent. Причина — fire-and-forget:
 * в Next 14 на Vercel серверлес-функция замораживается сразу после отправки
 * ответа, и «void recordLeadEvent(...)» не успевал выполнить INSERT — события
 * терялись молча (best-effort без ожидания = best-effort без результата).
 *
 * Фикс: все вызовы стали await (recordLeadEvent never-throws — catch внутри,
 * так что ожидание не может уронить маршрут), в lead-handling хелпер logEvent
 * возвращает промис, а каждый его вызов — await logEvent(...).
 *
 * Этот спек — регрессионный замок: перечитывает исходники маршрутов и не даёт
 * вернуть fire-and-forget. Комментарии вырезаются перед проверкой — guards
 * смотрят на КОД, а не на объяснения. Стиль source-assertion — как в
 * iter29-db-types-migrations.spec.ts (миграции/типы тоже проверяются текстом).
 */

import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "../..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

/**
 * Вырезать комментарии (// … и /* … *​/), чтобы guard не ловил упоминания
 * «void recordLeadEvent» в пояснениях — проверяем только исполняемый код.
 * Для наших файлов достаточно построчной обработки: строк с «//» внутри
 * строковых литералов, содержащих искомые паттерны, в коде нет.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")) // блоки → пустые строки (номера строк сохраняются)
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

/** Файлы с журналом + ожидаемая картина вызовов в КАЖДОМ. */
const FILES: Array<{
  path: string;
  /** минимум прямых вызовов recordLeadEvent( в файле */
  minDirect: number;
  /** прямые вызовы обязаны быть await? (в lead-handling вызов — return хелпера) */
  requireAwait: boolean;
}> = [
  // Webhook Авито: lead_created / avito_message / analysis_attached ×2
  { path: "app/api/webhooks/avito/route.ts", minDirect: 4, requireAwait: true },
  // POST (todo_created) + PATCH (todo_completed) + dismiss (closed_lost)
  { path: "app/api/franchize/lead-todo/route.ts", minDirect: 3, requireAwait: true },
  // Заметка оператора (note_added)
  { path: "app/franchize/server-actions/lead-notes.ts", minDirect: 1, requireAwait: true },
  // Вся запись через хелпер logEvent: единственный прямой вызов — return
  // внутри async-хелпера (await на месте ВЫЗОВА хелпера — см. ниже).
  { path: "app/api/franchize/lead-handling/route.ts", minDirect: 1, requireAwait: false },
];

describe("lead-events · журнал переживает ответ маршрута (serverless-safe)", () => {
  it("в исполняемом коде нет fire-and-forget «void recordLeadEvent»", () => {
    for (const { path } of FILES) {
      const src = stripComments(read(path));
      expect(src, `${path}: «void recordLeadEvent» запрещён (serverless убивает промис)`).not.toMatch(
        /void\s+recordLeadEvent/,
      );
    }
  });

  it.each(FILES.map((f) => [f.path, f.minDirect, f.requireAwait] as const))(
    "%s — прямые вызовы recordLeadEvent: без void, только await (или return хелпера)",
    (path, minDirect, requireAwait) => {
      const src = stripComments(read(path));
      const total = (src.match(/\brecordLeadEvent\s*\(/g) ?? []).length;
      const awaited = (src.match(/\bawait\s+recordLeadEvent\s*\(/g) ?? []).length;
      const asReturn = (src.match(/=>\s*recordLeadEvent\s*\(/g) ?? []).length;
      expect(total, `${path}: вызовы журнала не должны исчезнуть`).toBeGreaterThanOrEqual(minDirect);
      expect(
        awaited + asReturn,
        `${path}: каждый вызов — await recordLeadEvent(...) либо return из async-хелпера`,
      ).toBe(total);
      if (requireAwait) {
        expect(awaited, `${path}: ожидаем await у всех прямых вызовов`).toBe(total);
      }
    },
  );

  it("lead-handling: хелпер logEvent — async, возвращает Promise<boolean>, каждый из 5 вызовов await", () => {
    const src = stripComments(read("app/api/franchize/lead-handling/route.ts"));
    expect(src).toMatch(/const\s+logEvent\s*=\s*async\s*\(/);
    expect(src).toMatch(/:\s*Promise<boolean>\s*=>\s*\n\s*recordLeadEvent\(/);

    // Определение «const logEvent = async (» не матчится: между именем и «(» стоит « =».
    const calls = (src.match(/\blogEvent\s*\(/g) ?? []).length;
    const awaited = (src.match(/\bawait\s+logEvent\s*\(/g) ?? []).length;
    expect(calls, "5 вызовов: handled / unhandled / set / clear / complete").toBe(5);
    expect(awaited, "каждый logEvent(...) должен быть await logEvent(...)").toBe(calls);
  });
});
