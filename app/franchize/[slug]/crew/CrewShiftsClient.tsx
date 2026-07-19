"use client";

import React, { useEffect, useState } from 'react';
import { Loading } from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import Link from "next/link";
import { Clock, Users, ArrowLeft, Play, Square, Loader2 } from "lucide-react";
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
    const { dbUser, userCrewMemberships } = useAppContext();
    const [shifts, setShifts] = useState<ActiveShift[]>([]);
    const [loading, setLoading] = useState(true);
    const [endingShift, setEndingShift] = useState<string | null>(null);

    const isCrewAdmin = userCrewMemberships.some(
      (m) => m.slug === crewSlug && ["owner", "admin", "co_owner"].includes(m.role)
    );

    useEffect(() => {
        loadShifts();
        // Refresh shifts every 10 seconds
        const interval = setInterval(loadShifts, 10000);
        return () => clearInterval(interval);
    }, [crewSlug]);

    const loadShifts = async () => {
        if (!crewSlug) return;

        try {
            const response = await fetch(`/api/crew/shifts?slug=${encodeURIComponent(crewSlug)}`);
            if (!response.ok) {
                console.error('Failed to load shifts:', await response.text());
                setLoading(false);
                return;
            }
            const data = await response.json();
            if (data?.shifts) {
                setShifts(data.shifts);
            }
            setLoading(false);
        } catch (error) {
            console.error('Failed to load shifts:', error);
            setLoading(false);
        }
    };

    const handleEndShift = async (shiftId: string) => {
        if (!isCrewAdmin) {
            toast.error("Только администратор экипажа может завершить смену");
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
                toast.success("Смена завершена");
                loadShifts();
            } else {
                const error = await response.json();
                toast.error(error.error || "Ошибка завершения смены");
            }
        } catch (error) {
            toast.error("Ошибка завершения смены");
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
        return `${hours}ч ${minutes}м`;
    };

    if (loading) return <Loading variant="bike" text="Загрузка смен..." />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/franchize/${crewSlug}/crew`}>
                    <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold uppercase tracking-tight">Смены</h1>
                    <p className="text-muted-foreground text-sm">Активные смены и статус экипажа</p>
                </div>
                <Badge variant="outline" className={cn(
                    shifts.length > 0 ? "" : "text-muted-foreground"
                )}>
                    {shifts.length} Активных
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
                                        <div className="text-[9px] text-muted-foreground uppercase">Активна</div>
                                    </div>

                                    {/* Member Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold uppercase">
                                                @{shift.member?.username || 'Неизвестно'}
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
                                    {isCrewAdmin && (
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
                                                    <Square className="h-3 w-3 mr-1" />
                                                    Завершить
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
                        <p className="text-muted-foreground">Нет активных смен.</p>
                        <p className="text-muted-foreground/70 text-sm mt-2">Участники могут начать смену из своих элементов управления.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
