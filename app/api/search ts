import { NextResponse } from "next/server";
import { pipeline } from "@huggingface/transformers";
import { supabaseAdmin } from "@/hooks/supabase";

export async function POST(request: Request) {
  const { query } = await request.json();
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    // Generate embedding with Supabase/gte-small
    const pipe = await pipeline("feature-extraction", "Supabase/gte-small", { quantized: true });
    const output = await pipe(query, { pooling: "mean", normalize: true });
    const queryEmbedding = Array.from(output.data);

    // Query Supabase using search_cars RPC
    const { data, error } = await supabaseAdmin.rpc("search_cars", {
      query_embedding: queryEmbedding,
      match_count: 5,
    });

    if (error) throw new Error(error.message);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
