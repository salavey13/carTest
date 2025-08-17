import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";

/**
 * Страница кейса по slug.
 * Серверный компонент (App Router). Использует хардкоженный массив кейсов.
 * URL: /optimapipe/cases/:slug
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
    // можно вернуть notFound() в app router — но для простоты рендерим фоллбек
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <h1 className="text-2xl font-semibold">Кейс не найден</h1>
          <p className="mt-2 text-sm text-muted-foreground">Похоже, кейс с таким идентификатором отсутствует.</p>
          <div className="mt-4">
            <Link href="/optimapipe">
              <a>
                <Button>Вернуться на главную</Button>
              </a>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <header className="relative h-60 md:h-72 lg:h-96 overflow-hidden">
        <div className="absolute inset-0">
          <Image src={item.images[0]} alt={item.title} fill style={{ objectFit: "cover" }} unoptimized />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60 pointer-events-none" />
        </div>

        <div className="relative z-10 container mx-auto h-full px-4 flex items-end pb-8">
          <div className="bg-black/30 backdrop-blur-sm rounded-md p-4">
            <h1 className="text-2xl md:text-3xl font-semibold text-white">{item.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{item.subtitle}</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <article className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Описание проекта</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 bg-muted-foreground/8 rounded-full border border-border text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">Период: {item.period}</div>
            </CardContent>
          </Card>

          <section>
            <h3 className="text-xl font-semibold">Фотографии</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {item.images.map((src, i) => (
                <div key={i} className="relative h-48 w-full rounded overflow-hidden">
                  <Image src={src} alt={`${item.title}-${i}`} fill style={{ objectFit: "cover" }} unoptimized />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold">Результат и комментарии</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Работы завершены в срок, передача акта выполнена с полным комплектом исполнительной документации. Возможны повторные работы по сервисному обслуживанию и расширению сети.
            </p>
          </section>
        </article>

        <aside className="lg:col-span-1 space-y-4">
          <Card className="bg-card border-border p-4">
            <h4 className="font-semibold">Контакт для схожих работ</h4>
            <div className="mt-3 text-sm text-foreground flex items-center gap-2">
              <VibeContentRenderer content="::FaPhone::" /> +7 (XXX) XXX-XX-XX
            </div>
            <div className="mt-2 text-sm text-foreground flex items-center gap-2">
              <VibeContentRenderer content="::FaEnvelope::" /> info@optimapipe.ru
            </div>
            {item.contactNote && <div className="mt-3 text-xs text-muted-foreground">{item.contactNote}</div>}
            <div className="mt-4 flex gap-2">
              <Link href="/optimapipe#contact">
                <a>
                  <Button>Оставить заявку</Button>
                </a>
              </Link>
              <Link href="/optimapipe">
                <a>
                  <Button variant="ghost">Назад</Button>
                </a>
              </Link>
            </div>
          </Card>

          <Card className="bg-card border-border p-4">
            <h4 className="font-semibold">Похожие проекты</h4>
            <div className="mt-3 space-y-2">
              {CASES.filter((c) => c.slug !== item.slug).map((c) => (
                <div key={c.slug} className="flex items-center gap-3">
                  <div className="w-12 h-12 relative rounded overflow-hidden">
                    <Image src={c.images[0]} alt={c.title} fill style={{ objectFit: "cover" }} unoptimized />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.period}</div>
                    <div className="mt-1">
                      <Link href={`/optimapipe/cases/${c.slug}`}>
                        <a className="text-xs underline">Открыть</a>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}