// utils/embeddingGenerator.ts
import { pipeline } from "@huggingface/transformers";
import { supabaseAdmin } from "@/hooks/supabase"

export async function generateCarEmbeddings() {
  const cars = await supabaseAdmin.from('cars').select('*');
  
  const pipe = await pipeline(
    "feature-extraction",
    "Supabase/gte-small",
    { quantized: true }
  );

  for (const car of cars.data) {
    const output = await pipe(car.description, {
      pooling: "mean",
      normalize: true
    });
    
    const embedding = Array.from(output.data);
    
    await supabaseAdmin
      .from('cars')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', car.id);
  }
}

