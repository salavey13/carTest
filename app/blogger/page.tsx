"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { fetchBloggerArticles } from "@/lib/blog/fetchBloggerArticles";
import ArticleCard from "@/components/blog/ArticleCard";
import { use } from "react";

// helper: random unsplash pic
function randomUnsplash(seed: string) {
  const collections = [
    "gaming", "music", "technology", "cyberpunk", "neon", "community", "party", "sauna"
  ];
  const query = collections[Math.floor(Math.random() * collections.length)];
  return `https://source.unsplash.com/random/800x600/?${query}&sig=${seed}`;
}

export default function BloggerPageWrapper() {
  // Next.js 13 app dir → can’t use async directly with motion easily
  const dataPromise = fetchBloggerArticles({ limit: 24 });
  const res = use(dataPromise);

  const posts = useMemo(() => {
    return (res.data || []).map((p, i) => ({
      ...p,
      cover_url: p.cover_url || randomUnsplash(String(i)),
    }));
  }, [res]);

  return <BloggerPage posts={posts} usedFallback={res.meta?.usedFallback} />;
}

interface Props {
  posts: Awaited<ReturnType<typeof fetchBloggerArticles>>["data"];
  usedFallback?: boolean;
}

function BloggerPage({ posts, usedFallback }: Props) {
  return (
    <div className="container mx-auto px-4 py-10">
      <motion.header
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-10 flex items-center gap-4"
      >
        <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-brand-cyan/50 shadow-md">
          <Image src="/logo.png" alt="Blogger" fill className="object-cover" />
        </div>
        <div>
          <h1 className="font-orbitron text-3xl md:text-4xl tracking-wider text-brand-cyan drop-shadow-lg">
            Блоггер Демо (Level 1)
          </h1>
          <p className="text-sm text-gray-600">
            Здесь мы тестим VIP фан менеджмент, донаты и фановый движ
          </p>
        </div>
        <div className="ml-auto">
          <Link
            href="/"
            className="text-brand-purple hover:text-brand-purple/80 text-sm underline underline-offset-4"
          >
            На главную
          </Link>
        </div>
      </motion.header>

      {usedFallback && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-50 p-3 text-sm text-yellow-800"
        >
          ⚠️ Внимание: пока что это <b>демо</b>. Подключи таблицу{" "}
          <code>blog_posts</code> в Supabase, и статьи будут подгружаться
          автоматически.
        </motion.div>
      )}

      {(!posts || posts.length === 0) ? (
        <div className="text-center text-gray-500 py-20">
          Постов пока нет.
        </div>
      ) : (
        <motion.section
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0, y: 40 },
            show: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
          }}
          className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {posts.map((post, i) => (
            <motion.div
              key={post.slug}
              whileHover={{ scale: 1.05, rotate: -1 }}
              className="transition"
            >
              <ArticleCard post={post} />
            </motion.div>
          ))}
        </motion.section>
      )}
    </div>
  );
}