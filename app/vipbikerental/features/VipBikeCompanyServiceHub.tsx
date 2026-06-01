/**
 * VipBikeCompanyServiceHub.tsx
 * =============================
 * Company hub section — services, info, and community entry points.
 *
 * FIX: Tailwind v4 grid arbitrary value — comma replaced with underscore.
 * lg:grid-cols-[0.9fr,1.1fr] → lg:grid-cols-[0.9fr_1.1fr]
 */
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

const serviceLanes = [
  { title: "Прокат и выдача", icon: "::FaKey::", text: "Быстрая бронь, договор, экипировка и понятная выдача без лишних звонков.", href: "/franchize/vip-bike", cta: "Выбрать байк" },
  { title: "Сервис и ремонт", icon: "::FaWrench::", text: "Обслуживание своего мотоцикла, диагностика, сезонная подготовка и расходники на базе VIP BIKE.", href: "https://t.me/salavey13", cta: "Написать в сервис" },
  { title: "Комьюнити райдеров", icon: "::FaUsersViewfinder::", text: "MapRiders, точки встреч, живые маршруты и социальное доказательство вокруг реальных поездок.", href: "/franchize/vip-bike/map-riders", cta: "Открыть карту" },
];

const companyFacts = [
  "Локация: пл. Комсомольская 2",
  "Формат: аренда, продажа, сервис, комьюнити",
  "Фокус: electro-enduro и городские тест-драйвы",
];

export function VipBikeCompanyServiceHub() {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-card/50 p-5 shadow-2xl shadow-primary/10 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-black/35 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">company hub</p>
          <h2 className="mt-3 font-orbitron text-3xl sm:text-4xl">VIP BIKE — не только прокат, а база райдера</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">Один экран объясняет компанию простыми словами: где взять байк, где обслужить свой мотоцикл, куда приехать и как попасть в живое сообщество.</p>
          <div className="mt-5 grid gap-2">
            {companyFacts.map((fact) => (
              <div key={fact} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                <VibeContentRenderer content="::FaCircleCheck::" className="mt-0.5 text-primary" /><span>{fact}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
          {serviceLanes.map((lane) => (
            <article key={lane.title} className="rounded-3xl border border-border/70 bg-background/55 p-4 transition hover:-translate-y-1 hover:border-primary/50">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary"><VibeContentRenderer content={lane.icon} /></div>
                <div>
                  <h3 className="font-orbitron text-lg">{lane.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{lane.text}</p>
                  <Button asChild size="sm" variant="outline" className="mt-3"><Link href={lane.href}>{lane.cta}</Link></Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
