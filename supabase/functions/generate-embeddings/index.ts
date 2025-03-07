// supabase/functions/generate-embeddings/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { Session } from 'npm:@supabase/ai@0.1.0';

// Initialize the embedding model
const model = new Session('gte-small');

// Type definitions
interface Car {
  id?: string; // Optional for new cars
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

    const url = new URL(req.url);
    const path = url.pathname;

    // New route for UI-based car creation
    if (req.method === 'POST' && path === '/generate-embeddings/create') {
      const carData: Omit<Car, 'id' | 'embedding'> = await req.json();
      
      // Validate required fields
      if (!carData.make || !carData.model || !carData.description) {
        throw new Error('Missing required fields: make, model, or description');
      }

      // Generate embedding
      const text = getCombinedText(carData);
      const embedding = await model.run(text, { 
        mean_pool: true, 
        normalize: true 
      });

      // Insert new car with embedding
      const { data: newCar, error: insertError } = await supabase
        .from('cars')
        .insert({
          ...carData,
          embedding: Array.from(embedding),
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Failed to create car: ${insertError.message}`);
      }

      return new Response(
        JSON.stringify({ 
          message: 'Car created with embedding successfully',
          carId: newCar.id 
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Existing batch processing route
    if (req.method === 'POST' && path === '/generate-embeddings/batch') {
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

      EdgeRuntime.waitUntil(Promise.all(updatePromises));

      return new Response(
        JSON.stringify({ 
          message: 'Embedding generation started',
          count: cars.length 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Existing single car processing route
    if (req.method === 'POST' && path === '/generate-embeddings/single') {
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
