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
    <div className="container mx-auto px-4 pb-16 pt-24">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
          <Card className="border-brand-purple/30 bg-slate-950/80 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <CardHeader>
              <p className="text-xs uppercase tracking-[0.2em] text-brand-cyan">map pipeline</p>
              <CardTitle className="font-orbitron text-3xl text-white">Калибровщик карты</CardTitle>
              <CardDescription className="max-w-2xl text-base text-zinc-300">
                Один хаб для выравнивания map-image под реальные GPS bounds. Дальше этот preset можно использовать в franchize contacts,
                map-riders и других VibeMap сценариях.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {steps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
                  <div className="mb-2 text-xs uppercase tracking-[0.16em] text-brand-cyan">Шаг {index + 1}</div>
                  <p>{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-brand-purple/20 bg-slate-950/65">
            <CardHeader>
              <CardTitle className="text-lg text-white">Быстрые переходы</CardTitle>
              <CardDescription className="text-zinc-400">Чтобы map stack жил не отдельно, а рядом с franchize-операторкой.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                { label: "Franchize branding", href: "/franchize/create" },
                { label: "VIP Bike contacts", href: "/franchize/vip-bike/contacts" },
                { label: "VIP Bike MapRiders", href: "/franchize/vip-bike/map-riders" },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:border-brand-cyan/60 hover:bg-white/10">
                  {item.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto border-brand-purple/30 bg-slate-950/70">
          <CardContent className="pt-6">
            <VibeMapCalibrator initialBounds={INITIAL_MAP_BOUNDS} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
