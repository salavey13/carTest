"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { fetchBloggerArticleBySlug } from "@/lib/blog/fetchBloggerArticles";
import { use } from "react";

function randomUnsplash(seed: string) {
  const collections = [
    "streamer", "community", "gaming", "sauna", "cyberpunk", "future"
  ];
  const query = collections[Math.floor(Math.random() * collections.length)];
  return `https://source.unsplash.com/random/1200x800/?${query}&sig=${seed}`;
}

export default function BloggerPostPageWrapper({ params }: { params: { slug: string } }) {
  const res = use(fetchBloggerArticleBySlug(params.slug));
  return <BloggerPostPage post={res.data} usedFallback={res.meta?.usedFallback} />;
}

interface Props {
  post: Awaited<ReturnType<typeof fetchBloggerArticleBySlug>>["data"];
  usedFallback?: boolean;
}

function BloggerPostPage({ post, usedFallback }: Props) {
  if (!post) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-orbitron text-2xl md:text-3xl mb-2">Пост не найден</h1>
        <p className="text-gray-500 mb-6">
          Возможно, он был удалён или адрес введён неверно.
        </p>
        <Link href="/blogger" className="text-brand-cyan underline underline-offset-4">
          ← Вернуться в блог
        </Link>
      </div>
    );
  }

  const cover = post.cover_url || randomUnsplash(post.slug);

  return (
    <article className="container mx-auto px-4 py-10 max-w-3xl">
      <motion.header
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-brand-purple/40">
            <Image
              src={post.author_avatar || "/logo.png"}
              alt={post.author || "Author"}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="font-orbitron text-3xl md:text-4xl text-brand-purple">
              {post.title}
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
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

        <div className="relative w-full h-56 md:h-80 rounded-2xl overflow-hidden ring-2 ring-brand-purple/40 shadow-lg">
          <Image
            src={cover}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      </motion.header>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="prose max-w-none prose-p:my-3 prose-headings:font-orbitron prose-img:rounded-xl prose-img:shadow-md"
      >
        {post.content ? (
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        ) : (
          <p className="text-gray-500">Контент временно недоступен.</p>
        )}
      </motion.div>

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

      {usedFallback && (
        <p className="mt-6 text-xs text-yellow-700">
          ⚠️ Пост загружен из демонстрационной коллекции.
        </p>
      )}
    </article>
  );
}