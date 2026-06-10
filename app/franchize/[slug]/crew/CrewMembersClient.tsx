"use client";

import React, { useEffect, useState } from 'react';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import Link from "next/link";
import { Users, Crown, Shield, ArrowLeft, Circle } from "lucide-react";
import { cn } from '@/lib/utils';

type LiveStatus = 'online' | 'riding' | 'offline';

interface CrewMember {
    user_id: string;
    username: string;
    avatar_url?: string;
    role: 'owner' | 'co_owner' | 'mechanic' | 'member';
    live_status: LiveStatus;
    membership_status: 'active' | 'pending';
}

export function FranchizeCrewMembersClient({ crewSlug }: { crewSlug: string }) {
    const [crew, setCrew] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!crewSlug) return;
        getCrewLiveDetails(crewSlug).then(res => {
            if (res.success) setCrew(res.data);
            setLoading(false);
        });
    }, [crewSlug]);

    if (loading) return <Loading variant="bike" text="LOADING ROSTER..." />;
    if (!crew) return <div className="text-center text-destructive font-bold text-4xl py-20">CREW NOT FOUND</div>;

    const members = crew.members || [];
    const onlineCount = members.filter((m: CrewMember) => m.live_status === 'online' || m.live_status === 'riding').length;
    const totalCount = members.length;

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'owner': return <Crown className="h-4 w-4 text-primary" />;
            case 'co_owner': return <Shield className="h-4 w-4" />;
            default: return null;
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

    const getStatusLabel = (status: LiveStatus) => {
        switch (status) {
            case 'online': return 'ON_SHIFT';
            case 'riding': return 'RIDING';
            case 'offline': return 'OFFLINE';
            default: return 'UNKNOWN';
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
                    <h1 className="text-2xl font-bold uppercase tracking-tight">Unit Roster</h1>
                    <p className="text-muted-foreground text-sm">{crew.name}</p>
                </div>
                <Badge variant="outline">
                    {onlineCount} / {totalCount} Active
                </Badge>
            </div>

            {/* Members List */}
            <div className="space-y-2">
                {members.map((member: CrewMember) => (
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
                                        <span className="uppercase">Role: {member.role}</span>
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
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {members.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No crew members found.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
