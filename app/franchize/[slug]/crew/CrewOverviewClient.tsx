"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { useIsAdmin } from '@/app/franchize/hooks/useIsAdmin';
import Link from "next/link";
import { toast } from 'sonner';
import { Users, Clock, Settings, Calendar, UserPlus, Crown, Copy, Send } from "lucide-react";
import {
    getCrewInviteInfoAction,
    type CrewInviteInfo,
} from '../../server-actions/update-crew-member-role';

export function FranchizeCrewOverviewClient({ crewSlug, initialCrew }: { crewSlug: string; initialCrew: any }) {
    const { userCrewMemberships, dbUser } = useAppContext();
    const isPlatformAdmin = useIsAdmin();
    const [crew, setCrew] = useState<any>(initialCrew);
    const [loading, setLoading] = useState(false);
    const [activeShiftsCount, setActiveShiftsCount] = useState(0);
    // Invite link resolved SERVER-side (bot username from crew metadata —
    // never hardcoded; the old button built a dead `crew_<slug>_join_crew`
    // format the startapp router never parsed).
    const [inviteInfo, setInviteInfo] = useState<CrewInviteInfo | null>(null);

    const isCrewAdmin = userCrewMemberships.some(
      (m) => m.slug === crewSlug && ["owner", "admin", "co_owner"].includes(m.role)
    );

    const fetchActiveShifts = useCallback(async () => {
        try {
            const res = await fetch(`/api/crew/shifts?slug=${encodeURIComponent(crewSlug)}`);
            if (res.ok) {
                const data = await res.json();
                setActiveShiftsCount(data.shifts?.length || 0);
            }
        } catch (e) {
            // Silent fail — don't break the page for a counter
        }
    }, [crewSlug]);

    useEffect(() => {
        if (!crewSlug) return;
        setLoading(true);
        getCrewLiveDetails(crewSlug).then(res => {
            if (res.success) setCrew(res.data);
            setLoading(false);
        });
    }, [crewSlug]);

    useEffect(() => {
        fetchActiveShifts();
    }, [fetchActiveShifts]);

    // Resolve the invite deeplink once the actor identity is known.
    useEffect(() => {
        if (!crewSlug || !dbUser?.user_id) return;
        if (!(isCrewAdmin || isPlatformAdmin)) return;
        let cancelled = false;
        getCrewInviteInfoAction({ slug: crewSlug, actorTelegramUserId: dbUser.user_id })
            .then((res) => {
                if (!cancelled) setInviteInfo(res.success ? res : null);
            })
            .catch(() => setInviteInfo(null));
        return () => { cancelled = true; };
    }, [crewSlug, dbUser?.user_id, isCrewAdmin, isPlatformAdmin]);

    const buildInviteUrl = useCallback((info: CrewInviteInfo & { success: true }): string => {
        return info.botUsername
            ? `https://t.me/${info.botUsername}/app?startapp=${info.startParam}`
            : info.webFallbackUrl;
    }, []);

    const handleInviteClick = useCallback(() => {
        if (!inviteInfo || !inviteInfo.success) {
            toast.error("Не удалось получить ссылку-приглашение");
            return;
        }
        const inviteUrl = buildInviteUrl(inviteInfo);
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent("Присоединяйся к нашему экипажу в VIP Bike!")}`;
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) tg.openLink(shareUrl);
        else window.open(shareUrl, "_blank");
    }, [inviteInfo, buildInviteUrl]);

    const handleCopyInvite = useCallback(async (info: CrewInviteInfo & { success: true }) => {
        const inviteUrl = buildInviteUrl(info);
        try {
            await navigator.clipboard.writeText(inviteUrl);
            toast.success("Ссылка-приглашение скопирована");
        } catch {
            toast.error(inviteUrl);
        }
    }, [buildInviteUrl]);

    if (loading && !crew) return <Loading variant="bike" text="Загрузка..." />;

    const meta = crew?.metadata || {};
    const isProvider = meta.is_provider;
    const memberCount = crew?.members?.length || 0;
    const vehicleCount = crew?.vehicles?.length || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold uppercase tracking-tighter md:text-3xl">Управление экипажем</h1>
                    <p className="text-muted-foreground text-sm mt-1">{crew?.name || crewSlug}</p>
                </div>
                <div className="flex items-center gap-2">
                    {isProvider && <Badge className="bg-primary">ПРОВАЙДЕР</Badge>}
                    {/* Invite button — quick access (deeplink resolved from crew
                        metadata server-side; works for platform admins and the
                        senior members of THIS crew) */}
                    {(isCrewAdmin || isPlatformAdmin) && (
                        <button
                            type="button"
                            onClick={handleInviteClick}
                            disabled={!inviteInfo}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 min-h-[44px] disabled:opacity-50"
                        >
                            <UserPlus className="h-4 w-4" />
                            Пригласить
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Users className="h-5 w-5 text-primary" />
                            <div>
                                <div className="text-2xl font-bold">{memberCount}</div>
                                <div className="text-xs text-muted-foreground">Участников</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-primary" />
                            <div>
                                <div className="text-2xl font-bold">{vehicleCount}</div>
                                <div className="text-xs text-muted-foreground">Техники</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-primary" />
                            <div>
                                <div className="text-2xl font-bold">{activeShiftsCount}</div>
                                <div className="text-xs text-muted-foreground">На смене</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Settings className="h-5 w-5 text-primary" />
                            <div>
                                <div className="text-2xl font-bold">24/7</div>
                                <div className="text-xs text-muted-foreground">Поддержка</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Management Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                <Card className="hover:border-primary transition-colors">
                    <Link href={`/franchize/${crewSlug}/crew/members`}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Users className="h-6 w-6 text-primary" />
                                <h2 className="text-lg font-semibold">Участники</h2>
                            </div>
                            <p className="text-muted-foreground text-sm mb-4">
                                Список экипажа, роли и статусы участников.
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{memberCount} участников</span>
                                <Badge variant="outline">Открыть →</Badge>
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="hover:border-primary transition-colors">
                    <Link href={`/franchize/${crewSlug}/crew/shifts`}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock className="h-6 w-6 text-primary" />
                                <h2 className="text-lg font-semibold">Смены</h2>
                            </div>
                            <p className="text-muted-foreground text-sm mb-4">
                                Активные смены, график работы и отчёты.
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Учёт смен</span>
                                <Badge variant="outline">Открыть →</Badge>
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                {isCrewAdmin && (
                    <Card className="md:col-span-2 hover:border-primary transition-colors">
                        <Link href={`/franchize/${crewSlug}/admin`}>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Settings className="h-6 w-6 text-primary" />
                                    <h2 className="text-lg font-semibold">Настройки экипажа</h2>
                                </div>
                                <p className="text-muted-foreground text-sm mb-4">
                                    Управление каталогом, ценами, отзывами и оформлением.
                                </p>
                                <Badge variant="outline">Открыть →</Badge>
                            </CardContent>
                        </Link>
                    </Card>
                )}

                {/* Platform admin: owner-onboarding card (dummy crews → real
                    owners). 2026-09-22: трёхстрочная инструкция выпилена —
                    кнопку «Пригласить» и так видно в шапке, ссылка теперь
                    ВСЕГДА t.me/<бот>/app?startapp=join_<slug> (платформенный
                    фолбэк в резолвере), «веб-ссылка» больше не существует. */}
                {isPlatformAdmin && inviteInfo?.success && (
                    <Card className="md:col-span-2 border-amber-500/40">
                        <CardContent className="p-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <Crown className="h-6 w-6 shrink-0 text-amber-500" />
                                    <code
                                        className="min-w-0 flex-1 truncate rounded-lg border bg-muted px-3 py-2 text-xs"
                                        title={buildInviteUrl(inviteInfo)}
                                    >
                                        {buildInviteUrl(inviteInfo)}
                                    </code>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyInvite(inviteInfo)}
                                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition hover:border-primary"
                                    >
                                        <Copy className="h-4 w-4" /> Копировать
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleInviteClick}
                                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition hover:border-primary"
                                    >
                                        <Send className="h-4 w-4" /> Поделиться в TG
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
