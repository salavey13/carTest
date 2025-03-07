// scripts/batchUpdateEmbeddings.ts
import { generateCarEmbedding } from "@/hooks/supabase";
import { debugLogger } from "@/lib/debugLogger";

async function batchUpdateEmbeddings() {
  debugLogger.log("Starting batch embedding update...");
  try {
    await generateCarEmbedding(); // Batch process all cars without embeddings
    debugLogger.log("Batch embedding generation triggered successfully");
  } catch (error) {
    debugLogger.error("Error in batch update:", error);
  }
}

if (require.main === module) {
  batchUpdateEmbeddings()
    .then(() => debugLogger.log("Done"))
    .catch((err) => debugLogger.error("Fatal error:", err));
}
