import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { debugLogger as logger } from "@/lib/debugLogger";

type Supabase = ReturnType<typeof createClient<Database>>;

function getSupabaseAnon(): Supabase | null {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      logger.warn("[BlogFetch] Supabase env missing. Using fallback.");
      return null;
    }
    return createClient<Database>(url, key, { auth: { persistSession: false } });
  } catch (e) {
    logger.error("[BlogFetch] Failed to init Supabase", e);
    return null;
  }
}

export interface BloggerPostRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  author: string | null;
  author_avatar: string | null;
  published_at: string | null;
  content?: string | null;
  tags?: string[] | null;
  is_test_result?: boolean;
}

interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
  meta?: { usedFallback?: boolean };
}

/** Fallback demo data if table is absent/unavailable */
function fallbackPosts(): BloggerPostRecord[] {
  return [
    {
      id: "demo-1",
      slug: "welcome-to-cybervibe",
      title: "Добро пожаловать в блог CyberVibe",
      excerpt: "Стартуем: что мы строим, зачем и куда летим.",
      cover_url: "/placeholder-wide.jpg",
      author: "Архитектор",
      author_avatar: "/logo.png",
      published_at: new Date().toISOString(),
      content:
        "<p>Это демонстрационный пост. Подключи таблицу <code>blog_posts</code>, и здесь появится живой контент.</p>",
      tags: ["start", "vision"],
      is_test_result: true,
    },
    {
      id: "demo-2",
      slug: "weekly-digest-01",
      title: "Weekly Digest #1: апдейты студии",
      excerpt: "Подборка апдейтов и заметок за неделю.",
      cover_url: "/placeholder-wide.jpg",
      author: "Архитектор",
      author_avatar: "/logo.png",
      published_at: new Date(Date.now() - 86400000).toISOString(),
      content:
        "<p>Дай таблицу — будут живые апдейты. Сейчас это лишь заглушка.</p>",
      tags: ["digest"],
      is_test_result: true,
    },
  ];
}

/** Fetch list of posts */
export async function fetchBloggerArticles(options?: {
  limit?: number;
}): Promise<FetchResult<BloggerPostRecord[]>> {
  const supabase = getSupabaseAnon();
  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 100);

  if (!supabase) {
    logger.info("[BlogFetch] No Supabase client. Returning fallback posts.");
    return { success: true, data: fallbackPosts(), meta: { usedFallback: true } };
  }

  try {
    // Ожидаем таблицу public.blog_posts
    const { data, error } = await supabase
      .from("blog_posts" as any) // тип в Database не описан — приводим к any
      .select(
        "id, slug, title, excerpt, cover_url, author, author_avatar, published_at, tags"
      )
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("[BlogFetch] Supabase error (list)", error);
      return {
        success: true,
        data: fallbackPosts(),
        meta: { usedFallback: true },
        error: { message: error.message, code: error.code },
      };
    }

    const casted = (data || []) as BloggerPostRecord[];
    return { success: true, data: casted };
  } catch (e: any) {
    logger.error("[BlogFetch] Unexpected error (list)", e);
    return {
      success: true,
      data: fallbackPosts(),
      meta: { usedFallback: true },
      error: { message: e?.message || "Unexpected error" },
    };
  }
}

/** Fetch single post by slug */
export async function fetchBloggerArticleBySlug(
  slug: string
): Promise<FetchResult<BloggerPostRecord | null>> {
  const supabase = getSupabaseAnon();

  if (!slug) {
    return {
      success: false,
      data: null,
      error: { message: "Slug is required" },
    };
  }

  if (!supabase) {
    const fb = fallbackPosts().find((p) => p.slug === slug) || null;
    return { success: true, data: fb, meta: { usedFallback: true } };
  }

  try {
    const { data, error } = await supabase
      .from("blog_posts" as any)
      .select(
        "id, slug, title, excerpt, cover_url, author, author_avatar, published_at, content, tags"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      logger.error("[BlogFetch] Supabase error (bySlug)", { slug, error });
      const fb = fallbackPosts().find((p) => p.slug === slug) || null;
      return {
        success: true,
        data: fb,
        meta: { usedFallback: true },
        error: { message: error.message, code: error.code },
      };
    }

    return { success: true, data: (data as BloggerPostRecord) || null };
  } catch (e: any) {
    logger.error("[BlogFetch] Unexpected error (bySlug)", { slug, error: e });
    const fb = fallbackPosts().find((p) => p.slug === slug) || null;
    return {
      success: true,
      data: fb,
      meta: { usedFallback: true },
      error: { message: e?.message || "Unexpected error" },
    };
  }
}