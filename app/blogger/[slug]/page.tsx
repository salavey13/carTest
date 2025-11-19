import React from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchBloggerArticleBySlug } from "@/lib/blog/fetchBloggerArticles";
import type { BloggerPostRecord } from "@/lib/blog/fetchBloggerArticles";

export const dynamic = "force-dynamic";

function randomUnsplash(seed: string) {
  const collections = ["streamer", "community", "gaming", "sauna", "cyberpunk", "future", "portrait"];
  const query = collections[Math.floor(Math.random() * collections.length)];
  return `https://source.unsplash.com/random/1600x900/?${query}&sig=${encodeURIComponent(seed)}`;
}

interface PageProps {
  params: { slug: string };
}

export default async function BloggerPostPage({ params }: PageProps) {
  const slug = params.slug;
  const res = await fetchBloggerArticleBySlug(slug);
  const post: BloggerPostRecord | null = res.data || null;

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-orbitron text-2xl md:text-3xl mb-2">Пост не найден</h1>
        <p className="text-slate-600 mb-6">Возможно, он был удалён или адрес введён неверно.</p>
        <Link href="/blogger" className="text-brand-cyan underline">← Вернуться в блог</Link>
      </div>
    );
  }

  const cover = post.cover_url ? `${post.cover_url}?auto=format&fit=crop&w=1400&q=80` : randomUnsplash(post.slug || "cover");

  return (
    <article className="min-h-screen bg-white text-slate-900">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <header className="mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-slate-200">
              <Image src={post.author_avatar || "/logo.png"} alt={post.author || "Author"} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <h1 className="font-orbitron text-3xl md:text-4xl text-slate-900 mb-1">{post.title}</h1>
              <p className="text-xs text-slate-600">{post.author || "Автор"} • {post.published_at?.slice(0, 10) || "—"}</p>
            </div>
            <div>
              <Link href="/blogger" className="text-sm underline text-slate-700">В блог</Link>
            </div>
          </div>

          <div className="relative w-full h-56 md:h-80 rounded-2xl overflow-hidden ring-2 ring-slate-200 shadow-lg mb-4">
            <Image src={cover} alt={post.title} fill className="object-cover" priority />
          </div>
        </header>

        <div className="prose max-w-none prose-slate prose-img:rounded-xl prose-img:shadow-md">
          {post.content ? (
            // content is expected to be safe/demo HTML (from fallback). In prod, sanitize before rendering.
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          ) : (
            <p className="text-slate-600">Контент временно недоступен.</p>
          )}
        </div>

        {post.tags?.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-700">#{tag}</span>
            ))}
          </div>
        ) : null}

        <div className="mt-8 p-4 rounded-lg border border-slate-100 bg-slate-50 text-sm">
          <h4 className="font-semibold mb-2">Куда дальше?</h4>
          <p className="text-sm text-slate-700 mb-2">
            Если вам понравилась эта статья — посмотрите наши сервисы Level 2:
            <Link href="/vipbikerentals" className="underline ml-1 text-brand-cyan">VIP Bike Rentals</Link>,
            <Link href="/sauna-rent" className="underline ml-2 text-brand-cyan">Sauna Rent</Link>.
            Для общего описания архитектуры системы — <Link href="/about_en" className="underline ml-2 text-brand-cyan">About (EN)</Link>.
          </p>
          <p className="text-xs text-slate-600">Это демо: вы можете редактировать, сохранять и расширять статьи через административную панель (в будущем).</p>
        </div>

        {res.meta?.usedFallback && (
          <p className="mt-4 text-xs text-yellow-700">⚠️ Пост загружен из демонстрационной коллекции.</p>
        )}
      </div>
    </article>
  );
}