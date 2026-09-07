// /app/franchize/[slug]/leads/hooks/useLeadsUserPrefs.ts
"use client";

// ── НАСТРОЙКИ ОПЕРАТОРА: users.metadata jsonb + localStorage-фоллбек ────────
//
// КЛИЕНТСКАЯ ПРОСЬБА: «save filters settings upon page reload (save to user's
// metadata jsonb)». Хук:
//   1) при авторизации читает GET /api/franchize/leads/user-prefs?slug=…
//      (metadata.leads_ui — фильтры/сорт/вид, metadata.leads_path — геймификация);
//   2) если metadata недоступна (парольный зритель/сбой) — фоллбек на
//      localStorage (быстро и приватно, но только в этом браузере);
//   3) saveFilters/savePath — debounced-запись на клиенте, здесь только
//      fire-and-forget POST + зеркалирование в localStorage.
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

export function useLeadsUserPrefs({ slug, isAuthed, hasTelegramIdentity, authHeaders, retryTick }: Options) {
  const [resolution, setResolution] = useState<PrefsResolution | null>(null);
  const [ready, setReady] = useState(false);
  const reqIdRef = useRef(0);

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
      return { prefs, path, persisted: false };
    };

    (async () => {
      // Нет TG-идентичности (парольный вход) — metadata недоступна в принципе.
      if (!hasTelegramIdentity) {
        if (!cancelled && reqId === reqIdRef.current) {
          setResolution(readLocal());
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
          setResolution({ prefs, path: metaPath, persisted });
        } else {
          setResolution(readLocal());
        }
      } catch {
        if (!cancelled && reqId === reqIdRef.current) setResolution(readLocal());
      } finally {
        if (!cancelled && reqId === reqIdRef.current) setReady(true);
      }
    })();

    return () => { cancelled = true; };
    // authHeaders — мемо-объект клиента; не добавляем в deps (только смена
    // идентичности/сброса), иначе цикл перезаписи заголовков перезагружал бы prefs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, slug, hasTelegramIdentity, retryTick]);

  /** Fire-and-forget POST + localStorage-зеркало (работает и для парольных). */
  const post = useCallback((payload: Record<string, unknown>) => {
    if (!hasTelegramIdentity) return;
    void fetch("/api/franchize/leads/user-prefs", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ slug, ...payload }),
    }).catch(() => { /* тихо: настройки не критичны */ });
  }, [authHeaders, hasTelegramIdentity, slug]);

  const saveFilters = useCallback((prefs: LeadsUiPrefsClient) => {
    try {
      window.localStorage.setItem(`leads-ui:${slug}`, JSON.stringify(prefs));
    } catch { /* private mode */ }
    post({ prefs });
  }, [post, slug]);

  const savePath = useCallback((path: LeadPathState) => {
    try {
      window.localStorage.setItem(`leads-path:${slug}`, JSON.stringify(path));
    } catch { /* private mode */ }
    post({ path });
  }, [post, slug]);

  return { prefsResolution: resolution, prefsReady: ready, saveFilters, savePath };
}
