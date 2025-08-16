import React from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { fetchBloggerArticles } from "@/lib/blog/fetchBloggerArticles";
import type { BloggerPostRecord } from "@/lib/blog/fetchBloggerArticles";
import ArticleCard from "@/components/blog/ArticleCard";

// Server component that fetches data and renders a client renderer
export const dynamic = "force-dynamic"; // keep dynamic so fallback demo posts show immediately

// helper: random unsplash pic function
function randomUnsplash(seed: string) {
  const collections = [
    "gaming",
    "music",
    "technology",
    "cyberpunk",
    "neon",
    "community",
    "party",
    "sauna",
    "streaming",
    "portrait",
  ];
  const query = collections[Math.floor(Math.random() * collections.length)];
  return `https://source.unsplash.com/random/1200x800/?${query}&sig=${encodeURIComponent(seed)}`;
}

// dynamic client components (no-ssr) to embed inside the page
const PartnerWidget = dynamic(() => import("../partner/page").then((m) => m.default), { ssr: false });
const BuySubscriptionWidget = dynamic(() => import("../buy-subscription/page").then((m) => m.default), { ssr: false });
// donation form from streamer components (render client-side)
const DonationForm = dynamic(() => import("@/components/streamer/DonationForm").then((m) => m.default), { ssr: false });

export default async function BloggerPage() {
  const res = await fetchBloggerArticles({ limit: 24 });
  const postsRaw = res.data || [];

  // ensure every post has a cover_url (randomize if missing)
  const posts = postsRaw.map((p: BloggerPostRecord, i: number) => ({
    ...p,
    cover_url: p.cover_url ? `${p.cover_url}?auto=format&fit=crop&w=1200&q=80` : randomUnsplash(String(i) + (p.slug || i)),
  }));

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="container mx-auto px-4 py-10">
        <header className="mb-8 flex items-center gap-4">
          <div className="relative h-14 w-14 rounded-full overflow-hidden ring-2 ring-slate-200 shadow-sm">
            <Image src="/logo.png" alt="Blogger" fill className="object-cover" />
          </div>
          <div>
            <h1 className="font-orbitron text-3xl md:text-4xl tracking-wide text-slate-900 animate-[bounce_0.9s]">
              Блогер Демо — Level 1
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Это демонстрационная страница — white-label блог для стримера с VIP-фичами,
              донатами и фановым мерчем (Sauna Pack). Всё в рамках Level 1: проверяем механику, собираем фидбэк.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/" className="text-sm underline underline-offset-4 text-slate-700">На главную</Link>
            <Link href="/about_en" className="text-sm underline underline-offset-4 text-slate-700">О уровнях</Link>
          </div>
        </header>

        {/* short assistant note */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          🚀 Понял, братан — ща ебанём такой <b>Level 1 блоггерский демо-вайб</b>, что он будет прыгать, светиться и показывать фанам и инвесторам, как выглядит <b>начало нашей экосистемы</b>.
          Мы остаёмся в Scope Level 1: блог, статьи, донаты (на главных страницах), VIP-менеджмент. Ссылки на Level 2/3: <Link href="/vipbikerentals" className="text-brand-cyan underline">VIP Bike Rentals</Link>, <Link href="/sauna-rent" className="text-brand-cyan underline">Sauna Rent</Link>, <Link href="/about_en" className="text-brand-cyan underline">About (EN)</Link>.
        </div>

        {/* donation + partner / buy subscription widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Последние статьи и апдейты</h2>
            <p className="text-sm text-slate-600 mb-4">
              Тут отображаются последние посты. На этой странице также есть быстрый блок донатов и промо — это демонстрация интеграции.
            </p>

            {/* donation form (client) */}
            <div className="mb-4">
              <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-white/60">
                <h3 className="font-semibold mb-2">Поддержать проект — донат</h3>
                <p className="text-xs text-slate-600 mb-3">Донаты видны стримеру и апдейтят лидеры.</p>
                {/* DonationForm is client-side dynamic */}
                <DonationForm streamerId={"demo-streamer"} />
              </div>
            </div>

            {/* posts grid */}
            <div>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {posts.slice(0, 9).map((post) => (
                  <ArticleTileLite key={post.slug} post={post} />
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="p-4 rounded-2xl border border-slate-100 shadow-sm bg-white">
              <h4 className="font-semibold mb-2">Партнёрская программа</h4>
              <p className="text-sm text-slate-600 mb-3">Встраиваем виджет партнёрки — клиенты и рефералы. (Демонстрация)</p>
              <div style={{ minHeight: 120 }}>
                {/* Partner widget (client) */}
                <PartnerWidget />
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-100 shadow-sm bg-white">
              <h4 className="font-semibold mb-2">Подписки & апгрейды</h4>
              <p className="text-sm text-slate-600 mb-3">Прямо в блог можно показать доступные планы.</p>
              <div style={{ minHeight: 220 }}>
                <BuySubscriptionWidget />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-white text-sm">
              <h5 className="font-semibold mb-2">Roadmap (уровни)</h5>
              <ul className="text-xs list-disc ml-4 text-slate-600 space-y-1">
                <li>Level 1 — блог, донаты, VIP (текущая демка).</li>
                <li>Level 2 — интеграции: <Link href="/vipbikerentals" className="underline text-brand-cyan">VIP байки</Link>, <Link href="/sauna-rent" className="underline text-brand-cyan">сауна-аренда</Link>.</li>
                <li>Level 3 — агрегатор & marketplace: <Link href="/about_en" className="underline text-brand-cyan">подробнее</Link>.</li>
              </ul>
            </div>
          </aside>
        </div>

        {/* full posts grid */}
        <section>
          <h3 className="text-xl font-semibold mb-4">Все статьи</h3>
          {posts.length === 0 ? (
            <div className="text-center text-slate-500 py-16">Постов пока нет.</div>
          ) : (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {posts.map((post) => (
                <ArticleCardWrapper key={post.slug} post={post} />
              ))}
            </div>
          )}
        </section>

        {/* short footer / CTA */}
        <div className="mt-10 p-4 rounded-lg border border-slate-100 bg-slate-50 text-sm">
          <strong>Коротко:</strong> это Level 1 демо — блог + статьи + донаты. Sauna Pack — наш нестандартный мерч: не просто футболка, а IRL опыт. Хотите добавить свои услуги — свяжитесь через <Link href="/partner" className="underline">партнёрку</Link>.
        </div>
      </div>
    </div>
  );
}

/* ----- Small client-UI like tiles (server-renderable wrappers) ----- */

function ArticleTileLite({ post }: { post: BloggerPostRecord }) {
  return (
    <Link href={`/blogger/${post.slug}`} className="group block rounded-lg overflow-hidden border border-slate-100 hover:shadow-lg transition transform hover:-translate-y-1 bg-white">
      <div className="relative w-full h-48">
        <Image src={post.cover_url || randomUnsplash(post.slug || "tile")} alt={post.title} fill className="object-cover" />
      </div>
      <div className="p-3">
        <h4 className="font-semibold text-sm mb-1 group-hover:text-brand-cyan">{post.title}</h4>
        <p className="text-xs text-slate-500 line-clamp-3">{post.excerpt}</p>
      </div>
    </Link>
  );
}

/* ArticleCardWrapper — keeps ArticleCard import (client/server safe if ArticleCard is client, but if it's client-only it's okay
   because Next can render it as client component. If ArticleCard is server, it will work too.) */
function ArticleCardWrapper({ post }: { post: BloggerPostRecord }) {
  // use ArticleCard component (assumed present in project). If ArticleCard is client-only, Next will hydrate it.
  return <ArticleCard post={post} />;
}