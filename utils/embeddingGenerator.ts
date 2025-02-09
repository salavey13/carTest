// utils/embeddingGenerator.ts
import { pipeline } from "@huggingface/transformers";
import { supabaseAdmin } from "@/hooks/supabase";

export async function generateCarEmbeddings() {
  console.log("🚀 Starting embedding generation for cars...");
  
  // Fetch all cars from Supabase
  const { data: cars, error: fetchError } = await supabaseAdmin.from("cars").select("*");
  if (fetchError) {
    console.error("💥 Fuck, couldn't fetch cars:", fetchError);
    return;
  }

  console.log(✅ Fetched ${cars.length} car(s) from the DB.);
  
  // Load the embedding pipeline
  console.log("⏳ Loading embedding pipeline...");
  let pipe;
  try {
    pipe = await pipeline("feature-extraction", "Supabase/gte-small", {
      quantized: true,
    });
    console.log("✅ Embedding pipeline loaded successfully.");
  } catch (pipeError) {
    console.error("💥 Fuck, failed to load embedding pipeline:", pipeError);
    return;
  }

  // Process each car
  for (const car of cars) {
    try {
      console.log(🔍 Processing car with ID: ${car.id}...);

      // Combine description and specs into a single text input
      const specsString = JSON.stringify(car.specs || {}); // Convert specs to JSON string
      const combinedText = ${car.description} ${specsString}; // Concatenate description and specs

      // Generate embedding
      const output = await pipe(combinedText, {
        pooling: "mean",
        normalize: true,
      });

      const embedding = Array.from(output.data);

      // Update the car record with the new embedding
      const { error: updateError } = await supabaseAdmin
        .from("cars")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", car.id);

      if (updateError) {
        console.error(💥 Fuck, failed to update car with ID ${car.id}:, updateError);
      } else {
        console.log(✅ Successfully updated car with ID: ${car.id}.);
      }
    } catch (err) {
      console.error(💥 Error processing car with ID ${car.id}:, err);
    }
  }

  console.log("🎉 Finished embedding generation for all cars.");
}

// If this script is run directly via npx tsx utils/embeddingGenerator.ts
if (require.main === module) {
  generateCarEmbeddings()
    .then(() => console.log("👌 Done."))
    .catch((err) => console.error("💥 Fatal error:", err));
}

