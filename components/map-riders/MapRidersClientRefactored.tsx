// /components/map-riders/MapRidersClientRefactored.tsx
// Refactored orchestrator — ~120 lines, no business logic.
// All state lives in MapRidersProvider/useMapRiders.
// Layout: fullscreen map + vaul bottom sheet (taxi-style).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import { useTheme } from "next-themes";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useMaps } from "@/lib/maps/useMaps";
import { MapRidersProvider, useMapRiders } from "@/hooks/useMapRidersContext";
import { initialsFromName, meetupDraftFromPost, riderDisplayName, yandexMapsRouteUrl } from "@/lib/map-riders";
import { useLiveRiders } from "@/hooks/useLiveRiders";
import { useIsAdmin } from "@/app/franchize/hooks/useIsAdmin";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";
import { useMeetupCreator } from "@/hooks/useMeetupCreator";
import { FranchizeConfirmModal } from "@/app/franchize/components/FranchizeConfirmModal";
import { MeetupCreateModal } from "@/components/map-riders/MeetupCreateModal";
import { MapPhotoLightbox, type MapPhotoLightboxData } from "@/components/map-riders/MapPhotoLightbox";
import { CommunityWallClient } from "@/app/franchize/[slug]/community/CommunityWallClient";
import { getWallGeotagsAction } from "@/app/franchize/server-actions/community-wall";
import { getSpotCrewLogosAction, type SpotCrewLogoMap } from "@/app/franchize/server-actions/spot-crew-logos";
import {
  formatRelativeTimeRu,
  WALL_FOCUS_POST_EVENT,
  WALL_POSTS_CHANGED_EVENT,
  type WallGeoPinView,
} from "@/app/franchize/lib/community-wall";
import { motoSpotKindLabel, MOTO_SPOT_KINDS, motoSpotKindIcon, NN_MOTO_SPOTS, type MotoSpot, type MotoSpotKind } from "@/lib/map-riders-spots";
import { buildTelegramAppLink, crewCatalogStartParam, wallStartParam } from "@/lib/wall-deeplink";
import { catalogGpsFromSpecs } from "@/lib/catalog-gps";
import type { CatalogItemVM } from "@/app/franchize/actions";
import { RiderMarkerLayer } from "@/components/map-riders/RiderMarkerLayer";
import { RiderFAB } from "@/components/map-riders/RiderFAB";
import { RidersDrawer } from "@/components/map-riders/RidersDrawer";
import { StatusOverlay } from "@/components/map-riders/StatusOverlay";
import { SpeedGradientRoute } from "@/components/map-riders/SpeedGradientRoute";
import { MapRidersDebugPanel } from "@/components/map-riders/MapRidersDebugPanel";
import { useSessionManager } from "@/app/franchize/hooks/useSessionManager";

// Lazy-load map (SSR disabled)
const RacingMap = dynamic(() => import("@/components/maps/RacingMap").then((mod) => mod.RacingMap), { ssr: false });

const DEFAULT_BOUNDS = { top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 };
// HQ coordinates: 56°17'47.2"N 43°56'47.0"E = [56.296444, 43.946389]
// Exact GPS for пл. Комсомольская 2, Нижний Новгород.
// Kept in sync with:
//   - supabase/migrations/20260417023000_update_vip_bike_map_meet_points.sql (map POI dot)
//   - docs/crewDocs/vip-bike-franchize-hydration.sql (crews.hq_location + metadata.map.gps)
//   - docs/sql/vip-bike-franchize-hydration.sql (older copy)
// Update all 4 when this changes.
const HOME_BASE: [number, number] = [56.296444, 43.946389];
// Demo riders at realistic distances from HQ (300-450m, different directions + speeds)
const DEMO_RIDER_OFFSETS: [number, number][] = [
  [56.298356, 43.949833],  // Demo A • 12 км/ч — ~300m NE of HQ
  [56.294215, 43.942371],  // Demo B • 14 км/ч — ~350m SW of HQ
  [56.293578, 43.951555],  // Demo C • 16 км/ч — ~450m SE of HQ
];



const MEETUP_ACTION_DEBOUNCE_MS = 2000;

// Leaflet popup default container is white — force the dark card look for the
// rich spot/meetup popups (leaflet-popup-content-wrapper).
const SPOT_POPUP_CLASSNAME = "mr-spot-popup";

// Snap labels for the 3-button control (matching vaul snapPoints)
const SNAP_POINTS = [0.2, 0.48, 0.66, 0.86] as const;
const DRAWER_SNAP_POINTS: number[] = [...SNAP_POINTS];
type SnapLabel = "Мини" | "Средне" | "Высоко" | "Макс";
const SNAP_LABELS: Record<number, SnapLabel> = { 0.2: "Мини", 0.48: "Средне", 0.66: "Высоко", 0.86: "Макс" };

/** Deep-link params from /map-riders?post=|ride=|compose=|spot=|q= → wall in the sheet. */
export interface MapRidersWallParams {
  highlightPostId?: string | null;
  composeRentalId?: string | null;
  composeRideId?: string | null;
  initialQuery?: string | null;
  checkinSpotId?: string | null;
}

// ── Inner component (uses context) ──
function MapRidersInner({ crew, items, wallParams }: { crew: FranchizeCrewVM; items?: unknown[]; wallParams?: MapRidersWallParams }) {
  const { dbUser } = useAppContext();
  const { resolvedTheme = "dark" } = useTheme();
  const { state, dispatch, crewSlug, fetchSnapshot, fetchSessionDetail } = useMapRiders();
  const isAdmin = useIsAdmin();
  const [isQuickMeetupSaving, setIsQuickMeetupSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [activeSnap, setActiveSnap] = useState<number>(0.48);
  const [selectedMeetupId, setSelectedMeetupId] = useState<string | null>(null);
  const [isMeetupDeleting, setIsMeetupDeleting] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("Точка встречи");
  const [ridersDrawerOpen, setRidersDrawerOpen] = useState(false);
  const [ridersDrawerTab, setRidersDrawerTab] = useState<string>("riders");
  // Легенда мототочек — плавающий оверлей на карте (переехала из шита).
  const [spotLegendOpen, setSpotLegendOpen] = useState(false);
  // Interlink карта → стена: id последнего завершённого заезда — даёт кнопку
  // «Поделиться заездом на стене» (→ /community?ride=<id>). Чистится при новом старте.
  const [endedRideSessionId, setEndedRideSessionId] = useState<string | null>(null);
  // Round-2 enhance: per-kind фильтр мототочек (легенда-чипы на карте).
  const [spotKindFilter, setSpotKindFilter] = useState<MotoSpotKind | "all">("all");
  // Слой техники каталога (specs с GPS-координатами) — тумблер в легенде.
  const [showCatalogItems, setShowCatalogItems] = useState(true);
  // ── Wall × map: геотег-пины постов + flyTo-фокус ──
  const [geoPins, setGeoPins] = useState<WallGeoPinView[]>([]);
  const [wallFocusPoint, setWallFocusPoint] = useState<{ lat: number; lng: number; key: number } | null>(null);
  // Interlink v3: фуллскрин-просмотр фото из попапов (meetup / геотег-пин).
  // Portal в body (MapPhotoLightbox) — leaflet-pane не даёт перекрыть экран
  // изнутри попапа (z ~700 в собственном stacking context).
  const [mapLightbox, setMapLightbox] = useState<MapPhotoLightboxData | null>(null);
  // Стабильный close: без него ESC-эффект лайтбокса пересоздаётся на каждый
  // ререндер клиента (live-райдеры тикают часто).
  const closeLightbox = useCallback(() => setMapLightbox(null), []);
  // In-page «поделиться заездом»: черновик открывается в стене шита без смены URL.
  const [sheetRideComposeId, setSheetRideComposeId] = useState<string | null>(null);
  // Reverse interlink «точка карты → пост на стене»: из попапа meetup-точки
  // композер стены шита префиллится ТЕКСТОМ и ГЕОТЕГОМ этой точки (nonce
  // перезапускает префилл при повторном тапе, как у checkinSpot выше).
  const [wallMapPointCompose, setWallMapPointCompose] = useState<
    { lat: number; lng: number; label: string | null; text: string | null; nonce: number } | null
  >(null);
  // Чек-ин мототочки из попапа: композер стены шита префиллится БЕЗ роутинга
  // (in-page, как sheetRideComposeId). nonce перезапускает префилл при повторном
  // тапе по той же точке; URL-путь (?spot=) остаётся для внешних ссылок.
  const [wallCheckinSpot, setWallCheckinSpot] = useState<{ id: string; nonce: number } | null>(null);
  const lastMeetupActionAtRef = useRef(0);
  // ── Круглые картинки crew-точек: logo_url dummy-экипажей мототочек.
  // Пусто в БД → null → маркер рисует kind-иконку-бейдж (см. RacingMap).
  const [spotLogos, setSpotLogos] = useState<SpotCrewLogoMap>({});

  useEffect(() => {
    let cancelled = false;
    getSpotCrewLogosAction()
      .then((map) => {
        if (!cancelled) setSpotLogos(map);
      })
      .catch(() => {
        /* молча: фолбэк — иконки-бейджи */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply franchize theme CSS variables
  useFranchizeTheme(crew.theme);

  const mapEngine = process.env.NEXT_PUBLIC_MAP_ENGINE || "leaflet";
  const useLeafletMap = mapEngine !== "vibemap";
  const mapBounds = crew.contacts.map.bounds || DEFAULT_BOUNDS;

  // First, get map data to see if there's a configured tile layer
  const { mapData } = useMaps({
    mapId: crew.contacts.map?.id || undefined,
    crewSlug,
    defaultTileLayer: "cartodb-dark", // temporary default, will be overridden if needed
  });

  // Determine tile layer based on theme mode
  // When in auto mode, use light/dark tile layer based on global theme
  // Otherwise, use the configured tile layer from mapData or default to dark
  const finalTileLayer = crew.theme.isAuto
    ? (resolvedTheme === "light" ? "cartodb-light" : "cartodb-dark")
    : (mapData?.meta.tileLayer || "cartodb-dark");
  const { createMeetup } = useMeetupCreator(crewSlug);
  // Общий обработчик конца заезда: и FAB/шит, и таб «Эфир» в листе райдеров
  // должны поднять кнопку «Поделиться заездом» (иначе стоп из листа терял interlink).
  const handleRideStopped = useCallback((endedSessionId: string) => {
    setEndedRideSessionId(endedSessionId);
    // Панель свернута (Мини) → подними до Средне, чтобы кнопка шеринга была видна.
    setActiveSnap((snap) => (snap <= 0.2 ? 0.48 : snap));
  }, []);
  const { canStart, canStop, startSession, stopSession } = useSessionManager({
    authErrorMessage: "Авторизуйся",
    stopSuccessMessage: "Заезд завершён",
    onRideStopped: handleRideStopped,
  });
  const drawerEmptyStateCopy = useMemo(
    () => ({
      history:
        state.recentCompleted.length > 0
          ? `У вас ${state.recentCompleted.length} завершённых заезд(ов) за эту неделю 🏆`
          : "Пока тут пусто... maybe go ride first?",
      meetups:
        state.meetups.length > 0
          ? `Активных точек встречи: ${state.meetups.length}. Тапни на карту, чтобы добавить свою.`
          : "Пока тут пусто... maybe go ride first?",
    }),
    [state.meetups.length, state.recentCompleted.length],
  );

  // ── Inject crew theme CSS vars for FranchizeMapBottomNav ──
  useEffect(() => {
    const root = document.documentElement;
    const prevAccent = root.style.getPropertyValue("--fr-map-nav-accent");
    const prevText = root.style.getPropertyValue("--fr-map-nav-text");
    const prevBg = root.style.getPropertyValue("--fr-map-nav-bg");

    // When in auto mode, franchize CSS variables are already set by useFranchizeTheme
    // So we use those variables directly
    if (crew.theme.isAuto) {
      root.style.setProperty("--fr-map-nav-accent", "var(--franchize-accent-main)");
      root.style.setProperty("--fr-map-nav-text", "var(--franchize-text-primary)");
      root.style.setProperty("--fr-map-nav-bg", "var(--franchize-bg-base)");
    } else {
      root.style.setProperty("--fr-map-nav-accent", crew.theme.palette.accentMain);
      root.style.setProperty("--fr-map-nav-text", crew.theme.palette.textPrimary);
      root.style.setProperty("--fr-map-nav-bg", crew.theme.palette.bgBase);
    }

    return () => {
      if (prevAccent) root.style.setProperty("--fr-map-nav-accent", prevAccent); else root.style.removeProperty("--fr-map-nav-accent");
      if (prevText) root.style.setProperty("--fr-map-nav-text", prevText); else root.style.removeProperty("--fr-map-nav-text");
      if (prevBg) root.style.setProperty("--fr-map-nav-bg", prevBg); else root.style.removeProperty("--fr-map-nav-bg");
    };
  }, [crew.theme.isAuto, crew.theme.palette.accentMain, crew.theme.palette.bgBase, crew.theme.palette.textPrimary]);

  useEffect(() => {
    const { documentElement, body } = document;
    const prevHtmlOverscroll = documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevBodyOverflow = body.style.overflow;

    // Telegram WebView can route gesture intent to page scroll unless we lock overscroll.
    documentElement.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";

    return () => {
      documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Interlink: новый старт = старый «поделиться заездом» больше не актуален.
  useEffect(() => {
    if (state.shareEnabled) setEndedRideSessionId(null);
  }, [state.shareEnabled]);

  // ── GPS tracking hook ──
  const { isUsingTelegram, hasBrowserFix, geoError, refreshTelegramFix, lastBroadcastAt, queuedPoints } = useLiveRiders({
    crewSlug,
    sessionId: state.sessionId,
    userId: dbUser?.user_id || null,
    enabled: state.shareEnabled && Boolean(state.sessionId),
    paused: state.sharePaused,
    privacy: {
      visibilityMode: state.visibilityMode,
      homeBlurEnabled: state.homeBlurEnabled,
      autoExpireMinutes: state.autoExpireMinutes,
      expiresAt: state.shareExpiresAt,
    },
    onPosition: (point) => {
      if (!dbUser?.user_id) return;
      dispatch({
        type: "rider/moved",
        payload: {
          user_id: dbUser.user_id,
          lat: point.lat,
          lng: point.lng,
          speed_kmh: point.speedKmh,
          heading: point.heading,
          updated_at: point.capturedAt,
        },
        selfUserId: dbUser.user_id,
      });
    },
  });

  // ── Event listeners for FranchizeMapBottomNav ──
  useEffect(() => {
    const handleOpenRidersDrawer = (event?: Event) => {
      // «Топ» открывает лист на табе «Эфир» (зал славы переехал туда),
      // «Лист» — на табе райдеров.
      const tab = (event as CustomEvent<{ tab?: string }> | undefined)?.detail?.tab;
      setRidersDrawerTab(tab === "ride" ? "ride" : "riders");
      setRidersDrawerOpen(true);
    };

    const handleExpandSheet = () => {
      // Стена теперь живёт в шите — «Стена» в нижней навигации просто раскрывает его.
      setActiveSnap(0.86);
      setSheetOpen(true);
    };

    window.addEventListener("mapriders-open-riders-drawer", handleOpenRidersDrawer);
    window.addEventListener("mapriders-expand-sheet", handleExpandSheet);

    return () => {
      window.removeEventListener("mapriders-open-riders-drawer", handleOpenRidersDrawer);
      window.removeEventListener("mapriders-expand-sheet", handleExpandSheet);
    };
  }, []);

  // ── Wall × map: геотег-пины постов экипажа ──────────────────────────────────
  // Лента стены и карта — один экран: пост с геотегом = метка на карте.
  // Refetch: маунт + wall:posts-changed (пост создан/скрыт/удалён) + возврат
  // во вкладку — debounce 2s не даёт спамить экшен при серийных правках.
  const loadGeoPins = useCallback(async () => {
    try {
      const res = await getWallGeotagsAction({ slug: crewSlug });
      if (res.ok) setGeoPins(res.pins);
    } catch {
      // transport-level throw (offline / 5xx HTML): keep the previous pins,
      // the map layer is decorative and must never unmount the page's handlers
    }
  }, [crewSlug]);

  useEffect(() => {
    void loadGeoPins();
  }, [loadGeoPins]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadGeoPins(), 2000);
    };
    const onWallChanged = () => {
      scheduleReload();
      // Заезд поделили → кнопка-источник больше не нужна (борьба с no-op ре-кликами).
      setSheetRideComposeId(null);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };
    window.addEventListener(WALL_POSTS_CHANGED_EVENT, onWallChanged);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(WALL_POSTS_CHANGED_EVENT, onWallChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [loadGeoPins]);

  // Гео-чип поста в ленте (onFocusGeotag проп стены) — прямая интеграция:
  // свернуть шит, чтобы карта стала видна, и лететь к метке.
  const handleWallFocusGeotag = useCallback((geo: { lat: number; lng: number }) => {
    setActiveSnap(0.2);
    setSheetOpen(true);
    setWallFocusPoint({ lat: geo.lat, lng: geo.lng, key: Date.now() });
  }, []);

  /** Чек-ин мототочки из попапа: раскрыть шит на стене и префиллить композер.
   *  Осознанно БЕЗ роутинга: раньше тут был <Link> на ТОТ ЖЕ маршрут с ?spot= —
   *  same-route навигация не давала видимого эффекта («кнопка не работает»). */
  const checkinNonceRef = useRef(0);
  const openSpotCheckin = useCallback((spotId: string) => {
    // Счётчик вместо Date.now(): строго монотонный, два тапа в одну миллисекунду
    // не дают одинаковый nonce → повторный префилл гарантирован.
    checkinNonceRef.current += 1;
    setWallCheckinSpot({ id: spotId, nonce: checkinNonceRef.current });
    setActiveSnap(0.86);
    setSheetOpen(true);
  }, []);

  /** «Точка карты → пост на стене» (обратный interlink): попап meetup-точки
   *  просит стену префиллить композер геотегом этой точки (+ название точки
   *  в текст, если композер пустой). Тот же nonce-паттерн, что у чек-ина. */
  const mapPointComposeNonceRef = useRef(0);
  const openWallComposeFromPoint = useCallback((point: { lat: number; lng: number; label?: string | null; text?: string | null }) => {
    mapPointComposeNonceRef.current += 1;
    setWallMapPointCompose({
      lat: point.lat,
      lng: point.lng,
      label: point.label ?? null,
      text: point.text ?? null,
      nonce: mapPointComposeNonceRef.current,
    });
    setActiveSnap(0.86);
    setSheetOpen(true);
  }, []);

  /** Чужой экипаж = отдельный запуск мини-аппа: t.me/<bot>/app?startapp=… через
   *  openTelegramLink корректно перезапускает WebApp с новым startapp (полный
   *  роутинг по грамматике: crew_<slug> / wall_<slug>), тогда как SPA-переход
   *  на чужой экипаж ломает контекст (auth/crew snapshot текущего экипажа). */
  const openCrewDeeplink = useCallback((bot: string, param: string) => {
    const url = buildTelegramAppLink(bot, param);
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return;
    }
    // Обычный браузер: t.me-ссылка откроется Telegram'ом сам.
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  /** Метка на карте → раскрыть шит и подсветить пост в ленте. */
  const openWallPostFromMap = useCallback((postId: string) => {
    window.dispatchEvent(new CustomEvent(WALL_FOCUS_POST_EVENT, { detail: { postId } }));
    setActiveSnap(0.86);
    setSheetOpen(true);
  }, []);

  /** Внешняя ссылка (Яндекс.Карты и пр.): в Telegram WebApp — openLink,
   *  в браузере — новая вкладка. НЕ openTelegramLink: это не t.me-грамматика. */
  const openExternalUrl = useCallback((url: string) => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  /** Interlink v2 «пост на стене → точка на карте»: тап по «Точкой на карту»
   *  у геотег-чипа поста создаёт meetup в координатах поста. Название берём
   *  из лейбла геотега (или текста поста — meetupDraftFromPost), автор поста
   *  остался в комментарии. Успех: шит сворачивается (0.2) и карта летит к
   *  новой точке (wallFocusPoint) — человек ВИДИТ, что точка появилась.
   *  Определён ДО useMemo с попапами (wallPinPoints): попап пина поста
   *  переиспользует этот же handler — интерлинк симметричен чипу на стене. */
  const isCreatingMeetupFromPostRef = useRef(false);
  const handleMakeMeetupFromPost = useCallback(
    async (geo: { lat: number; lng: number; label?: string | null }, meta: { postId: string; text: string | null; authorName: string }) => {
      if (!dbUser?.user_id) {
        toast.error("Авторизуйся в Telegram/VIP BIKE");
        return;
      }
      if (isCreatingMeetupFromPostRef.current) {
        toast.info("Уже добавляем точку…");
        return;
      }
      const now = Date.now();
      if (now - lastMeetupActionAtRef.current < MEETUP_ACTION_DEBOUNCE_MS) {
        toast.info("Подожди пару секунд перед следующим действием");
        return;
      }
      lastMeetupActionAtRef.current = now;

      isCreatingMeetupFromPostRef.current = true;
      try {
        const draft = meetupDraftFromPost(geo.label, meta.text, meta.authorName);
        // meta.postId в контракте задел на будущий «исходный пост» — линк из
        // попапа точки обратно на пост стены (сейчас не читается).
        const created = await createMeetup({
          userId: dbUser.user_id,
          title: draft.title,
          comment: draft.comment,
          point: [geo.lat, geo.lng],
          successMessage: "Точка встречи добавлена на карту",
        });
        if (created) {
          setActiveSnap(0.2);
          setSheetOpen(true);
          setWallFocusPoint({ lat: geo.lat, lng: geo.lng, key: Date.now() });
        }
      } finally {
        isCreatingMeetupFromPostRef.current = false;
      }
    },
    [createMeetup, dbUser?.user_id],
  );

  // ── Build map points from state ──
  // MR polish: riders wear their REAL avatar (sessions already join
  // users.avatar_url) — the round-picture promise now covers people, not just
  // places. No avatar → local initials badge (zero network; the old foreign
  // placeholder-CDN URL was an extra round-trip per marker, slow/unreachable
  // on RU mobile networks). Stale riders additionally dim via .mr-poi--stale.
  const riderPoints = useMemo(
    () =>
      Array.from(state.liveRiders.values())
        .filter((r) => r.status !== "evicted")
        .map((rider) => {
          const session = state.sessions.find((s) => s.user_id === rider.user_id);
          const name = riderDisplayName(session?.users, rider.user_id);
          const isStale = rider.status === "stale";
          const avatar = session?.users?.avatar_url?.trim() || null;
          return {
            id: `live-rider-${rider.user_id}`,
            name: `${name} • ${Math.round(rider.speed_kmh)} км/ч`,
            type: "point" as const,
            icon: `initials:${initialsFromName(name)}`,
            imageUrl: avatar,
            color: rider.isSelf ? "#facc15" : isStale ? "#6b7280" : "#60a5fa",
            coords: [[rider.lat, rider.lng]] as [number, number][],
            markerClassName: isStale ? "mr-poi--stale" : undefined,
          };
        }),
    [state.liveRiders, state.sessions],
  );
  const showDemo = riderPoints.length === 0 && !state.shareEnabled;

  // MR-012: Filter out stale demo-rider POIs from the DB (they're replaced by client-side
  // DEMO_RIDER_OFFSETS below). Only filter by EXACT ID matches — the old .includes("rider •")
  // substring check was too broad and could hide admin-created POIs like "Stunt rider • training".
  // MR-018: Do NOT filter out "vip-base-point" — the HQ dot should be visible on the map.
  // Routes edition (2026-09-23): the client no longer injects hardcoded
  // DEFAULT_ROUTES — routes now live ONLY in the DB
  // (migration 20260923000000_dirt_routes_between_bridges.sql replaced the old
  // asphalt loops with dirt tracks between the real Oka bridges).
  const STALE_DEMO_POI_IDS = new Set([
    "demo-rider-beta",
    "vip-demo-rider-a",
    "vip-demo-rider-b",
    "vip-demo-rider-c",
    "vip-riverside-safe-point",
    // Dirt routes (dirt-*) are DB-only; the migration already replaces old
    // route POIs wholesale, so there is nothing route-shaped left to hide.
  ]);
  const staticMapPoints = useMemo(() => {
    return (mapData?.points || []).filter((point) => {
      const normalizedId = String(point.id || "").toLowerCase();
      return !STALE_DEMO_POI_IDS.has(normalizedId);
    });
    // MR-022: removed mapData?.bounds from deps — the filter body doesn't read it
  }, [mapData?.points]);

  // ── Мототочки НН (Chain-style discovery layer) ─────────────────────────────
  // Каждая точка = dummy-экипаж (crews.slug = spot.slug, сеет миграция
  // 20260921000000). «Отметиться» — чек-ин на стене ТЕКУЩЕГО экипажа (in-page
  // префилл шита); «Каталог/Стена экипажа» — TG-deeplinks на чужой экипаж.
  const spotPopupFor = useCallback(
    (spot: MotoSpot) => {
      // Бот текущего экипажа ведёт все startapp-ссылки попапа: роутер мини-аппа
      // резолвит ЧУЖОЙ slug из параметра (crew_<slug> / wall_<slug>), так что
      // openid-через-любой-бот работает одинаково. Нет бота → веб-пути.
      const crewBot = crew.contacts.telegramBotUsername || null;
      const deeplinkClass = "rounded-lg border px-2 py-1.5 text-center text-xs font-medium transition hover:brightness-125";
      const deeplinkStyle = { borderColor: "var(--community-border, var(--mr-border))", color: "var(--community-text, var(--mr-text))" };
      // Чужой экипаж — через TG-грамматику (crew_<slug> → каталог (главная),
      // wall_<slug> → стена чужого экипажа); роутер резолвит оба на FAST path
      // (до auth), мини-апп перезапускается через openTelegramLink.
      // paramFactory под try/catch: билдеры бросают на недоверенном slug, а
      // попап рендерится внутри useMemo — карта никогда не должна падать
      // целиком (фолбэк — обычная веб-ссылка).
      const crossCrewControl = (paramFactory: () => string, webHref: string, label: string) => {
        let built: string | null = null;
        try {
          built = paramFactory();
        } catch {
          // битый slug → веб-фолбэк тем же контролом
        }
        if (!crewBot || !built) {
          return (
            <Link href={webHref} className={deeplinkClass} style={deeplinkStyle}>
              {label}
            </Link>
          );
        }
        const param = built; // const-алиас: TS-нароуинг внутрь onClick-замыкания
        return (
          <button
            type="button"
            onClick={() => openCrewDeeplink(crewBot, param)}
            className={deeplinkClass}
            style={deeplinkStyle}
            // Единственный источник URL-формата — билдер (не дублируем его руками)
            title={buildTelegramAppLink(crewBot, param)}
          >
            {label}
          </button>
        );
      };
      return (
        // Community tokens (--community-*): same family as the wall's cards —
        // the --mr-* fallbacks keep the popup readable on old embeds.
        <div className="min-w-[200px] max-w-[260px] space-y-1.5 p-1 text-[var(--mr-text)]">
          <div className="text-sm font-semibold" style={{ color: spot.color }}>
            {spot.name}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--mr-muted)]">
            {motoSpotKindLabel(spot.kind)} · {spot.address}
          </div>
          <div className="text-xs leading-snug opacity-80">{spot.hint}</div>
          <div className="flex flex-col gap-1 pt-1">
            {/* Стена живёт в шите этой же страницы: чек-ин — кнопка с in-page
                префиллом композера (раньше это был <Link> на тот же маршрут с
                ?spot= — same-route навигация выглядела как «не работает»). */}
            <button
              type="button"
              onClick={() => openSpotCheckin(spot.id)}
              className="rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition hover:brightness-110"
              style={{ backgroundColor: "var(--community-accent, var(--mr-accent))", color: "var(--community-accent-text, var(--mr-base))" }}
            >
              Отметиться на стене экипажа
            </button>
            {/* Чужой экипаж — через TG-грамматику: crew_<slug> → каталог
                (главная), wall_<slug> → стена чужого экипажа. */}
            {crossCrewControl(() => crewCatalogStartParam(spot.slug), `/franchize/${spot.slug}`, "Каталог экипажа")}
            {crossCrewControl(() => wallStartParam(spot.slug), `/franchize/${spot.slug}/community`, "Стена экипажа")}
          </div>
        </div>
      );
    },
    [crew.contacts.telegramBotUsername, openCrewDeeplink, openSpotCheckin],
  );

  /** Легенда-фильтр: «all» показывает весь слой, иначе только выбранный kind. */
  const visibleSpots = useMemo(
    () => (spotKindFilter === "all" ? NN_MOTO_SPOTS : NN_MOTO_SPOTS.filter((s) => s.kind === spotKindFilter)),
    [spotKindFilter],
  );

  const spotPoints = useMemo(
    () =>
      visibleSpots.map((spot) => ({
        id: `spot-${spot.id}`,
        name: `${spot.name} · ${motoSpotKindLabel(spot.kind)}`,
        type: "point" as const,
        // Реальная иконка вместо точки (kind-бейдж в RacingMap) + круглая
        // аватарка, когда у dummy-экипажа точки задан logo_url.
        icon: motoSpotKindIcon(spot.kind),
        imageUrl: spotLogos[spot.slug] || null,
        color: spot.color,
        coords: [spot.coords] as [number, number][],
        markerClassName: SPOT_POPUP_CLASSNAME,
        popup: spotPopupFor(spot),
      })),
    [visibleSpots, spotPopupFor, spotLogos],
  );

  const spotKindCounts = useMemo(() => {
    const counts = new Map<MotoSpotKind, number>();
    for (const spot of NN_MOTO_SPOTS) counts.set(spot.kind, (counts.get(spot.kind) ?? 0) + 1);
    return counts;
  }, []);

  // ── Wall × map: геотег-метки постов (лента в шите ↔ слой на карте) ──
  // preferCanvas у карты → цвет нужен КОНКРЕТНЫМ hex'ом, CSS-переменные
  // canvas-рендерер не понимает. Авто-тема → фирменный amber VIP BIKE.
  const wallPinColor = crew.theme.isAuto ? "#facc15" : crew.theme.palette.accentMain;

  const wallPinPoints = useMemo(
    () =>
      geoPins.map((pin) => ({
        id: `wallpost-${pin.postId}`,
        name: `Пост · ${pin.authorName}${pin.label ? ` · ${pin.label}` : ""}`,
        type: "point" as const,
        icon: "::FaCameraRetro::",
        // Снимок поста → круглая аватарка на карте (фолбэк — камера-бейдж).
        imageUrl: pin.photoUrl ?? null,
        color: wallPinColor,
        coords: [[pin.lat, pin.lng]] as [number, number][],
        markerClassName: SPOT_POPUP_CLASSNAME,
        popup: (
          <div className="min-w-[200px] max-w-[260px] space-y-1.5 p-1 text-[var(--mr-text)]">
            {pin.photoUrl ? (
              <button
                type="button"
                aria-label={`Открыть фото поста${pin.label ? ` · ${pin.label}` : ""}`}
                className="block w-full cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation();
                  setMapLightbox({ url: pin.photoUrl as string, caption: pin.label || pin.excerpt.slice(0, 60) });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- public wallpix CDN URL, same as the feed renders */}
                <img src={pin.photoUrl} alt={pin.label || "Фото поста"} className="h-24 w-full rounded-lg object-cover" />
              </button>
            ) : null}
            {pin.excerpt ? <div className="text-xs leading-snug">{pin.excerpt}</div> : null}
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-[var(--mr-muted)]">
              {/* Author → public rider page (profile v1 interlinking): the
                  same identity chip the wall renders under each post. */}
              <Link
                href={`/franchize/${crewSlug}/rider/${pin.authorId}`}
                onClick={(e) => e.stopPropagation()}
                className="max-w-[130px] truncate font-semibold transition hover:brightness-125"
                style={{ color: wallPinColor }}
                title={`Профиль райдера · ${pin.authorName}`}
              >
                {pin.authorName}
              </Link>
              <span className="shrink-0">{formatRelativeTimeRu(pin.createdAt)}</span>
            </div>
            {pin.label ? (
              <div className="truncate text-[11px] font-semibold" style={{ color: wallPinColor }}>
                📍 {pin.label}
              </div>
            ) : null}
            {/* Interlink v3: попап пина симметричен чипу поста на стене —
                «Показать в ленте» + «Точкой на карту» (тот же handler,
                что у чипа: атрибуция автора сохраняется в комментарии). */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => openWallPostFromMap(pin.postId)}
                className="rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold leading-tight transition hover:brightness-110"
                style={{ backgroundColor: wallPinColor, color: crew.theme.isAuto ? "#030712" : crew.theme.palette.bgBase }}
              >
                Показать в ленте
              </button>
              <button
                type="button"
                onClick={() =>
                  handleMakeMeetupFromPost(
                    { lat: pin.lat, lng: pin.lng, label: pin.label },
                    { postId: pin.postId, text: pin.excerpt, authorName: pin.authorName },
                  )
                }
                title="Добавить точку встречи в координатах этого поста"
                className="rounded-lg border px-2 py-1.5 text-center text-[11px] font-semibold leading-tight transition hover:brightness-125"
                style={{ borderColor: wallPinColor, color: wallPinColor }}
              >
                Точкой на карту
              </button>
            </div>
          </div>
        ),
      })),
    [geoPins, wallPinColor, openWallPostFromMap, handleMakeMeetupFromPost, crew.theme.isAuto, crew.theme.palette.bgBase],
  );

  // ── Каталог × карта: техника с GPS-координатами в specs ────────────────────
  // «show catalog items on map in case it has gps coordinates in specs»:
  // item.rawSpecs парсится толерантно (gps: "lat, lon" / объект / lat+lon),
  // попап ведёт в каталог экипажа. preferCanvas → цвет конкретным hex'ом.
  const catalogItemPinColor = crew.theme.isAuto ? "#38bdf8" : crew.theme.palette.accentMain;

  const itemPoints = useMemo(() => {
    const list = (items ?? []) as CatalogItemVM[];
    return list.flatMap((item) => {
      const coords = catalogGpsFromSpecs(item.rawSpecs);
      if (!coords) return [];
      return [{
        id: `catitem-${item.id}`,
        name: item.title,
        type: "point" as const,
        icon: "::FaMotorcycle::",
        // Фото техники → круглая аватарка маркера (фолбэк — мото-бейдж).
        imageUrl: item.imageUrl || null,
        color: catalogItemPinColor,
        coords: [coords] as [number, number][],
        markerClassName: SPOT_POPUP_CLASSNAME,
        popup: (
          <div className="min-w-[200px] max-w-[260px] space-y-1.5 p-1 text-[var(--mr-text)]">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- catalog image URL, same as the site renders
              <img src={item.imageUrl} alt="" className="h-24 w-full rounded-lg object-cover" />
            ) : null}
            <div className="text-sm font-semibold" style={{ color: catalogItemPinColor }}>
              {item.title}
            </div>
            {item.subtitle ? <div className="text-[10px] uppercase tracking-wider text-[var(--mr-muted)]">{item.subtitle}</div> : null}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">{item.rentPriceLabel}</span>
              <span className="text-[var(--mr-muted)]">{item.availabilityLabel}</span>
            </div>
            <Link
              href={`/franchize/${crewSlug}`}
              className="block rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition hover:brightness-110"
              style={{ backgroundColor: catalogItemPinColor, color: crew.theme.isAuto ? "#030712" : crew.theme.palette.bgBase }}
            >
              Смотреть в каталоге
            </Link>
          </div>
        ),
      }];
    });
  }, [items, catalogItemPinColor, crewSlug, crew.theme.isAuto, crew.theme.palette.bgBase]);

  const mapPoints = useMemo(() => {
    // MR-018: Always add the HQ point so it's visible even if the migration hasn't been
    // re-run or the DB POI is missing. Uses HOME_BASE constant (single source of truth).
    const hqPoint = {
      id: "vip-base-point",
      name: "VIP BIKE HQ • пл. Комсомольская 2",
      type: "point" as const,
      icon: "::FaLocationDot::",
      color: "#f97316",
      // «Round pictures if available»: HQ-точка = логотип экипажа (круглая
      // аватарка); без логотипа RacingMap нарисует иконку-бейдж. HQ — якорь
      // карты: крупнее обычных точек (lg) + halo-пульс для привлечения взгляда.
      imageUrl: crew.logoUrl || null,
      coords: [[HOME_BASE[0], HOME_BASE[1]]] as [number, number][],
      markerSize: "lg" as const,
      markerHalo: true,
    };

    const demoPoints = showDemo
      ? DEMO_RIDER_OFFSETS.map((coords, index) => ({
          id: `demo-rider-${String.fromCharCode(65 + index)}`,
          // MR-020: Russian labels (was "Demo Rider A" — inconsistent with the rest of the UI)
          name: `Демо-райдер ${String.fromCharCode(65 + index)} • ${12 + index * 2} км/ч`,
          type: "point" as const,
          // MR polish: local initials badge instead of a per-marker request to
          // a foreign placeholder CDN (offline-safe, instant).
          icon: `initials:${String.fromCharCode(65 + index)}`,
          color: "#60a5fa",
          coords: [coords],
          markerClassName: "animate-in fade-in duration-300",
        }))
      : [];

    const meetupPoints = state.meetups.map((m) => ({
      id: `meetup-${m.id}`,
      name: `${m.title}${m.comment ? ` — ${m.comment}` : ""}`,
      type: "point" as const,
      icon: "::FaLocationDot::",
      // MR polish: meetup PHOTO (20260925120000_meetup_photo_url) wins —
      // «add respective photo to be used for icon on map». Fallback chain:
      // creator's avatar (overview API joins avatar_url) → FaLocationDot badge.
      imageUrl: m.photo_url?.trim() || m.users?.avatar_url?.trim() || null,
      color: "#f97316",
      coords: [[m.lat, m.lon]] as [number, number][],
      markerClassName: SPOT_POPUP_CLASSNAME,
      // Meetup → wall interlink: «написать пост о точке» — композер стены шита
      // префиллится геотегом этой точки (обратный interlink, как у чек-инов).
      popup: (
        <div className="min-w-[180px] max-w-[240px] space-y-1.5 p-1 text-[var(--mr-text)]">
          {m.photo_url?.trim() ? (
            <button
              type="button"
              aria-label={`Открыть фото точки · ${m.title}`}
              className="block w-full cursor-zoom-in"
              onClick={(e) => {
                e.stopPropagation();
                setMapLightbox({ url: m.photo_url!.trim(), caption: m.title });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- wallpix CDN URL, same as the wall-pin popup renders */}
              <img src={m.photo_url.trim()} alt={m.title} className="h-24 w-full rounded-lg object-cover" />
            </button>
          ) : null}
          <div className="text-sm font-semibold" style={{ color: "#f97316" }}>
            {m.title}
          </div>
          {m.comment ? <div className="text-xs opacity-80">{m.comment}</div> : null}
          {/* Кто и когда поставил точку — паритет с попапом геотег-меток
              стены (author + formatRelativeTimeRu). */}
          {m.users || m.created_at ? (
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-[var(--mr-muted)]">
              <span className="max-w-[130px] truncate font-semibold normal-case tracking-normal text-[var(--mr-text)]">
                {riderDisplayName(m.users)}
              </span>
              <span className="shrink-0">{formatRelativeTimeRu(m.created_at)}</span>
            </div>
          ) : null}
          {/* Interlink v3: два действия — пост о точке и маршрут до неё
              (Яндекс.Карты планирует от текущего местоположения; в App
              openLink, в браузере — новая вкладка). */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => openWallComposeFromPoint({ lat: m.lat, lng: m.lon, label: m.title, text: m.title })}
              className="rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition hover:brightness-110"
              style={{ backgroundColor: "var(--mr-accent)", color: "var(--mr-base)" }}
            >
              Пост на стене
            </button>
            <button
              type="button"
              onClick={() => openExternalUrl(yandexMapsRouteUrl(m.lat, m.lon))}
              title="Маршрут до точки в Яндекс.Картах"
              className="rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition hover:brightness-125"
              style={{ borderColor: "var(--mr-accent)", color: "var(--mr-accent)" }}
            >
              Маршрут
            </button>
          </div>
        </div>
      ),
    }));

    const routePoints =
      state.sessionDetail?.points?.length
        ? [
            {
              id: `route-${state.sessionDetail.session.id}`,
              name: `Маршрут`,
              type: "path" as const,
              icon: "::FaRoute::",
              color: "#22c55e",
              coords: state.sessionDetail.points.map((p) => [p.lat, p.lon] as [number, number]),
            },
          ]
        : [];

    // Routes come exclusively from the DB now (dirt-* entries from migration
    // 20260923000000) — the old hardcoded DEFAULT_ROUTES injection is gone.
    return [hqPoint, ...staticMapPoints, ...routePoints, ...riderPoints, ...demoPoints, ...meetupPoints, ...spotPoints, ...wallPinPoints, ...(showCatalogItems ? itemPoints : [])];
    // crew.logoUrl / crewSlug are read inside (HQ avatar, meetup popup link) —
    // codereview N2: stale HQ avatar after a logo change otherwise lingers.
  }, [staticMapPoints, riderPoints, showDemo, state.meetups, state.sessionDetail, spotPoints, wallPinPoints, itemPoints, showCatalogItems, crew.logoUrl, crewSlug, openWallComposeFromPoint, openExternalUrl]);

  const riderStatusCounts = useMemo(() => {
    const riders = Array.from(state.liveRiders.values());
    return {
      live: riders.filter((rider) => rider.status === "live").length,
      stale: riders.filter((rider) => rider.status === "stale").length,
      offline: riders.filter((rider) => rider.status === "evicted").length,
    };
  }, [state.liveRiders]);

  const handleQuickMeetupCreate = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Авторизуйся в Telegram/VIP BIKE");
      return;
    }
    if (!state.selectedMeetupPoint) {
      toast.error("Сначала выбери точку на карте");
      return;
    }
    const now = Date.now();
    if (now - lastMeetupActionAtRef.current < MEETUP_ACTION_DEBOUNCE_MS) {
      toast.info("Подожди пару секунд перед следующим действием");
      return;
    }
    lastMeetupActionAtRef.current = now;

    setPromptValue("Точка встречи");
    setIsPromptOpen(true);
  }, [dbUser?.user_id, state.selectedMeetupPoint]);

  const selectedMeetup = useMemo(() => state.meetups.find((meetup) => meetup.id === selectedMeetupId) || null, [state.meetups, selectedMeetupId]);
  const selectedMeetupOwnerLabel = useMemo(() => {
    if (!selectedMeetup) return null;
    const fullName = selectedMeetup.users?.full_name?.trim();
    const username = selectedMeetup.users?.username?.trim();
    if (fullName) return fullName;
    if (username) return `@${username}`;
    return selectedMeetup.created_by_user_id;
  }, [selectedMeetup]);
  const isSelectedMeetupOwnedByCurrentUser = useMemo(() => {
    if (!selectedMeetup || !dbUser?.user_id) return false;
    return selectedMeetup.created_by_user_id === dbUser.user_id;
  }, [dbUser?.user_id, selectedMeetup]);

  const handleMeetupDelete = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Авторизуйся в Telegram/VIP BIKE");
      return;
    }
    if (!selectedMeetup) {
      toast.error("Сначала выбери meetup-поинт");
      return;
    }
    const now = Date.now();
    if (now - lastMeetupActionAtRef.current < MEETUP_ACTION_DEBOUNCE_MS) {
      toast.info("Подожди пару секунд перед следующим действием");
      return;
    }
    lastMeetupActionAtRef.current = now;

    setIsConfirmOpen(true);
  }, [dbUser?.user_id, selectedMeetup]);

  const handleMeetupSubmit = useCallback(
    async (value: string, photoFile: File | null) => {
      if (!dbUser?.user_id) {
        toast.error("Авторизуйся в Telegram/VIP BIKE");
        return;
      }
      if (!state.selectedMeetupPoint) {
        toast.error("Сначала выбери точку на карте");
        return;
      }
      // Модалка остаётся открытой до результата: при ошибке (сеть/валидация)
      // текст и фото сохраняются для повторной попытки; при успехе close
      // запускает open-effect модалки, который сбрасывает её состояние.
      setIsQuickMeetupSaving(true);
      try {
        const created = await createMeetup({
          userId: dbUser.user_id,
          title: value,
          comment: "Добавлено с карты",
          point: state.selectedMeetupPoint,
          successMessage: photoFile
            ? "Meetup добавлен — точка на карте носит твоё фото"
            : "Meetup добавлен по выбранной точке",
          photoFile,
        });
        if (created) setIsPromptOpen(false);
      } finally {
        setIsQuickMeetupSaving(false);
      }
    },
    [createMeetup, dbUser?.user_id, state.selectedMeetupPoint],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!dbUser?.user_id || !selectedMeetup) return;

    setIsConfirmOpen(false);
    setIsMeetupDeleting(true);
    try {
      const headers = await getMapRidersWriteHeaders();
      const response = await fetch("/api/map-riders/meetups", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          meetupId: selectedMeetup.id,
          crewSlug,
          userId: dbUser.user_id,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Не удалось удалить meetup");

      setSelectedMeetupId(null);
      dispatch({ type: "ui/select-meetup-point", payload: null });
      await fetchSnapshot();
      toast.success("Meetup удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка удаления meetup");
    } finally {
      setIsMeetupDeleting(false);
    }
  }, [crewSlug, dbUser, dispatch, fetchSnapshot, selectedMeetup]);

  const cssVars = useMemo(() => ({
    "--mr-accent": crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain,
    "--mr-accent-hover": crew.theme.isAuto ? "var(--franchize-accent-hover)" : crew.theme.palette.accentMainHover,
    "--mr-border": crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
    "--mr-card": crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard,
    "--mr-text": crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
    "--mr-muted": crew.theme.isAuto ? "var(--franchize-text-secondary)" : crew.theme.palette.textSecondary,
    "--mr-base": crew.theme.isAuto ? "var(--franchize-bg-base)" : crew.theme.palette.bgBase,
  }), [crew.theme.isAuto, crew.theme.palette]);

  return (
    <div
      // `relative` is the fix for the rail-link/tap-hijack saga: without it the
      // <section className="absolute inset-0"> map escapes this box and pins
      // itself to the viewport (top:0), sliding UNDER the sticky CrewHeader and
      // stealing taps from the header's link rail. With `relative`, inset-0 is
      // resolved against THIS box — which sits below the header in the flex
      // column — so the map starts exactly where the header ends.
      className="relative flex-1 h-full w-full overflow-hidden"
      style={{ ...cssVars } as React.CSSProperties}
    >
      {/* ── MAP (fullscreen background) ── */}
      <section className="absolute inset-0 z-0">
        <div className="absolute inset-0 pointer-events-auto">
          {useLeafletMap ? (
            <RacingMap
              points={mapPoints}
              bounds={mapData?.bounds || mapBounds || DEFAULT_BOUNDS}
              className="h-full w-full"
              tileLayer={finalTileLayer}
              focusPoint={wallFocusPoint}
              onMapClick={(coords) => {
                setSelectedMeetupId(null);
                dispatch({ type: "ui/select-meetup-point", payload: coords });
              }}
              onPointClick={(point) => {
                const pointId = String(point.id || "");
                if (pointId.startsWith("meetup-")) {
                  const meetupId = pointId.replace(/^meetup-/, "");
                  setSelectedMeetupId(meetupId);
                  dispatch({ type: "ui/select-meetup-point", payload: null });
                }
                // wallpost-* метки: тап открывает leaflet-попап (фото/цитата/кнопка).
                // Шит раскрывает только кнопка «Показать в ленте» внутри попапа —
                // иначе попап мгновенно уходит под развернутый шит.
              }}
            >
              {state.sessionDetail?.points?.length ? <SpeedGradientRoute points={state.sessionDetail.points} /> : null}
            </RacingMap>
          ) : (
            <div className="flex h-full min-h-[calc(100dvh-10rem)] sm:min-h-[100dvh] items-center justify-center text-muted-foreground">
              Режим VibeMap (резерв) — установи NEXT_PUBLIC_MAP_ENGINE=leaflet
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-transparent to-black/30" />
          <MapRidersDebugPanel
            activeRiders={state.liveRiders.size}
            sessionCount={state.sessions.length}
            pendingBatchPoints={queuedPoints}
            isUsingTelegram={isUsingTelegram}
            lastBroadcastAt={lastBroadcastAt}
          />
        </div>

        {/* Meetup selector pill (top-right). The map now starts below the
            CrewHeader (the section is contained in the relative flex-1 wrapper
            above), so this never overlaps the header's link rail. The wrapper is
            pointer-events-none, so map taps/drag pass through everywhere except
            the pill. The old floating status "balloons" (engine / live / stale /
            маршрутов / share-mode badges) were removed: they duplicated info
            already in the bottom sheet and their pointer-events handling was the
            recurring source of stolen taps. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 md:p-4">
          <div className="flex justify-end">
            <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-[var(--mr-border)] bg-[var(--mr-card)]/80 px-3 py-2 text-xs text-[var(--mr-text)] shadow-2xl shadow-black/30 backdrop-blur-md">
              <span className="min-w-0">
                <span className="block font-medium text-[var(--mr-text)]">
                  {selectedMeetup
                    ? `Точка встречи: ${selectedMeetup.title}`
                    : state.selectedMeetupPoint
                    ? `Точка: ${state.selectedMeetupPoint[0].toFixed(4)}, ${state.selectedMeetupPoint[1].toFixed(4)}`
                    : "Тапни на карту, чтобы выбрать точку"}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                disabled={
                  selectedMeetup
                    ? isMeetupDeleting
                    : !state.selectedMeetupPoint || isQuickMeetupSaving
                }
                className="h-6 min-w-6 rounded-full px-2 text-xs leading-none text-black"
                style={{ backgroundColor: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain }}
                onClick={selectedMeetup ? handleMeetupDelete : handleQuickMeetupCreate}
                aria-label={selectedMeetup ? "Удалить выбранный meetup" : "Создать meetup из выбранной точки"}
              >
                {selectedMeetup ? (isMeetupDeleting ? "…" : "−") : isQuickMeetupSaving ? "…" : "+"}
              </Button>
            </div>
          </div>
        </div>

        {/* Легенда мототочек (переехала из шита): плавающий оверлей top-left
            ПОД зумом Leaflet. Схлопнутая — одна кнопка-чип; раскрытая —
            горизонтальная лента kind-фильтров, красится через --mr-*. */}
        <div className="pointer-events-none absolute left-2 top-12 z-20 max-w-[calc(100%-6rem)] md:left-3">
          <div className="pointer-events-auto rounded-2xl border border-[var(--mr-border)] bg-[var(--mr-card)]/80 shadow-2xl shadow-black/30 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setSpotLegendOpen((cur) => !cur)}
              aria-expanded={spotLegendOpen}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--mr-text)]"
            >
              <VibeContentRenderer content={motoSpotKindIcon("landmark")} className="inline-block align-[-2px]" />
              Мототочки {NN_MOTO_SPOTS.length}
              <span className="text-[var(--mr-muted)]">{spotLegendOpen ? "▲" : "▼"}</span>
            </button>
            {spotLegendOpen && (
              <div className="flex max-w-full gap-1.5 overflow-x-auto px-2.5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setSpotKindFilter("all")}
                  aria-pressed={spotKindFilter === "all"}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={
                    spotKindFilter === "all"
                      ? { backgroundColor: "var(--mr-accent)", color: "var(--mr-base)", borderColor: "var(--mr-accent)" }
                      : { color: "var(--mr-text)", borderColor: "var(--mr-border)" }
                  }
                >
                  Все {NN_MOTO_SPOTS.length}
                </button>
                {MOTO_SPOT_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setSpotKindFilter((cur) => (cur === kind ? "all" : kind))}
                    aria-pressed={spotKindFilter === kind}
                    className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition"
                    style={
                      spotKindFilter === kind
                        ? { backgroundColor: "var(--mr-accent)", color: "var(--mr-base)", borderColor: "var(--mr-accent)" }
                        : { color: "var(--mr-text)", borderColor: "var(--mr-border)" }
                    }
                  >
                    <VibeContentRenderer content={motoSpotKindIcon(kind)} className="mr-1 inline-block align-[-2px]" />
                    {motoSpotKindLabel(kind)} {spotKindCounts.get(kind) ?? 0}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Слой техники каталога: компактный тумблер под легендой. Виден
              только когда в specs экипажа есть GPS-координаты — иначе лишний
              чип на карте ничего не значил бы. */}
          {itemPoints.length > 0 && (
            <div className="pointer-events-auto mt-2 inline-flex max-w-full items-center rounded-2xl border border-[var(--mr-border)] bg-[var(--mr-card)]/80 shadow-2xl shadow-black/30 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setShowCatalogItems((cur) => !cur)}
                aria-pressed={showCatalogItems}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--mr-text)]"
              >
                <VibeContentRenderer content="::FaMotorcycle::" className="inline-block align-[-2px]" />
                Техника {itemPoints.length}
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: showCatalogItems ? catalogItemPinColor : "var(--mr-border)" }}
                />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── DRAGGABLE TAXI-STYLE BOTTOM SHEET (vaul) ── */}
      <Drawer.Root
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        snapPoints={DRAWER_SNAP_POINTS}
        activeSnapPoint={activeSnap}
        setActiveSnapPoint={(snapPoint) => {
          if (typeof snapPoint === "number") setActiveSnap(snapPoint);
        }}
        dismissible={false}
        modal={false}
      >
        <Drawer.Portal>
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-20 pointer-events-none">
            <div className={`rounded-t-[1.4rem] border border-[var(--mr-border)] bg-[var(--mr-card)]/96 p-3 shadow-[0_-20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${activeSnap <= 0.2 ? "pointer-events-none" : "pointer-events-auto"}`}><Drawer.Handle className="pointer-events-auto mx-auto mb-2 h-1.5 w-14 rounded-full bg-[var(--mr-muted)]/35" />
            {/* Snap control buttons — WALL v6: accent hairline under the sheet
                title ties the sheet to the wall cards below (same accent). */}
            <div className="pointer-events-auto relative mb-3 flex items-center justify-between gap-2 border-b border-[var(--mr-border)] pb-2.5">
              <h3 className="font-orbitron flex items-center gap-2 text-sm text-[var(--mr-text)]">Стена экипажа<span className="cw-live-dot" aria-hidden /></h3>
              <span aria-hidden className="absolute inset-x-0 -bottom-px h-px" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--mr-accent) 70%, transparent) 45%, transparent)" }} />
              <div className="pointer-events-auto flex gap-1.5">
                {SNAP_POINTS.map((snap) => (
                  <Button
                    key={snap}
                    type="button"
                    size="sm"
                    variant={activeSnap === snap ? "default" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => setActiveSnap(snap)}
                  >
                    {SNAP_LABELS[snap]}
                  </Button>
                ))}
              </div>
            </div>
            {/* ── Scrollable sheet body. data-vaul-no-drag: vaul 0.9 must NOT
                claim touch gestures that start inside the feed — at scrollTop=0
                it redirected the first downward swipe to "collapse the sheet",
                so scrolling the wall felt like fighting the sheet (user report).
                Drag-to-resize stays on the handle/header/buttons OUTSIDE this
                div. overscroll-contain stops scroll chaining to the map page. */}
            <div
              data-vaul-no-drag
              className={`mx-auto max-h-[82dvh] w-full max-w-6xl overflow-y-auto overscroll-contain pb-[calc(8.5rem+env(safe-area-inset-bottom))] ${activeSnap <= 0.2 ? "pointer-events-none opacity-70" : "pointer-events-auto opacity-100"}`}
            >
              {/* ── Ride strip: компактный статус эфира (start/stop — жёлтый FAB
                  справа, полный пульт с приватностью — в листе райдеров, таб
                  «Эфир»). Всё остальное устарело: шит теперь = стена экипажа. ── */}
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2" style={{ backgroundColor: "var(--mr-card)", borderColor: "var(--mr-border)" }}>
                <span className="cw-live-dot" aria-hidden />
                <span className="text-xs font-semibold text-[var(--mr-text)]">
                  {state.shareEnabled ? (state.sharePaused ? "Эфир на паузе" : "Ты в эфире") : "Эфир выключен"}
                </span>
                <span className="text-xs text-[var(--mr-muted)]">
                  · {riderStatusCounts.live} live · {state.stats.totalWeeklyDistanceKm} км за 7 дней
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {/* MR geo-fix: если W3C-геолокация в WebView мертва, а первый
                      фикс пришёл из Telegram — ручной one-shot вместо автопопапов.
                      Полировка: кнопка видна и при ошибке GPS (denied/timeout) —
                      единственный осмысленный повтор теперь сознательный тап. */}
                  {state.shareEnabled && !hasBrowserFix && (isUsingTelegram || geoError !== null) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={refreshTelegramFix}
                    >
                      <VibeContentRenderer content="::FaLocationCrosshairs::" className="mr-1" />
                      Обновить гео
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                      <Link href="/admin/map-routes">Маршруты</Link>
                    </Button>
                  ) : null}
                  {endedRideSessionId && !state.shareEnabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        // Стена теперь в шите: черновик «поделиться заездом»
                        // открывается здесь же, без ухода со страницы карты.
                        setSheetRideComposeId(endedRideSessionId);
                        setActiveSnap(0.86);
                      }}
                    >
                      <VibeContentRenderer content="::FaShareNodes::" className="mr-1.5" />
                      Поделиться заездом
                    </Button>
                  ) : null}
                </span>
                {/* MR geo polish: раньше ошибка геолокации уходила только в
                    console.warn — райдер видел «Ты в эфире» при не двигающейся
                    точке. Теперь причина видна сразу; chip на всю ширину строки
                    (basis-full заворачивает его под основной ряд). */}
                {state.shareEnabled && geoError ? (
                  <span
                    role="status"
                    className={`basis-full rounded-lg border px-2 py-1 text-[11px] leading-snug ${
                      geoError === "denied"
                        ? "border-red-400/30 bg-red-500/10 text-red-200"
                        : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {geoError === "denied"
                      ? "Доступ к геолокации запрещён — разреши его в настройках Telegram, иначе точка на карте не двигается."
                      : "GPS-сигнал недоступен — попробуй «Обновить гео» или выйди на открытое место."}
                  </span>
                ) : null}
              </div>

              {/* ── Community wall merged into the sheet (sheet IS the feed) ──
                  Тот же CommunityWallClient, что на странице /community: посты,
                  фото, реакции, комментарии, зачёт, композер с геотегом.
                  mapSelectedPoint → «Точка с карты» в пикере геотега;
                  onFocusGeotag → карта сворачивает шит и летит к метке.
                  Зачистка 2026-09-22: фолбэк на crew.contacts.telegram (@живой-человек,
                  не бот!) давал битую ссылку t.me/I_O_S_NN/app?startapp=… — убран. */}
              <CommunityWallClient
                slug={crewSlug}
                crewName={crew.header.brandName || crew.name || "Экипаж"}
                botUsername={crew.contacts.telegramBotUsername || null}
                deeplinkBotUsername={crew.contacts.telegramBotUsername || null}
                highlightPostId={wallParams?.highlightPostId ?? null}
                composeRentalId={wallParams?.composeRentalId ?? null}
                composeRideId={sheetRideComposeId ?? wallParams?.composeRideId ?? null}
                initialQuery={wallParams?.initialQuery ?? null}
                checkinSpotId={wallCheckinSpot?.id ?? wallParams?.checkinSpotId ?? null}
                checkinSpotNonce={wallCheckinSpot?.nonce}
                mapSelectedPoint={state.selectedMeetupPoint}
                mapPointCompose={wallMapPointCompose}
                onFocusGeotag={handleWallFocusGeotag}
                onMakeMeetupPoint={handleMakeMeetupFromPost}
              />
            </div>
          </div>
        </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      <StatusOverlay />
      <RiderFAB />
      <RidersDrawer
        crew={crew}
        initialTab={ridersDrawerTab}
        emptyStateCopy={drawerEmptyStateCopy}
        externalOpen={ridersDrawerOpen}
        onExternalOpenChange={setRidersDrawerOpen}
        onRideStopped={handleRideStopped}
      />
      <MeetupCreateModal
        open={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        onSubmit={handleMeetupSubmit}
        title="Название точки встречи"
        placeholder="Точка встречи"
        defaultValue={promptValue}
        saving={isQuickMeetupSaving}
      />
      {/* Interlink v3: фуллскрин-фото из попапов (portal → body, вне
          leaflet-pane/шита). Кнопки попапов ставят mapLightbox. */}
      <MapPhotoLightbox photo={mapLightbox} onClose={closeLightbox} />
      <FranchizeConfirmModal
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Удалить meetup?"
        confirmDisabled={isMeetupDeleting}
        message={
          selectedMeetup
            ? `Удалить meetup «${selectedMeetup.title}»?\n\nВладелец: ${selectedMeetupOwnerLabel || "неизвестно"}${
                isSelectedMeetupOwnedByCurrentUser ? " (вы)" : ""
              }.\nУдаление доступно автору, owner экипажа или admin.`
            : "Удалить выбранную точку встречи?"
        }
        confirmText={isMeetupDeleting ? "Удаляем…" : "Удалить"}
        cancelText="Отмена"
        variant="danger"
      />
    </div>
  );
}

// ── Exported wrapper with provider ──
export function MapRidersClientRefactored({ crew, slug, items, wallParams }: { crew: FranchizeCrewVM; slug?: string; items?: unknown[]; wallParams?: MapRidersWallParams }) {
  const resolvedSlug = crew.slug || slug || "vip-bike";
  return (
    <MapRidersProvider crew={crew} slug={resolvedSlug}>
      <MapRidersInner crew={crew} items={items} wallParams={wallParams} />
    </MapRidersProvider>
  );
}
