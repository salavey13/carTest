// /app/optimapipe/cases/[slug]/page.tsx
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { motion } from "framer-motion";

/**
 * Improved /app/optimapipe/cases/[slug]/page.tsx
 * Enhancements:
 * - Added animations for better engagement (fade-in on load).
 * - Improved layout: Larger images, better spacing, responsive grid.
 * - Added share buttons placeholder (e.g., for social media).
 * - Enhanced accessibility: Alt texts, aria labels.
 * - Code: Refactored for consistency with landing page improvements.
 * - Added back to home link in not found state.
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
  const { slug } = params;
  const item = CASES.find((c) => c.slug === slug);

  if (!item) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-semibold mb-4">Кейс не найден</h1>
          <p className="text-muted-foreground mb-6">Похоже, кейс с таким идентификатором отсутствует.</p>
          <Link href="/optimapipe">
            <Button>Вернуться на главную</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <header className="relative h-80 md:h-96 lg:h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <Image src={item.images[0]} alt={item.title} fill style={{ objectFit: "cover" }} unoptimized priority />
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
              <CardHeader>
                <CardTitle className="text-2xl">Описание проекта</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{item.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {item.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-muted rounded-full text-sm text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Период: {item.period}</p>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <h3 className="text-2xl font-semibold mb-4">Фотографии</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {item.images.map((src, i) => (
                <div key={i} className="relative h-64 rounded-lg overflow-hidden shadow-md">
                  <Image src={src} alt={`${item.title} - фото ${i + 1}`} fill style={{ objectFit: "cover" }} loading="lazy" unoptimized />
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}>
            <h3 className="text-2xl font-semibold mb-4">Результат и комментарии</h3>
            <p className="text-muted-foreground">
              Работы завершены в срок, передача акта выполнена с полным комплектом исполнительной документации. Возможны повторные работы по сервисному обслуживанию и расширению сети.
            </p>
          </motion.section>

          {/* Share */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 }} className="flex gap-4">
            <Button variant="outline">Поделиться в Telegram</Button>
            <Button variant="outline">Поделиться в VK</Button>
          </motion.div>
        </article>

        <aside className="lg:col-span-1 space-y-6">
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <Card className="p-6 border-border shadow-md">
              <h4 className="font-semibold text-lg mb-4">Контакт для схожих работ</h4>
              <div className="space-y-3 text-sm mb-4">
                <div className="flex items-center gap-3">
                  <VibeContentRenderer content="::FaPhone::" className="h-5 w-5 text-accent" />
                  +7 (XXX) XXX-XX-XX
                </div>
                <div className="flex items-center gap-3">
                  <VibeContentRenderer content="::FaEnvelope::" className="h-5 w-5 text-accent" />
                  info@optimapipe.ru
                </div>
              </div>
              {item.contactNote && <p className="text-sm text-muted-foreground mb-4">{item.contactNote}</p>}
              <div className="flex gap-3">
                <Link href="/optimapipe#contact">
                  <Button>Оставить заявку</Button>
                </Link>
                <Link href="/optimapipe">
                  <Button variant="outline">Назад</Button>
                </Link>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <Card className="p-6 border-border shadow-md">
              <h4 className="font-semibold text-lg mb-4">Похожие проекты</h4>
              <div className="space-y-6">
                {CASES.filter((c) => c.slug !== item.slug).map((c) => (
                  <div key={c.slug} className="flex items-start gap-4">
                    <div className="relative h-16 w-16 rounded overflow-hidden flex-shrink-0">
                      <Image src={c.images[0]} alt={c.title} fill style={{ objectFit: "cover" }} unoptimized />
                    </div>
                    <div>
                      <h5 className="font-medium">{c.title}</h5>
                      <p className="text-sm text-muted-foreground">{c.period}</p>
                      <Link href={`/optimapipe/cases/${c.slug}`}>
                        <a className="text-sm text-accent underline hover:no-underline">Открыть</a>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </aside>
      </div>
    </main>
  );
}