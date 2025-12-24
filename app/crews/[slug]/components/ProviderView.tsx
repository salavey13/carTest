"use client";
import React from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const ProviderView = ({ crew }: { crew: any }) => {
    const meta = crew.metadata || {};
    const services = meta.services || [];
    const budget = (meta.teambuilding_budget_base || 0) + (meta.teambuilding_budget_dynamic || 0);

  return (
    <div className="space-y-12">
        {/* Блок Бюджета (Показываем всем для интереса) */}
        <div className="bg-gradient-to-r from-brand-purple/20 to-transparent p-6 border-l-4 border-brand-purple">
            <h4 className="text-sm font-mono text-brand-purple uppercase tracking-widest">Текущий Фонд Тимбилдинга</h4>
            <p className="text-4xl font-black font-orbitron">{budget.toLocaleString()} ₽</p>
            <p className="text-[10px] text-zinc-500 mt-1 italic">* 13% от каждой закрытой операции в этой локации уходит в этот фонд.</p>
        </div>

        {/* Сетка Сервисов */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s: any) => (
                <Card key={s.id} className="bg-black/60 border-accent/30 overflow-hidden group">
                    <div className="h-48 relative overflow-hidden">
                        <img src={s.image_url || crew.logo_url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                        <h3 className="absolute bottom-4 left-4 text-2xl font-black uppercase">{s.name}</h3>
                    </div>
                    <div className="p-4 space-y-4">
                        <p className="text-xs text-muted-foreground font-mono leading-relaxed">{s.description}</p>
                        <div className="space-y-2">
                            {s.packages.map((pkg: any) => (
                                <div key={pkg.id} className="flex justify-between items-center bg-zinc-900/50 p-2 border border-white/5">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase">{pkg.name}</div>
                                        <div className="text-[8px] text-zinc-500">{pkg.includes}</div>
                                    </div>
                                    <div className="text-accent-text font-orbitron font-bold">{pkg.price} ₽</div>
                                </div>
                            ))}
                        </div>
                        <Button className="w-full bg-accent hover:bg-white hover:text-black font-black uppercase text-xs tracking-widest">
                            Забронировать Операцию
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    </div>
  );
};