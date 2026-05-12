import Image from "next/image";
import Link from "next/link";
import React from "react";
import { getCrewPaletteBySlug } from "@/app/franchize/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VibeContentRenderer from "@/components/VibeContentRenderer";

export default async function Sly13CyberVibeLanding() {
  const theme = await getCrewPaletteBySlug("sly13");
  const palette = theme.palette;

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: palette.bgBase, color: palette.textPrimary }}>
      <section className="relative flex h-[90vh] items-center justify-center px-6 text-center">
        <div className="absolute inset-0">
          <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg" alt="cyber hero" fill className="object-cover opacity-40" priority />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${palette.bgBase}cc, ${palette.bgBase}99, ${palette.bgBase})` }} />
        </div>
        <div className="relative z-10 max-w-4xl">
          <h1 className="text-4xl font-bold md:text-6xl" style={{ color: palette.accentMain }}>SLY13 CYBERVIBE</h1>
          <p className="mt-5 text-lg md:text-xl" style={{ color: palette.textSecondary }}>AI-ко-пилот для запуска продуктов, прокачки навыков и ускорения мышления.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/franchize/sly13/catalog"><Button style={{ background: palette.accentMain, color: palette.accentTextOn }}><VibeContentRenderer content="::FaBolt:: Запустить CyberVIBE" /></Button></Link>
            <Link href="/franchize/sly13/contacts"><Button variant="secondary">Связаться</Button></Link>
          </div>
        </div>
      </section>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-12 md:grid-cols-2">
        {["CyberVIBE Sprint", "AI Workflow Custom", "Trade-in Хаоса", "Coaching / Labs"].map((title) => (
          <Card key={title} style={{ background: palette.bgCard, borderColor: palette.borderSoft }}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent><p style={{ color: palette.textSecondary }}>Операционный блок из metadata seed. Открывайте /franchize/sly13 для полной витрины.</p></CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
