// /utils/embeddingGenerator.ts
// Use dynamic import to avoid bundling @xenova/transformers during build
import { supabaseAdmin } from "@/hooks/supabase"
import { debugLogger } from "@/lib/debugLogger"

// Match the vector dimensions with the database
const VECTOR_DIMENSIONS = 384
const MODEL_NAME = "Supabase/gte-small"
const MODEL_OPTIONS = { quantized: true }

export async function generateCarEmbeddings() {
  debugLogger.log("🚀 Starting embedding generation for cars...")

  const { data: cars, error: fetchError } = await supabaseAdmin.from("cars").select("*")
  if (fetchError) {
    debugLogger.error("Error fetching cars:", fetchError)
    return
  }

  debugLogger.log(`✅ Fetched ${cars.length} car(s) from the DB.`)

  debugLogger.log("⏳ Loading embedding pipeline...")
  let pipe
  try {
    // Dynamic import to avoid bundling during build
    const { pipeline } = await import("@xenova/transformers")
    pipe = await pipeline("feature-extraction", MODEL_NAME, MODEL_OPTIONS)
    debugLogger.log("✅ Embedding pipeline loaded successfully.")
  } catch (pipeError) {
    debugLogger.error("Failed to load embedding pipeline:", pipeError)
    return
  }

  for (const car of cars) {
    try {
      debugLogger.log(`🔍 Processing car with ID: ${car.id}...`)

      const specsString = JSON.stringify(car.specs || {})
      const combinedText = `${car.description}\n${specsString}`

      const output = await pipe(combinedText, {
        pooling: "mean",
        normalize: true,
      })

      const embedding = Array.from(output.data)

      if (!embedding || embedding.length !== VECTOR_DIMENSIONS) {
        throw new Error(`Invalid embedding dimensions: got ${embedding.length}, expected ${VECTOR_DIMENSIONS}`)
      }

      const { error: updateError } = await supabaseAdmin.from("cars").update({ embedding }).eq("id", car.id)

      if (updateError) {
        debugLogger.error(`Failed to update car with ID ${car.id}:`, updateError)
      } else {
        debugLogger.log(`✅ Successfully updated car with ID: ${car.id}.`)
      }
    } catch (err) {
      debugLogger.error(`Error processing car with ID ${car.id}:`, err)
    }
  }

  debugLogger.log("🎉 Finished embedding generation for all cars.")
}

if (require.main === module) {
  generateCarEmbeddings()
    .then(() => debugLogger.log("👌 Done."))
    .catch((err) => debugLogger.error("Fatal error:", err))
}

