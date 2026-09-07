// /app/franchize/[slug]/leads/hooks/useLeadsUserPrefs.ts
"use client";

// ── НАСТРОЙКИ ОПЕРАТОРА: users.metadata jsonb + localStorage-фоллбек ────────
//
// КЛИЕНТСКАЯ ПРОСЬБА: «save filters settings upon page reload (save to user's
// metadata jsonb)». Хук — ЕДИНСТВЕННЫЙ владелец логики сохранения:
//   1) при авторизации читает GET /api/franchize/leads/user-prefs?slug=…
//      (metadata.leads_ui — фильтры/сорт/вид, metadata.leads_path — геймификация);
//   2) если metadata недоступна (парольный зритель/сбой) — фоллбек на
//      localStorage (быстро и приватно, но только в этом браузере);
//   3) saveFilters/savePath — вызываются на каждое изменение состояния, хук
//      сам дебаунсит (800 мс), ретраит сбой (1 раз через 4 с) и ФЛАШИТ
//      неотправленное при уходе со страницы (pagehide/visibilitychange,
//      fetch keepalive — переживает закрытие вкладки).
//
// CODE REVIEW FIXES (wave «progress is saved correctly»):
//   • сбой GET больше не приводит к перезаписи серверных настроек дефолтами:
//     первое после резолюции сохранение — «эхо» применения восстановленного
//     состояния и просто БАЗЛАЙНИТСЯ (syncedKey), а не уходит на сервер;
//   • повторная резолюция («Повторить загрузку») не стирает локальный
//     прогресс пути — в LeadsClient путь мержится через mergeLeadPathState;
//   • если оператор успел потрогать фильтры до прихода медленного GET —
//     его живое состояние не затирается (touched-guard в LeadsClient).
//
// Сознательно НЕ используем React Query — зависимости стабилизируются
// вручную (retryTick), ошибки тихие: страница обязана работать и без prefs.

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadPathState } from "../lib/lead-path";
import { DEFAULT_LEAD_PATH_STATE } from "../lib/lead-path";

export interface LeadsUiPrefsClient {
  q?: string;
  source?: string;
  stage?: string;
  owner?: string;
  segment?: string;
  hidePlaceholders?: boolean;
  sortMode?: string;
  viewMode?: string;
}

export interface PrefsResolution {
  /** undefined — metadata ответила «пусто»; объект — восстановленные значения. */
  prefs: LeadsUiPrefsClient | null;
  path: LeadPathState;
  /** true — значение из users.metadata (синхронизируется между устройствами). */
  persisted: boolean;
  /**
   * false — metadata ПРОЧИТАТЬ не удалось (сбой сети/сервера): текущий снимок
   * настроек неавторитетен, и первое сохранение обязано быть пропущено, иначе
   * дефолтные фильтры затрут сохранённое на сервере. true — снимку можно
   * верить (metadata прочитана, или это локальный план парольного зрителя).
   */
  authoritative: boolean;
}

interface Options {
  slug: string;
  isAuthed: boolean;
  /** TG-идентичность есть — metadata доступна; иначе localStorage-only. */
  hasTelegramIdentity: boolean;
  authHeaders: Record<string, string>;
  /** Инкремент вручную повторяет загрузку (кнопка «Повторить загрузку»). */
  retryTick: number;
}

/** Что копится в очереди сохранения до дебаунса/флаша. */
interface PrefsSavePayload {
  slug: string;
  prefs?: LeadsUiPrefsClient;
  path?: LeadPathState;
}

const PREFS_DEBOUNCE_MS = 800;
const PREFS_RETRY_MS = 4000;

/** Нормализованный ключ prefs-объекта (порядок ключей не важен, дефолты — как в состоянии). */
const prefsKey = (p: LeadsUiPrefsClient): string =>
  JSON.stringify([
    p.q ?? "",
    p.source || "all",
    p.stage || "all",
    p.owner || "all",
    p.segment || "all",
    !!p.hidePlaceholders,
    p.sortMode || "priority",
    p.viewMode || "list",
  ]);

export function useLeadsUserPrefs({ slug, isAuthed, hasTelegramIdentity, authHeaders, retryTick }: Options) {
  const [resolution, setResolution] = useState<PrefsResolution | null>(null);
  const [ready, setReady] = useState(false);
  const reqIdRef = useRef(0);
  // Однократная подсказка «настройки запоминаются сами» — после первого
  // УСПЕШНОГО POST за сессию (учебный момент без постоянного шума).
  const [saveFlash, setSaveFlash] = useState(false);
  const saveFlashShownRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Очередь сохранения: debounce → POST → (сбой → 1 ретрай) ────────────────
  const pendingRef = useRef<PrefsSavePayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ключ prefs-payload, уже синхронизированного с сервером (базлайн). */
  const syncedKeyRef = useRef<string | null>(null);
  /** Зеркало резолюции для детерминированного распознавания «эха». */
  const resolutionRef = useRef<PrefsResolution | null>(null);
  /**
   * Базлайн-флаг ТОЛЬКО для неавторитетной резолюции (сбой GET): первое после
   * неё сохранение — снимок дефолтов/локального зеркала — обязано не дойти
   * до сервера (иначе дефолты затрут сохранённые настройки). Для авторитетной
   * резолюции флаг не нужен: совпадение по содержимому (prefsKey) и так
   * отсекает эхо, а несовпадение — честное сохранение.
   */
  const baselineArmedRef = useRef(false);
  const setResolutionTracked = useCallback((r: PrefsResolution | null) => {
    resolutionRef.current = r;
    baselineArmedRef.current = r != null && !r.authoritative;
    setResolution(r);
  }, []);
  // Ref-зеркала для стабильных колбэков (listener pagehide не пересоздаётся).
  const hasTgRef = useRef(hasTelegramIdentity);
  useEffect(() => {
    hasTgRef.current = hasTelegramIdentity;
  }, [hasTelegramIdentity]);
  const headersRef = useRef(authHeaders);
  useEffect(() => {
    headersRef.current = authHeaders;
  }, [authHeaders]);

  const postNow = useCallback(
    (payload: PrefsSavePayload, opts?: { keepalive?: boolean; attempt?: number }) => {
      if (!hasTgRef.current) return; // парольный зритель — только localStorage
      void fetch("/api/franchize/leads/user-prefs", {
        method: "POST",
        headers: headersRef.current,
        // keepalive: запрос доживает закрытие вкладки (флаш при уходе).
        keepalive: opts?.keepalive ?? false,
        body: JSON.stringify(payload),
      })
        .then((resp) => {
          if (!resp.ok) throw new Error(`status ${resp.status}`);
          if (!saveFlashShownRef.current) {
            saveFlashShownRef.current = true;
            setSaveFlash(true);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setSaveFlash(false), 2600);
          }
        })
        .catch(() => {
          // Тихо: ОДИН ретрай через 4 c — сеть могла мигнуть; дальше save
          // случится при следующем изменении или уходе со страницы.
          if (opts?.attempt) return;
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => postNow(payload, { attempt: 1 }), PREFS_RETRY_MS);
        });
    },
    // slug входит в payload — колбэк стабилен в рамках страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Немедленно отправить накопленное (уход со страницы / выгрузка). */
  const flushPending = useCallback(
    (keepalive: boolean) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const payload = pendingRef.current;
      pendingRef.current = null;
      if (payload) postNow(payload, { keepalive });
    },
    [postNow],
  );

  // Уход со страницы / скрытие вкладки: сбрасываем отложенное сохранение,
  // иначе смена фильтров за <800 мс до закрытия теряется навсегда.
  useEffect(() => {
    const onHide = () => {
      if (typeof document === "undefined" || document.visibilityState === "hidden") {
        flushPending(true);
      }
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushPending]);

  // Размонтирование (SPA-навигация): флаш + уборка таймеров.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      const payload = pendingRef.current;
      pendingRef.current = null;
      if (payload) postNow(payload, { keepalive: true });
    },
    [postNow],
  );

  const scheduleSave = useCallback(
    (part: { prefs?: LeadsUiPrefsClient; path?: LeadPathState }) => {
      pendingRef.current = { ...(pendingRef.current ?? { slug }), slug, ...part };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const payload = pendingRef.current;
        pendingRef.current = null;
        if (payload) postNow(payload);
      }, PREFS_DEBOUNCE_MS);
    },
    [postNow, slug],
  );

  // ── Чтение настроек при авторизации ─────────────────────────────────────────
  useEffect(() => {
    if (!isAuthed || !slug) return;
    const reqId = ++reqIdRef.current;
    let cancelled = false;

    const readLocal = (): PrefsResolution => {
      let prefs: LeadsUiPrefsClient | null = null;
      let path: LeadPathState = DEFAULT_LEAD_PATH_STATE;
      try {
        const raw = window.localStorage.getItem(`leads-ui:${slug}`);
        if (raw) prefs = JSON.parse(raw) as LeadsUiPrefsClient;
      } catch { /* private mode */ }
      try {
        const rawPath = window.localStorage.getItem(`leads-path:${slug}`);
        if (rawPath) path = { ...DEFAULT_LEAD_PATH_STATE, ...(JSON.parse(rawPath) as Partial<LeadPathState>) };
      } catch { /* private mode */ }
      return { prefs, path, persisted: false, authoritative: true };
    };

    (async () => {
      // Нет TG-идентичности (парольный вход) — metadata недоступна в принципе.
      if (!hasTelegramIdentity) {
        if (!cancelled && reqId === reqIdRef.current) {
          setResolutionTracked(readLocal());
          setReady(true);
        }
        return;
      }
      try {
        const resp = await fetch(`/api/franchize/leads/user-prefs?slug=${encodeURIComponent(slug)}`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const body = await resp.json().catch(() => null);
        if (cancelled || reqId !== reqIdRef.current) return;
        if (resp.ok && body?.success) {
          const metaPath: LeadPathState = body.path
            ? { ...DEFAULT_LEAD_PATH_STATE, ...(body.path as Partial<LeadPathState>) }
            : DEFAULT_LEAD_PATH_STATE;
          const persisted = body.persisted !== false;
          let prefs = (body.prefs as LeadsUiPrefsClient | null) ?? null;
          if (!persisted) {
            // Метаданные недоступны этому зрителю — локальные настройки полнее.
            prefs = readLocal().prefs ?? prefs;
          }
          setResolutionTracked({ prefs, path: metaPath, persisted, authoritative: true });
        } else {
          // СБОЙ GET: снимок неавторитетен — сохранение дефолтов на сервер
          // запрещено (эхо-механика в saveFilters: пишется только то, что
          // отличается от восстановленного/примененного), работаем локально.
          setResolutionTracked({ ...readLocal(), persisted: false, authoritative: false });
        }
      } catch {
        if (!cancelled && reqId === reqIdRef.current) {
          setResolutionTracked({ ...readLocal(), persisted: false, authoritative: false });
        }
      } finally {
        if (!cancelled && reqId === reqIdRef.current) setReady(true);
      }
    })();

    return () => { cancelled = true; };
    // authHeaders — мемо-объект клиента; не добавляем в deps (только смена
    // идентичности/сброса), иначе цикл перезаписи заголовков перезагружал бы prefs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, slug, hasTelegramIdentity, retryTick]);

  /** Fire-and-forget POST (debounce/флаш/ретрай внутри хука) + localStorage. */
  const saveFilters = useCallback(
    (prefs: LeadsUiPrefsClient) => {
      try {
        window.localStorage.setItem(`leads-ui:${slug}`, JSON.stringify(prefs));
      } catch { /* private mode */ }
      const key = prefsKey(prefs);
      // 1) Неавторитетная резолюция (сбой GET): первый снимок — базлайн,
      //    на сервер НЕ пишем (защита сохранённых настроек от дефолтов).
      if (baselineArmedRef.current) {
        baselineArmedRef.current = false;
        syncedKeyRef.current = key;
        return;
      }
      // 2) «Эхо» авторитетной резолюции: payload совпал с тем, что приехало
      //    из metadata — сервер уже в этом состоянии, писать обратно нечего.
      const res = resolutionRef.current;
      if (res?.prefs && prefsKey(res.prefs) === key) {
        syncedKeyRef.current = key;
        return;
      }
      // 3) Без изменений с прошлого сохранения — не пишем.
      if (key === syncedKeyRef.current) return;
      scheduleSave({ prefs });
    },
    [scheduleSave, slug],
  );

  const savePath = useCallback(
    (path: LeadPathState) => {
      try {
        window.localStorage.setItem(`leads-path:${slug}`, JSON.stringify(path));
      } catch { /* private mode */ }
      scheduleSave({ path });
    },
    [scheduleSave, slug],
  );

  return { prefsResolution: resolution, prefsReady: ready, saveFilters, savePath, saveFlash };
}
