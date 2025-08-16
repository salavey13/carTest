"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchBloggerArticles } from "@/lib/blog/fetchBloggerArticles";
import { debugLogger as logger } from "@/lib/debugLogger";
import ArticleCard from "@/components/blog/ArticleCard";
import DonationForm from "@/components/streamer/DonationForm";
import DonationFeed from "@/components/streamer/DonationFeed";
import Leaderboard from "@/components/streamer/Leaderboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BloggerPage() {
  const res = await fetchBloggerArticles({ limit: 12 });

  if (!res.success) {
    logger.error("[BloggerPage] Failed to load posts", res.error);
  }

  const posts = res.data || [];

  // Рандомные картинки Unsplash для обновления при каждом заходе
  const heroUrl = useMemo(() => {
    const seed = Math.floor(Math.random() * 9999);
    return `https://source.unsplash.com/random/1200x400/?tech,cyber,${seed}`;
  }, []);

  const sideImg = useMemo(() => {
    const seed = Math.floor(Math.random() * 9999);
    return `https://source.unsplash.com/random/600x400/?startup,future,${seed}`;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-gray-100 text-black">
      <div className="container mx-auto px-4 py-8">
        {/* HERO */}
        <header className="rounded-2xl overflow-hidden shadow-xl mb-10">
          <div className="relative w-full h-52 md:h-72">
            <Image
              src={heroUrl}
              alt="Hero"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="p-6 bg-white">
            <h1 className="font-orbitron text-3xl md:text-4xl font-bold text-gray-900">
              Блогерский портал
            </h1>
            <p className="text-gray-600 mt-2">
              Добро пожаловать в белую (white-label) зону CyberVibe. Здесь мы тестим
              наш движ, пишем статьи, публикуем обновления и прокачиваем идеи,
              которые потом двигаем на уровни Lvl2 (Сауна), Lvl3 (VIP Bike Rentals) и агрегатор.
            </p>
          </div>
        </header>

        {/* Статьи */}
        {posts.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            Постов пока нет. Подключи таблицу <code>blog_posts</code>.
          </div>
        ) : (
          <section className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {posts.map((post) => (
              <ArticleCard key={post.slug} post={post} />
            ))}
          </section>
        )}

        {/* Врезка про движ */}
        <section className="mt-12 grid md:grid-cols-2 gap-6">
          <Card className="bg-white border shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">
                Наш движ в действии
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600 space-y-3">
              <p>
                Тут мы показываем, как работает экосистема: блогер получает донаты
                через ту же механику, что и стример. Поддержка фанатов превращается
                в реальные «плюшки»: цифровые мерчи, доступ в VIP и т.д.
              </p>
              <p>
                Пример: как в «сауна паке» мы продавали тапки и полотенце, так здесь
                можно придумать свой набор «цифровых сувениров» для подписчиков.
              </p>
              <DonationForm streamerId="blogger-demo" />
            </CardContent>
          </Card>

          <Card className="bg-white border shadow-lg">
            <div className="relative w-full h-48 md:h-64 rounded-t-xl overflow-hidden">
              <Image src={sideImg} alt="Наш движ" fill className="object-cover" />
            </div>
            <CardContent className="p-4 text-gray-600">
              <p>
                В реальном времени видно, как двигаются донаты, кто поддерживает
                проект — и формируется лидерборд.
              </p>
              <div className="mt-3">
                <Leaderboard streamerId="blogger-demo" />
              </div>
              <div className="mt-3">
                <DonationFeed streamerId="blogger-demo" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* White-label CTA */}
        <section className="mt-12 grid md:grid-cols-2 gap-6">
          <Card className="bg-white border shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">
                Подписка
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              <p className="mb-4">
                Включи премиум-доступ: эксклюзивные материалы, закулисье и ранний
                доступ к новому функционалу.
              </p>
              <Link href="/buy-subscription">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Купить подписку
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white border shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-900">
                Партнёрка
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              <p className="mb-4">
                Двигай наш движ вместе с нами — подключай партнёрку и зарабатывай
                бонусы, приглашая друзей.
              </p>
              <Link href="/partner">
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  В партнёрку
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}