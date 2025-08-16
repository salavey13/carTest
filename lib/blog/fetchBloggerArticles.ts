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
      id: "streamer-vip-intro",
      slug: "streamer-vip-intro",
      title: "Стример + VIP фан менеджмент: зачем вообще это нужно?",
      excerpt: "Первая демка: блог для стримера, фан-система и донаты с мозгами.",
      cover_url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
      author: "VibeRider",
      author_avatar: "/logo.png",
      published_at: new Date().toISOString(),
      content: `
        <p>Это не просто блог. Это демо-платформа для стримера, где фанаты превращаются
        в <b>VIP-комьюнити</b>. Здесь мы тестим Level 1: блог + донаты, 
        а дальше — больше.</p>
        <p>Фан может не только закинуть донат, а реально участвовать в движухе,
        апгрейдить свой статус и влиять на развитие контента.</p>
        <p>🔥 Это твой шанс потрогать то, что скоро станет стандартом — 
        <a href="/about_en">читай подробнее про уровни</a>.</p>
      `,
      tags: ["стример", "vip", "донаты", "level1"],
      is_test_result: true,
    },
    {
      id: "why-sauna-pack",
      slug: "why-sauna-pack",
      title: "Почему Sauna Pack — топовый мерч для стримера",
      excerpt: "Футболки? Стикеры? Скучно. Настоящий флекс — это банный пак.",
      cover_url: "https://images.unsplash.com/photo-1606904825846-9752c7e4b9ae",
      author: "CyberSauna",
      author_avatar: "/logo.png",
      published_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
      content: `
        <p>Мы долго думали, какой мерч зайдёт стримеру. И ответ оказался прост:
        <b>баня</b>. Sauna Pack — это не про "футболку с логотипом". Это про
        опыт, который фанаты <i>запомнят</i>.</p>
        <p>VIP-фаны могут арендовать баню через <a href="/sauna-rent">сауна-аренду</a>,
        собрать тусу, и это будет не просто донат, а настоящий IRL experience.</p>
        <p>Кто сказал, что мерч должен пылиться на полке? Мы говорим — VIBE должен
        проживаться вживую.</p>
      `,
      tags: ["мерч", "сауна", "vip", "irl"],
      is_test_result: true,
    },
    {
      id: "roadmap-lvl1-2-3",
      slug: "roadmap-lvl1-2-3",
      title: "Roadmap: Level 1 → Level 2 → Level 3",
      excerpt: "Как блог стримера превратится в целую кибер-экосистему.",
      cover_url: "https://images.unsplash.com/photo-1522199710521-72d69614c702",
      author: "Архитектор",
      author_avatar: "/logo.png",
      published_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      content: `
        <p>Сейчас у нас Level 1: блог, донаты, VIP-менеджмент. 
        Но это только начало.</p>
        <ul>
          <li>⚡ Level 2: интеграция сервисов — аренда саун, байков, кастомные офферы.
          См. <a href="/vipbikerentals">VIP Bike Rentals</a>.</li>
          <li>🚀 Level 3: агрегатор. Вся движуха фанатов, сервисов и стримера
          в одной системе (<a href="/about_en">подробнее тут</a>).</li>
        </ul>
        <p>Идея проста: фан = игрок. Он не просто донатит — он участвует в игре.</p>
      `,
      tags: ["roadmap", "level2", "level3", "экосистема"],
      is_test_result: true,
    },
    {
      id: "vip-fan-game",
      slug: "vip-fan-game",
      title: "VIP фан = игрок. Это не донат, это игра",
      excerpt: "Как мы превращаем донаты в реальную геймификацию.",
      cover_url: "https://images.unsplash.com/photo-1614282845958-f7d3f2f67c87",
      author: "VibeTeam",
      author_avatar: "/logo.png",
      published_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
      content: `
        <p>Фанат устал от тупых донатов, где максимум — твой ник на экране?
        У нас другой подход. Здесь фан = игрок.</p>
        <p>Он апгрейдит статус, получает реальные плюшки (например,
        аренду байка через <a href="/vipbikerentals">наш сервис</a> или
        VIP-поход в баню через <a href="/sauna-rent">сауна-аренду</a>).</p>
        <p>Каждый шаг — это часть <b>большой игры</b>, где выигрывают и стример,
        и фанаты.</p>
      `,
      tags: ["vip", "геймификация", "донаты", "игра"],
      is_test_result: true,
    },
    {
      id: "goal-profit",
      slug: "goal-profit",
      title: "Цель и профит: зачем мы строим эту экосистему?",
      excerpt: "Не просто заработать. Создать движ, где профит рождается сам.",
      cover_url: "https://images.unsplash.com/photo-1531297484001-80022131f5a1",
      author: "VibeStrategist",
      author_avatar: "/logo.png",
      published_at: new Date(Date.now() - 3600 * 1000 * 96).toISOString(),
      content: `
        <p>Многие спрашивают: "Зачем вам всё это? Не проще ли сразу рвануть
        в байк-аренду или другие хайповые сервисы?"</p>
        <p>Ответ прост: <b>мы строим фундамент</b>. 
        Блог стримера (Level 1) — это тест-песочница. 
        Здесь мы проверяем механики донатов, VIP-управления, вовлечения фанатов.</p>
        <p>На <a href="/sauna-rent">Level 2 (сауна)</a> и 
        <a href="/vipbikerentals">VIP-байках</a> мы уже выходим в реальный мир: 
        даём фанам не только цифровые, но и IRL бонусы.</p>
        <p>А <a href="/about_en">Level 3</a> — это когда вся движуха собирается 
        в одной точке. Там и появляется настоящий профит: от синергии фанатов, 
        сервисов и создателей контента.</p>
        <p>Так что цель у нас не "срубить кэш", а <b>создать игру</b>, 
        в которой выигрывают все. 
        <br/>🚀 И да, мы делаем это с юмором и в кайф, потому что по-другому 
        у нас просто не получается.</p>
      `,
      tags: ["цель", "профит", "roadmap", "экосистема"],
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
    const { data, error } = await supabase
      .from("blog_posts" as any)
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