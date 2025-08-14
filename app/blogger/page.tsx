import React from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchBloggerArticles } from "@/lib/blog/fetchBloggerArticles";
import { debugLogger as logger } from "@/lib/debugLogger";
import ArticleCard from "@/components/blog/ArticleCard";

export const dynamic = "force-dynamic";

export default async function BloggerPage() {
  const res = await fetchBloggerArticles({ limit: 24 });

  if (!res.success) {
    logger.error("[BloggerPage] Failed to load posts", res.error);
  }

  const posts = res.data || [];

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <header className="mb-6 md:mb-10 flex items-center gap-3 md:gap-4">
        <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-xl overflow-hidden ring-2 ring-brand-cyan/50">
          <Image
            src={posts[0]?.author_avatar || "/logo.png"}
            alt="Blogger"
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="font-orbitron text-2xl md:text-3xl tracking-wide">
            Блогер
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Новости, разборы и инсайты от команды CyberVibe
          </p>
        </div>
        <div className="ml-auto">
          <Link
            href="/"
            className="text-brand-cyan hover:text-brand-cyan/80 text-sm underline underline-offset-4"
          >
            На главную
          </Link>
        </div>
      </header>

      {res.meta?.usedFallback && (
        <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
          Внимание: показаны демонстрационные посты (таблица <code>blog_posts</code> не найдена
          или недоступна). Добавь таблицу — и данные подтянутся автоматически.
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          Постов пока нет.
        </div>
      ) : (
        <section
          className="grid gap-3 sm:gap-4 md:gap-6
                     grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
        >
          {posts.map((post) => (
            <ArticleCard key={post.slug} post={post} />
          ))}
        </section>
      )}
    </div>
  );
}