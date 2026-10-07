"use client";

import React, { useEffect, useState } from 'react';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { useIsAdmin } from '@/app/franchize/hooks/useIsAdmin';
import Link from "next/link";
import { Users, Crown, Shield, ArrowLeft, UserCog, Wrench } from "lucide-react";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCrewTokens } from '../../lib/use-crew-tokens';
import { FranchizeOperatorPanel } from '../../components/FranchizeOperatorSurface';
import { DEFAULT_FRANCHIZE_THEME, type FranchizeTheme } from '@/lib/franchize-config';
import {
    updateCrewMemberRole,
    promoteCrewMemberToOwnerAction,
    getCrewInviteInfoAction,
    type AssignableRole,
    type CrewInviteInfo,
} from '../../server-actions/update-crew-member-role';
import {
    roleLabel,
    roleRank,
    assignableRolesFor,
    type CrewRole,
} from '../../lib/crew-roles';
import { UserPlus, Trash2 } from 'lucide-react';

type LiveStatus = 'online' | 'riding' | 'offline';

interface CrewMember {
    user_id: string;
    username: string;
    avatar_url?: string;
    role: CrewRole;
    live_status: LiveStatus;
    membership_status: 'active' | 'pending';
}

export function FranchizeCrewMembersClient({ crewSlug, theme }: { crewSlug: string; theme?: FranchizeTheme }) {
    const { dbUser, userCrewMemberships } = useAppContext();
    const isPlatformAdmin = useIsAdmin();
    const T = useCrewTokens(theme || DEFAULT_FRANCHIZE_THEME);
    const [crew, setCrew] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    // Invite deeplink resolved server-side (bot from crew metadata; the old
    // hardcoded `crew_<slug>_join_crew` startapp format was dead — the router
    // never parsed it).
    const [inviteInfo, setInviteInfo] = useState<CrewInviteInfo | null>(null);

    const refreshCrew = async () => {
        const res = await getCrewLiveDetails(crewSlug);
        if (res.success) setCrew(res.data);
        return res;
    };

    useEffect(() => {
        if (!crewSlug) return;
        refreshCrew().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [crewSlug]);

    // Invite deeplink — resolved SERVER-side (bot from crew metadata; the old
    // hardcoded `crew_<slug>_join_crew` startapp format was dead — the router
    // never parsed it). MUST live above the loading early-returns (hooks rule).
    useEffect(() => {
        if (!crewSlug || !dbUser?.user_id) return;
        let cancelled = false;
        getCrewInviteInfoAction({ slug: crewSlug, actorTelegramUserId: dbUser.user_id })
            .then((res) => { if (!cancelled) setInviteInfo(res.success ? res : null); })
            .catch(() => setInviteInfo(null));
        return () => { cancelled = true; };
    }, [crewSlug, dbUser?.user_id]);

    // Current user's effective role in this crew
    const myCrewRole: CrewRole | null = (() => {
        if (!dbUser?.user_id || !crew?.id) return null;
        // Check owner field (JSON: { user_id, username, avatar_url })
        if (crew.owner?.user_id === dbUser.user_id) return 'owner';
        const membership = userCrewMemberships.find((m) => m.crewId === crew.id);
        return (membership?.role as CrewRole) || null;
    })();

    // Mirror of the server-side matrix: you manage only ranks strictly below you.
    const canManageMember = (member: CrewMember) => {
        if (!myCrewRole || !dbUser?.user_id) return false;
        if (member.user_id === dbUser.user_id) return false;
        return roleRank(member.role) < roleRank(myCrewRole);
    };

    const myAssignableRoles: AssignableRole[] = myCrewRole ? assignableRolesFor(myCrewRole) : [];

    const handleRoleChange = async (member: CrewMember, newRole: AssignableRole) => {
        if (!dbUser?.user_id || newRole === member.role) return;
        if (roleRank(newRole) < roleRank(member.role)) {
            const ok = confirm(`Понизить @${member.username} до «${roleLabel(newRole)}»?`);
            if (!ok) return;
        }
        setBusyId(member.user_id);
        try {
            const result = await updateCrewMemberRole({
                crewSlug,
                targetUserId: member.user_id,
                newRole,
                actorTelegramUserId: dbUser.user_id,
            });
            if (result.success) {
                toast.success(`Роль @${member.username} обновлена: ${roleLabel(newRole)}`);
                await refreshCrew();
            } else {
                toast.error(result.error);
            }
        } catch {
            toast.error("Ошибка при обновлении роли");
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <Loading variant="bike" text="Загрузка состава..." />;
    if (!crew) return <div className="text-center text-destructive font-bold text-4xl py-20">ЭКИПАЖ НЕ НАЙДЕН</div>;

    const members: CrewMember[] = crew.members || [];
    const onlineCount = members.filter((m) => m.live_status === 'online' || m.live_status === 'riding').length;
    const totalCount = members.length;

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'owner': return <Crown className="h-3.5 w-3.5 text-yellow-500" />;
            case 'co_owner': return <Shield className="h-3.5 w-3.5 text-blue-400" />;
            case 'admin': return <UserCog className="h-3.5 w-3.5 text-purple-400" />;
            case 'mechanic': return <Wrench className="h-3.5 w-3.5 text-orange-400" />;
            default: return null;
        }
    };

    const getStatusLabel = (status: LiveStatus) => {
        switch (status) {
            case 'online': return 'НА СМЕНЕ';
            case 'riding': return 'В ПОЕЗДКЕ';
            case 'offline': return 'НЕ В СЕТИ';
            default: return 'НЕИЗВЕСТНО';
        }
    };

    const getStatusColor = (status: LiveStatus) => {
        switch (status) {
            case 'online': return '#22c55e';
            case 'riding': return T.accent;
            default: return T.textFaint;
        }
    };

    // Invite link — built from the server-resolved inviteInfo (see effect above).
    const inviteUrl = inviteInfo?.success
        ? (inviteInfo.botUsername
            ? `https://t.me/${inviteInfo.botUsername}/app?startapp=${inviteInfo.startParam}`
            : inviteInfo.webFallbackUrl)
        : "";
    const shareInviteUrl = typeof window !== "undefined" && inviteUrl
        ? `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent("Присоединяйся к нашему экипажу в VIP Bike!")}`
        : "";

    const handleShareInvite = () => {
        if (typeof window === "undefined" || !shareInviteUrl) {
            toast.error("Ссылка-приглашение ещё не готова");
            return;
        }
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openLink) tg.openLink(shareInviteUrl);
        else window.open(shareInviteUrl, "_blank");
    };

    // Platform-admin-only: transfer crew ownership to an existing member
    // (dummy-crew onboarding: invite as member → promote later).
    const handlePromoteOwner = async (userId: string, name: string) => {
        if (!dbUser?.user_id) return;
        if (!confirm(`Назначить ${name} владельцем экипажа?\n\nТекущий владелец (если есть) станет совладельцем.`)) return;
        setBusyId(userId);
        try {
            const res = await promoteCrewMemberToOwnerAction({
                crewSlug,
                targetUserId: userId,
                actorTelegramUserId: dbUser.user_id,
            });
            if (res.success) {
                toast.success(`${name} теперь владелец экипажа 👑`);
                await refreshCrew();
            } else {
                toast.error(res.error || "Не удалось назначить владельца");
            }
        } catch (e) {
            toast.error("Ошибка: " + (e instanceof Error ? e.message : "unknown"));
        } finally {
            setBusyId(null);
        }
    };

    const handleRemoveMember = async (userId: string, name: string) => {
        if (!confirm(`Удалить ${name} из экипажа?\n\nУчастник потеряет доступ к экипажу.`)) return;
        setBusyId(userId);
        try {
            // Use the existing shifts API with a custom action
            const res = await fetch(`/api/crew/shifts`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: crewSlug, removeMember: true, userId }),
            });
            if (res.ok) {
                toast.success(`${name} удалён из экипажа`);
                await refreshCrew();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || "Не удалось удалить участника");
            }
        } catch (e) {
            toast.error("Ошибка: " + (e instanceof Error ? e.message : "unknown"));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-3 sm:space-y-5">
            {/* Header — mobile-first: title row always keeps its width, the
                counter + invite pill wrap below it (overlap-proof at any
                viewport). Single row from sm up. */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2.5">
                <Link
                    href={`/franchize/${crewSlug}/crew`}
                    aria-label="Назад к управлению экипажем"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-opacity hover:opacity-80"
                    style={T.styles.ctaSecondary}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="w-[calc(100%-2.625rem)] min-w-0 sm:w-auto sm:flex-1">
                    <h1
                        className="text-lg font-bold uppercase leading-tight tracking-tight sm:text-2xl"
                        style={{ color: T.text }}
                    >
                        Состав экипажа
                    </h1>
                    <p className="mt-0.5 truncate text-xs sm:text-sm" style={{ color: T.textMuted }}>
                        {crew.name}
                    </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <span
                        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: T.accentSoft, color: T.accent }}
                    >
                        <span
                            className={cn("h-1.5 w-1.5 rounded-full", onlineCount > 0 && "animate-pulse")}
                            style={{ backgroundColor: onlineCount > 0 ? '#22c55e' : T.textFaint }}
                        />
                        {onlineCount}/{totalCount} на смене
                    </span>
                    <button
                        type="button"
                        onClick={handleShareInvite}
                        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-opacity hover:opacity-90"
                        style={T.styles.ctaPrimary}
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        Пригласить
                    </button>
                </div>
            </div>

            {/* Members List */}
            <div className="space-y-2">
                {members.map((member) => {
                    const isBusy = busyId === member.user_id;
                    const manageable = canManageMember(member);
                    const showRoleSelect = manageable && myAssignableRoles.length > 0;
                    const canRemove = (myCrewRole === 'owner' || myCrewRole === 'co_owner') && member.role !== 'owner';
                    const canPromote = isPlatformAdmin && member.role !== 'owner';
                    const statusColor = getStatusColor(member.live_status);
                    const isOnline = member.live_status === 'online' || member.live_status === 'riding';

                    return (
                        <FranchizeOperatorPanel key={member.user_id} className="transition-opacity hover:opacity-[0.97]">
                            <div className="flex items-center gap-3">
                                {/* Avatar with live dot */}
                                <div className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
                                    <div
                                        className="h-full w-full overflow-hidden rounded-full border"
                                        style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
                                    >
                                        {member.avatar_url ? (
                                            <Image
                                                src={member.avatar_url}
                                                alt={member.username}
                                                fill
                                                sizes="44px"
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div
                                                className="flex h-full w-full items-center justify-center text-sm font-bold"
                                                style={{ color: T.textMuted }}
                                            >
                                                {member.username?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2",
                                            member.live_status === 'riding' && "animate-pulse"
                                        )}
                                        style={{ backgroundColor: statusColor, borderColor: T.bgCard }}
                                    />
                                </div>

                                {/* Identity — truncate everywhere, never overlaps */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <span
                                            className="truncate text-sm font-bold uppercase tracking-tight sm:text-[15px]"
                                            style={{ color: T.text }}
                                        >
                                            @{member.username}
                                        </span>
                                        <span className="shrink-0">{getRoleIcon(member.role)}</span>
                                    </div>
                                    <p
                                        className="mt-0.5 truncate text-[10px] uppercase tracking-wider sm:text-[11px]"
                                        style={{ color: T.textMuted }}
                                    >
                                        {roleLabel(member.role)}
                                    </p>
                                </div>

                                {/* Live status chip — own flex slot, shrink-0 */}
                                <span
                                    className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[9px] font-semibold uppercase tracking-wide"
                                    style={{
                                        borderColor: isOnline ? statusColor : T.borderSoft,
                                        color: isOnline ? statusColor : T.textMuted,
                                        backgroundColor: isOnline ? 'transparent' : T.bgElevated,
                                    }}
                                >
                                    <span
                                        className={cn("h-1.5 w-1.5 rounded-full", member.live_status === 'riding' && "animate-pulse")}
                                        style={{ backgroundColor: statusColor }}
                                    />
                                    {getStatusLabel(member.live_status)}
                                </span>

                                {/* CID (desktop only) */}
                                <span
                                    className="hidden shrink-0 font-mono text-[9px] uppercase sm:block"
                                    style={{ color: T.textFaint }}
                                >
                                    {member.user_id?.slice(0, 8)}
                                </span>
                            </div>

                            {/* Management row — separate row on mobile (select is
                                full-width, buttons share the second line), inline
                                right-aligned from sm up. */}
                            {(showRoleSelect || canRemove || canPromote) && (
                                <div
                                    className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 sm:justify-end"
                                    style={{ borderColor: T.borderSoft }}
                                >
                                    {showRoleSelect && (
                                        <Select
                                            value={member.role}
                                            disabled={isBusy}
                                            onValueChange={(v) => handleRoleChange(member, v as AssignableRole)}
                                        >
                                            <SelectTrigger
                                                className="h-8 w-full text-[11px] uppercase tracking-wide sm:w-[150px]"
                                                aria-label={`Роль @${member.username}`}
                                                style={{ backgroundColor: T.bg, borderColor: T.border, color: T.text }}
                                            >
                                                <SelectValue placeholder="Роль" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* current role always visible in the list */}
                                                {[...new Set([member.role as string, ...myAssignableRoles] as string[])]
                                                    .sort((a, b) => roleRank(b) - roleRank(a))
                                                    .map((r) => (
                                                        <SelectItem key={r} value={r}>
                                                            {roleLabel(r)}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {canRemove && (
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleRemoveMember(member.user_id, member.username || member.user_id)}
                                            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-40 sm:flex-none"
                                            style={{ ...T.styles.dangerBadge, borderColor: '#ef444455' }}
                                            aria-label="Удалить из экипажа"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Удалить
                                        </button>
                                    )}
                                    {canPromote && (
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handlePromoteOwner(member.user_id, member.username || member.user_id)}
                                            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[10px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-40 sm:flex-none"
                                            style={{ borderColor: `${T.accent}55`, color: T.accent, backgroundColor: 'transparent' }}
                                            aria-label="Назначить владельцем"
                                        >
                                            <Crown className="h-3 w-3" />
                                            Сделать владельцем
                                        </button>
                                    )}
                                </div>
                            )}
                        </FranchizeOperatorPanel>
                    );
                })}
            </div>

            {members.length === 0 && (
                <FranchizeOperatorPanel className="py-8 text-center">
                    <Users className="mx-auto h-8 w-8" style={{ color: T.textFaint }} />
                    <p className="mt-3 text-sm" style={{ color: T.textMuted }}>Участники не найдены.</p>
                </FranchizeOperatorPanel>
            )}
        </div>
    );
}
