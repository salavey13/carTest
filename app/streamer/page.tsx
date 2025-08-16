"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/contexts/AppContext";
import DonationForm from "@/components/streamer/DonationForm";
import Leaderboard from "@/components/streamer/Leaderboard";
import DonationFeed from "@/components/streamer/DonationFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

export default function StreamerPage() {
  const { dbUser, isLoading, refreshDbUser } = useAppContext();
  const [profile, setProfile] = useState<any>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    setProfile(dbUser);
    setLiveBalance(Number(dbUser?.metadata?.starsBalance ?? null));
  }, [dbUser]);

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
          const meta = rec.metadata || {};
          const bal = Number(meta?.starsBalance ?? null);
          setLiveBalance(Number.isFinite(bal) ? bal : null);
        }
      );
      channel.subscribe();
      chan = channel;
    } catch (e) {}
    return () => {
      try {
        if (chan) {
          if (typeof chan.unsubscribe === "function") chan.unsubscribe();
          else if (typeof (supabase as any).removeChannel === "function") (supabase as any).removeChannel(chan);
        }
      } catch {}
    };
  }, [profile?.user_id, supabase]);

  if (isLoading || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
        <div className="loading-spinner-cyber w-16 h-16 rounded-full" />
        <span className="sr-only">Загрузка профиля стримера...</span>
      </div>
    );
  }

  const streamerId = profile.user_id;
  const schedule = Array.isArray(profile.metadata?.streamSchedule) ? profile.metadata.streamSchedule : [];
  const isOwner = dbUser?.user_id === streamerId;

  // Background hero image (Unsplash) — full URL
  const heroUrl =
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80";

  return (
    <div
      className="min-h-screen pb-12"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(3,7,18,0.75), rgba(5,10,22,0.92)), url(${heroUrl})`,
        backgroundBlendMode: "overlay",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-2xl p-6 bg-[linear-gradient(135deg,#00121a20,#001d2a40)] border border-border shadow-2xl">
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
              <h1 className="text-3xl font-extrabold">{profile.username || profile.full_name || "Стример"}</h1>
              <p className="text-sm text-muted-foreground mt-1">{profile.description || "Профиль стримера"}</p>
              <div className="mt-2 flex items-center gap-4">
                <div className="text-sm text-muted-foreground">Баланс</div>
                <div className="text-xl font-semibold">{liveBalance !== null ? `${liveBalance}★` : "—"}</div>
                <div>
                  <Button variant="secondary" size="sm" onClick={() => refreshDbUser()}>Обновить</Button>
                </div>
                {!isOwner && <div className="text-xs text-muted-foreground ml-2">Вы просматриваете публичную страницу</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-0 bg-transparent border-transparent">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <CardTitle className="text-2xl">VIP Dashboard</CardTitle>
                  <div className="text-xs text-muted-foreground">Управление донатами и наградами</div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <DonationForm streamerId={streamerId} />
                    <div className="p-3 rounded-md border border-border bg-card/60 mt-3">
                      <h5 className="font-semibold mb-2">Быстрые фичи</h5>
                      <ul className="text-sm list-disc list-inside text-muted-foreground">
                        <li>Страницы для конкретных игр (в планах)</li>
                        <li>Управление VIP: роли и доступ</li>
                        <li>Экспорт фанат-листа в CSV</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Расписание</h4>

                    {schedule.length > 0 ? (
                      <ul className="list-inside space-y-2" aria-live="polite">
                        {schedule.map((s: any, idx: number) => (
                          <li key={idx} className="p-2 rounded bg-muted/60 border border-border">
                            <div className="text-sm font-medium">{s.title}</div>
                            <div className="text-xs text-muted-foreground">{s.day} — {s.time}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">Расписание не настроено. Добавьте в profile metadata.streamSchedule.</div>
                    )}

                    <div className="mt-4 space-y-4">
                      <h4 className="font-semibold mb-2">Leaderboard Snapshot</h4>
                      <Leaderboard streamerId={streamerId} />
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Live поток донатов</h4>
                        <DonationFeed streamerId={streamerId} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Вся история пожертвований</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Полная история донатов хранится в таблице <code className="bg-muted px-1 rounded">invoices</code>.
                  Можно добавить фильтрацию, CSV-экспорт и webhooks для external payments.
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-3">
              <h4 className="font-semibold mb-2">VIP Fan Management</h4>
              <p className="text-sm text-muted-foreground">Список VIP, уведомления и быстрые шаблоны сообщений.</p>
              <div className="mt-3">
                {isOwner ? (
                  <Button onClick={() => alert("Открываю VIP панель (TODO)")} className="w-full">Открыть VIP панель</Button>
                ) : (
                  <div className="text-xs text-muted-foreground">Только владелец может открыть панель управления</div>
                )}
              </div>
            </Card>

            <Card className="p-3">
              <h4 className="font-semibold mb-2">Инструменты</h4>
              <ul className="text-sm list-inside">
                <li>Генерация pay-link (через инвойс)</li>
                <li>Webhook callback & автоматическое зачисление</li>
                <li>Leaderboards & аналитика</li>
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}