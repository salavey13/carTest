import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/hooks/supabase";

// Simplified embedding generator
function generateSimplifiedEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return new Array(384).fill(0);

  const embedding = new Array(384).fill(0);
  const wordCount: { [key: string]: number } = {};

  // Count word frequencies
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Hash-based distribution with frequency weighting
  Object.entries(wordCount).forEach(([word, count], index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % 10007;
    }
    const baseIdx = (hash + index * 17) % 384;
    for (let i = 0; i < 5; i++) { // Spread across 5 dimensions
      const idx = (baseIdx + i) % 384;
      embedding[idx] += (count / words.length) * (1 - i * 0.1); // Decay effect
    }
  });

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

export async function POST(request: Request) {
  const { query } = await request.json();
  if (!query) {
    return NextResponse.json({ error: "Запрос обязателен" }, { status: 400 });
  }

  try {
    console.log("Генерация эмбеддинга для запроса:", query);
    const queryEmbedding = generateSimplifiedEmbedding(query);
    console.log("Эмбеддинг сгенерирован, первые 5 значений:", queryEmbedding.slice(0, 5));

    console.log("Вызов RPC Supabase с эмбеддингом");
    const { data, error } = await supabaseAdmin.rpc("search_cars", {
      query_embedding: queryEmbedding,
      match_count: 5,
    });

    if (error) {
      console.error("Ошибка RPC Supabase:", error);
      throw new Error(error.message);
    }
    console.log("Результаты поиска:", data);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Ошибка API поиска:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

