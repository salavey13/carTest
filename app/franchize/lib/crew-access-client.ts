// /app/franchize/lib/crew-access-client.ts
//
// ── Crew-access probe (single-flight + TTL) ─────────────────────────────────
//
// «Достижения/геймификация — только для членов экипажа» (запрос босса).
// Один и тот же серверный чек `getFranchizeOperatorDashboardAccess`
// (admin/owner/active member по серверной TG-сессии) нужен сразу в
// нескольких местах каждой страницы франшизы:
//
//   • LeadsClient        — гейтит панель достижений, XP-стор и чекбоксы плейбука;
//   • AchievementToastSync (в layout) — гейтит тосты достижений;
//   • AchievementExplorer (на каждой crew-странице) — гейтит выдачу
//     «исследовательских» бейджей.
//
// Без общего кэша это 2–3 одинаковых server-action-запроса на страницу.
// Probe превращает их в ОДИН: первый вызов уходит на сервер, остальные
// ждут тот же Promise (single-flight), результат живёт TTL_MS.
// Для НЕ-crew это особенно важно: после одного probe их клиент больше не
// шлёт никаких геймификационных запросов вовсе (Explorer молчит, ToastSync
// молчит) — «обычный пользователь» не генерирует мусорных вызовов.
//
// Ошибки сети кэшируются КОРОТКО (ERROR_TTL_MS): временный сбой не хоронит
// crew-панели на 5 минут, но и не превращается в шторм ретраев.
//
// Хранилище — module-level Map (живёт пока жива вкладка), но фабрика
// createCrewAccessProbe позволяет тестам получить изолированный инстанс
// с подставным фетчером (без моков server actions).

export interface CrewAccessResult {
  canOpen: boolean;
  role?: string;
}

type Fetcher = (slug: string) => Promise<CrewAccessResult>;

/** Успешный ответ живёт 5 минут: состав экипажа меняется редко. */
export const CREW_ACCESS_TTL_MS = 5 * 60_000;
/** Ошибочный ответ живёт 15 секунд: быстрое восстановление без шторма. */
export const CREW_ACCESS_ERROR_TTL_MS = 15_000;

interface CacheEntry {
  at: number;
  ttl: number;
  promise: Promise<CrewAccessResult>;
}

export function createCrewAccessProbe(defaultFetcher: Fetcher) {
  const cache = new Map<string, CacheEntry>();

  function probe(slug: string, fetcher: Fetcher = defaultFetcher): Promise<CrewAccessResult> {
    const key = slug.trim();
    if (!key) return Promise.resolve({ canOpen: false });

    const now = Date.now();
    const hit = cache.get(key);
    if (hit) {
      if (now - hit.at < hit.ttl) return hit.promise;
      cache.delete(key);
    }

    // Одиночный полёт: все зовущие ждут ОДИН и тот же promise.
    // never-rejects обёртка: сетевая ошибка → canOpen:false + короткий TTL
    // (внутренний ok-флаг задаёт TTL после разрешения, наружу не отдаётся).
    const internal: Promise<CrewAccessResult & { ok: boolean }> = (async () => {
      try {
        const res = await fetcher(key);
        return { canOpen: !!res?.canOpen, role: res?.role, ok: true };
      } catch {
        return { canOpen: false, ok: false };
      }
    })();
    const entry: CacheEntry = {
      at: now,
      ttl: CREW_ACCESS_ERROR_TTL_MS,
      promise: internal.then(({ canOpen, role }) => ({ canOpen, role })),
    };
    // TTL уточняется ПОСЛЕ разрешения: успех — долго, ошибка — коротко.
    void internal.then((r) => {
      entry.ttl = r.ok ? CREW_ACCESS_TTL_MS : CREW_ACCESS_ERROR_TTL_MS;
    });
    cache.set(key, entry);
    return entry.promise;
  }

  function invalidate(slug?: string): void {
    if (slug) cache.delete(slug.trim());
    else cache.clear();
  }

  return { probe, invalidate };
}

/**
 * Дефолтный фетчер — сам server action. Динамический import ВНУТРИ вызова:
 * статиический тянул бы серверный barrel (actions → supabase-server) в модуль
 * при загрузке, а он бросает исключение в браузере/jsdom. Ленивый вызов
 * грузит barrel только при первом probe (в клиентском бандле Next заменяет
 * server action на референс — как обычный import).
 */
async function defaultFetcher(slug: string): Promise<CrewAccessResult> {
  const { getFranchizeOperatorDashboardAccess } = await import("../actions");
  const res = await getFranchizeOperatorDashboardAccess({ slug });
  return { canOpen: !!(res?.success && res?.canOpen), role: res?.role };
}

const shared = createCrewAccessProbe(defaultFetcher);

/** Общий probe для всех клиентских компонентов франшизы. */
export const probeCrewAccess: (slug: string) => Promise<CrewAccessResult> = shared.probe;

/** Сброс кэша (например, после изменения состава экипажа в UI). */
export const invalidateCrewAccess: (slug?: string) => void = shared.invalidate;
