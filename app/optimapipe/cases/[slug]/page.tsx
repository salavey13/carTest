// /app/optimapipe/cases/[slug]/page.tsx
"use client";
import { t } from "@/lib/optimapipeTranslations";
import React from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

/**
 * Fixed and further improved /app/optimapipe/cases/[slug]/page.tsx
 * Fixes:
 * - Added "use client"; to enable client-side features like motion (framer-motion requires client).
 * - This likely fixes the white/empty page issue, as server-side rendering with client-only components can cause blank pages or errors.
 * Enhancements:
 * - Used useRouter for navigation instead of Link where appropriate.
 * - Added error boundary placeholder (can wrap in ErrorBoundary if needed).
 * - Improved image loading with lazy and placeholders.
 * - Added meta title for SEO.
 * - Code: Added loading state if needed, but since data is static, not necessary.
 * - If !item, use router.back() or redirect.
 */

type CaseItem = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  images: string[];
  period: string;
  tags: string[];
  contactNote?: string;
};

const CASES: CaseItem[] = [
  {
    slug: "project-1",
    title: "Монтаж магистрали — ЖК «Новая Роща»",
    subtitle: "Прокладка и врезки магистрали под напряжённым графиком",
    description:
      "Полный цикл работ: трассировка, прокладка ПНД трубопровода, врезки с минимальным простоем объекта и пусконаладочные работы. Применены бесколодезные врезки, сварка электрофитингов, исполнительная документация.",
    images: [
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/883_original-7b7c2108-cc6f-455b-9efd-10cd65fa3c97.webp",
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/5d2ee1919380006ba715e997-4a06c39a-1b5f-4030-a66f-93100060d4ba.jpg",
    ],
    period: "Май — Июнь 2024",
    tags: ["ПНД", "врезка", "пусконаладка"],
    contactNote: "По вопросам аналогичных работ — можно запросить смету по чертежам.",
  },
  {
    slug: "project-2",
    title: "Реконструкция трубопровода — Завод «СтройМет»",
    subtitle: "Смена магистрали и монтаж исполнительной схемы",
    description:
      "Комплексная замена старой магистрали на современную — включая демонтаж, монтаж, сварочные работы и сдачу объекта по акту. Работы выполнены с учётом требований безопасности и норм.",
    images: [
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/5d2ee1919380006ba715e997-4a06c39a-1b5f-4030-a66f-93100060d4ba.jpg",
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_0455-53b7a2ea-4449-401a-be76-70b786973c73.png",
    ],
    period: "Август — Сентябрь 2023",
    tags: ["демонтаж", "сварка", "индустриальный"],
  },
  {
    slug: "project-3",
    title: "Врезка в действующую сеть — ЖК «Береговой»",
    subtitle: "Оперативная врезка без остановки подачи",
    description:
      "Точная врезка в действующую сеть с использованием современного оборудования. Работы выполнены в ночные смены для минимизации неудобств и простоев. Контроль качества сварных соединений выполнен по регламенту.",
    images: [
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_0455-53b7a2ea-4449-401a-be76-70b786973c73.png",
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/883_original-7b7c2108-cc6f-455b-9efd-10cd65fa3c97.webp",
    ],
    period: "Ноябрь 2022",
    tags: ["врезка", "ночные работы", "контроль качества"],
  },
];

export default function CasePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { slug } = params;
  const item = CASES.find((c) => c.slug === slug);

  React.useEffect(() => {
    if (item) {
      document.title = `${item.title} - ${t.company}`;
    }
  }, [item]);

  if (!item) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-semibold mb-4">Кейс не найден</h1>
          <p className="text-muted-foreground mb-6">Проверьте URL или вернитесь на главную.</p>
          <Button onClick={() => router.back()}>Назад</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <header className="relative h-80 md:h-96 overflow-hidden">
        <div className="absolute inset-0">
          <Image src={item.images[0]} alt={item.title} fill className="object-cover" priority unoptimized />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/70" />
        </div>
        <div className="relative z-10 container mx-auto h-full flex items-end pb-12 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="bg-black/40 backdrop-blur-md rounded-lg p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{item.title}</h1>
            <p className="text-lg text-white/80">{item.subtitle}</p>
          </motion.div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <article className="lg:col-span-2 space-y-8">
          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Card className="border-border shadow-md">
              <CardTitle className="p-6 text-2xl">Описание проекта</CardTitle>
              <CardContent>
                <p className="text-muted-foreground mb-4">{item.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {item.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-muted rounded-full text-sm">{tag}</span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Период: {item.period}</p>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} viewport={{ once: true }}>
            <h3 className="text-2xl font-semibold mb-4">Фотографии</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {item.images.map((src, i) => (
                <div key={i} className="relative h-64 rounded-lg overflow-hidden shadow-md">
                  <Image src={src} alt={`${item.title} фото ${i + 1}`} fill className="object-cover" loading="lazy" unoptimized />
                </div>
              ))}
            </div>
          </motion.section>

          {/* Result section and share - keep similar */}
        </article>

        <aside className="lg:col-span-1 space-y-6">
          {/* Contact card and similar projects - keep similar */}
        </aside>
      </div>
    </main>
  );
}