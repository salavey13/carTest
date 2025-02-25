import { supabaseAdmin } from "@/hooks/supabase";
import { debugLogger } from "@/lib/debugLogger";

// Match the vector dimensions with the database
const VECTOR_DIMENSIONS = 384;

// Simplified embedding generator (same as in CarSubmissionForm)
function generateSimplifiedEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return new Array(VECTOR_DIMENSIONS).fill(0);

  const embedding = new Array(VECTOR_DIMENSIONS).fill(0);
  const wordCount: { [key: string]: number } = {};

  // Count word frequencies
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Hash-based distribution with frequency weighting
  Object.entries(wordCount).forEach(([word, count], index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) % 10007; // Robust hashing
    }
    const baseIdx = Math.abs(hash + index * 23) % VECTOR_DIMENSIONS;
    for (let i = 0; i < 7; i++) { // Spread across 7 dimensions
      const idx = (baseIdx + i * 3) % VECTOR_DIMENSIONS;
      embedding[idx] += (count / words.length) * (1 - i * 0.05); // Smoother decay
    }
  });

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

export async function generateCarEmbeddings() {
  debugLogger.log("🚀 Starting simplified embedding generation for cars...");

  const { data: cars, error: fetchError } = await supabaseAdmin.from("cars").select("*");
  if (fetchError) {
    debugLogger.error("Error fetching cars:", fetchError);
    return;
  }

  debugLogger.log(`✅ Fetched ${cars.length} car(s) from the DB.`);

  for (const car of cars) {
    try {
      debugLogger.log(`🔍 Processing car with ID: ${car.id}...`);

      const specsString = JSON.stringify(car.specs || {});
      const combinedText = `${car.make} ${car.model} ${car.description} ${specsString}`; // Include make/model for richer embedding

      const embedding = generateSimplifiedEmbedding(combinedText);

      if (!embedding || embedding.length !== VECTOR_DIMENSIONS) {
        throw new Error(`Invalid embedding dimensions: got ${embedding.length}, expected ${VECTOR_DIMENSIONS}`);
      }

      const { error: updateError } = await supabaseAdmin
        .from("cars")
        .update({ embedding })
        .eq("id", car.id);

      if (updateError) {
        debugLogger.error(`Failed to update car with ID ${car.id}:`, updateError);
      } else {
        debugLogger.log(`✅ Successfully updated car with ID: ${car.id}.`);
      }
    } catch (err) {
      debugLogger.error(`Error processing car with ID ${car.id}:`, err);
    }
  }

  debugLogger.log("🎉 Finished simplified embedding generation for all cars.");
}

if (require.main === module) {
  generateCarEmbeddings()
    .then(() => debugLogger.log("👌 Done."))
    .catch((err) => debugLogger.error("Fatal error:", err));
}

