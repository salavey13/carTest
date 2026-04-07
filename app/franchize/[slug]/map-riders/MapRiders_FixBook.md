# MapRiders FixBook v1.0.13
## Comprehensive Code Review & Actionable Roadmap (Hybrid Edition)

**Дата:** 8 апреля 2026  
**Версия:** 1.0.13 (v1.0 concrete fixes + v1.1 architectural upgrades + final touches)

---

## Что изменилось в v1.0.13

Эта версия — финальная. Она объединяет всё лучшее из трёх предыдущих итераций:

| Источник | Что взято |
|----------|-----------|
| **v1.0** | Конкретные кодовые сниппеты, готовые файлы (`MapInteractionCapture.tsx`, `useMapRidersContext.tsx`), полные таблицы с файлами, чек-лист тестирования, `cancelled`-guard для анимаций |
| **v1.1** | Demo mode полностью в reducer (без `useState`), все `ui/*` + `demo/*` actions формализуются до UI, speed-gradient routes в HIGH, heading arrow в HIGH, privacy controls как production requirement, route-point buffering в CRITICAL, stale GPS guard |
| **v1.0.12** | `DEMO_TICK_MS` как именованная константа, полный `privacy` slice в `initialMapRidersState` с `homeBlurEnabled`, все `privacy/*` actions в reducer, Phase A пункт 0 (сначала reducer), speed-gradient performance note, дополнительный acceptance criteria для demo/reducer safety |
| **v1.0.13** | Telegram Hybrid `useLiveRiders` (primary `requestLocation` + fallback `watchPosition`), full `SpeedGradientRoute.tsx` component, enhanced privacy panel with `homeBlurEnabled`, heading arrow upgrade, `visibilitychange` background resilience, haptic feedback integration, location architecture docs |

Ключевые архитектурные решения:

- **Demo mode** — не `useState` в компоненте, а `state.demo` в reducer с действиями `demo/toggle`, `demo/tick`, `demo/auto-enable`, `demo/disable`.
- **Reducer actions** — сначала добавляются в `MapRidersAction`, потом используются в компонентах. Нет "призрачных" dispatch'ей.
- **Privacy** — не polish, а production requirement. Visibility mode, auto-expire, home blur.
- **Speed-gradient** — routes с цветовой кодировкой по скорости (0-10 / 10-25 / 25-40 / 40+ км/ч).
- **Location source** — гибридный: Telegram `requestLocation` как основной (более точный GPS), fallback на `navigator.geolocation.watchPosition`. Haptic feedback при каждом обновлении.

---

## Executive Summary

Рефакторинг из 750-строчного монстра в модульную архитектуру выполнен на высоком уровне. Монолит разбит на слои: map canvas, control panel, rider list, realtime behaviour. State перенесён в reducer/context. Однако остаётся **5 критических блокеров** и **9 high-priority** задач, из-за которых приложение пока не production-ready.

**Самая больная точка** — мобильный long-tap для создания meetup полностью сломан. Пользователь не может создать точку встречи с телефона — это core feature продукта.

**Второй по важности риск** — source-of-truth drift между snapshot data, live rider state и local UI state. Demo mode, живущий в `useState`, усугубляет проблему.

**Цель FixBook v1.0.13** — за 8–9 часов превратить текущее состояние (≈87/100) в production-clean продукт (≈99/100).

---

## Status Overview

| Категория | Статус | Кол-во |
|-----------|--------|--------|
| 🔴 Critical | Сломано / Блокирует | 5 |
| 🟠 High Priority | Отсутствует / Незавершённо | 9 |
| 🟡 Medium | Качество / Производительность | 5 |
| 🟢 Low | Nice to Have | 4 |
| **Итого** | | **23** |

> **v1.0.13:** CRIT-3 значительно расширен — добавлен полный Telegram Hybrid Location System. HIGH-3 дополнен standalone компонентом `SpeedGradientRoute.tsx`. HIGH-5 дополнен `homeBlurEnabled` toggle в UI.

---

## 🔴 CRITICAL ISSUES (Fix First)

> Цель Phase A — за 2–3 часа устранить все блокеры, из-за которых приложение не компилируется или не работает.

---

### CRIT-1: Mobile Long-Tap Meetup Creation Broken

**Проблема:**
На мобильном long-tap (press-and-hold) должен создавать точку встречи, но ничего не происходит. Карта реагирует только на single click, который ненадёжно работает на touch-устройствах.

**Root Cause:**
В `/components/maps/RacingMap.tsx` компонент `MapClickCapture` слушает только `click`-события:

```tsx
// ТЕКУЩИЙ КОД — СЛОМАН НА МОБИЛЬНОМ
function MapClickCapture({ onMapClick }: { onMapClick?: (coords: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onMapClick?.([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}
```

Мобильные браузеры переводят long-press в `contextmenu` event, а не `click`. Кроме того, нет детекции длительности touch для различения tap (pan/zoom) и long-tap (create meetup).

**Fix: Создать `/components/maps/MapInteractionCapture.tsx`**

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";

interface Props {
  onMapClick?: (coords: [number, number]) => void;
  onMapLongPress?: (coords: [number, number]) => void;
  longPressDelay?: number;
}

export function MapInteractionCapture({
  onMapClick,
  onMapLongPress,
  longPressDelay = 500,
}: Props) {
  const map = useMap();
  const touchStartRef = useRef<{
    time: number;
    latlng: { lat: number; lng: number };
    timeoutId: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  // Сброс long-press таймера
  const clearLongPress = useCallback(() => {
    if (touchStartRef.current?.timeoutId) {
      clearTimeout(touchStartRef.current.timeoutId);
      touchStartRef.current.timeoutId = null;
    }
  }, []);

  // Обработка contextmenu (native long-press на мобильном)
  const handleContextMenu = useCallback(
    (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      onMapLongPress?.([e.latlng.lat, e.latlng.lng]);
    },
    [onMapLongPress]
  );

  // Touch start — запуск long-press таймера
  const handleTouchStart = useCallback(
    (e: L.LeafletMouseEvent) => {
      touchStartRef.current = {
        time: Date.now(),
        latlng: { lat: e.latlng.lat, lng: e.latlng.lng },
        timeoutId: setTimeout(() => {
          // Long-press сработал
          onMapLongPress?.([e.latlng.lat, e.latlng.lng]);
        }, longPressDelay),
      };
    },
    [onMapLongPress, longPressDelay]
  );

  // Touch end — проверяем tap vs long-press
  const handleTouchEnd = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!touchStartRef.current) return;

      const duration = Date.now() - touchStartRef.current.time;
      clearLongPress();

      // Короткий tap — вызываем click
      if (duration < 200) {
        onMapClick?.([e.latlng.lat, e.latlng.lng]);
      }

      touchStartRef.current = null;
    },
    [onMapClick, clearLongPress]
  );

  // Отмена при перемещении
  const handleTouchMove = useCallback(() => {
    clearLongPress();
    touchStartRef.current = null;
  }, [clearLongPress]);

  // Регистрация событий
  useEffect(() => {
    map.on("contextmenu", handleContextMenu);
    map.on("touchstart", handleTouchStart as any);
    map.on("touchend", handleTouchEnd as any);
    map.on("touchmove", handleTouchMove as any);

    return () => {
      map.off("contextmenu", handleContextMenu);
      map.off("touchstart", handleTouchStart as any);
      map.off("touchend", handleTouchEnd as any);
      map.off("touchmove", handleTouchMove as any);
    };
  }, [map, handleContextMenu, handleTouchStart, handleTouchEnd, handleTouchMove]);

  // Desktop click handler
  useMapEvents({
    click(event) {
      // Только для non-touch устройств
      if (!("ontouchstart" in window)) {
        onMapClick?.([event.latlng.lat, event.latlng.lng]);
      }
    },
  });

  return null;
}
```

**Обновить `RacingMap.tsx`:**

```tsx
// Заменить MapClickCapture на MapInteractionCapture
import { MapInteractionCapture } from "./MapInteractionCapture";

// В props компонента:
interface RacingMapProps {
  // ... существующие props
  onMapClick?: (coords: [number, number]) => void;
  onMapLongPress?: (coords: [number, number]) => void; // НОВОЕ
}

// В render:
<MapInteractionCapture
  onMapClick={onMapClick}
  onMapLongPress={onMapLongPress}
/>
```

**Обновить `MapRidersClientRefactored.tsx`:**

```tsx
<RacingMap
  points={mapPoints}
  bounds={mapData?.bounds || mapBounds || DEFAULT_BOUNDS}
  className="h-full min-h-[78vh] w-full md:min-h-[84vh]"
  tileLayer={mapData?.meta.tileLayer || "cartodb-dark"}
  onMapClick={(coords) => {
    console.log("Map tapped:", coords);
  }}
  onMapLongPress={(coords) => {
    // Long-press — выбор точки meetup
    dispatch({ type: "ui/select-meetup-point", payload: coords });
  }}
>
  <RiderMarkerLayer />
</RacingMap>
```

**Acceptance Criteria:**
- [ ] Tap не создаёт meetup случайно при pan/zoom
- [ ] Long-press на мобильном создаёт точку встречи
- [ ] Desktop click продолжает работать
- [ ] Drag отменяет long-press таймер
- [ ] Правый клик (desktop contextmenu) создаёт точку встречи

---

### CRIT-2: Missing `useMapRidersContext` Hook File

**Проблема:**
Рефакторенный код импортирует `useMapRiders` из `@/hooks/useMapRidersContext`, но этот файл не был предоставлен в code dump. Без него всё приложение не компилируется.

**Fix: Создать `/hooks/useMapRidersContext.tsx` (полный файл с `selfUserId` пропом)**

```tsx
"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  mapRidersReducer,
  initialMapRidersState,
  type MapRidersState,
  type MapRidersAction,
  type SnapshotData,
  type SessionDetail,
} from "@/lib/map-riders-reducer";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

interface MapRidersContextValue {
  state: MapRidersState;
  dispatch: React.Dispatch<MapRidersAction>;
  crewSlug: string;
  crew: FranchizeCrewVM;
  fetchSnapshot: () => Promise<void>;
  fetchSessionDetail: (sessionId: string) => Promise<void>;
}

const MapRidersContext = createContext<MapRidersContextValue | null>(null);

const STALE_MS = 30_000;
const EVICT_MS = 120_000;
const DEMO_TICK_MS = 1_300; // ~1.3s — частота кадров demo-анимации

export function MapRidersProvider({
  children,
  crew,
  slug,
  selfUserId,
}: {
  children: ReactNode;
  crew: FranchizeCrewVM;
  slug: string;
  selfUserId?: string;
}) {
  const [state, dispatch] = useReducer(mapRidersReducer, initialMapRidersState);
  const crewSlug = slug;
  const supabaseRef = useRef(getSupabaseBrowserClient());

  // Fetch snapshot from API
  const fetchSnapshot = useCallback(async () => {
    dispatch({ type: "loading", payload: true });
    try {
      const response = await fetch(
        `/api/map-riders?slug=${encodeURIComponent(crewSlug)}`,
        { cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load MapRiders");
      }
      dispatch({
        type: "snapshot/loaded",
        payload: result.data as SnapshotData,
        selfUserId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      dispatch({ type: "error", payload: message });
    }
  }, [crewSlug, selfUserId]);

  // Fetch session detail
  const fetchSessionDetail = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(
          `/api/map-riders/session/${sessionId}`,
          { cache: "no-store" }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load track");
        }
        dispatch({
          type: "session/detail-loaded",
          payload: result.data as SessionDetail,
        });
      } catch (error) {
        console.error("[MapRiders] Failed to load session detail:", error);
      }
    },
    []
  );

  // Demo mode timer (v1.1 — reducer-owned)
  useEffect(() => {
    if (!state.demo.enabled) return;
    const timer = window.setInterval(() => {
      dispatch({ type: "demo/tick" });
    }, DEMO_TICK_MS);
    return () => window.clearInterval(timer);
  }, [state.demo.enabled]);

  // Auto-enable demo when no riders (v1.1)
  useEffect(() => {
    if (
      state.sessions.length === 0 &&
      state.liveRiders.size === 0 &&
      !state.demo.enabled
    ) {
      dispatch({ type: "demo/auto-enable" });
    } else if (
      (state.sessions.length > 0 || state.liveRiders.size > 0) &&
      state.demo.enabled
    ) {
      dispatch({ type: "demo/disable" });
    }
  }, [state.sessions.length, state.liveRiders.size, state.demo.enabled]);

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`map-riders:${crewSlug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "map_rider_sessions",
          filter: `crew_slug=eq.${crewSlug}`,
        },
        () => fetchSnapshot()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "map_rider_meetups",
          filter: `crew_slug=eq.${crewSlug}`,
        },
        () => fetchSnapshot()
      )
      .on("broadcast", { event: "rider:move" }, (payload) => {
        dispatch({
          type: "rider/moved",
          payload: payload.payload as any,
          selfUserId,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewSlug, fetchSnapshot, selfUserId]);

  // Initial fetch
  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Eviction tick timer
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "eviction/tick" });
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  const value: MapRidersContextValue = {
    state,
    dispatch,
    crewSlug,
    crew,
    fetchSnapshot,
    fetchSessionDetail,
  };

  return (
    <MapRidersContext.Provider value={value}>
      {children}
    </MapRidersContext.Provider>
  );
}

export function useMapRiders(): MapRidersContextValue {
  const context = useContext(MapRidersContext);
  if (!context) {
    throw new Error(
      "useMapRiders must be used within a MapRidersProvider"
    );
  }
  return context;
}
```

**Обновить `MapRidersClientRefactored.tsx`:**

```tsx
export function MapRidersClientRefactored({
  crew,
  slug,
}: { crew: FranchizeCrewVM; slug?: string }) {
  const { dbUser } = useAppContext();
  const resolvedSlug = crew.slug || slug || "vip-bike";

  return (
    <MapRidersProvider
      crew={crew}
      slug={resolvedSlug}
      selfUserId={dbUser?.user_id}
    >
      <MapRidersInner crew={crew} />
    </MapRidersProvider>
  );
}
```

---

### CRIT-3: Telegram Hybrid Location System (`useLiveRiders` Rewrite)

**Проблема:**
Текущий `useLiveRiders` использует только `navigator.geolocation.watchPosition` — браузерный API, который работает только в foreground и не даёт оптимальной точности в Telegram WebView. Telegram Mini App предоставляет `WebApp.requestLocation()` — более точный и быстрый GPS, особенно на Android/iOS.

**Архитектура location:**

| Аспект | Текущее состояние | После обновления |
|--------|-------------------|------------------|
| **Источник** | `navigator.geolocation.watchPosition` | Telegram `requestLocation` (primary) + `watchPosition` (fallback) |
| **Точность** | 5–15 метров | 3–10 метров (через Telegram API) |
| **Background** | Останавливается при `document.hidden` | Автоматический запрос при возвращении в foreground |
| **Haptic** | Нет | `HapticFeedback.impactOccurred("light")` при каждом обновлении |
| **Fallback** | Нет | Автоматический fallback если Telegram не доступен |

**Важно: приложение должно быть открыто (foreground) для live-трекинга.** Telegram Mini App (WebView) не даёт настоящего background GPS. При сворачивании `watchPosition` останавливается почти сразу.

**Fix: Полная замена `/hooks/useLiveRiders.ts`**

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useTelegram } from "@/hooks/useTelegram";
import type { GPSPoint } from "@/lib/map-riders";

interface UseLiveRidersOptions {
  crewSlug: string;
  sessionId: string | null;
  userId: string | null;
  enabled: boolean;
  onPosition?: (point: GPSPoint) => void;
}

const THROTTLE_MS = 3000;
const MIN_DISTANCE_METERS = 10;
const BATCH_MS = 5000;

export function useLiveRiders({
  crewSlug,
  sessionId,
  userId,
  enabled,
  onPosition,
}: UseLiveRidersOptions) {
  const { WebApp, isReady } = useTelegram();
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GPSPoint | null>(null);
  const pendingBatchRef = useRef<GPSPoint[]>([]);
  const lastUpdateRef = useRef<number>(0);

  const flushBatch = useCallback(async () => {
    if (!pendingBatchRef.current.length || !sessionId || !userId) return;
    try {
      await fetch("/api/map-riders/batch-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewSlug,
          sessionId,
          userId,
          points: pendingBatchRef.current,
        }),
      });
      pendingBatchRef.current = [];
    } catch (err) {
      console.error("[useLiveRiders] Batch failed", err);
    }
  }, [crewSlug, sessionId, userId]);

  const handleNewPosition = useCallback(
    (point: GPSPoint) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) return;
      if (lastPositionRef.current) {
        const distance = haversineKm(
          lastPositionRef.current.lat,
          lastPositionRef.current.lng,
          point.lat,
          point.lng
        ) * 1000;
        if (distance < MIN_DISTANCE_METERS) return;
      }
      lastPositionRef.current = point;
      lastUpdateRef.current = now;
      onPosition?.(point);
      pendingBatchRef.current.push(point);
      if (pendingBatchRef.current.length >= 5 || now - lastUpdateRef.current > BATCH_MS) {
        flushBatch();
      }
      if (WebApp?.HapticFeedback) {
        WebApp.HapticFeedback.impactOccurred("light");
      }
    },
    [onPosition, flushBatch, WebApp]
  );

  // ====================== TELEGRAM LOCATION (primary) ======================
  const requestTelegramLocation = useCallback(() => {
    if (!isReady || !WebApp?.requestLocation) return;
    WebApp.requestLocation((location) => {
      if (!location || !location.latitude || !location.longitude) return;
      const point: GPSPoint = {
        lat: location.latitude,
        lng: location.longitude,
        speedKmh: location.speed ? location.speed * 3.6 : 0,
        heading: location.heading ?? null,
        accuracyMeters: location.accuracy ?? 10,
        capturedAt: new Date().toISOString(),
      };
      handleNewPosition(point);
    });
  }, [isReady, WebApp, handleNewPosition]);

  // ====================== BROWSER GEOLOCATION (fallback) ======================
  useEffect(() => {
    if (!enabled || !sessionId || !userId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (isReady && WebApp?.requestLocation) {
      requestTelegramLocation();
      const tgInterval = setInterval(requestTelegramLocation, 8000);
      return () => clearInterval(tgInterval);
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: GPSPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speedKmh: position.coords.speed ? position.coords.speed * 3.6 : 0,
          heading: position.coords.heading ?? null,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        };
        handleNewPosition(point);
      },
      (error) => {
        console.warn("[useLiveRiders] Geolocation error:", error);
        toast.error("Не удалось получить геопозицию");
      },
      options
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, sessionId, userId, isReady, WebApp, requestTelegramLocation, handleNewPosition]);

  // ====================== BACKGROUND / VISIBILITY HANDLING ======================
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && enabled && sessionId) {
        requestTelegramLocation();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, sessionId, requestTelegramLocation]);

  useEffect(() => () => flushBatch(), [flushBatch]);

  return { isUsingTelegram: isReady && !!WebApp?.requestLocation };
}
```

**Интеграция в `MapRidersClientRefactored.tsx` / `MapRidersInner`:**

```tsx
const { isUsingTelegram } = useLiveRiders({
  crewSlug,
  sessionId: state.sessionId,
  userId: dbUser?.user_id || null,
  enabled: state.shareEnabled && Boolean(state.sessionId),
  onPosition: (point) => {
    dispatch({
      type: "rider/moved",
      payload: { ...point, user_id: dbUser!.user_id },
      selfUserId: dbUser?.user_id,
    });
  },
});

// Опционально: показать в dev-console, какой источник используется
useEffect(() => {
  if (isUsingTelegram) {
    console.log("%c🛰️ Используется Telegram Location (более точный)", "color:#22c55e");
  }
}, [isUsingTelegram]);
```

**Что даёт этот upgrade:**
- **Telegram Location** — более точный GPS + быстрее старт на Telegram WebView
- **Автоматический fallback** — ничего не ломается, если Telegram Mini App не дал доступ
- **Background resilience** — при возвращении из background сразу обновляет позицию
- **Haptic feedback** — пользователь физически чувствует, что трекинг живой
- **Сохраняет** весь существующий throttling + batching + haversine фильтр

**Acceptance Criteria:**
- [ ] `useLiveRiders` компилируется без ошибок
- [ ] В Telegram Mini App используется `requestLocation` как основной источник
- [ ] Fallback на `watchPosition` работает если Telegram не доступен
- [ ] `isUsingTelegram` корректно отражает используемый источник
- [ ] Haptic feedback срабатывает при каждом обновлении позиции
- [ ] `visibilitychange` запрашивает свежую локацию при возвращении в foreground
- [ ] Throttling (3 сек) и distance filter (10 м) работают корректно
- [ ] Batching (5 сек / 5 точек) отправляет данные на сервер

---

### CRIT-4: Missing Self User ID in Reducer Actions

**Проблема:**
Reducer использует `selfUserId` для пометки rider'ов как `isSelf`, но это значение никогда не передаётся из компонента. Все rider'ы отображаются одинаково (как чужие).

**Root Cause:**
В `snapshot/loaded` action `selfUserId` всегда `undefined`:

```tsx
case "snapshot/loaded": {
  const { payload, selfUserId } = action;
  // selfUserId is undefined!
  isSelf: loc.user_id === selfUserId, // всегда false
}
```

**Fix (уже включён в CRIT-2 выше):**
1. Добавить `selfUserId` как prop в `MapRidersProvider`
2. Передавать `selfUserId` в `snapshot/loaded` dispatch
3. Передавать `selfUserId` в `rider/moved` dispatch
4. Обернуть `MapRidersProvider` в клиентском компоненте с `dbUser?.user_id`

**Acceptance Criteria:**
- [ ] Собственный rider отображается жёлтым маркером
- [ ] Чужие rider'ы отображаются синими маркерами
- [ ] `isSelf` корректно вычисляется для всех rider'ов

---

### CRIT-5: RiderMarker Animation Memory Leak

**Проблема:**
В `RiderMarker.tsx` анимация использует `requestAnimationFrame`, но cleanup не всегда срабатывает корректно. Если компонент unmount'ится во время анимации, `step` может успеть запланировать ещё один кадр до завершения cleanup.

**Fix (с `cancelled` guard):**

```tsx
useEffect(() => {
  // Отменяем предыдущую анимацию
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }

  const target: [number, number] = [rider.lat, rider.lng];
  const from = positionRef.current;
  const deltaLat = target[0] - from[0];
  const deltaLng = target[1] - from[1];
  const movementMagnitude = Math.abs(deltaLat) + Math.abs(deltaLng);

  // Пропускаем анимацию для крошечных перемещений или больших прыжков
  if (movementMagnitude < 0.00001 || movementMagnitude > 0.08) {
    positionRef.current = target;
    setPosition(target);
    return;
  }

  let cancelled = false; // GUARD — предотвращает post-unmount обновления
  const start = performance.now();
  const durationMs = 650;

  const step = (now: number) => {
    if (cancelled) return; // Проверка guard

    const progress = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const next: [number, number] = [
      from[0] + deltaLat * eased,
      from[1] + deltaLng * eased,
    ];
    positionRef.current = next;
    setPosition(next);

    if (progress < 1 && !cancelled) { // Проверка guard перед следующим кадром
      animationRef.current = requestAnimationFrame(step);
    }
  };

  animationRef.current = requestAnimationFrame(step);

  return () => {
    cancelled = true; // Устанавливаем guard при cleanup
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
}, [rider.lat, rider.lng]);
```

---

## 🟠 HIGH PRIORITY ISSUES

> Цель Phase B — за 3–4 часа довести product quality до уровня, где приложение может быть показано пользователям.

---

### HIGH-1: Reducer Actions Must Be Formalized First

**Проблема (из v1.1):**
UI-код ссылается на `ui/*` actions до того, как они гарантированно существуют в `MapRidersAction`. Это потенциальные runtime-ошибки и source-of-truth drift.

**Fix: Добавить все action families в reducer до подключения UI.**

```ts
// В map-riders-reducer.ts — полный список MapRidersAction:

// === Snapshot & Data ===
| { type: "loading"; payload: boolean }
| { type: "error"; payload: string }
| { type: "snapshot/loaded"; payload: SnapshotData; selfUserId?: string }
| { type: "session/detail-loaded"; payload: SessionDetail }

// === Rider Updates ===
| { type: "rider/moved"; payload: RiderMovePayload; selfUserId?: string }
| { type: "eviction/tick" }

// === UI Actions ===
| { type: "ui/select-meetup-point"; payload: [number, number] | null }
| { type: "ui/clear-meetup-point" }
| { type: "ui/set-meetup-title"; payload: string }
| { type: "ui/set-meetup-comment"; payload: string }
| { type: "ui/set-ride-name"; payload: string }
| { type: "ui/set-vehicle-label"; payload: string }
| { type: "ui/set-ride-mode"; payload: "rental" | "personal" }
| { type: "ui/toggle-drawer" }
| { type: "ui/toggle-share" }

// === Demo Actions (v1.1 — reducer-owned) ===
| { type: "demo/toggle" }
| { type: "demo/tick" }
| { type: "demo/auto-enable" }
| { type: "demo/disable" }

// === Share Actions ===
| { type: "share/started"; payload: { sessionId: string } }
| { type: "share/stopped" }

// === Privacy Actions (v1.0.12 — production requirement) ===
| { type: "privacy/set-visibility"; payload: "crew" | "private" | "temporary" }
| { type: "privacy/set-temporary-minutes"; payload: number }
| { type: "privacy/toggle-pause" }
| { type: "privacy/toggle-home-blur" }
```

**Corresponding reducer cases:**

```ts
// === UI ===
case "ui/select-meetup-point":
  return { ...state, selectedMeetupPoint: action.payload };

case "ui/clear-meetup-point":
  return { ...state, selectedMeetupPoint: null };

case "ui/set-ride-name":
  return { ...state, rideName: action.payload };

case "ui/set-vehicle-label":
  return { ...state, vehicleLabel: action.payload };

case "ui/set-ride-mode":
  return { ...state, rideMode: action.payload };

case "ui/toggle-drawer":
  return { ...state, drawerOpen: !state.drawerOpen };

case "ui/toggle-share":
  return { ...state, shareEnabled: !state.shareEnabled };

// === Demo (v1.1) ===
case "demo/toggle":
  return { ...state, demo: { ...state.demo, enabled: !state.demo.enabled } };

case "demo/tick":
  return { ...state, demo: { ...state.demo, time: state.demo.time + 1 } };

case "demo/auto-enable":
  return { ...state, demo: { ...state.demo, enabled: true, time: 0 } };

case "demo/disable":
  return { ...state, demo: { ...state.demo, enabled: false } };

// === Share ===
case "share/started":
  return { ...state, sessionId: action.payload.sessionId, shareEnabled: true };

case "share/stopped":
  return { ...state, sessionId: null, shareEnabled: false };

// === Privacy (v1.0.12) ===
case "privacy/set-visibility":
  return { ...state, privacy: { ...state.privacy, visibilityMode: action.payload } };

case "privacy/set-temporary-minutes":
  return { ...state, privacy: { ...state.privacy, temporaryMinutes: Math.max(5, Math.min(1440, action.payload)) } };

case "privacy/toggle-pause":
  return { ...state, privacy: { ...state.privacy, paused: !state.privacy.paused } };

case "privacy/toggle-home-blur":
  return { ...state, privacy: { ...state.privacy, homeBlurEnabled: !state.privacy.homeBlurEnabled } };
```

**В state добавить demo и privacy slices:**

```ts
// В initialMapRidersState:
demo: {
  enabled: false,
  time: 0,
}

privacy: {
  visibilityMode: "crew" as const,
  temporaryMinutes: 60,
  paused: false,
  homeBlurEnabled: true,
}
```

> **Важно:** `privacy` slice добавляется один раз в `initialMapRidersState` и управляется через reducer actions. Компоненты никогда не пишут напрямую в `state.privacy` — только через `dispatch`.

**Acceptance Criteria:**
- [ ] TypeScript компилируется без ошибок по action types
- [ ] Ни один компонент не dispatch'ит action, который reducer не понимает
- [ ] Reducer — единственный source of truth для domain state

---

### HIGH-2: Demo Mode Must Live in Reducer (v1.1 Upgrade)

**Проблема:**
В v1.0 demo mode жил в `useState` компонента. Это создаёт второй "остров логики" и нарушает принцип единого source of truth. Если demo state живёт в компоненте, он drift'ует от остального map state.

**Fix (уже частично реализован в CRIT-2):**

1. **State в reducer** — `demo: { enabled: boolean; time: number }`
2. **Actions** — `demo/toggle`, `demo/tick`, `demo/auto-enable`, `demo/disable`
3. **Timer** — в `MapRidersProvider` через `setInterval` → `dispatch({ type: "demo/tick" })`
4. **Auto-enable** — `useEffect` в Provider: если `sessions.length === 0 && liveRiders.size === 0` → `dispatch({ type: "demo/auto-enable" })`
5. **Auto-disable** — если появились живые данные → `dispatch({ type: "demo/disable" })`

**В `mapPoints` useMemo использовать `state.demo`:**

```tsx
const demoPoints = useMemo(() => {
  if (!state.demo.enabled) return [];

  const t = state.demo.time;
  const orbit = Math.sin(t / 2.8) * 0.004;
  const orbit2 = Math.cos(t / 3.4) * 0.0035;

  return [
    {
      id: "demo-rider-alpha",
      name: `Demo Rider Alpha • ${18 + Math.round(Math.abs(orbit) * 100)} км/ч`,
      type: "point" as const,
      icon: "image:https://placehold.co/56x56/111827/ffffff?text=DA",
      color: "#60a5fa",
      coords: [[56.2339 + orbit, 43.9801 + orbit2]] as [number, number][],
    },
    {
      id: "demo-rider-beta",
      name: `Demo Rider Beta • ${23 + Math.round(Math.abs(orbit2) * 120)} км/ч`,
      type: "point" as const,
      icon: "image:https://placehold.co/56x56/facc15/111827?text=DB",
      color: "#facc15",
      coords: [[56.2251 - orbit2, 43.9924 + orbit]] as [number, number][],
    },
    {
      id: "demo-rider-gamma",
      name: `Demo Rider Gamma • ${31 + Math.round(Math.abs(orbit2) * 80)} км/ч`,
      type: "point" as const,
      icon: "image:https://placehold.co/56x56/16a34a/ffffff?text=DG",
      color: "#22c55e",
      coords: [[56.2186 + orbit2, 43.964 + orbit]] as [number, number][],
    },
  ];
}, [state.demo.enabled, state.demo.time]);
```

**Acceptance Criteria:**
- [ ] Пустая карта автоматически входит в demo mode
- [ ] Ручной toggle работает
- [ ] Demo анимация детерминирована и не ломает live state
- [ ] Demo state переживает rerender'ы без ad hoc local state
- [ ] При появлении реальных данных demo выключается

---

### HIGH-3: Speed-Gradient Routes (NEW HIGH — из v1.1)

**Проблема:**
Одиночный плоский цвет маршрута — упущенная визуальная возможность. Speed-gradient paths делают track replay наглядным и кардинально улучшают visual storytelling карты.

**Fix: Render route segments с цветом по speed band.**

**Speed bands:**

| Скорость | Цвет | Описание |
|----------|------|----------|
| 0–10 км/ч | `#6b7280` (серый) | Stopped / slow traffic |
| 10–25 км/ч | `#3b82f6` (синий) | Normal city riding |
| 25–40 км/ч | `#22c55e` (зелёный) | Active riding |
| 40+ км/ч | `#ef4444` (красный) | High speed / highway |

**Реализация:**

```tsx
// Утилита для определения цвета по скорости
function speedToColor(speedKmh: number): string {
  if (speedKmh < 10) return "#6b7280";
  if (speedKmh < 25) return "#3b82f6";
  if (speedKmh < 40) return "#22c55e";
  return "#ef4444";
}

// В компоненте отображения маршрута:
function SpeedGradientRoute({ points }: { points: Array<{ lat: number; lng: number; speed_kmh: number }> }) {
  if (points.length < 2) return null;

  return (
    <>
      {points.slice(0, -1).map((point, i) => {
        const next = points[i + 1];
        const color = speedToColor(point.speed_kmh);
        return (
          <Polyline
            key={`seg-${i}`}
            positions={[[point.lat, point.lng], [next.lat, next.lng]]}
            color={color}
            weight={4}
            opacity={0.85}
          />
        );
      })}
    </>
  );
}
```

**CSS для gradient legend:**

```css
/* В globals.css */
.speed-legend {
  position: absolute;
  bottom: 80px;
  left: 12px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: #d1d5db;
}

.speed-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.speed-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
```

**Acceptance Criteria:**
- [ ] Route replay показывает видимую "историю скорости"
- [ ] Быстрые сегменты визуально отличаются от медленных
- [ ] Медленные сегменты читаемы на тёмных basemap'ах
- [ ] Gradient rendering не снижает производительность
- [ ] При большом количестве сегментов (1000+) rendering остаётся плавным

> **Performance note:** Реализация через отдельные `<Polyline>` на каждый сегмент — самая простая и надёжная. Для 1000+ сегментов можно оптимизировать через `dashArray` или Leaflet gradient plugin, но для типичного маршрута (50–300 точек) текущий подход достаточен и не требует дополнительной оптимизации.

**v1.0.13 — Полный standalone компонент:**

Создай новый файл `/components/map-riders/SpeedGradientRoute.tsx`:

```tsx
"use client";

import { Polyline } from "react-leaflet";

interface RoutePoint {
  lat: number;
  lng: number;
  speedKmh: number;
}

function speedToColor(speedKmh: number): string {
  if (speedKmh < 10) return "#6b7280";   // серый — медленно / остановка
  if (speedKmh < 25) return "#3b82f6";   // синий — обычная езда
  if (speedKmh < 40) return "#22c55e";   // зелёный — активно
  return "#ef4444";                      // красный — высокоскоростной
}

export function SpeedGradientRoute({ points }: { points: RoutePoint[] }) {
  if (points.length < 2) return null;

  return (
    <>
      {points.slice(0, -1).map((point, i) => {
        const next = points[i + 1];
        const color = speedToColor(point.speedKmh);

        return (
          <Polyline
            key={`seg-${i}`}
            positions={[
              [point.lat, point.lng],
              [next.lat, next.lng],
            ]}
            color={color}
            weight={4.5}
            opacity={0.9}
            lineJoin="round"
            lineCap="round"
          />
        );
      })}
    </>
  );
}
```

**Интеграция в `RiderMarkerLayer.tsx` (или где рисуются маршруты):**

```tsx
import { SpeedGradientRoute } from "./SpeedGradientRoute";

// Внутри слоя маршрутов:
{activeRoutes.map((route) => (
  <SpeedGradientRoute key={route.sessionId} points={route.points} />
))}
```

**Легенда (добавь в `RacingMap.tsx` или `StatusOverlay`):**

```tsx
<div className="speed-legend">
  <div className="speed-legend-item"><div className="speed-legend-dot" style={{background:"#6b7280"}} />0-10</div>
  <div className="speed-legend-item"><div className="speed-legend-dot" style={{background:"#3b82f6"}} />10-25</div>
  <div className="speed-legend-item"><div className="speed-legend-dot" style={{background:"#22c55e"}} />25-40</div>
  <div className="speed-legend-item"><div className="speed-legend-dot" style={{background:"#ef4444"}} />40+</div>
</div>
```

---

### HIGH-4: Heading Arrow on Rider Markers

**Проблема:**
Стрелка направления (heading arrow) — ключевой affordance для rider маркеров. Без неё непонятно, куда едет rider. Это не опциональный полиш — это необходимый элемент map UX.

**Fix direction:**
Сохранить HTML/CSS стрелку в дизайне маркера, рендерить только когда heading доступен.

**В `RiderMarker.tsx`:**

```tsx
// Внутри DivIcon содержимого маркера:
{rider.heading != null && rider.heading !== 0 && (
  <div
    style={{
      position: "absolute",
      bottom: "-6px",
      left: "50%",
      transform: `translateX(-50%) rotate(${rider.heading}deg)`,
      width: 0,
      height: 0,
      borderLeft: "5px solid transparent",
      borderRight: "5px solid transparent",
      borderTop: `9px solid ${isSelf ? "#facc15" : "#60a5fa"}`,
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
      zIndex: 10,
    }}
  />
)}
```

**Acceptance Criteria:**
- [ ] Heading arrow видна когда heading доступен
- [ ] Нет стрелки для stationary / unknown-heading rider'ов
- [ ] Стрелка остаётся читаемой в selected и stale состояниях
- [ ] Стрелка корректно вращается по heading

---

### HIGH-5: Privacy Controls — Production Requirement

**Проблема (из v1.1 — повышено с LOW):**
Location sharing — чувствительная функция. Приложение нуждается в встроенном privacy behaviour, а не в reliance на product discipline.

**Fix direction:**

1. **Visibility mode** — выбор между:
   - `crew` — видно всему экипажу
   - `private` — видно только при прямой ссылке
   - `temporary` — автоматически исчезает через N минут

2. **Home blur / approximate location:**
   - Снижение точности координат вокруг защищённых зон (дом, работа)
   - Замена точных координат на approximate (±500м)

3. **Auto-expire shares:**
   - Конфигурируемая длительность видимости сессии
   - По истечении — сессия исчезает из live views
   - Warn за 5 минут до expire

4. **Pause sharing:**
   - One-tap пауза
   - Фоновая пауза при long background

5. **Clear consent copy:**
   - Текст, объясняющий что видно и на сколько
   - Перед стартом share — brief summary

**Reducer additions (полный `privacy` slice в `initialMapRidersState`):**

```ts
// State:
privacy: {
  visibilityMode: "crew" | "private" | "temporary";
  temporaryMinutes: number; // default 60
  paused: boolean;
  homeBlurEnabled: boolean; // v1.0.12 — включает blur вокруг home-координат
}

// Actions (полный список, включая v1.0.12):
| { type: "privacy/set-visibility"; payload: "crew" | "private" | "temporary" }
| { type: "privacy/set-temporary-minutes"; payload: number }
| { type: "privacy/toggle-pause" }
| { type: "privacy/toggle-home-blur" }

// Reducer cases (с safety bounds):
case "privacy/set-visibility":
  return { ...state, privacy: { ...state.privacy, visibilityMode: action.payload } };

case "privacy/set-temporary-minutes":
  return { ...state, privacy: { ...state.privacy, temporaryMinutes: Math.max(5, Math.min(1440, action.payload)) } };

case "privacy/toggle-pause":
  return { ...state, privacy: { ...state.privacy, paused: !state.privacy.paused } };

case "privacy/toggle-home-blur":
  return { ...state, privacy: { ...state.privacy, homeBlurEnabled: !state.privacy.homeBlurEnabled } };
```

> **v1.0.12 change:** `homeBlurEnabled` добавлен как boolean toggle. `privacy/set-temporary-minutes` теперь clamped в [5, 1440] для safety. `privacy/add-home-location` заменён на `privacy/toggle-home-blur` — проще в реализации и достаточно для MVP privacy.

**UI: Privacy panel в drawer:**

```tsx
{/* Privacy Panel */}
<div className="p-4 border-t border-white/10">
  <h3 className="text-sm font-medium text-white/70 mb-3">Приватность геопозиции</h3>

  <div className="space-y-4">
    {/* Visibility mode */}
    <div>
      <Label className="text-xs text-white/60">Кто видит мою позицию</Label>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {(["crew", "private", "temporary"] as const).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={state.privacy.visibilityMode === mode ? "default" : "outline"}
            onClick={() => dispatch({ type: "privacy/set-visibility", payload: mode })}
          >
            {mode === "crew" ? "Экипаж" : mode === "private" ? "Приватно" : "Временно"}
          </Button>
        ))}
      </div>
    </div>

    {/* Temporary minutes */}
    {state.privacy.visibilityMode === "temporary" && (
      <div>
        <Label className="text-xs text-white/60">Время видимости (мин)</Label>
        <Input
          type="number"
          value={state.privacy.temporaryMinutes}
          onChange={(e) =>
            dispatch({
              type: "privacy/set-temporary-minutes",
              payload: parseInt(e.target.value) || 60,
            })
          }
          min={5}
          max={1440}
          className="mt-1"
        />
      </div>
    )}

    {/* Pause + Home blur toggles */}
    <div className="flex flex-col gap-2">
      <Button
        variant={state.privacy.paused ? "destructive" : "outline"}
        size="sm"
        onClick={() => dispatch({ type: "privacy/toggle-pause" })}
      >
        {state.privacy.paused ? "▶ Возобновить трансляцию" : "⏸ Приостановить трансляцию"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => dispatch({ type: "privacy/toggle-home-blur" })}
      >
        {state.privacy.homeBlurEnabled ? "✅ Дом размыт (защита)" : "❌ Дом не размыт"}
      </Button>
    </div>
  </div>
</div>
```

**Acceptance Criteria:**
- [ ] Privacy mode влияет на map rendering и data exposure
- [ ] Защищённые зоны не показывают точные home координаты по умолчанию
- [ ] `homeBlurEnabled` toggle работает и сразу применяется на карте
- [ ] `temporaryMinutes` clamped в [5, 1440] — невозможно ввести некорректное значение
- [ ] Expired shares перестают появляться в live views
- [ ] Пользователь понимает scope sharing'а перед стартом

---

### HIGH-6: Missing Session Form Fields

**Проблема:**
`rideName`, `vehicleLabel`, `rideMode` есть в reducer state, но UI inputs отсутствуют в рефакторенном `MapRidersClientRefactored.tsx`.

**Fix: Добавить form inputs в rider control panel.**

```tsx
{/* В rider control panel */}
<div className="mt-4 space-y-3">
  <div className="space-y-2">
    <Label htmlFor="ride-name">Название заезда</Label>
    <Input
      id="ride-name"
      value={state.rideName}
      onChange={(e) =>
        dispatch({ type: "ui/set-ride-name", payload: e.target.value })
      }
      disabled={state.shareEnabled}
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="vehicle-label">Байк</Label>
    <Input
      id="vehicle-label"
      value={state.vehicleLabel}
      onChange={(e) =>
        dispatch({ type: "ui/set-vehicle-label", payload: e.target.value })
      }
      disabled={state.shareEnabled}
    />
  </div>

  <div className="grid grid-cols-2 gap-3">
    <Button
      type="button"
      variant={state.rideMode === "rental" ? "default" : "outline"}
      onClick={() => dispatch({ type: "ui/set-ride-mode", payload: "rental" })}
      disabled={state.shareEnabled}
    >
      Арендный байк
    </Button>
    <Button
      type="button"
      variant={state.rideMode === "personal" ? "default" : "outline"}
      onClick={() => dispatch({ type: "ui/set-ride-mode", payload: "personal" })}
      disabled={state.shareEnabled}
    >
      Свой байк
    </Button>
  </div>
</div>
```

---

### HIGH-7: Missing Meetup Creation Toast Feedback

**Проблема:**
`RidersDrawer.tsx` имеет логику создания meetup, но после создания нужно закрыть drawer, очистить форму и дать визуальную обратную связь.

**Fix:**

```tsx
const handleCreateMeetup = useCallback(async () => {
  if (!state.selectedMeetupPoint || !dbUser) return;
  if (!meetupTitle.trim()) {
    toast.error("Укажите название точки встречи");
    return;
  }

  setIsSubmitting(true);
  try {
    const res = await fetch("/api/map-riders/meetups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crewSlug,
        userId: dbUser.user_id,
        title: meetupTitle,
        comment: meetupComment,
        lat: state.selectedMeetupPoint[0],
        lon: state.selectedMeetupPoint[1],
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error);

    toast.success("Точка встречи сохранена для всего экипажа!");
    setMeetupComment("");
    setMeetupTitle("Точка сбора");
    dispatch({ type: "ui/select-meetup-point", payload: null });
    await fetchSnapshot();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Ошибка meetup");
  } finally {
    setIsSubmitting(false);
  }
}, [crewSlug, dbUser, meetupTitle, meetupComment, state.selectedMeetupPoint, fetchSnapshot]);
```

---

### HIGH-8: Clustering Implementation Incomplete

**Проблема:**
`RiderMarkerLayer.tsx` реализует кластеризацию, но cluster markers нуждаются в proper styling.

**Fix: CSS для cluster markers.**

```css
/* В globals.css */
.rider-cluster-icon {
  background: transparent !important;
  border: none !important;
}

.rider-cluster {
  transition: transform 0.2s ease-out;
}

.rider-cluster:hover {
  transform: scale(1.1);
}
```

---

### HIGH-9: Missing vaul Drawer Handle

**Проблема:**
Drawer использует `Drawer.Handle` некорректно. Handle должен быть внутри `Drawer.Content`, а не как отдельный child `Drawer.Root`.

**Fix:**

```tsx
<Drawer.Root
  snapPoints={[64, 380, 640]}
  open={state.drawerOpen}
  onOpenChange={(open) => {
    if (!open) dispatch({ type: "ui/toggle-drawer" });
  }}
>
  <Drawer.Content className="mx-auto flex h-full w-full max-w-lg flex-col rounded-t-2xl bg-black/90 backdrop-blur-xl">
    {/* Handle как визуальный элемент вверху content */}
    <div className="flex justify-center pt-2">
      <div className="h-1.5 w-12 rounded-full bg-white/30" />
    </div>
    {/* ... остальной контент */}
  </Drawer.Content>
</Drawer.Root>
```

---

## 🟡 MEDIUM PRIORITY ISSUES

> Цель Phase C — за 2 часа улучшить resilience и качество.

---

### MED-1: Extract `mapPoints` Composition into Dedicated Hook

**Проблема:**
`mapPoints` memo делает слишком много: смешивает sessions, riders, demo items, routes и meetup points. Это затрудняет тестирование и reading.

**Fix direction:**
Создать `useMapPoints()` hook, который возвращает отдельные массивы:
- `riderPoints`
- `meetupPoints`
- `routePoints`
- `demoPoints`

---

### MED-2: Missing `preferCanvas` Prop in RacingMap

**Проблема:**
`preferCanvas` передаётся как HTML-attribute, а не как React prop.

**Fix:**

```tsx
<MapContainer
  bounds={mapBounds}
  className="z-0 h-full w-full"
  zoomControl={false}
  attributionControl={false}
  preferCanvas={true}
>
```

---

### MED-3: Missing Custom Zoom Controls

**Проблема:**
Стандартный Leaflet zoom control в top-left перекрывается UI элементами.

**Fix:**

```tsx
function CustomZoomControl() {
  const map = useMap();

  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={() => map.zoomIn()}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/70"
      >
        +
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/70"
      >
        −
      </button>
    </div>
  );
}
```

---

### MED-4: No Offline/Fallback Map Tiles

**Проблема:**
Если tile server недоступен, карта пустая.

**Fix:**

```tsx
<TileLayer
  url={source}
  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
  errorTileUrl="/fallback-tile.png"
/>
```

---

### MED-5: No Battery Optimization for GPS

**Проблема:**
GPS продолжает работать когда приложение в фоне.

**Fix: Enhanced battery-aware handling.**

```tsx
const [backgroundTime, setBackgroundTime] = useState<number | null>(null);

useEffect(() => {
  const onVisibility = () => {
    if (document.hidden) {
      setBackgroundTime(Date.now());
    } else {
      // Если был в фоне > 5 минут — обновить snapshot
      if (backgroundTime && Date.now() - backgroundTime > 300_000) {
        fetchSnapshot();
      }
      setBackgroundTime(null);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}, [backgroundTime, fetchSnapshot]);
```

---

## 🟢 LOW PRIORITY / ENHANCEMENTS

> Цель Phase D — за 1–2 часа добавить "радость использования".

---

### LOW-1: Add Haptic Feedback

Использовать Telegram WebApp haptic feedback:

```tsx
import { useTelegram } from "@/hooks/useTelegram";

// При старте sharing
tg?.HapticFeedback?.impactOccurred("medium");

// При meetup создан
tg?.HapticFeedback?.notificationOccurred("success");
```

---

### LOW-2: Add Sound Effects

Play sound при:
- Session start
- New rider joins
- Meetup created

---

### LOW-3: Add Map Theme Switching

Переключение между dark/light map tiles.

---

### LOW-4: Add Rider Photos in Markers

Показывать реальный avatar вместо placeholder с инициалами.

---

## IMPLEMENTATION ORDER (v1.0.11)

### Phase A — Critical (2–3 часа)

| # | ID | Задача | Зависимости |
|---|-----|--------|-------------|
| 0 | HIGH-1 | **Сначала обновить reducer** — добавить все UI/demo/privacy actions + state slices | — |
| 1 | CRIT-2 | Создать `useMapRidersContext.tsx` | HIGH-1 |
| 2 | CRIT-4 | `selfUserId` prop в Provider | CRIT-2 |
| 3 | CRIT-1 | `MapInteractionCapture` компонент | — |
| 4 | CRIT-3 | `onPosition` callback в `useLiveRiders` | CRIT-4 |
| 4b | CRIT-3b | Telegram Hybrid `useLiveRiders` rewrite | CRIT-2, CRIT-4 |
| 5 | CRIT-5 | RiderMarker memory leak fix | — |
| 6 | HIGH-1 | Добавить все UI actions в reducer | — |

### Phase B — Product Quality (3–4 часа)

| # | ID | Задача | Зависимости |
|---|-----|--------|-------------|
| 7 | HIGH-2 | Demo mode в reducer | HIGH-1, CRIT-2 |
| 8 | HIGH-3 | Speed-gradient routes | — |
| 8b | HIGH-3b | Standalone `SpeedGradientRoute.tsx` component + legend | HIGH-3 |
| 9 | HIGH-4 | Heading arrow | — |
| 10 | HIGH-5 | Privacy controls | HIGH-1 |
| 11 | HIGH-6 | Session form fields | HIGH-1 |
| 12 | HIGH-7 | Meetup toast feedback | CRIT-1 |
| 13 | HIGH-8 | Cluster marker CSS | — |
| 14 | HIGH-9 | Vaul drawer fix | HIGH-1 |

### Phase C — Cleanup (2 часа)

| # | ID | Задача | Зависимости |
|---|-----|--------|-------------|
| 15 | MED-1 | Extract `mapPoints` hook | Phase B |
| 16 | MED-2 | Fix `preferCanvas` | — |
| 17 | MED-3 | Custom zoom controls | — |
| 18 | MED-4 | Fallback tiles | — |
| 19 | MED-5 | Battery optimization | CRIT-2 |

### Phase D — Polish (1–2 часа)

| # | ID | Задача | Зависимости |
|---|-----|--------|-------------|
| 20 | LOW-1 | Haptic feedback | Phase B |
| 21 | LOW-2 | Sound effects | Phase B |
| 22 | LOW-3 | Map theme switching | — |
| 23 | LOW-4 | Rider avatars | — |

---

## FILES TO CREATE / MODIFY

### Create New Files

| Файл | Назначение |
|------|------------|
| `/hooks/useMapRidersContext.tsx` | Provider + hook с `selfUserId`, demo timer, realtime subscriptions |
| `/components/maps/MapInteractionCapture.tsx` | Touch/long-press/click обработка для карты |
| `/components/map-riders/SpeedGradientRoute.tsx` | Standalone компонент speed-gradient маршрутов с 4 цветами по speed bands |

### Modify Existing Files

| Файл | Изменения |
|------|-----------|
| `/hooks/useLiveRiders.ts` | Полная замена: Telegram `requestLocation` primary + browser fallback + haptic + visibility handling |
| `/lib/map-riders-reducer.ts` | Добавить `demo` state, все `ui/*` + `demo/*` + `privacy/*` actions |
| `/components/maps/RacingMap.tsx` | Заменить `MapClickCapture` → `MapInteractionCapture`, добавить `onMapLongPress` prop |
| `/components/map-riders/MapRidersClientRefactored.tsx` | Pass `selfUserId`, `onPosition`, demo из reducer, long-press handler |
| `/components/map-riders/RiderMarker.tsx` | `cancelled` guard для анимации, heading arrow CSS |
| `/components/map-riders/RidersDrawer.tsx` | Meetup feedback, privacy panel, drawer handle fix |
| `/components/map-riders/RiderMarkerLayer.tsx` | Speed-gradient route rendering |
| `/app/globals.css` | Cluster marker styles, speed legend, gradient styles |

### Verified Existing (No Changes Needed)

| Файл | Статус |
|------|--------|
| `/app/api/map-riders/route.ts` | ✅ Exists |
| `/app/api/map-riders/session/route.ts` | ✅ Exists |
| `/app/api/map-riders/session/[id]/route.ts` | ✅ Exists |
| `/app/api/map-riders/location/route.ts` | ✅ Exists |
| `/app/api/map-riders/meetups/route.ts` | ✅ Exists |
| `/app/api/map-riders/batch-points/route.ts` | ✅ Exists |

---

## TESTING CHECKLIST

После имплементации убедиться:

### Critical
- [ ] Mobile long-tap создаёт точку meetup
- [ ] Long-tap на desktop (правый клик) создаёт точку meetup
- [ ] Tap не создаёт meetup случайно при pan/zoom
- [ ] Drag отменяет long-press таймер
- [ ] `useMapRidersContext` компилируется без ошибок
- [ ] `selfUserId` корректно передаётся через Provider
- [ ] Собственный rider отображается жёлтым
- [ ] Чужие rider'ы отображаются синими
- [ ] `onPosition` callback обновляет позицию оптимистично
- [ ] RiderMarker анимация не leak'ит память
- [ ] Telegram `requestLocation` используется как primary source в Telegram Mini App
- [ ] Fallback на `watchPosition` работает вне Telegram
- [ ] `isUsingTelegram` корректно отражает используемый источник
- [ ] Haptic feedback срабатывает при обновлении позиции
- [ ] `visibilitychange` запрашивает локацию при возврате из background

### High Priority
- [ ] Demo mode показывает анимированных rider'ов
- [ ] Demo mode автоматически включается при пустой карте
- [ ] Demo mode автоматически выключается при появлении live data
- [ ] Manual demo toggle работает
- [ ] Demo state живёт в reducer (не `useState`)
- [ ] Demo не ломает realtime broadcast (demo riders не отправляют `rider:move`)
- [ ] Speed-gradient визуально различим на маршрутах
- [ ] Heading arrow видна и корректно вращается
- [ ] Session form fields редактируемы
- [ ] Form values передаются в reducer state
- [ ] Meetup creation показывает toast и очищает форму
- [ ] Privacy mode переключается
- [ ] Drawer открывается/закрывается корректно
- [ ] `SpeedGradientRoute.tsx` рендерит сегменты с правильными цветами
- [ ] Speed legend отображается на карте
- [ ] `homeBlurEnabled` toggle работает и показывает состояние

### Medium
- [ ] Cluster markers стилизованы
- [ ] `preferCanvas` передаётся как React prop
- [ ] Custom zoom controls работают
- [ ] Fallback tile при ошибке загрузки
- [ ] Battery optimization при background
- [ ] Snapshot обновляется после возвращения из background

### Low
- [ ] Haptic feedback при действиях
- [ ] Звуковые эффекты (если включены)
- [ ] Theme switching между dark/light

---

## Архитектурные принципы (v1.0.13)

1. **Не reintroduce второй source of truth** в component-local state для domain data.
2. **UI state** — только для ephemeral view concerns, если абсолютно необходимо.
3. **Prefer explicit action types** над ad hoc setters.
4. **Preserve marker heading affordance** — это не полиш, а необходимый элемент UX.
5. **Privacy as a feature**, not a disclaimer.
6. **Reducer actions first** — сначала определить action, потом подключать UI.
7. **Demo in reducer** — demo mode не scatter'ится по компонентам.
8. **Constants over magic numbers** — `DEMO_TICK_MS`, `STALE_MS`, `EVICT_MS` как именованные константы.
9. **Safety bounds in reducer** — privacy values clamped, no invalid state possible.
10. **Hybrid location** — Telegram `requestLocation` как primary, browser API как fallback. Автоматический переключение без user intervention.
