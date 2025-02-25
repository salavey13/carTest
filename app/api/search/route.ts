import { NextResponse } from "next/server";
import { pipeline } from "@huggingface/transformers";
import { supabaseAdmin } from "@/hooks/supabase";

export async function POST(request: Request) {
  const { query } = await request.json();
  if (!query) {
    return NextResponse.json({ error: "Запрос обязателен" }, { status: 400 });
  }

  try {
    console.log("Генерация эмбеддинга для запроса:", query);
    const pipe = await pipeline("feature-extraction", "Supabase/gte-small", { quantized: true });
    const output = await pipe(query, { pooling: "mean", normalize: true });
    const queryEmbedding = Array.from(output.data);
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
