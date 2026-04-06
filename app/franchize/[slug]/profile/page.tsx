"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";
import {
  getFranchizeCapabilityContractAction,
  getFranchizeProfileBySlugAction,
  grantFranchizeAchievementAction,
  type FranchizeAchievementDefinition,
  type FranchizeProfileState,
} from "@/app/franchize/profile-actions";

export default function FranchizeProfilePage() {
  const { dbUser } = useAppContext();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "vip-bike";
  const [catalog, setCatalog] = useState<FranchizeAchievementDefinition[]>([]);
  const [profile, setProfile] = useState<FranchizeProfileState | null>(null);
  const [capabilityContract, setCapabilityContract] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!dbUser?.user_id) return;
      const result = await getFranchizeProfileBySlugAction({ slug, userId: dbUser.user_id });
      if (!result.success || !result.data) {
        setError(result.error || "Не удалось загрузить франшизный профиль.");
        return;
      }
      setProfile(result.data);
      setCatalog(result.catalog || []);
      const capabilities = await getFranchizeCapabilityContractAction();
      setCapabilityContract(capabilities);
      await grantFranchizeAchievementAction({
        slug,
        userId: dbUser.user_id,
        achievementId: "franchize_profile_opened",
        source: "web:franchize_profile",
        context: { path: `/franchize/${slug}/profile` },
        incrementCounters: { profileOpenCount: 1 },
      });
    };
    run();
  }, [dbUser?.user_id, slug]);

  const unlockedSet = useMemo(() => new Set(Object.keys(profile?.achievements || {})), [profile?.achievements]);
  const unlockedCount = catalog.filter((item) => unlockedSet.has(item.id)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pb-16">
      <div className="container mx-auto max-w-4xl space-y-4">
        <Card className="border-brand-cyan/40 bg-dark-card/80">
          <CardHeader>
            <CardTitle className="font-orbitron text-brand-cyan flex items-center gap-2">
              <VibeContentRenderer content="::FaIdBadge::" /> Franchize Identity — {profile?.crewName || slug}
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Персональная страница достижений франшизы: slug-фильтр, capability-треки и интеграционные триггеры.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-brand-green/30 bg-black/20 p-3">
              <p className="font-orbitron text-brand-green text-sm">Разблокировано</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">{unlockedCount}/{catalog.length} достижений для slug `{slug}`</p>
            </div>
            <div className="rounded-lg border border-brand-purple/30 bg-black/20 p-3">
              <p className="font-orbitron text-brand-purple text-sm">Счётчики</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">Открытий профиля: {profile?.counters?.profileOpenCount || 0}</p>
            </div>
            <div className="rounded-lg border border-brand-yellow/30 bg-black/20 p-3">
              <p className="font-orbitron text-brand-yellow text-sm">Последняя активность</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">{profile?.lastActivityAt || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-brand-pink/30 bg-dark-card/70">
          <CardHeader>
            <CardTitle className="font-orbitron text-brand-pink flex items-center gap-2">
              <VibeContentRenderer content="::FaUserSecret::" /> Достижения франшизы (filtered by slug)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {catalog.map((achievement) => {
              const unlocked = unlockedSet.has(achievement.id);
              return (
                <div key={achievement.id} className={`rounded-lg border bg-black/20 p-3 ${unlocked ? "border-brand-green/40" : "border-brand-pink/20"}`}>
                  <p className={`font-orbitron text-sm ${unlocked ? "text-brand-green" : "text-brand-pink"}`}>{achievement.title}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">{achievement.description}</p>
                  <p className="font-mono text-2xs text-brand-yellow mt-1">Источник: {achievement.triggerSources.join(", ")}</p>
                  <p className="font-mono text-2xs mt-1">{unlocked ? "✅ Разблокировано" : "🔒 Заблокировано"}</p>
                </div>
              );
            })}
            {!!error && <p className="text-xs font-mono text-red-400">{error}</p>}
          </CardContent>
        </Card>

        <Card className="border-brand-cyan/20 bg-dark-card/60">
          <CardHeader>
            <CardTitle className="font-orbitron text-brand-cyan text-base">Capability contract (для интеграций)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(capabilityContract).map(([key, value]) => (
              <p key={key} className="font-mono text-xs text-muted-foreground">
                <span className="text-brand-cyan">{key}:</span> {value}
              </p>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button asChild className="bg-brand-cyan text-black hover:bg-brand-cyan/80 font-orbitron">
            <Link href={`/franchize/${slug}/map-riders`}>
              Открыть Map Riders
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10">
            <Link href="/profile">
              Вернуться в главный профиль
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
