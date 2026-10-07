"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { useAppContext } from '@/contexts/AppContext';
import { useIsAdmin } from '@/app/franchize/hooks/useIsAdmin';
import Link from "next/link";
import { toast } from 'sonner';
import { Users, Clock, Settings, Calendar, UserPlus, Crown, Copy, Send } from "lucide-react";
import { useCrewTokens } from '../../lib/use-crew-tokens';
import { FranchizeOperatorPanel } from '../../components/FranchizeOperatorSurface';
import { DEFAULT_FRANCHIZE_THEME, type FranchizeTheme } from '@/lib/franchize-config';
import {
    getCrewInviteInfoAction,
    type CrewInviteInfo,
} from '../../server-actions/update-crew-member-role';

export function FranchizeCrewOverviewClient({ crewSlug, initialCrew, theme }: { crewSlug: string; initialCrew: any; theme?: FranchizeTheme }) {
    const { userCrewMemberships, dbUser } = useAppContext();
    const isPlatformAdmin = useIsAdmin();
    const T = useCrewTokens(theme || DEFAULT_FRANCHIZE_THEME);
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

    const stats = [
        { icon: Users, label: "Участников", value: memberCount },
        { icon: Calendar, label: "Техники", value: vehicleCount },
        { icon: Clock, label: "На смене", value: activeShiftsCount },
        { icon: Settings, label: "Поддержка", value: "24/7" },
    ];

    return (
        <div className="space-y-3 sm:space-y-5">
            {/* Header — title block always keeps a sane width, provider badge +
                invite wrap below it on narrow screens (overlap-proof). */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                <div className="min-w-0 flex-1 basis-52">
                    <h1
                        className="text-lg font-bold uppercase tracking-tight sm:text-2xl"
                        style={{ color: T.text }}
                    >
                        Управление экипажем
                    </h1>
                    <p className="mt-0.5 truncate text-xs sm:text-sm" style={{ color: T.textMuted }}>
                        {crew?.name || crewSlug}
                    </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                    {isProvider && (
                        <span
                            className="inline-flex h-8 items-center whitespace-nowrap rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wider"
                            style={T.styles.accentPill}
                        >
                            Провайдер
                        </span>
                    )}
                    {(isCrewAdmin || isPlatformAdmin) && (
                        <button
                            type="button"
                            onClick={handleInviteClick}
                            disabled={!inviteInfo}
                            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={T.styles.ctaPrimary}
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            Пригласить
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats — compact tiles */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {stats.map(({ icon: Icon, label, value }) => (
                    <FranchizeOperatorPanel key={label}>
                        <div className="flex items-center gap-2.5">
                            <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: T.accentSoft }}
                            >
                                <Icon className="h-4 w-4" style={{ color: T.accent }} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-lg font-bold leading-tight sm:text-xl" style={{ color: T.text }}>
                                    {value}
                                </p>
                                <p className="truncate text-[10px] uppercase tracking-wider" style={{ color: T.textMuted }}>
                                    {label}
                                </p>
                            </div>
                        </div>
                    </FranchizeOperatorPanel>
                ))}
            </div>

            {/* Management Cards */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                <Link href={`/franchize/${crewSlug}/crew/members`} className="block h-full">
                    <FranchizeOperatorPanel className="h-full transition-opacity hover:opacity-[0.97]">
                        <div className="flex items-center gap-2.5">
                            <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: T.accentSoft }}
                            >
                                <Users className="h-4 w-4" style={{ color: T.accent }} />
                            </span>
                            <h2 className="text-sm font-semibold sm:text-base" style={{ color: T.text }}>
                                Участники
                            </h2>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed sm:text-sm" style={{ color: T.textMuted }}>
                            Список экипажа, роли и статусы участников.
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                                {memberCount} участников
                            </span>
                            <span className="shrink-0 text-xs font-semibold" style={{ color: T.accent }}>
                                Открыть →
                            </span>
                        </div>
                    </FranchizeOperatorPanel>
                </Link>

                <Link href={`/franchize/${crewSlug}/crew/shifts`} className="block h-full">
                    <FranchizeOperatorPanel className="h-full transition-opacity hover:opacity-[0.97]">
                        <div className="flex items-center gap-2.5">
                            <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: T.accentSoft }}
                            >
                                <Clock className="h-4 w-4" style={{ color: T.accent }} />
                            </span>
                            <h2 className="text-sm font-semibold sm:text-base" style={{ color: T.text }}>
                                Смены
                            </h2>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed sm:text-sm" style={{ color: T.textMuted }}>
                            Активные смены, график работы и отчёты.
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>
                                Учёт смен
                            </span>
                            <span className="shrink-0 text-xs font-semibold" style={{ color: T.accent }}>
                                Открыть →
                            </span>
                        </div>
                    </FranchizeOperatorPanel>
                </Link>

                {isCrewAdmin && (
                    <Link href={`/franchize/${crewSlug}/admin`} className="block h-full md:col-span-2">
                        <FranchizeOperatorPanel className="h-full transition-opacity hover:opacity-[0.97]">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                    style={{ backgroundColor: T.accentSoft }}
                                >
                                    <Settings className="h-4 w-4" style={{ color: T.accent }} />
                                </span>
                                <h2 className="text-sm font-semibold sm:text-base" style={{ color: T.text }}>
                                    Настройки экипажа
                                </h2>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed sm:text-sm" style={{ color: T.textMuted }}>
                                Управление каталогом, ценами, отзывами и оформлением.
                            </p>
                            <div className="mt-3">
                                <span className="text-xs font-semibold" style={{ color: T.accent }}>
                                    Открыть →
                                </span>
                            </div>
                        </FranchizeOperatorPanel>
                    </Link>
                )}

                {/* Platform admin: owner-onboarding card (dummy crews → real
                    owners). 2026-09-22: трёхстрочная инструкция выпилена —
                    кнопку «Пригласить» и так видно в шапке, ссылка теперь
                    ВСЕГДА t.me/<бот>/app?startapp=join_<slug> (платформенный
                    фолбэк в резолвере), «веб-ссылка» больше не существует. */}
                {isPlatformAdmin && inviteInfo?.success && (
                    <FranchizeOperatorPanel className="md:col-span-2">
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <Crown className="h-4 w-4 shrink-0" style={{ color: T.accent }} />
                                <code
                                    className="min-w-0 flex-1 truncate rounded-lg border px-2.5 py-1.5 font-mono text-[10px] sm:text-xs"
                                    style={{ borderColor: T.borderSoft, backgroundColor: T.bg, color: T.textMuted }}
                                    title={buildInviteUrl(inviteInfo)}
                                >
                                    {buildInviteUrl(inviteInfo)}
                                </code>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleCopyInvite(inviteInfo)}
                                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-opacity hover:opacity-80"
                                    style={T.styles.ctaSecondary}
                                >
                                    <Copy className="h-3.5 w-3.5" /> Копировать
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInviteClick}
                                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-opacity hover:opacity-80"
                                    style={T.styles.ctaSecondary}
                                >
                                    <Send className="h-3.5 w-3.5" /> Поделиться в TG
                                </button>
                            </div>
                        </div>
                    </FranchizeOperatorPanel>
                )}
            </div>
        </div>
    );
}
