"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { VibeMap } from "@/components/VibeMap";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatRideDuration, initialsFromName, riderDisplayName } from "@/lib/map-riders";
import { useAppContext } from "@/contexts/AppContext";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";

type SnapshotData = {
  activeSessions: any[];
  meetups: any[];
  weeklyLeaderboard: Array<{ rank: number; riderName: string; distanceKm: number; sessions: number; avgSpeedKmh: number; maxSpeedKmh: number }>;
  latestCompleted: any[];
  stats: { activeRiders: number; meetupCount: number; totalWeeklyDistanceKm: number };
};

type SessionDetail = {
  session: any;
  points: Array<{ lat: number; lon: number; speedKmh: number; capturedAt: string }>;
};

const DEFAULT_BOUNDS = { top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 };

export function MapRidersClient({ crew }: { crew: FranchizeCrewVM }) {
  const { dbUser, userCrewInfo } = useAppContext();
  const crewSlug = crew.slug || userCrewInfo?.slug || "vip-bike";
  const mapBounds = crew.contacts.map.bounds || DEFAULT_BOUNDS;
  const mapImageUrl = crew.contacts.map.imageUrl;
  const surface = crewPaletteForSurface(crew.theme);
  const shareStartParam = `mapriders_${crewSlug}`;
  const shareDeepLink = `https://t.me/oneBikePlsBot/app?startapp=${shareStartParam}`;
  const shareCopy = `${crew.header.brandName || crew.name || "VIP BIKE"} MapRiders — карта экипажа, live-share и meetup-пины в одном окне`;
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeetupPoint, setSelectedMeetupPoint] = useState<[number, number] | null>(null);
  const [meetupTitle, setMeetupTitle] = useState("Точка сбора");
  const [meetupComment, setMeetupComment] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [rideName, setRideName] = useState("Вечерний выезд");
  const [vehicleLabel, setVehicleLabel] = useState("VIP bike");
  const [rideMode, setRideMode] = useState<"rental" | "personal">("rental");
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareStatus, setShareStatus] = useState("Геошеринг выключен");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const activeOwnSession = useMemo(
    () => snapshot?.activeSessions.find((session) => session.user_id === dbUser?.user_id) || null,
    [snapshot?.activeSessions, dbUser?.user_id],
  );

  const fetchSnapshot = useCallback(async () => {
    setLoading((prev) => prev && !snapshot);
    try {
      const response = await fetch(`/api/map-riders?slug=${encodeURIComponent(crewSlug)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось загрузить MapRiders");
      setSnapshot(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить карту райдеров");
    } finally {
      setLoading(false);
    }
  }, [crewSlug, snapshot]);

  const fetchSessionDetail = useCallback(async (nextSessionId: string) => {
    try {
      const response = await fetch(`/api/map-riders/session/${nextSessionId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось загрузить трек");
      setSessionDetail(result.data);
      setSelectedSessionId(nextSessionId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть маршрут");
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!snapshot || selectedSessionId || !snapshot.latestCompleted[0]?.id) return;
    fetchSessionDetail(snapshot.latestCompleted[0].id);
  }, [snapshot, selectedSessionId, fetchSessionDetail]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`map-riders:${crewSlug}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "map_rider_sessions", filter: `crew_slug=eq.${crewSlug}` }, () => fetchSnapshot())
      .on("postgres_changes", { event: "*", schema: "public", table: "map_rider_meetups", filter: `crew_slug=eq.${crewSlug}` }, () => fetchSnapshot())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewSlug, fetchSnapshot]);

  useEffect(() => {
    if (activeOwnSession?.id) {
      setSessionId(activeOwnSession.id);
      setShareEnabled(true);
      setShareStatus("Ты сейчас в эфире на карте");
    } else {
      setSessionId(null);
      setShareEnabled(false);
      setShareStatus("Геошеринг выключен");
    }
  }, [activeOwnSession?.id]);

  const stopWatcher = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const pushLocation = useCallback(async (position: GeolocationPosition, nextSessionId: string) => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const prev = lastCoordsRef.current;
    if (prev && Math.abs(prev.lat - lat) < 0.00003 && Math.abs(prev.lon - lon) < 0.00003) {
      return;
    }
    lastCoordsRef.current = { lat, lon };

    await fetch("/api/map-riders/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: nextSessionId,
        userId: dbUser?.user_id,
        crewSlug,
        lat,
        lon,
        speedKmh: Math.max(0, Number(position.coords.speed || 0) * 3.6),
        headingDeg: position.coords.heading || null,
        accuracyMeters: position.coords.accuracy || null,
        capturedAt: new Date(position.timestamp).toISOString(),
      }),
    });
  }, [crewSlug, dbUser?.user_id]);

  const beginWatch = useCallback((nextSessionId: string) => {
    if (!navigator.geolocation) {
      toast.error("Браузер не поддерживает геолокацию");
      return;
    }
    stopWatcher();
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        pushLocation(position, nextSessionId).catch((error) => {
          toast.error(error instanceof Error ? error.message : "Не удалось отправить геопоинт");
        });
      },
      (error) => {
        toast.error(`Геолокация недоступна: ${error.message}`);
        setShareStatus("Нет доступа к GPS");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    );
  }, [pushLocation, stopWatcher]);

  const handleStartSharing = useCallback(async () => {
    if (!dbUser?.user_id) {
      toast.error("Сначала авторизуйся в Telegram/VIP BIKE");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/map-riders/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          userId: dbUser.user_id,
          crewSlug,
          rideName,
          vehicleLabel,
          rideMode,
          visibility: "crew",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось запустить заезд");
      const nextSessionId = result.data.id as string;
      setSessionId(nextSessionId);
      setShareEnabled(true);
      setShareStatus("Делимся локацией в реальном времени");
      beginWatch(nextSessionId);
      await fetchSnapshot();
      toast.success("MapRiders активирован. Экипаж видит твой маршрут.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось запустить MapRiders");
    } finally {
      setIsSubmitting(false);
    }
  }, [beginWatch, crewSlug, dbUser?.user_id, fetchSnapshot, rideMode, rideName, vehicleLabel]);

  const handleStopSharing = useCallback(async () => {
    if (!dbUser?.user_id || !sessionId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/map-riders/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId, userId: dbUser.user_id, crewSlug }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось завершить заезд");
      stopWatcher();
      setShareEnabled(false);
      setSessionId(null);
      setShareStatus("Заезд завершён и сохранён в статистику");
      await fetchSnapshot();
      toast.success("Маршрут закрыт. Статистика обновлена.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось завершить заезд");
    } finally {
      setIsSubmitting(false);
    }
  }, [crewSlug, dbUser?.user_id, fetchSnapshot, sessionId, stopWatcher]);

  useEffect(() => () => stopWatcher(), [stopWatcher]);

  const handleCreateMeetup = useCallback(async () => {
    if (!dbUser?.user_id || !selectedMeetupPoint) {
      toast.error("Выбери точку на карте и авторизуйся");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/map-riders/meetups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewSlug,
          userId: dbUser.user_id,
          title: meetupTitle,
          comment: meetupComment,
          lat: selectedMeetupPoint[0],
          lon: selectedMeetupPoint[1],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Не удалось создать точку встречи");
      toast.success("Точка встречи сохранена для всего экипажа");
      setMeetupComment("");
      setSelectedMeetupPoint(null);
      await fetchSnapshot();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить meetup");
    } finally {
      setIsSubmitting(false);
    }
  }, [crewSlug, dbUser?.user_id, fetchSnapshot, meetupComment, meetupTitle, selectedMeetupPoint]);

  const mapPoints = useMemo(() => {
    const riderPoints = (snapshot?.activeSessions || [])
      .filter((session) => typeof session.latest_lat === "number" && typeof session.latest_lon === "number")
      .map((session) => ({
        id: `rider-${session.id}`,
        name: `${riderDisplayName(session.users, session.user_id)} • ${Math.round(Number(session.latest_speed_kmh || 0))} км/ч`,
        type: "point" as const,
        icon: `image:https://placehold.co/56x56/${session.user_id === dbUser?.user_id ? "facc15" : "111827"}/ffffff?text=${encodeURIComponent(initialsFromName(riderDisplayName(session.users, session.user_id)))}`,
        color: session.user_id === dbUser?.user_id ? "#facc15" : "#60a5fa",
        coords: [[Number(session.latest_lat), Number(session.latest_lon)]],
      }));

    const meetupPoints = (snapshot?.meetups || []).map((meetup) => ({
      id: `meetup-${meetup.id}`,
      name: `${meetup.title}${meetup.comment ? ` — ${meetup.comment}` : ""}`,
      type: "point" as const,
      icon: "::FaLocationDot::",
      color: "#f97316",
      coords: [[Number(meetup.lat), Number(meetup.lon)]],
    }));

    const routePoints = sessionDetail?.points?.length
      ? [{
          id: `route-${sessionDetail.session.id}`,
          name: `Маршрут ${sessionDetail.session.rider_name}`,
          type: "path" as const,
          icon: "::FaRoute::",
          color: "#22c55e",
          coords: sessionDetail.points.map((point) => [point.lat, point.lon] as [number, number]),
        }]
      : [];

    return [...routePoints, ...riderPoints, ...meetupPoints];
  }, [dbUser?.user_id, sessionDetail, snapshot?.activeSessions, snapshot?.meetups]);

  const heroStats = [
    { label: "В эфире", value: snapshot?.stats.activeRiders ?? 0, icon: "::FaSatelliteDish::" },
    { label: "Точки встречи", value: snapshot?.stats.meetupCount ?? 0, icon: "::FaUsersViewfinder::" },
    { label: "Км за 7 дней", value: snapshot?.stats.totalWeeklyDistanceKm ?? 0, icon: "::FaRoad::" },
  ];

  const mapTools = [
    {
      title: "Брендинг / карта",
      description: "Открыть карту внутри франшизного кастомайзера и поправить GPS, bounds и image URL.",
      href: `/franchize/create?slug=${crewSlug}`,
      cta: "Открыть branding",
    },
    {
      title: "Контакты с картой",
      description: "Проверить публичную контактную страницу команды и то, как карта вписана в crew-shell.",
      href: `/franchize/${crewSlug}/contacts`,
      cta: "Смотреть contacts",
    },
    {
      title: "Админ-гараж",
      description: "Быстрый вход в admin-поверхность экипажа: storefront, техника и рядом все map-сценарии.",
      href: `/franchize/${crewSlug}/admin`,
      cta: "Открыть admin",
    },
    {
      title: "Калибратор карты",
      description: "Если картинка карты кривая — открой калибратор и сохрани новый preset с точными bounds.",
      href: "/admin/map-calibrator",
      cta: "Калибровать",
    },
  ];

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-24 md:pt-28"
      style={{
        ["--mr-accent" as string]: crew.theme.palette.accentMain,
        ["--mr-accent-hover" as string]: crew.theme.palette.accentMainHover,
        ["--mr-border" as string]: crew.theme.palette.borderSoft,
        ["--mr-card" as string]: surface.subtleCard.backgroundColor,
        ["--mr-text" as string]: crew.theme.palette.textPrimary,
        ["--mr-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <Badge className="w-fit border hover:opacity-100" style={{ borderColor: `${crew.theme.palette.accentMain}55`, backgroundColor: `${crew.theme.palette.accentMain}18`, color: crew.theme.palette.accentMain }}>{(crew.header.brandName || crew.name || "VIP BIKE").toUpperCase()} • MAPRIDERS</Badge>
            <CardTitle className="mt-3 font-orbitron text-3xl" style={{ color: crew.theme.palette.textPrimary }}>Карта райдеров в реальном времени</CardTitle>
            <CardDescription className="max-w-2xl text-base" style={{ color: crew.theme.palette.textSecondary }}>
              Один тап — и авторизованный байкер делится маршрутом как в Telegram live location: команда видит движение, точки встречи, скорость и недельный прогресс. Deeplink уже несёт franchize slug и корректно возвращает в `/franchize/{slug}/map-riders`.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border p-4" style={{ borderColor: `${crew.theme.palette.borderSoft}aa`, backgroundColor: `${crew.theme.palette.bgBase}66` }}>
                <div className="mb-2" style={{ color: crew.theme.palette.accentMain }}><VibeContentRenderer content={stat.icon} /></div>
                <div className="text-2xl font-semibold" style={{ color: crew.theme.palette.textPrimary }}>{stat.value}</div>
                <div className="text-sm" style={{ color: crew.theme.palette.textSecondary }}>{stat.label}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Пульт райдера</CardTitle>
            <CardDescription>{shareStatus}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ride-name">Название заезда</Label>
                <Input id="ride-name" value={rideName} onChange={(event) => setRideName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-label">Байк</Label>
                <Input id="vehicle-label" value={vehicleLabel} onChange={(event) => setVehicleLabel(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant={rideMode === "rental" ? "default" : "outline"} onClick={() => setRideMode("rental")}>Арендный байк</Button>
              <Button type="button" variant={rideMode === "personal" ? "default" : "outline"} onClick={() => setRideMode("personal")}>Свой байк</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" disabled={isSubmitting || shareEnabled} onClick={handleStartSharing} className="text-black" style={{ backgroundColor: crew.theme.palette.accentMain }}>
                <VibeContentRenderer content="::FaLocationArrow::" className="mr-2" />
                Включить live share
              </Button>
              <Button type="button" variant="outline" disabled={isSubmitting || !shareEnabled} onClick={handleStopSharing}>
                <VibeContentRenderer content="::FaPowerOff::" className="mr-2" />
                Завершить заезд
              </Button>
            </div>
            <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: `${crew.theme.palette.accentMain}33`, backgroundColor: `${crew.theme.palette.accentMain}12`, color: crew.theme.palette.textPrimary }}>
              <div className="font-medium">Крутые фишки сверху базового запроса</div>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: crew.theme.palette.textSecondary }}>
                <li>Convoy Pulse: видно, кто в эфире прямо сейчас и с какой скоростью идёт колонна.</li>
                <li>Meetup Pins: можно ткнуть в карту, задать точку встречи и комментарий для всей команды.</li>
                <li>Route Replay: любой завершённый заезд открывается по кнопке с визуальным треком и KPI.</li>
              </ul>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href={`https://t.me/share/url?url=${encodeURIComponent(shareDeepLink)}&text=${encodeURIComponent(shareCopy)}`} target="_blank">
                Открыть Telegram-share мост
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Городская карта экипажа</CardTitle>
            <CardDescription>Тапни по карте, чтобы поставить meetup-поинт. Зелёным — выбранный маршрут, жёлтым/синим — активные райдеры.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[520px] overflow-hidden rounded-3xl border" style={{ borderColor: `${crew.theme.palette.borderSoft}aa` }}>
              <VibeMap points={mapPoints} bounds={mapBounds ?? DEFAULT_BOUNDS} imageUrl={mapImageUrl} isEditable onMapClick={(coords) => setSelectedMeetupPoint(coords)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
            <CardHeader>
              <CardTitle className="font-orbitron text-lg" style={{ color: crew.theme.palette.textPrimary }}>Новая точка встречи</CardTitle>
              <CardDescription>
                {selectedMeetupPoint ? `Выбрано: ${selectedMeetupPoint[0].toFixed(5)}, ${selectedMeetupPoint[1].toFixed(5)}` : "Нажми на карту, чтобы выбрать точку"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="meetup-title">Заголовок</Label>
                <Input id="meetup-title" value={meetupTitle} onChange={(event) => setMeetupTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetup-comment">Комментарий</Label>
                <Textarea id="meetup-comment" value={meetupComment} onChange={(event) => setMeetupComment(event.target.value)} placeholder="Например: собираемся тут в 21:00, есть парковка и кофе" />
              </div>
              <Button type="button" className="w-full" disabled={isSubmitting || !selectedMeetupPoint} onClick={handleCreateMeetup}>Сохранить meetup</Button>
            </CardContent>
          </Card>

          <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
            <CardHeader>
              <CardTitle className="font-orbitron text-lg" style={{ color: crew.theme.palette.textPrimary }}>Онлайн-райдеры</CardTitle>
              <CardDescription>{loading ? "Обновляем эфир..." : `${snapshot?.activeSessions.length || 0} райдеров сейчас на карте`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(snapshot?.activeSessions || []).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => fetchSessionDetail(session.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-amber-400/50"
                >
                  <div>
                    <div className="font-medium text-white">{riderDisplayName(session.users, session.user_id)}</div>
                    <div className="text-xs text-muted-foreground">{session.ride_name || "Без названия"} • {session.vehicle_label || "байк не указан"}</div>
                  </div>
                  <div className="text-right text-sm text-amber-200">
                    <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                    <div>{Number(session.latest_speed_kmh || 0).toFixed(0)} км/ч</div>
                  </div>
                </button>
              ))}
              {!snapshot?.activeSessions?.length && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">Пока никто не в эфире. Запусти live share первым.</div>}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Разбор выбранного заезда</CardTitle>
            <CardDescription>Показываем маршрут, скорость, среднюю скорость и длительность по кнопке.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionDetail ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Райдер</div><div className="mt-1 text-lg text-white">{sessionDetail.session.rider_name}</div></div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Дистанция</div><div className="mt-1 text-lg text-white">{Number(sessionDetail.session.total_distance_km || 0).toFixed(1)} км</div></div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Средняя скорость</div><div className="mt-1 text-lg text-white">{Number(sessionDetail.session.avg_speed_kmh || 0).toFixed(1)} км/ч</div></div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-muted-foreground">Максимум</div><div className="mt-1 text-lg text-white">{Number(sessionDetail.session.max_speed_kmh || 0).toFixed(1)} км/ч</div></div>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground">Длительность: {formatRideDuration(Number(sessionDetail.session.duration_seconds || 0))}. Точек в треке: {sessionDetail.points.length}.</div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">Выбери активный или завершённый заезд, чтобы раскрыть маршрут и статистику.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Недельный зал славы</CardTitle>
            <CardDescription>Кто больше всех проехал за 7 дней — тот выше в таблице.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(snapshot?.weeklyLeaderboard || []).map((row) => (
              <div key={`${row.rank}-${row.riderName}`} className="grid grid-cols-[56px,1fr,88px] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-center font-orbitron text-xl text-amber-300">#{row.rank}</div>
                <div>
                  <div className="font-medium text-white">{row.riderName}</div>
                  <div className="text-xs text-muted-foreground">{row.sessions} заезд(ов) • ср. {row.avgSpeedKmh} км/ч • max {row.maxSpeedKmh} км/ч</div>
                </div>
                <div className="text-right text-lg text-white">{row.distanceKm} км</div>
              </div>
            ))}
            {!snapshot?.weeklyLeaderboard?.length && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">Лидерборд наполнится после первых треков.</div>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Последние завершённые выезды</CardTitle>
            <CardDescription>Открывай любой заезд кнопкой, чтобы увидеть маршрут на карте.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(snapshot?.latestCompleted || []).map((session) => (
              <button key={session.id} type="button" onClick={() => fetchSessionDetail(session.id)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-emerald-400/50">
                <div>
                  <div className="font-medium text-white">{session.rider_name}</div>
                  <div className="text-xs text-muted-foreground">{session.ride_name || "Без названия"} • {formatRideDuration(Number(session.duration_seconds || 0))}</div>
                </div>
                <div className="text-right text-sm text-emerald-200">
                  <div>{Number(session.total_distance_km || 0).toFixed(1)} км</div>
                  <div>avg {Number(session.avg_speed_kmh || 0).toFixed(1)}</div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)", boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
          <CardHeader>
            <CardTitle className="font-orbitron text-xl" style={{ color: crew.theme.palette.textPrimary }}>Как это работает</CardTitle>
            <CardDescription>Короткий сценарий для байкеров и админов.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">1.</span> Авторизованный райдер жмёт “Включить live share”, выбирает: арендный или свой байк.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">2.</span> MapRiders начинает писать точки маршрута, считает дистанцию, среднюю и максимальную скорость.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">3.</span> Любой участник видит всех активных райдеров, meetup-пины и недельный лидерборд.</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-medium text-white">4.</span> После завершения поездки маршрут остаётся доступен по кнопке “открыть заезд”.</div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {mapTools.map((tool) => (
          <Card key={tool.href} className="border backdrop-blur-xl" style={{ ...surface.subtleCard, borderColor: "var(--mr-border)" }}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold" style={{ color: crew.theme.palette.textPrimary }}>{tool.title}</CardTitle>
              <CardDescription style={{ color: crew.theme.palette.textSecondary }}>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={tool.href}>{tool.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
