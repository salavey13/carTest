"use client";

import React, { useEffect, useState } from 'react';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import Link from "next/link";
import { Users, Crown, Shield, ArrowLeft, UserCog, ChevronUp } from "lucide-react";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateCrewMemberRole } from '../../server-actions/update-crew-member-role';

type LiveStatus = 'online' | 'riding' | 'offline';

interface CrewMember {
    user_id: string;
    username: string;
    avatar_url?: string;
    role: 'owner' | 'co_owner' | 'admin' | 'mechanic' | 'member';
    live_status: LiveStatus;
    membership_status: 'active' | 'pending';
}

export function FranchizeCrewMembersClient({ crewSlug }: { crewSlug: string }) {
    const { dbUser, userCrewMemberships } = useAppContext();
    const [crew, setCrew] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [promotingId, setPromotingId] = useState<string | null>(null);

    useEffect(() => {
        if (!crewSlug) return;
        getCrewLiveDetails(crewSlug).then(res => {
            if (res.success) setCrew(res.data);
            setLoading(false);
        });
    }, [crewSlug]);

    // Current user's effective role in this crew
    const myCrewRole: string | null = (() => {
        if (!dbUser?.user_id || !crew?.id) return null;
        // Check owner field (JSON: { user_id, username, avatar_url })
        if (crew.owner?.user_id === dbUser.user_id) return 'owner';
        const membership = userCrewMemberships.find((m) => m.crewId === crew.id);
        return membership?.role || null;
    })();

    const canPromoteToAdmin = (member: CrewMember) => {
        if (!myCrewRole) return false;
        if (myCrewRole === 'owner') return member.role === 'member' || member.role === 'mechanic';
        if (myCrewRole === 'co_owner') return member.role === 'member' || member.role === 'mechanic';
        return false;
    };

    const canPromoteToCoOwner = (member: CrewMember) => {
        if (!myCrewRole) return false;
        return myCrewRole === 'owner' && member.role === 'admin';
    };

    const handlePromote = async (member: CrewMember, newRole: 'admin' | 'co_owner') => {
        if (!dbUser?.user_id) {
            toast.error("Нужна авторизация");
            return;
        }
        setPromotingId(member.user_id);
        try {
            const result = await updateCrewMemberRole({
                crewSlug,
                targetUserId: member.user_id,
                newRole,
                actorTelegramUserId: dbUser.user_id,
            });
            if (result.success) {
                toast.success(`@${member.username} повышен до ${newRole === 'co_owner' ? 'совладельца' : 'администратора'}`);
                // Refresh crew data
                const res = await getCrewLiveDetails(crewSlug);
                if (res.success) setCrew(res.data);
            } else {
                toast.error(result.error);
            }
        } catch {
            toast.error("Ошибка при повышении");
        } finally {
            setPromotingId(null);
        }
    };

    if (loading) return <Loading variant="bike" text="Загрузка состава..." />;
    if (!crew) return <div className="text-center text-destructive font-bold text-4xl py-20">ЭКИПАЖ НЕ НАЙДЕН</div>;

    const members = crew.members || [];
    const onlineCount = members.filter((m: CrewMember) => m.live_status === 'online' || m.live_status === 'riding').length;
    const totalCount = members.length;

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />;
            case 'co_owner': return <Shield className="h-4 w-4 text-blue-400" />;
            case 'admin': return <UserCog className="h-4 w-4 text-purple-400" />;
            default: return null;
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'owner': return 'Владелец';
            case 'co_owner': return 'Совладелец';
            case 'admin': return 'Администратор';
            case 'mechanic': return 'Механик';
            case 'member': return 'Участник';
            default: return role;
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
            case 'online': return 'bg-green-500';
            case 'riding': return 'bg-primary';
            case 'offline': return 'bg-muted';
            default: return 'bg-muted-foreground';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/franchize/${crewSlug}/crew`}>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold uppercase tracking-tight">Состав экипажа</h1>
                    <p className="text-muted-foreground text-sm">{crew.name}</p>
                </div>
                <Badge variant="outline">
                    {onlineCount} / {totalCount} На смене
                </Badge>
            </div>

            {/* Members List */}
            <div className="space-y-2">
                {members.map((member: CrewMember) => {
                    const isPromoting = promotingId === member.user_id;
                    const showPromoteToAdmin = canPromoteToAdmin(member);
                    const showPromoteToCoOwner = canPromoteToCoOwner(member);

                    return (
                        <Card key={member.user_id} className="hover:border-primary transition-colors">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    {/* Avatar with status */}
                                    <div className="relative">
                                        <div className="w-12 h-12 bg-muted border overflow-hidden shrink-0 rounded-full">
                                            {member.avatar_url ? (
                                                <Image
                                                    src={member.avatar_url}
                                                    alt={member.username}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold">
                                                    {member.username?.[0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                        </div>
                                        <div className={cn(
                                            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
                                            getStatusColor(member.live_status)
                                        )} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold uppercase truncate">
                                                @{member.username}
                                            </span>
                                            {getRoleIcon(member.role)}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            <span className="uppercase">{getRoleLabel(member.role)}</span>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[9px] px-1.5 py-0",
                                                    member.live_status === 'online' || member.live_status === 'riding'
                                                        ? "border-green-500 text-green-500"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {getStatusLabel(member.live_status)}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* CID */}
                                    <div className="text-[9px] text-muted-foreground font-mono hidden sm:block">
                                        {member.user_id?.slice(0, 8).toUpperCase()}
                                    </div>

                                    {/* Promote actions */}
                                    {(showPromoteToAdmin || showPromoteToCoOwner) && (
                                        <div className="flex gap-1 shrink-0">
                                            {showPromoteToAdmin && (
                                                <button
                                                    type="button"
                                                    disabled={isPromoting}
                                                    onClick={() => handlePromote(member, 'admin')}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-400 transition-colors hover:bg-purple-500/10 disabled:opacity-40"
                                                >
                                                    <ChevronUp className="h-3 w-3" />
                                                    Admin
                                                </button>
                                            )}
                                            {showPromoteToCoOwner && (
                                                <button
                                                    type="button"
                                                    disabled={isPromoting}
                                                    onClick={() => handlePromote(member, 'co_owner')}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-400 transition-colors hover:bg-blue-500/10 disabled:opacity-40"
                                                >
                                                    <ChevronUp className="h-3 w-3" />
                                                    Co-Owner
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {members.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Участники не найдены.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
