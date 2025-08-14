"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BloggerPost {
  slug: string;
  title: string;
  excerpt?: string | null;
  cover_url?: string | null;
  author?: string | null;
  author_avatar?: string | null;
  published_at?: string | null;
  tags?: string[];
}

export default function ArticleCard({ post }: { post: BloggerPost }) {
  return (
    <Link
      href={`/blogger/${post.slug}`}
      className={cn(
        "group relative rounded-xl overflow-hidden border-2 border-transparent",
        "bg-dark-card/70 hover:bg-dark-card/90",
        "transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5",
        "shadow-md hover:shadow-lg"
      )}
    >
      <div className="relative h-40 md:h-44 w-full overflow-hidden">
        <Image
          src={post.cover_url || "/placeholder-wide.jpg"}
          alt={post.title}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      <div className="p-3 md:p-4">
        <h3 className="font-orbitron text-sm md:text-base leading-tight mb-1 line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
            {post.excerpt}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11px] md:text-xs text-muted-foreground">
          <span>{post.author || "Автор"}</span>
          <span>•</span>
          <span>{post.published_at?.slice(0, 10) || "—"}</span>
        </div>
      </div>
    </Link>
  );
}