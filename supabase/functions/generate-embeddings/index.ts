// supabase/functions/generate-embeddings/index.ts
 
import { SupabaseClient, createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { Session } from 'npm:@supabase/ai@0.1.0';

// Initialize the embedding model
const model = new Session('gte-small');

// Type definitions
interface Car {
  id: string;
  make: string;
  model: string;
  description: string;
  specs: Record<string, any>;
  embedding?: number[];
}

// Helper function to combine car data into text
function getCombinedText(car: Car): string {
  return `${car.make} ${car.model} ${car.description} ${JSON.stringify(car.specs || {})}`;
}

// Main handler
Deno.serve(async (req: Request) => {
  try {
    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Handle different routes
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'POST' && path === '/generate-embeddings/batch') {
      // Batch processing of all cars without embeddings
      const { data: cars, error: fetchError } = await supabase
        .from('cars')
        .select('id, make, model, description, specs')
        .is('embedding', null);

      if (fetchError) {
        throw new Error(`Failed to fetch cars: ${fetchError.message}`);
      }

      if (!cars?.length) {
        return new Response(
          JSON.stringify({ message: 'No cars need embeddings' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Process embeddings in background
      const updatePromises = cars.map(async (car: Car) => {
        const text = getCombinedText(car);
        const embedding = await model.run(text, { 
          mean_pool: true, 
          normalize: true 
        });

        return supabase
          .from('cars')
          .update({ embedding: Array.from(embedding) })
          .eq('id', car.id);
      });

      // Run updates in background without blocking response
      EdgeRuntime.waitUntil(Promise.all(updatePromises));

      return new Response(
        JSON.stringify({ 
          message: 'Embedding generation started',
          count: cars.length 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && path === '/generate-embeddings/single') {
      // Process single car embedding
      const { carId } = await req.json();
      
      const { data: car, error: fetchError } = await supabase
        .from('cars')
        .select('id, make, model, description, specs')
        .eq('id', carId)
        .single();

      if (fetchError || !car) {
        throw new Error(`Car not found: ${fetchError?.message}`);
      }

      const text = getCombinedText(car);
      const embedding = await model.run(text, { 
        mean_pool: true, 
        normalize: true 
      });

      const { error: updateError } = await supabase
        .from('cars')
        .update({ embedding: Array.from(embedding) })
        .eq('id', car.id);

      if (updateError) {
        throw new Error(`Failed to update embedding: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({ message: 'Embedding generated successfully' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 
