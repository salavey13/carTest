import { NextApiRequest, NextApiResponse } from "next";
import { pipeline } from "@huggingface/transformers";
import { supabaseAdmin } from "@/hooks/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Запрос обязателен" });
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
    return res.status(200).json(data || []);
  } catch (error) {
    console.error("Ошибка API поиска:", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
}
