"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Users,
  ArrowLeft,
  Play,
  Square,
  Loader2,
  Timer,
  Activity,
  Coffee,
  History,
  TrendingUp,
  Calendar,
  DollarSign,
  Pause,
  PlayCircle,
  FileText,
  BarChart3,
} from "lucide-react";
import { useAppContext } from '@/contexts/AppContext';
import Link from "next/link";
import { toast } from "sonner";
import { cn } from '@/lib/utils';
import {
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
} from "../../components/FranchizeOperatorSurface";
import { useFranchizeTheme } from "../../hooks/useFranchizeTheme";
import { useCrewTokens } from "../../lib/use-crew-tokens";
import { fallbackCrew } from "../../lib/fallback-crew";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ShiftMember {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  live_status: 'online' | 'riding' | 'offline';
  hourly_rate?: number;
}

interface ActiveShift {
  id: string;
  member_id: string;
  clock_in_time: string;
  clock_out_time?: string;
  shift_type: string;
  hourly_rate?: number;
  salary_amount?: number;
  notes?: string;
  duration_minutes?: number;
  break_duration_minutes?: number;
  member?: ShiftMember;
}

interface ShiftHistory {
  id: string;
  clock_in_time: string;
  clock_out_time: string;
  duration_minutes: number;
  salary_amount: number;
  hourly_rate: number;
  notes?: string;
}

interface MemberStats {
  total_shifts: number;
  total_hours: number;
  total_earnings: number;
  avg_daily_hours: number;
}

export function FranchizeCrewShiftsClient({ crewSlug, crew }: { crewSlug: string; crew?: any }) {
  const { dbUser, userCrewMemberships } = useAppContext();

  useFranchizeTheme(crew?.theme || fallbackCrew.theme);
  const T = useCrewTokens(crew?.theme || fallbackCrew.theme);

  const [shifts, setShifts] = useState<ActiveShift[]>([]);
  const [shiftHistory, setShiftHistory] = useState<ShiftHistory[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [endingShift, setEndingShift] = useState<string | null>(null);
  const [startingShift, setStartingShift] = useState(false);
  const [takingBreak, setTakingBreak] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [newHourlyRate, setNewHourlyRate] = useState("");
  const [updatingRate, setUpdatingRate] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isCrewAdmin = userCrewMemberships.some(
    (m) => m.slug === crewSlug && ["owner", "admin", "co_owner"].includes(m.role)
  );

  const myActiveShift = shifts.find((s) => s.member_id === dbUser?.user_id);
  const myMemberInfo = myActiveShift?.member;

  useEffect(() => {
    loadShifts();
    // Poll every 5 seconds for better consistency with bot commands
    const interval = setInterval(loadShifts, 5000);
    return () => clearInterval(interval);
  }, [crewSlug]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}ч ${minutes}м`;
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
      if (data?.shifts) {
        setShifts(data.shifts);
        // Load member stats for current user
        if (dbUser?.user_id) {
          loadMemberStats(dbUser.user_id);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load shifts:', error);
      setLoading(false);
    }
  };

  const loadMemberStats = async (userId: string) => {
    try {
      const response = await fetch(`/api/crew/shifts/stats?slug=${encodeURIComponent(crewSlug)}&userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setMemberStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadShiftHistory = async () => {
    if (!dbUser?.user_id) return;
    try {
      const response = await fetch(
        `/api/crew/shifts/history?slug=${encodeURIComponent(crewSlug)}&userId=${dbUser.user_id}`
      );
      if (response.ok) {
        const data = await response.json();
        setShiftHistory(data.shifts || []);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleStartShift = async () => {
    if (!dbUser?.user_id) {
      toast.error("Нужна авторизация");
      return;
    }
    if (myActiveShift) {
      toast.error("У вас уже есть активная сменa");
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
      const data = await response.json();
      if (response.ok) {
        if (data.alreadyClosed) {
          toast.info(data.message || "Смена уже была завершена");
        } else {
          toast.success("Смена завершена");
        }
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

  const handleTakeBreak = async () => {
    if (!myActiveShift) return;
    setTakingBreak(true);
    try {
      // TODO: Implement break API
      toast.success("Перерыв начат");
    } catch {
      toast.error("Ошибка");
    } finally {
      setTakingBreak(false);
    }
  };

  const handleUpdateHourlyRate = async () => {
    const rate = Number(newHourlyRate);
    if (isNaN(rate) || rate < 0) {
      toast.error("Некорректная ставка");
      return;
    }
    setUpdatingRate(true);
    try {
      const response = await fetch('/api/crew/shifts/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: crewSlug, memberId: dbUser?.user_id, hourlyRate: rate }),
      });
      if (response.ok) {
        toast.success("Ставка обновлена");
        setShowRateDialog(false);
        loadShifts();
      } else {
        const error = await response.json();
        toast.error(error.error || "Ошибка обновления");
      }
    } catch {
      toast.error("Ошибка");
    } finally {
      setUpdatingRate(false);
    }
  };

  const handleOpenHistory = () => {
    setShowHistory(true);
    loadShiftHistory();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: T.accent }} />
      </div>
    );
  }

  // Calculate earnings for active shift
  const activeShiftEarnings = myActiveShift
    ? (elapsedSec / 3600) * (myActiveShift.hourly_rate || myMemberInfo?.hourly_rate || 169)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <FranchizeOperatorPanel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/franchize/${crewSlug}/crew`}>
              <ArrowLeft className="h-5 w-5 transition-colors flex-shrink-0" style={{ color: T.textMuted }} />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-semibold uppercase tracking-tight" style={{ color: T.text }}>
                Смены
              </h1>
              <p className="text-xs sm:text-sm truncate" style={{ color: T.textMuted }}>
                Активные смены и статус экипажа
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap"
              style={{ background: `${T.accent}20`, color: T.accent }}
            >
              {shifts.length} Активн.
            </span>
          </div>
        </div>
      </FranchizeOperatorPanel>

      {/* My Shift Control Panel */}
      <FranchizeOperatorPanel muted={!myActiveShift}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                myActiveShift ? "animate-pulse" : ""
              )}
              style={{
                backgroundColor: myActiveShift ? `${T.accent}30` : `${T.borderSoft}30`,
              }}
            >
              {myActiveShift ? (
                <Activity className="h-6 w-6" style={{ color: T.accent }} />
              ) : (
                <Clock className="h-6 w-6" style={{ color: T.textMuted }} />
              )}
            </div>

            <div>
              <p className="text-xs font-medium uppercase" style={{ color: T.textMuted }}>
                {myActiveShift ? "Текущая смена" : "Нет активной смены"}
              </p>
              <p className="text-2xl font-mono font-bold tracking-tighter" style={{ color: T.text }}>
                {myActiveShift ? formatElapsed(elapsedSec) : "— : — : —"}
              </p>
              {myActiveShift && (
                <p className="text-xs" style={{ color: T.textMuted }}>
                  Начало: {new Date(myActiveShift.clock_in_time).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>

          {dbUser?.user_id && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {myActiveShift ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleTakeBreak}
                    disabled={takingBreak}
                    variant="outline"
                    className="rounded-full"
                    style={{ borderColor: T.borderSoft }}
                  >
                    <Coffee className="mr-2 h-4 w-4" />
                    Перерыв
                  </Button>
                  <Button
                    onClick={handleEndMyShift}
                    disabled={endingShift === myActiveShift.id}
                    className="rounded-full font-semibold"
                    style={{ backgroundColor: "#ef4444", color: "white" }}
                  >
                    {endingShift === myActiveShift.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Завершить
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleStartShift}
                  disabled={startingShift}
                  className="rounded-full font-semibold"
                  style={{ backgroundColor: T.accent, color: T.accentContrast }}
                >
                  {startingShift ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Начать смену
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Active shift earnings preview */}
        {myActiveShift && (
          <div className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: T.borderSoft }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: T.textMuted }}>
              <DollarSign className="h-4 w-4" />
              <span>Предварительный заработок:</span>
            </div>
            <span className="font-mono text-sm font-semibold" style={{ color: T.accent }}>
              {formatCurrency(activeShiftEarnings)}
            </span>
          </div>
        )}
      </FranchizeOperatorPanel>

      {/* My Stats */}
      {memberStats && (
        <FranchizeOperatorPanel>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: T.accent }} />
            <h2 className="text-sm font-semibold" style={{ color: T.text }}>
              Моя статистика
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FranchizeOperatorStatCard
              label="Смен за месяц"
              value={String(memberStats.total_shifts)}
              icon={<Calendar className="h-4 w-4" style={{ color: T.accent }} />}
            />
            <FranchizeOperatorStatCard
              label="Часов"
              value={`${memberStats.total_hours.toFixed(1)}ч`}
              icon={<Clock className="h-4 w-4" style={{ color: "#22c55e" }} />}
            />
            <FranchizeOperatorStatCard
              label="Заработано"
              value={formatCurrency(memberStats.total_earnings)}
              icon={<DollarSign className="h-4 w-4" style={{ color: "#f59e0b" }} />}
            />
            <FranchizeOperatorStatCard
              label="Средне/день"
              value={`${memberStats.avg_daily_hours.toFixed(1)}ч`}
              icon={<TrendingUp className="h-4 w-4" style={{ color: "#3b82f6" }} />}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleOpenHistory}
              variant="ghost"
              size="sm"
              className="text-xs"
              style={{ color: T.accent }}
            >
              <History className="mr-1 h-3 w-3" />
              История смен
            </Button>
          </div>
        </FranchizeOperatorPanel>
      )}

      {/* Hourly Rate Settings */}
      {isCrewAdmin && (
        <FranchizeOperatorPanel>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${T.accent}20` }}>
                <DollarSign className="h-5 w-5" style={{ color: T.accent }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: T.text }}>
                  Моя часовая ставка
                </p>
                <p className="text-xs" style={{ color: T.textMuted }}>
                  Используется для расчёта зарплаты
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold" style={{ color: T.accent }}>
                {formatCurrency(myMemberInfo?.hourly_rate || 169)}
                <span className="text-xs font-normal" style={{ color: T.textMuted }}> /ч</span>
              </span>
              <Button
                onClick={() => setShowRateDialog(true)}
                variant="outline"
                size="sm"
                className="rounded-full"
                style={{ borderColor: T.borderSoft }}
              >
                Изменить
              </Button>
            </div>
          </div>
        </FranchizeOperatorPanel>
      )}

      {/* All Active Shifts */}
      <FranchizeOperatorPanel>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: T.accent }} />
          <h2 className="text-sm font-semibold" style={{ color: T.text }}>
            Активные смены экипажа
          </h2>
        </div>

        {shifts.length > 0 ? (
          <div className="space-y-2">
            {shifts.map((shift) => {
              const isMine = shift.member_id === dbUser?.user_id;
              const duration = formatDuration(shift.clock_in_time, shift.clock_out_time);
              return (
                <div
                  key={shift.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    isMine ? "border-2" : "hover:border"
                  )}
                  style={{
                    borderColor: isMine ? T.accent : T.borderSoft,
                    background: isMine ? `${T.accent}10` : "transparent",
                  }}
                >
                  {/* Status indicator - matches member live_status */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full animate-pulse",
                      shift.member?.live_status === 'riding' ? "bg-primary" : "bg-green-500"
                    )} />
                    <Activity className={cn(
                      "h-3 w-3",
                      shift.member?.live_status === 'riding' ? "text-primary" : "text-green-500"
                    )} />
                  </div>

                  {/* Member info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate" style={{ color: T.text }}>
                        @{shift.member?.username || 'Неизвестно'}
                      </span>
                      {isMine && (
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: T.accent, color: T.accentContrast }}>
                          Я
                        </span>
                      )}
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-medium",
                        shift.member?.live_status === 'riding'
                          ? "bg-primary text-primary-foreground"
                          : shift.member?.live_status === 'online'
                          ? "bg-green-500 text-white"
                          : "border px-2 py-0.5 text-[9px]"
                      )} style={shift.member?.live_status === 'offline' ? { borderColor: T.borderSoft, color: T.textMuted } : undefined}>
                        {shift.member?.live_status === 'riding' ? 'В ПОЕЗДКЕ' : shift.member?.live_status === 'online' ? 'НА СМЕНЕ' : 'ОФЛАЙН'}
                      </span>
                      {shift.shift_type && shift.shift_type !== 'default' && (
                        <span className="rounded-full border px-2 py-0.5 text-[9px]" style={{ borderColor: T.borderSoft, color: T.textMuted }}>
                          {shift.shift_type}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px]" style={{ color: T.textMuted }}>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {new Date(shift.clock_in_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {duration}
                      </span>
                      {shift.hourly_rate && (
                        <span className="flex items-center gap-1" style={{ color: T.accent }}>
                          <DollarSign className="h-3 w-3" />
                          {shift.hourly_rate} ₽/ч
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Admin actions */}
                  {isCrewAdmin && !isMine && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setEndingShift(shift.id);
                        try {
                          const response = await fetch('/api/crew/shifts', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ shiftId: shift.id, slug: crewSlug }),
                          });
                          const data = await response.json();
                          if (response.ok) {
                            if (data.alreadyClosed) {
                              toast.info(data.message || "Смена уже была завершена");
                            } else {
                              toast.success("Смена завершена");
                            }
                            loadShifts();
                          } else {
                            toast.error(data.error || "Ошибка завершения смены");
                          }
                        } catch {
                          toast.error("Ошибка завершения смены");
                        } finally {
                          setEndingShift(null);
                        }
                      }}
                      disabled={endingShift === shift.id}
                      className="h-7 text-[10px] rounded-full"
                      style={{ borderColor: "#ef4444", color: "#ef4444" }}
                    >
                      {endingShift === shift.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Завершить"
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${T.borderSoft}30` }}>
              <Clock className="h-6 w-6" style={{ color: T.textMuted }} />
            </div>
            <p className="text-sm font-medium" style={{ color: T.text }}>Нет активных смен</p>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              Нажми «Начать смену» чтобы открыть смену
            </p>
          </div>
        )}
      </FranchizeOperatorPanel>

      {/* Hourly Rate Dialog */}
      <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Изменить часовую ставку</DialogTitle>
            <DialogDescription>
              Установите ставку для расчёта зарплаты за смены
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rate">Ставка (₽/час)</Label>
              <Input
                id="rate"
                type="number"
                value={newHourlyRate}
                onChange={(e) => setNewHourlyRate(e.target.value)}
                placeholder={String(myMemberInfo?.hourly_rate || 169)}
                className="font-mono"
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRateDialog(false)}
                className="rounded-full"
              >
                Отмена
              </Button>
              <Button
                onClick={handleUpdateHourlyRate}
                disabled={updatingRate}
                className="rounded-full"
                style={{ backgroundColor: T.accent, color: T.accentContrast }}
              >
                {updatingRate ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shift History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История смен</DialogTitle>
            <DialogDescription>
              Ваши завершённые смены и заработок
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {shiftHistory.length > 0 ? (
              shiftHistory.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  style={{ borderColor: T.borderSoft }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: T.text }}>
                      {new Date(shift.clock_in_time).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <p className="text-xs" style={{ color: T.textMuted }}>
                      {new Date(shift.clock_in_time).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {" → "}
                      {new Date(shift.clock_out_time).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: T.textMuted }}>
                      {Math.floor(shift.duration_minutes / 60)}ч {shift.duration_minutes % 60}м
                    </p>
                    <p className="font-mono text-sm font-semibold" style={{ color: T.accent }}>
                      {formatCurrency(shift.salary_amount)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm" style={{ color: T.textMuted }}>
                История смен пуста
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowHistory(false)}
              className="rounded-full"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
