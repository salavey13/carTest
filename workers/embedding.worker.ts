// workers/embedding.worker.ts
import { pipeline } from "@huggingface/transformers";

self.addEventListener("message", async (event) => {
  const pipe = await pipeline(
    "feature-extraction",
    "Supabase/gte-small",
    { quantized: true }
  );
  
  const output = await pipe(event.data.text, {
    pooling: "mean",
    normalize: true
  });
  
  self.postMessage({
    status: "complete",
    embedding: Array.from(output.data)
  });
});

