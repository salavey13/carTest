"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loading } from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import Link from "next/link";
import { Clock, Users, ArrowLeft, Play, Square, Loader2, Timer, Activity } from "lucide-react";
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
    const [startingShift, setStartingShift] = useState(false);
    const [elapsedSec, setElapsedSec] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const isCrewAdmin = userCrewMemberships.some(
      (m) => m.slug === crewSlug && ["owner", "admin", "co_owner"].includes(m.role)
    );

    const myActiveShift = shifts.find((s) => s.member_id === dbUser?.user_id);

    useEffect(() => {
        loadShifts();
        const interval = setInterval(loadShifts, 10000);
        return () => clearInterval(interval);
    }, [crewSlug]);

    // Timer for my active shift
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (myActiveShift?.clock_in_time) {
            const startTs = Date.parse(myActiveShift.clock_in_time);
            timerRef.current = setInterval(() => {
                setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
            }, 1000);
            setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
        } else {
            setElapsedSec(0);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [myActiveShift?.clock_in_time]);

    const formatElapsed = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

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
            if (data?.shifts) setShifts(data.shifts);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load shifts:', error);
            setLoading(false);
        }
    };

    const handleStartShift = async () => {
        if (!dbUser?.user_id) {
            toast.error("Нужна авторизация");
            return;
        }
        if (myActiveShift) {
            toast.error("У вас уже есть активная смена");
            return;
        }
        setStartingShift(true);
        try {
            const response = await fetch('/api/crew/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: crewSlug, memberId: dbUser.user_id, shiftType: 'default' }),
            });
            const data = await response.json();
            if (response.ok) {
                toast.success("Смена начата!");
                loadShifts();
            } else {
                toast.error(data.error || "Ошибка начала смены");
            }
        } catch {
            toast.error("Ошибка связи");
        } finally {
            setStartingShift(false);
        }
    };

    const handleEndMyShift = async () => {
        if (!myActiveShift) return;
        setEndingShift(myActiveShift.id);
        try {
            const response = await fetch('/api/crew/shifts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shiftId: myActiveShift.id, slug: crewSlug }),
            });
            if (response.ok) {
                toast.success("Смена завершена");
                loadShifts();
            } else {
                const error = await response.json();
                toast.error(error.error || "Ошибка завершения смены");
            }
        } catch {
            toast.error("Ошибка завершения смены");
        } finally {
            setEndingShift(null);
        }
    };

    const handleEndShift = async (shiftId: string) => {
        if (!isCrewAdmin) {
            toast.error("Только администратор экипажа может завершить чужую смену");
            return;
        }
        setEndingShift(shiftId);
        try {
            const response = await fetch('/api/crew/shifts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shiftId, slug: crewSlug }),
            });
            if (response.ok) {
                toast.success("Смена завершена");
                loadShifts();
            } else {
                const error = await response.json();
                toast.error(error.error || "Ошибка завершения смены");
            }
        } catch {
            toast.error("Ошибка завершения смены");
        } finally {
            setEndingShift(null);
        }
    };

    const formatDuration = (startTime: string) => {
        const start = new Date(startTime);
        const diff = Date.now() - start.getTime();
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

            {/* ── My Shift Control Panel ── */}
            <Card className={cn(
                "border-2 overflow-hidden transition-colors",
                myActiveShift ? "border-green-500/50" : "border-muted"
            )}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "w-2 h-10 rounded-full",
                                myActiveShift ? "bg-green-500 animate-pulse" : "bg-muted"
                            )} />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                                    {myActiveShift ? "Текущая смена" : "Нет активной смены"}
                                </span>
                                <span className="text-2xl font-mono font-bold tracking-tighter">
                                    {myActiveShift ? formatElapsed(elapsedSec) : "— : — : —"}
                                </span>
                            </div>
                        </div>

                        {dbUser?.user_id && (
                            myActiveShift ? (
                                <Button
                                    onClick={handleEndMyShift}
                                    disabled={endingShift === myActiveShift.id}
                                    variant="destructive"
                                    className="h-11 px-5 font-bold uppercase text-xs tracking-widest"
                                >
                                    {endingShift === myActiveShift.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <><Square className="h-4 w-4 mr-1.5" /> Завершить</>
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleStartShift}
                                    disabled={startingShift}
                                    variant="default"
                                    className="h-11 px-5 font-bold uppercase text-xs tracking-widest"
                                >
                                    {startingShift ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <><Play className="h-4 w-4 mr-1.5" /> Начать</>
                                    )}
                                </Button>
                            )
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── All Active Shifts ── */}
            <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Активные смены экипажа
                </h2>
                {shifts.length > 0 ? (
                    <div className="space-y-2">
                        {shifts.map((shift) => {
                            const isMine = shift.member_id === dbUser?.user_id;
                            return (
                                <Card key={shift.id} className={cn(
                                    "transition-colors",
                                    isMine ? "border-green-500/30" : "hover:border-primary"
                                )}>
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-3">
                                            {/* Status */}
                                            <div className="flex flex-col items-center gap-0.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                                <Activity className="h-3 w-3 text-green-500" />
                                            </div>

                                            {/* Member Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm truncate">
                                                        @{shift.member?.username || 'Неизвестно'}
                                                    </span>
                                                    {isMine && (
                                                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                                            Я
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                                        {shift.shift_type}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Timer className="h-3 w-3" />
                                                        {new Date(shift.clock_in_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDuration(shift.clock_in_time)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Admin: end another's shift */}
                                            {isCrewAdmin && !isMine && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEndShift(shift.id)}
                                                    disabled={endingShift === shift.id}
                                                    className="h-7 text-[10px] px-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                                                >
                                                    {endingShift === shift.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        "Завершить"
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Нет активных смен.</p>
                            <p className="text-muted-foreground/70 text-sm mt-2">
                                Нажми «Начать» чтобы открыть смену.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
