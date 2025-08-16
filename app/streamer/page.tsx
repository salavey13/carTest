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

export default function StreamerPage() {
  const { dbUser, isLoading, refreshDbUser } = useAppContext();
  const [profile, setProfile] = useState<any>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    setProfile(dbUser);
    setLiveBalance(Number(dbUser?.metadata?.starsBalance ?? null));
  }, [dbUser]);

  // subscribe to user's metadata.starsBalance changes (best-effort client-side)
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
    } catch (e) {
      // ignore realtime errors
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-0">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted">
                  <Image
                    src={profile.avatar_url || "/logo.png"}
                    alt={profile.username || profile.full_name || "Стример"}
                    width={64}
                    height={64}
                  />
                </div>

                <div>
                  <CardTitle className="text-2xl">{profile.username || profile.full_name || "Стример"}</CardTitle>
                  <div className="text-sm text-muted-foreground">{profile.description || "Профиль стримера"}</div>
                  <div className="text-sm mt-1">
                    <span className="text-xs text-muted-foreground mr-2">Баланс:</span>
                    <span className="font-semibold">{liveBalance !== null ? `${liveBalance}★` : "—"}</span>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => refreshDbUser()}>
                    Обновить
                  </Button>
                  {!isOwner && (
                    <span className="text-xs text-muted-foreground">Вы просматриваете публичную страницу</span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">VIP Dashboard</h4>
                  <p className="text-sm text-muted-foreground mb-3">Управляй VIP-фанами, настрой донаты и смотри статистику.</p>

                  <div className="space-y-3">
                    <DonationForm streamerId={streamerId} />
                    <div className="p-3 bg-card rounded-md border border-border">
                      <h5 className="font-semibold mb-2">Быстрые фичи</h5>
                      <ul className="text-sm list-disc list-inside text-muted-foreground">
                        <li>Настроить страницы для конкретных игр (в будущем)</li>
                        <li>Сертификация VIP: управлять доступом и ролями</li>
                        <li>Импорт/экспорт фанат-листа</li>
                      </ul>
                    </div>
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
                    <div className="text-sm text-muted-foreground">Расписание не настроено. Добавьте в профиль metadata.streamSchedule.</div>
                  )}

                  <div className="mt-4 space-y-4">
                    <h4 className="font-semibold mb-2">Leaderboard Snapshot</h4>
                    <Leaderboard streamerId={streamerId} />
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Live Donation Feed</h4>
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
            <p className="text-sm text-muted-foreground">Список VIP, уведомления, быстрые шаблоны сообщений.</p>
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
  );
}