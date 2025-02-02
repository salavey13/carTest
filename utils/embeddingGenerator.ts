// utils/embeddingGenerator.ts
/*Expected logs from "npx utils/embeddingGenerator.ts:
🚀 Starting embedding generation for cars...
✅ Fetched 10 car(s) from the DB.
⏳ Loading embedding pipeline...
dtype not specified for "model". Using the default dtype (fp32)
for this device (cpu).
✅ Embedding pipeline loaded successfully.
🔍 Processing car with ID: tesla-roadster...
✅ Successfully updated car with ID: tesla-roadster.
🔍 Processing car with ID: ferrari-sf90...
✅ Successfully updated car with ID: ferrari-sf90.
🔍 Processing car with ID: porsche-911...
✅ Successfully updated car with ID: porsche-911.
🔍 Processing car with ID: lamborghini-huracan...
✅ Successfully updated car with ID: lamborghini-huracan.
🔍 Processing car with ID: mclaren-720s...
✅ Successfully updated car with ID: mclaren-720s.
🔍 Processing car with ID: 1...
✅ Successfully updated car with ID: 1.
🔍 Processing car with ID: 2...
✅ Successfully updated car with ID: 2.
🔍 Processing car with ID: 3...
✅ Successfully updated car with ID: 3.
🔍 Processing car with ID: 4...
✅ Successfully updated car with ID: 4.
🔍 Processing car with ID: 5...
✅ Successfully updated car with ID: 5.
🎉 Finished embedding generation for all cars.
👌 Done.

*/
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
  
  console.log(`✅ Fetched ${cars.length} car(s) from the DB.`);

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
      console.log(`🔍 Processing car with ID: ${car.id}...`);
      
      // Generate embedding
      const output = await pipe(car.description, {
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
        console.error(`💥 Fuck, failed to update car with ID ${car.id}:`, updateError);
      } else {
        console.log(`✅ Successfully updated car with ID: ${car.id}.`);
      }
    } catch (err) {
      console.error(`💥 Error processing car with ID ${car.id}:`, err);
    }
  }

  console.log("🎉 Finished embedding generation for all cars.");
}

// If this script is run directly via `npx tsx utils/embeddingGenerator.ts`
if (require.main === module) {
  generateCarEmbeddings()
    .then(() => console.log("👌 Done."))
    .catch((err) => console.error("💥 Fatal error:", err));
}

