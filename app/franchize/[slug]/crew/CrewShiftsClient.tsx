"use client";

import React, { useEffect, useState } from 'react';
import { supabaseAdmin } from '@/lib/supabase-server';
import { Loading } from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import Link from "next/link";
import { Clock, Users, ArrowLeft, Play, Stop, Loader2 } from "lucide-react";
import { cn } from '@/lib/utils';
import { toast } from "sonner";

interface ShiftMember {
    user_id: string;
    username: string;
    avatar_url?: string;
    live_status: 'online' | 'riding' | 'offline';
}

interface ActiveShift {
    id: string;
    member_id: string;
    clock_in_time: string;
    clock_out_time?: string;
    shift_type: string;
    member?: ShiftMember;
}

export function FranchizeCrewShiftsClient({ crewSlug }: { crewSlug: string }) {
    const { dbUser, userCrewInfo } = useAppContext();
    const [shifts, setShifts] = useState<ActiveShift[]>([]);
    const [loading, setLoading] = useState(true);
    const [endingShift, setEndingShift] = useState<string | null>(null);

    const isCrewOwner = userCrewInfo?.is_owner && userCrewInfo?.slug === crewSlug;

    useEffect(() => {
        loadShifts();
        // Refresh shifts every 10 seconds
        const interval = setInterval(loadShifts, 10000);
        return () => clearInterval(interval);
    }, [crewSlug]);

    const loadShifts = async () => {
        if (!crewSlug) return;

        try {
            // Get crew ID from slug
            const { data: crew } = await supabaseAdmin
                .from('crews')
                .select('id')
                .eq('slug', crewSlug)
                .single();

            if (!crew) return;

            // Get active shifts (no clock_out_time)
            const { data: activeShifts } = await supabaseAdmin
                .from('crew_member_shifts')
                .select('*')
                .eq('crew_id', crew.id)
                .is('clock_out_time', null)
                .order('clock_in_time', { ascending: false });

            if (activeShifts) {
                // Enrich with member info
                const enriched = await Promise.all(
                    activeShifts.map(async (shift) => {
                        const { data: memberData } = await supabaseAdmin
                            .from('users')
                            .select('id, username, avatar_url')
                            .eq('id', shift.member_id)
                            .single();

                        const { data: crewMemberData } = await supabaseAdmin
                            .from('crew_members')
                            .select('live_status')
                            .eq('crew_id', crew.id)
                            .eq('user_id', shift.member_id)
                            .single();

                        return {
                            ...shift,
                            member: memberData ? {
                                user_id: memberData.id,
                                username: memberData.username || 'Unknown',
                                avatar_url: memberData.avatar_url,
                                live_status: crewMemberData?.live_status || 'offline'
                            } : undefined
                        };
                    })
                );
                setShifts(enriched);
            }
            setLoading(false);
        } catch (error) {
            console.error('Failed to load shifts:', error);
            setLoading(false);
        }
    };

    const handleEndShift = async (shiftId: string) => {
        if (!isCrewOwner) {
            toast.error("Only crew owners can end shifts");
            return;
        }

        setEndingShift(shiftId);
        try {
            const response = await fetch('/api/crew/shifts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shiftId, slug: crewSlug })
            });

            if (response.ok) {
                toast.success("Shift ended successfully");
                loadShifts();
            } else {
                const error = await response.json();
                toast.error(error.error || "Failed to end shift");
            }
        } catch (error) {
            toast.error("Failed to end shift");
        } finally {
            setEndingShift(null);
        }
    };

    const formatDuration = (startTime: string) => {
        const start = new Date(startTime);
        const now = new Date();
        const diff = now.getTime() - start.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    };

    if (loading) return <Loading variant="bike" text="LOADING SHIFTS..." />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/franchize/${crewSlug}/crew`}>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold uppercase tracking-tight">Shift Management</h1>
                    <p className="text-muted-foreground text-sm">Active shifts and crew status</p>
                </div>
                <Badge variant="outline" className={cn(
                    shifts.length > 0 ? "" : "text-muted-foreground"
                )}>
                    {shifts.length} Active
                </Badge>
            </div>

            {/* Active Shifts */}
            {shifts.length > 0 ? (
                <div className="space-y-3">
                    {shifts.map((shift) => (
                        <Card key={shift.id} className="hover:border-primary transition-colors">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    {/* Status Indicator */}
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                                        <div className="text-[9px] text-muted-foreground uppercase">Active</div>
                                    </div>

                                    {/* Member Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold uppercase">
                                                @{shift.member?.username || 'Unknown'}
                                            </span>
                                            <Badge variant="outline" className="text-[9px]">
                                                {shift.shift_type}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Play className="h-3 w-3" />
                                                {new Date(shift.clock_in_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDuration(shift.clock_in_time)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {isCrewOwner && (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleEndShift(shift.id)}
                                            disabled={endingShift === shift.id}
                                            className="h-8 text-xs"
                                        >
                                            {endingShift === shift.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <>
                                                    <Stop className="h-3 w-3 mr-1" />
                                                    End
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No active shifts right now.</p>
                        <p className="text-muted-foreground/70 text-sm mt-2">Crew members can start shifts from their controls.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
