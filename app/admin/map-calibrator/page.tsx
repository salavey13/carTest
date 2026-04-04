"use client";

import Link from "next/link";
import { VibeMapCalibrator } from "@/components/VibeMapCalibrator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_MAP_BOUNDS = {
  top: 56.4242,
  bottom: 56.08,
  left: 43.66,
  right: 44.1230,
};

const steps = [
  "Вставьте URL изображения карты или сохранённого map preset asset.",
  "Нажмите «Начать калибровку» — появятся две опорные точки.",
  "Перетащите «Аську» и «Аэропорт» в реальные координаты на картинке.",
  "Скопируйте вычисленные bounds и при необходимости сохраните preset прямо отсюда.",
];

export default function MapCalibratorPage() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-8 px-3 sm:px-4 bg-black relative">
      {/* Background */}
      <div className="fixed inset-0 z-[-1] opacity-15">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(124,244,120,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,244,120,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* Header Section - More Compact */}
        <div className="grid gap-4 lg:grid-cols-[1fr,auto]">
          <Card className="border-brand-purple/30 bg-slate-950/80 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-cyan mb-1">map pipeline</p>
              <CardTitle className="font-orbitron text-xl sm:text-2xl text-white">Калибровщик карты</CardTitle>
              <CardDescription className="text-sm sm:text-base text-zinc-300">
                Выравнивание GPS bounds под изображение карты для franchize contacts, map-riders и других сценариев.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-brand-purple/20 bg-slate-950/65 backdrop-blur-xl h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">Быстрые переходы</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                { label: "Franchize branding", href: "/franchize/create" },
                { label: "VIP Bike contacts", href: "/franchize/vip-bike/contacts" },
                { label: "VIP Bike MapRiders", href: "/franchize/vip-bike/map-riders" },
              ].map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:border-brand-cyan/60 hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Calibrator - Full Width, Larger Map */}
        <Card className="border-brand-purple/30 bg-slate-950/70 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-3 sm:p-6">
            <VibeMapCalibrator initialBounds={INITIAL_MAP_BOUNDS} />
          </CardContent>
        </Card>

        {/* Steps - Collapsible on Mobile */}
        <details className="rounded-xl border border-white/10 bg-slate-950/60 p-4 sm:p-6 backdrop-blur-sm">
          <summary className="cursor-pointer font-medium text-white mb-3">Как использовать калибратор</summary>
          <div className="grid gap-3 sm:grid-cols-2 mt-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-zinc-200">
                <div className="mb-1 text-xs uppercase tracking-[0.16em] text-brand-cyan">Шаг {index + 1}</div>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}