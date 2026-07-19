"use client";

import React, { useEffect, useState } from 'react';
import { getCrewLiveDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import Link from "next/link";
import { Users, Clock, Settings, Calendar } from "lucide-react";

export function FranchizeCrewOverviewClient({ crewSlug, initialCrew }: { crewSlug: string; initialCrew: any }) {
    const { userCrewMemberships } = useAppContext();
    const [crew, setCrew] = useState<any>(initialCrew);
    const [loading, setLoading] = useState(false);

    const isCrewAdmin = userCrewMemberships.some(
      (m) => m.slug === crewSlug && ["owner", "admin", "co_owner"].includes(m.role)
    );

    useEffect(() => {
        if (!crewSlug) return;
        setLoading(true);
        getCrewLiveDetails(crewSlug).then(res => {
            if (res.success) setCrew(res.data);
            setLoading(false);
        });
    }, [crewSlug]);

    if (loading && !crew) return <Loading variant="bike" text="Загрузка..." />;

    const meta = crew?.metadata || {};
    const isProvider = meta.is_provider;
    const memberCount = crew?.members?.length || 0;
    const vehicleCount = crew?.vehicles?.length || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tighter">Управление экипажем</h1>
                    <p className="text-muted-foreground text-sm mt-1">{crew?.name || crewSlug}</p>
                </div>
                {isProvider && <Badge className="bg-primary">ПРОВАЙДЕР</Badge>}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                <div className="text-2xl font-bold">{crew?.activeShifts ?? 0}</div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
        </div>
    );
}
