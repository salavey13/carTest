"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/contexts/AppContext";
import DonationForm from "@/components/streamer/DonationForm";
import Leaderboard from "@/components/streamer/Leaderboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Простая страница стримера.
 * Предполагаем, что текущий залогиненный пользователь - стример (dbUser.user_id).
 * Если это публичная страница для другого стримера, можно расширить до dynamic route.
 */

export default function StreamerPage() {
  const { dbUser, isLoading } = useAppContext();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    setProfile(dbUser);
  }, [dbUser]);

  if (isLoading || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="loading-spinner-cyber w-16 h-16 rounded-full" />
      </div>
    );
  }

  const streamerId = profile.user_id;

  // schedule stored in metadata.streamSchedule (array of {day, time, title})
  const schedule = profile.metadata?.streamSchedule ?? [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-0">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden">
                  <Image src={profile.avatar_url || "/logo.png"} alt={profile.username || profile.full_name || "streamer"} width={64} height={64} />
                </div>
                <div>
                  <CardTitle className="text-2xl">{profile.username || profile.full_name || "Стример"}</CardTitle>
                  <div className="text-sm text-muted-foreground">{profile.description || "Профиль стримера"}</div>
                </div>
                <div className="ml-auto">
                  <Button variant="secondary" onClick={() => window.location.reload()}>Обновить</Button>
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
                        <li>Настроить страницы для конкретных игр (в будущем).</li>
                        <li>Сертификация VIP: управлять доступом и ролями.</li>
                        <li>Импорт/экспорт фанат-листа.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Расписание</h4>
                  {Array.isArray(schedule) && schedule.length > 0 ? (
                    <ul className="list-inside space-y-2">
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

                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Leaderboard Snapshot</h4>
                    <Leaderboard streamerId={streamerId} />
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
              <div className="text-sm text-muted-foreground">Полная история донатов доступна в таблице invoices. Можно расширить фильтрацию и экспорт в CSV.</div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-3">
            <h4 className="font-semibold mb-2">VIP Fan Management</h4>
            <p className="text-sm text-muted-foreground">Список VIP, уведомления, быстрые шаблоны сообщений.</p>
            <div className="mt-3">
              <Button onClick={() => alert("TODO: open VIP panel")} className="w-full">Открыть VIP панель</Button>
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