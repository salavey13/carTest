"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import DonationForm from "@/components/streamer/DonationForm";
import Leaderboard from "@/components/streamer/Leaderboard";
import DonationFeed from "@/components/streamer/DonationFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import StreamManager from "@/components/streamer/StreamManager";
import CarSubmissionForm from "@/components/CarSubmissionForm";

/**
 * Streamer page — Level 1 demo (fixed JSX + StreamManager integration)
 */

export default function StreamerPage() {
  const { dbUser, isLoading, refreshDbUser } = useAppContext();
  const [profile, setProfile] = useState<any>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const supabase = getSupabaseBrowserClient();

  // Parallax (mouse + device orientation)
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    setProfile(dbUser);
    setLiveBalance(Number(dbUser?.metadata?.starsBalance ?? null));
  }, [dbUser]);

  // Realtime balance updates
  useEffect(() => {
    if (!profile?.user_id || !supabase) return;
    let chan: any;
    try {
      const channel = supabase.channel(`public:users:balance-${profile.user_id}`);
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `user_id=eq.${profile.user_id}` },
        (payload: any) => {
          const rec = payload?.new;
          if (!rec) return;
          const bal = Number(rec?.metadata?.starsBalance ?? null);
          setLiveBalance(Number.isFinite(bal) ? bal : null);
        }
      );
      channel.subscribe();
      chan = channel;
    } catch (e) {
      // ignore
      console.warn("realtime subscribe failed", e);
    }
    return () => {
      try {
        if (chan) {
          if (typeof chan.unsubscribe === "function") chan.unsubscribe();
          else if (typeof (supabase as any).removeChannel === "function") (supabase as any).removeChannel(chan);
        }
      } catch {}
    };
  }, [profile?.user_id, supabase]);

  // Combined parallax
  useEffect(() => {
    let requestId: number;

    const updatePos = (x: number, y: number) => {
      setPos({ x, y });
    };

    const handleMouse = (e: MouseEvent) => {
      const newX = e.clientX / window.innerWidth;
      const newY = e.clientY / window.innerHeight;
      cancelAnimationFrame(requestId);
      requestId = requestAnimationFrame(() => updatePos(newX, newY));
    };

    const handleGyro = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const gammaNorm = Math.max(0, Math.min(1, (e.gamma + 90) / 180));
      const betaNorm = Math.max(0, Math.min(1, (e.beta + 90) / 180));
      cancelAnimationFrame(requestId);
      requestId = requestAnimationFrame(() => updatePos(gammaNorm, betaNorm));
    };

    window.addEventListener("mousemove", handleMouse, { passive: true });
    if ("DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleGyro, true);
    }

    return () => {
      cancelAnimationFrame(requestId);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("deviceorientation", handleGyro);
    };
  }, []);

  if (isLoading || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
        <div className="loading-spinner-cyber w-16 h-16 rounded-full" />
        <span className="sr-only">Загрузка профиля стримера...</span>
        <div className="mt-8 space-y-4 w-full max-w-2xl px-4">
          <div className="h-32 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="h-64 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg animate-pulse" />
              <div className="h-48 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg animate-pulse" />
              <div className="h-40 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const streamerId = profile.user_id;
  const schedule = Array.isArray(profile.metadata?.streamSchedule) ? profile.metadata.streamSchedule : [];
  const isOwner = dbUser?.user_id === streamerId;

  const heroUrl =
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80";
  const bgPos = `${50 + (pos.x - 0.5) * 6}% ${50 + (pos.y - 0.5) * 4}%`;

  return (
    <div
      className="min-h-screen pb-12 text-white"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(3,7,18,0.95), rgba(5,10,22,0.98)), url(${heroUrl})`,
        backgroundBlendMode: "overlay",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: bgPos,
        transition: "background-position 400ms linear",
      }}
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header card */}
        <div className="rounded-2xl p-6 bg-[linear-gradient(135deg,#00121a40,#001d2a60)] border border-border shadow-2xl"> {/* Increased opacity */}
          <div className="flex items-center gap-4">
            <div className={cn("w-20 h-20 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/40")}>
              <Image
                src={profile.avatar_url || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80"}
                alt={profile.username || profile.full_name || "Стример"}
                width={80}
                height={80}
                style={{ objectFit: "cover" }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-extrabold text-primary leading-tight">
                {profile.username || profile.full_name || "Стример"}
              </h1>
              <p className="text-sm text-gray-300 mt-1"> {/* Lighter gray for contrast */}
                Демо-страница персонального VIP Dashboard для стримера.
              </p>

              <div className="mt-2 flex items-center gap-4">
                <div className="text-sm text-gray-300">Баланс</div> {/* Lighter gray */}
                <div className="text-xl font-semibold">{liveBalance !== null ? `${liveBalance}★` : "—"}</div>
                <div>
                  <Button variant="secondary" size="sm" onClick={() => refreshDbUser()}>
                    Обновить
                  </Button>
                </div>

                {!isOwner && <div className="text-xs text-gray-300 ml-2">Вы просматриваете публичную страницу</div>} {/* Lighter gray */}
              </div>
            </div>
          </div>
        </div>

        {/* StreamManager only for owner */}
        {isOwner && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Stream Overlay — редактор (Level 1)</h3>
            <StreamManager />
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Сохранить текущий стрим как запись (public.cars)</h4>
              <CarSubmissionForm
                ownerId={dbUser?.user_id}
                vehicleToEdit={null}
                onSuccess={(row) => {
                  console.info("Stream saved to public.cars:", row);
                  // Можно обновить профиль/расписание: refreshDbUser() если нужно
                }}
              />
            </div>
          </div>
        )}

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-0 bg-gradient-to-br from-gray-900 to-gray-800 border-transparent"> {/* Darker bg for contrast */}
              <CardHeader>
                <div className="flex items-center gap-4">
                  <CardTitle className="text-2xl text-white">VIP Dashboard</CardTitle>
                  <div className="text-xs text-gray-300">Управление донатами, наградами и VIP фан-базой</div> {/* Lighter gray */}
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <DonationForm streamerId={streamerId} />
                    <div className="p-3 rounded-md border border-border bg-gray-800/80 mt-3"> {/* Darker bg */}
                      <h5 className="font-semibold mb-2 text-white">Почему донат = мерч?</h5>
                      <p className="text-sm text-gray-300">
                        Эксперимент: донат превращается в цифровой/IRL пакет (Sauna Pack и т.п.). Всё хранится в БД и может быть управляемо.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-white">Расписание стримов</h4>
                    {schedule.length > 0 ? (
                      <ul className="list-inside space-y-2" aria-live="polite">
                        {schedule.map((s: any, idx: number) => (
                          <li key={idx} className="p-2 rounded bg-gray-800/80 border border-border"> {/* Darker bg */}
                            <div className="text-sm font-medium text-white">{s.title}</div>
                            <div className="text-xs text-gray-300">{s.day} — {s.time}</div> {/* Lighter gray */}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-300">Расписание пока не настроено. Добавьте в profile metadata.streamSchedule.</div> {/* Lighter gray */}
                    )}

                    <div className="mt-4 space-y-4">
                      <h4 className="font-semibold mb-2 text-white">Лидерборд фанатов</h4>
                      <Leaderboard streamerId={streamerId} />
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2 text-white">Живой поток донатов</h4>
                        <DonationFeed streamerId={streamerId} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-900 to-gray-800"> {/* Darker bg */}
              <CardHeader>
                <CardTitle className="text-white">Вся история донатов</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300">
                  Полная история хранится в таблице <code className="bg-gray-800 px-1 rounded">invoices</code>.
                </p> {/* Lighter gray */}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-3 bg-gradient-to-br from-gray-900 to-gray-800"> {/* Darker bg */}
              <h4 className="font-semibold mb-2 text-white">VIP Fan Management</h4>
              <p className="text-sm text-gray-300">Владелец управляет VIP-фанатами и шаблонами уведомлений.</p> {/* Lighter gray */}
              <div className="mt-3">
                {isOwner ? (
                  <Button onClick={() => alert("Открываю VIP панель (TODO)")} className="w-full">Открыть VIP панель</Button>
                ) : (
                  <div className="text-xs text-gray-300">Только владелец может открыть панель управления</div> {/* Lighter gray */}
                )}
              </div>
            </Card>

            <Card className="p-3 bg-gradient-to-br from-gray-900 to-gray-800"> {/* Darker bg */}
              <h4 className="font-semibold mb-2 text-white">Роадмап проекта</h4>
              <ul className="text-sm list-inside text-gray-300 space-y-1"> {/* Lighter gray */}
                <li><strong>Lvl1 (стример)</strong> — текущая демо-страница.</li>
                <li><strong><Link href="/sauna-rent" className="underline">Lvl2 (сауна)</Link></strong> — IRL бонусы.</li>
                <li><strong><Link href="/vipbikerentals" className="underline">Lvl3 (VIP Bike Rentals)</Link></strong> — масштабируемый сервис.</li>
                <li><strong><Link href="/about_en" className="underline">Агрегация</Link></strong> — единый портал всех уровней.</li>
              </ul>
            </Card>
          </aside>
        </div>
      </div>

      {/* Subtle vignette */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.35) 100%)", mixBlendMode: "multiply" }} />
    </div>
  );
}