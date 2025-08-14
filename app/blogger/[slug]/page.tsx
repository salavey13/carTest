import React from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchBloggerArticleBySlug } from "@/lib/blog/fetchBloggerArticles";
import { debugLogger as logger } from "@/lib/debugLogger";

interface PageProps {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export default async function BloggerPostPage({ params }: PageProps) {
  const { slug } = params;
  const res = await fetchBloggerArticleBySlug(slug);

  if (!res.success) {
    logger.error("[BloggerPostPage] Failed to load post", { slug, error: res.error });
  }

  const post = res.data;

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-orbitron text-2xl md:text-3xl mb-2">Пост не найден</h1>
        <p className="text-muted-foreground mb-6">
          Возможно, он был удалён или адрес введён неверно.
        </p>
        <Link href="/blogger" className="text-brand-cyan underline underline-offset-4">
          ← Вернуться в блог
        </Link>
      </div>
    );
  }

  return (
    <article className="container mx-auto px-4 py-6 md:py-10 max-w-3xl">
      <header className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 md:gap-4 mb-3">
          <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-xl overflow-hidden ring-2 ring-brand-cyan/50">
            <Image
              src={post.author_avatar || "/logo.png"}
              alt={post.author || "Author"}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="font-orbitron text-2xl md:text-3xl">{post.title}</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {post.author || "Автор"} • {post.published_at?.slice(0, 10) || "—"}
            </p>
          </div>
          <div className="ml-auto">
            <Link
              href="/blogger"
              className="text-brand-cyan hover:text-brand-cyan/80 text-sm underline underline-offset-4"
            >
              В блог
            </Link>
          </div>
        </div>

        {post.cover_url && (
          <div className="relative w-full h-48 md:h-72 rounded-2xl overflow-hidden ring-2 ring-brand-purple/40 shadow-lg mb-4 md:mb-6">
            <Image
              src={post.cover_url}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          </div>
        )}
      </header>

      <div className="prose prose-invert max-w-none prose-p:my-3 prose-headings:font-orbitron">
        {/* В реальном проекте здесь можно рендерить Markdown/MDX.
            Для безопасности уже приходящий из БД HTML можно пропускать через санитайзер. */}
        {post.content ? (
          <div
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <p className="text-muted-foreground">
            Контент временно недоступен.
          </p>
        )}
      </div>

      {post.tags?.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 rounded-md border border-brand-cyan/40 text-brand-cyan/90"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}