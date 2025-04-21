import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateJwtToken } from "@/lib/auth";
import type { WebAppUser } from "@/types/telegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; // Use standard logger for errors/warnings
import type { Database } from "@/types/database.types";

// --- Type Aliases ---
// (Restored and merged from reference and new additions)
type DbUser = Database["public"]["Tables"]["users"]["Row"];
type DbCar = Database["public"]["Tables"]["cars"]["Row"];
type DbInvoice = Database["public"]["Tables"]["invoices"]["Row"];
type DbRental = Database["public"]["Tables"]["rentals"]["Row"];
type DbTask = Database["public"]["Tables"]["tasks"]["Row"]; // From reference
type DbCharacter = Database["public"]["Tables"]["characters"]["Row"]; // From reference
type DbVideo = Database["public"]["Tables"]["videos"]["Row"]; // From reference
type DbSubscription = Database["public"]["Tables"]["subscriptions"]["Row"]; // Assuming you have a subscriptions table (from reference)
type DbArticle = Database["public"]["Tables"]["articles"]["Row"]; // Added for Articles
type DbArticleSection = Database["public"]["Tables"]["article_sections"]["Row"]; // Added for Article Sections
// Add other types if needed, e.g., VPR types if used in this hook file
// type DbVprSubject = Database["public"]["Tables"]["subjects"]["Row"];
// .. etc.


// --- Supabase Client Initialization ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

if (!supabaseUrl || !supabaseAnonKey) {
    logger.error("Supabase URL or Anon Key is missing from environment variables.");
    // Consider throwing an error here if essential
    // throw new Error("Supabase URL or Anon Key is missing from environment variables.");
}
if (!serviceRoleKey) {
    // Log warning but don't throw, admin client might not be needed everywhere immediately
    logger.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations might fail.");
}

// Public client (for anonymous access or RLS-protected user access with JWT)
export const supabaseAnon: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Admin client (for server-side operations requiring elevated privileges)
// Ensure this is ONLY used on the server and never exposed to the client.
export const supabaseAdmin: SupabaseClient<Database> = serviceRoleKey
    ? createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            // Prevent client-side persistence/auth state management for admin client
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        }
    })
    : (()=>{ logger.error("Admin client creation failed due to missing service role key."); return null as any; })(); // Handle missing key


// Function to create an authenticated client for a specific user (respects RLS)
// Used for user-specific actions where RLS is enforced.
export const createAuthenticatedClient = async (userId: string): Promise<SupabaseClient<Database> | null> => {
    if (!userId) {
        logger.warn("Attempted to create authenticated client without a user ID.");
        return null;
    }
     if (!supabaseUrl || !supabaseAnonKey) {
        logger.error("Cannot create authenticated client: Supabase URL or Anon Key missing.");
        return null;
    }
    try {
        const token = await generateJwtToken(userId);
        if (!token) {
            logger.warn(`Failed to generate JWT for user ${userId}. Cannot create authenticated client.`);
            return null;
        }
        return createClient<Database>(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false } // Usually don't persist session for server-side authenticated clients
        });
    } catch (error) {
        logger.error(`Error creating authenticated client for user ${userId}:`, error);
        return null;
    }
};

// --- User Management ---

/** Fetches user data by user ID. Uses admin client. */
export const fetchUserData = async (userId: string): Promise<DbUser | null> => {
    if (!userId) {
        debugLogger.warn("fetchUserData called with empty userId");
        return null;
    }
    debugLogger.log(`Fetching user data for userId: ${userId}`);
    if (!supabaseAdmin) { // Use admin to ensure metadata is always fetched regardless of user RLS on select
        logger.error("Admin client unavailable for fetchUserData.");
        return null;
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("users") // Adjust table name if needed (e.g., auth.users)
            .select("*, metadata") // Explicitly select metadata
            .eq("user_id", userId) // Adjust column name if needed
            .maybeSingle();

        if (error) {
            logger.error(`Error fetching user data for ${userId}:`, error);
            return null;
        }

        debugLogger.log(`Fetched user data for ${userId}:`, data ? 'User found' : 'User not found');
        return data;
    } catch (catchError) {
        logger.error(`Exception in fetchUserData for ${userId}:`, catchError);
        return null;
    }
};

/** Creates or updates a user in the database. Uses admin client. */
export const createOrUpdateUser = async (userId: string, userInfo: Partial<WebAppUser & { role?: string; status?: string; metadata?: Record<string, any> }>): Promise<DbUser | null> => {
     if (!userId) {
        debugLogger.error("createOrUpdateUser called with empty userId");
        return null;
    }
     if (!supabaseAdmin) {
         logger.error("Admin client unavailable for createOrUpdateUser.");
         return null;
     }

    debugLogger.log("Attempting to create or update user:", { userId, username: userInfo.username });

    try {
        const userData: Partial<DbUser> = { // Use Partial<DbUser> for upsert flexibility
            user_id: userId, // Adjust column name if needed
            username: userInfo.username || null,
            full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || null,
            avatar_url: userInfo.photo_url || null,
            language_code: userInfo.language_code || null,
            ...(userInfo.role && { role: userInfo.role }),
            ...(userInfo.status && { status: userInfo.status }),
            // Ensure metadata is included/updated correctly
            ...(userInfo.metadata !== undefined && { metadata: userInfo.metadata }),
            updated_at: new Date().toISOString(),
        };
        // Remove undefined keys specifically, except for metadata if intentionally set to null
        Object.keys(userData).forEach(key => {
            const k = key as keyof typeof userData;
            if (userData[k] === undefined && k !== 'metadata') {
                 delete userData[k];
            }
        });


        const { data, error } = await supabaseAdmin
            .from("users") // Adjust table name if needed
            .upsert(userData, {
                onConflict: 'user_id', // Adjust conflict target column if needed
            })
            .select("*, metadata") // Ensure metadata is selected back
            .single();

        if (error) {
            logger.error(`Error upserting user ${userId}:`, error);
            throw error;
        }

        if (!data) {
             logger.error(`Upsert for user ${userId} returned no data.`);
            throw new Error("Failed to get user data after upsert.");
        }

        debugLogger.log(`User ${userId} upserted successfully.`);
        return data;
    } catch (catchError) {
        logger.error(`Exception in createOrUpdateUser for ${userId}:`, catchError);
        return null;
    }
};


/** Updates only the metadata field for a specific user. Uses authenticated client for RLS. */
export const updateUserMetadata = async (
  userId: string,
  metadata: Record<string, any> | null // Pass null to clear metadata or specific object to set/update
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
  if (!userId) return { success: false, error: "User ID is required." };

  // Use authenticated client to respect RLS policy allowing user to update own metadata
  const client = await createAuthenticatedClient(userId);
  if (!client) return { success: false, error: "Failed to create authenticated client." };

  debugLogger.log(`Updating metadata for user ${userId}`, metadata);
  try {
    const { data, error } = await client
      .from("users") // Adjust table name if needed
      .update({ metadata: metadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId) // Adjust column name if needed
      .select("*, metadata") // Select the updated user row including metadata
      .single();

    if (error) {
      logger.error(`Error updating metadata for user ${userId}:`, error);
      if (error.code === 'PGRST116') return { success: false, error: `User ${userId} not found.` };
      if (error.code === '42501') return { success: false, error: `Permission denied to update metadata for user ${userId}. Check RLS policy.` };
      throw error;
    }
    if (!data) return { success: false, error: `User ${userId} not found after metadata update attempt.` };

    debugLogger.log(`Successfully updated metadata for user ${userId}.`);
    return { success: true, data };
  } catch (catchError) {
    logger.error(`Exception in updateUserMetadata for user ${userId}:`, catchError);
    return { success: false, error: catchError instanceof Error ? catchError.message : "Failed to update user metadata" };
  }
};

// --- Embeddings & Car Search ---
// Match the vector dimensions defined in the database function/column
const VECTOR_DIMENSIONS = 384; // Make sure this is correct

// Simplified local embedding generator (FALLBACK ONLY)
// This is likely not semantically meaningful. Use the Edge Function primarily.
function generateSimplifiedFallbackEmbedding(text: string): number[] {
   logger.warn("Generating simplified FALLBACK embedding for text:", text.substring(0, 50) + "...");
   // Basic hashing/distribution - replace with a more robust method if needed
   const embedding = new Array(VECTOR_DIMENSIONS).fill(0);
   if (!text) return embedding;
   const words = text.toLowerCase().split(/\W+/).filter(Boolean);
   words.forEach((word, i) => {
       let hash = 0;
       for (let j = 0; j < word.length; j++) {
           hash = (hash * 31 + word.charCodeAt(j)) | 0; // Simple hash
       }
       embedding[Math.abs(hash + i) % VECTOR_DIMENSIONS] += 1;
   });
    // Normalize (optional, depends on similarity metric used)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

/**
 * Generates car embedding using Supabase Edge Function. Handles single, batch, and create modes.
 * Falls back to simplified local embedding on Edge Function failure.
 */
export async function generateCarEmbedding(
  mode: 'single' | 'batch' | 'create' = 'batch', // Default to batch
  payload?: {
    carId?: string; // For single mode
    carData?: { // For create mode
        make: string; model: string; description: string; specs: Record<string, any>;
        // Optional fields to update *after* creation if Edge Function only returns ID
        owner_id?: string; daily_price?: number; image_url?: string; rent_link?: string;
    };
  }
): Promise<{ success: boolean; message: string; carId?: string; error?: string }> {
    if (!serviceRoleKey || !supabaseUrl) {
        return { success: false, message: "Service role key or Supabase URL missing.", error:"Configuration error." };
    }
    if (!supabaseAdmin) {
        return { success: false, message: "Admin client is not available.", error: "Configuration error." };
    }

    let endpoint: string;
    let requestBody: any = {};
    const headers = {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
    };

    try {
        switch (mode) {
            case 'single':
                if (!payload?.carId) throw new Error("carId is required for single mode");
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings`; // Assuming single entry point handles mode via payload
                requestBody = { mode: 'single', carId: payload.carId };
                break;
            case 'create':
                if (!payload?.carData) throw new Error("carData is required for create mode");
                 // Pass only data needed for embedding generation to the function
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings`; // Assuming single entry point
                requestBody = {
                    mode: 'create',
                    make: payload.carData.make,
                    model: payload.carData.model,
                    description: payload.carData.description,
                    specs: payload.carData.specs,
                 };
                break;
            case 'batch':
            default:
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings`; // Assuming single entry point
                requestBody = { mode: 'batch' }; // Send mode indicator
                break;
        }

        logger.info(`Calling Edge Function 'generate-embeddings' (mode: ${mode})...`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text(); // Get text first for better error reporting
        if (!response.ok) {
            logger.error(`Edge Function 'generate-embeddings' (${mode}) failed (${response.status}): ${responseText}`);
            throw new Error(`Edge Function failed (${response.status}): ${responseText}`);
        }

        const result = JSON.parse(responseText); // Parse JSON only if response is ok
        logger.info(`Edge Function 'generate-embeddings' (${mode}) success: ${result.message}`);

        // Handle post-creation updates for 'create' mode if necessary
        let createdCarId = result.carId; // Function should return carId on create
        if (mode === 'create' && createdCarId && payload?.carData) {
            const { owner_id, daily_price, image_url, rent_link } = payload.carData;
            const fieldsToUpdate: Partial<DbCar> = {};
            if (owner_id !== undefined) fieldsToUpdate.owner_id = owner_id;
            if (daily_price !== undefined) fieldsToUpdate.daily_price = daily_price;
            if (image_url !== undefined) fieldsToUpdate.image_url = image_url;
            if (rent_link !== undefined) fieldsToUpdate.rent_link = rent_link;

            if (Object.keys(fieldsToUpdate).length > 0) {
                logger.info(`Updating additional fields for new car ${createdCarId}...`, fieldsToUpdate);
                fieldsToUpdate.updated_at = new Date().toISOString();

                const { error: updateError } = await supabaseAdmin
                    .from("cars")
                    .update(fieldsToUpdate)
                    .eq("id", createdCarId);

                 if (updateError) {
                     logger.error(`Failed to update additional fields for car ${createdCarId}: ${updateError.message}`);
                     result.message += ` (Warning: Failed to update some additional fields: ${updateError.message})`;
                 } else {
                     logger.info(`Successfully updated additional fields for car ${createdCarId}.`);
                 }
            }
        }

        return { success: true, message: result.message, carId: createdCarId };

    } catch (error) {
        logger.error(`generateCarEmbedding (${mode}) failed, attempting fallback:`, error);

        // --- Fallback Logic ---
        try {
            let combinedText: string | null = null;
            let carIdToUpdate: string | undefined = undefined;

            if (mode === 'single' && payload?.carId) {
                const { data: car, error: fetchError } = await supabaseAdmin.from("cars").select("make, model, description, specs").eq("id", payload.carId).single();
                if (fetchError || !car) { throw new Error(`Fallback failed: Cannot fetch car ${payload.carId}. ${fetchError?.message}`); }
                combinedText = `${car.make} ${car.model} ${car.description || ''} ${JSON.stringify(car.specs || {})}`;
                carIdToUpdate = payload.carId;
            } else if (mode === 'create' && payload?.carData) {
                 combinedText = `${payload.carData.make} ${payload.carData.model} ${payload.carData.description || ''} ${JSON.stringify(payload.carData.specs || {})}`;
            } else {
                 return { success: false, message: "Edge function failed, fallback not supported for batch mode.", error: error instanceof Error ? error.message : String(error) };
            }

            if (!combinedText) {
                throw new Error("Fallback failed: Could not generate combined text for embedding.");
            }
            const embedding = generateSimplifiedFallbackEmbedding(combinedText);

            if (carIdToUpdate) { // Update existing car (single mode fallback)
                 const { error: updateError } = await supabaseAdmin.from("cars").update({ embedding, updated_at: new Date().toISOString() }).eq("id", carIdToUpdate);
                 if (updateError) throw new Error(`Fallback failed: Cannot update embedding for ${carIdToUpdate}. ${updateError.message}`);
                 logger.info(`Successfully updated car ${carIdToUpdate} with fallback embedding.`);
                 return { success: true, message: "Edge function failed, fallback embedding generated and updated.", carId: carIdToUpdate };
            } else if (mode === 'create' && payload?.carData) { // Create car with fallback embedding
                 const { data: newCar, error: insertError } = await supabaseAdmin
                    .from("cars")
                    .insert({
                        make: payload.carData.make, model: payload.carData.model, description: payload.carData.description,
                        specs: payload.carData.specs, owner_id: payload.carData.owner_id, daily_price: payload.carData.daily_price,
                        image_url: payload.carData.image_url, rent_link: payload.carData.rent_link,
                        embedding, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'new', // Default status?
                    })
                    .select("id")
                    .single();
                 if (insertError || !newCar) throw new Error(`Fallback failed: Cannot create car. ${insertError?.message}`);
                 logger.info(`Successfully created car ${newCar.id} with fallback embedding.`);
                 return { success: true, message: "Edge function failed, fallback embedding generated and car created.", carId: newCar.id };
            }
             return { success: false, message: "Edge function failed, and fallback logic path unclear.", error: error instanceof Error ? error.message : String(error) };
        } catch (fallbackError) {
            logger.error("Fallback embedding generation also failed:", fallbackError);
            return { success: false, message: "Edge function and fallback embedding failed.", error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) };
        }
    }
}


/** Searches for cars using vector similarity via RPC */
export interface CarResult {
  id: string;
  make: string;
  model: string;
  similarity: number;
  description?: string | null; // Make optional fields explicitly nullable
  image_url?: string | null;
  rent_link?: string | null;
  daily_price?: number | null; // Add price if available from RPC
}

export const searchCars = async (embedding: number[], limit: number = 5): Promise<{ success: boolean; data?: CarResult[]; error?: string }> => {
    if (!embedding || embedding.length !== VECTOR_DIMENSIONS) {
        return { success: false, error: `Invalid embedding provided (length ${embedding?.length}, expected ${VECTOR_DIMENSIONS})` };
    }
    if (!supabaseAnon) {
        return { success: false, error: "Anon client is not available for search." };
    }
    try {
        // Ensure the RPC function name and parameters match your DB definition
        const { data, error } = await supabaseAnon.rpc("search_cars", {
            query_embedding: embedding,
            match_count: limit,
        });

        if (error) {
            logger.error("Error calling search_cars RPC:", error);
            throw error;
        }

        // Map the RPC result (data structure depends on your RPC definition)
        const formattedData: CarResult[] = (data || []).map((item: any) => ({ // Use a more specific type if RPC output is known
            id: item.id,
            make: item.make,
            model: item.model,
            similarity: item.similarity,
            description: item.description, // Pass through fields returned by RPC
            image_url: item.image_url,
            daily_price: item.daily_price, // Pass through price if returned
            rent_link: item.rent_link || `/rent/${item.id}`, // Construct default link if not present
        }));

        return { success: true, data: formattedData };
    } catch (error) {
        logger.error("Error searching cars:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to search cars" };
    }
};

/** Gets similar cars based on a car ID via RPC */
export const getSimilarCars = async (carId: string, matchCount: number = 3): Promise<{ success: boolean; data?: DbCar[]; error?: string }> => {
     if (!carId) return { success: false, error: "Car ID is required." };
     if (!supabaseAnon) return { success: false, error: "Anon client not available."};

     try {
         // Ensure RPC name and parameter names match DB
        const { data, error } = await supabaseAnon.rpc("similar_cars", {
            p_car_id: carId,
            p_match_count: matchCount,
        });
        if (error) {
             logger.error(`Error calling similar_cars RPC for car ${carId}:`, error);
            throw error;
        }
         // Assuming RPC returns data matching DbCar structure
         return { success: true, data: data || [] };
    } catch (error) {
         logger.error(`Error finding similar cars for ${carId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to find similar cars" };
    }
};

// --- Advice Articles & Sections ---

/** Fetches all advice articles. Uses anon client based on RLS policy. */
export const fetchArticles = async (): Promise<{ success: boolean; data?: DbArticle[]; error?: string }> => {
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };
  try {
    // Fetch from the 'articles' table
    const { data, error } = await supabaseAnon
      .from("articles")
      .select("*")
      .order("title", { ascending: true }); // Order alphabetically by title

    if (error) throw error;
    debugLogger.log(`Fetched ${data?.length || 0} articles.`);
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error("Error fetching articles:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch articles" };
  }
};

/** Fetches all sections for a specific article ID. Uses anon client based on RLS policy. */
export const fetchArticleSections = async (articleId: string): Promise<{ success: boolean; data?: DbArticleSection[]; error?: string }> => {
  if (!articleId) return { success: false, error: "Article ID is required." };
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };

  try {
    // Fetch from the 'article_sections' table
    const { data, error } = await supabaseAnon
      .from("article_sections")
      .select("*")
      .eq("article_id", articleId)
      .order("section_order", { ascending: true }); // **Crucial for correct sequence**

    if (error) throw error;
    debugLogger.log(`Fetched ${data?.length || 0} sections for article ${articleId}.`);
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error(`Error fetching sections for article ${articleId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch article sections" };
  }
};


// --- Test Progress ---
export const saveTestProgress = async (userId: string, progress: any): Promise<{ success: boolean; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        // Assuming 'test_progress' column exists on the 'users' table
        const { error } = await client
            .from("users") // Adjust table name if needed
            .update({ test_progress: progress, updated_at: new Date().toISOString() })
            .eq("user_id", userId); // Adjust column name if needed

        if (error) throw error;
        debugLogger.log(`Saved test progress for user ${userId}.`);
        return { success: true };
    } catch (error) {
        logger.error(`Exception saving test progress for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to save progress" };
    }
};

export const loadTestProgress = async (userId: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
         // Assuming 'test_progress' column exists on the 'users' table
        const { data, error } = await client
            .from("users") // Adjust table name if needed
            .select("test_progress")
            .eq("user_id", userId) // Adjust column name if needed
            .maybeSingle();

        if (error) {
            logger.error(`Error loading test progress for user ${userId}:`, error);
             if (error.code === 'PGRST116') return { success: true, data: null }; // Not found is not an error here
            throw error;
        }

        debugLogger.log(`Loaded test progress for user ${userId}.`);
        // Return null if test_progress is null in DB or user not found
        return { success: true, data: data?.test_progress ?? null };
    } catch (error) {
        logger.error(`Exception loading test progress for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to load progress" };
    }
};


// --- Subscriptions ---
// (Assuming 'subscription_id' column exists on 'users' table)
export const updateUserSubscription = async (
  userId: string,
  subscriptionId: string | number | null // Allow null to remove subscription
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
    if (!userId) return { success: false, error: "User ID is required." };
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };

    debugLogger.log(`Updating subscription for user ${userId} to ${subscriptionId}`);
    try {
        const { data, error } = await supabaseAdmin
            .from("users") // Adjust table name if needed
            .update({ subscription_id: subscriptionId, updated_at: new Date().toISOString() })
            .eq("user_id", userId) // Adjust column name if needed
            .select("*, metadata") // Select updated user data
            .single();

        if (error) {
            logger.error(`Error updating user ${userId} subscription:`, error);
            if (error.code === 'PGRST116') return { success: false, error: `User ${userId} not found.` };
            throw error;
        }
         if (!data) return { success: false, error: `User ${userId} not found after update attempt.` };

        debugLogger.log(`Successfully updated subscription for user ${userId}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Exception in updateUserSubscription for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update subscription" };
    }
};

export const getUserSubscription = async (
  userId: string
): Promise<{ success: boolean; data?: number | string | null; error?: string }> => {
    if (!userId) return { success: false, error: "User ID is required." };
    // Use authenticated client respecting RLS, or admin client if needed
    // Using admin client for broader access possibility:
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };

    debugLogger.log(`Fetching subscription for user ${userId}`);
    try {
        const { data, error } = await supabaseAdmin
            .from("users") // Adjust table name if needed
            .select("subscription_id")
            .eq("user_id", userId) // Adjust column name if needed
            .maybeSingle();

        if (error) {
            logger.error(`Error fetching user ${userId} subscription:`, error);
            if (error.code === 'PGRST116') {
                 debugLogger.log(`User ${userId} not found when fetching subscription.`);
                return { success: true, data: null }; // User found, but no subscription is not an error
            }
            throw error;
        }

        debugLogger.log(`Found subscription ID ${data?.subscription_id ?? 'null'} for user ${userId}.`);
        // Return null if subscription_id is null in DB or user not found
        return { success: true, data: data?.subscription_id ?? null };

    } catch (error) {
        logger.error(`Exception in getUserSubscription for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch subscription" };
    }
};


// --- Invoice Management ---
export const createInvoice = async (
    type: string,
    id: string, // Invoice ID (e.g., from payment provider or generated)
    userId: string,
    amount: number,
    subscriptionId?: number | string | null, // Optional subscription link
    metadata: Record<string, any> = {}
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
    if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
    if (!id || !userId || amount == null || !type) return { success: false, error: "Missing required parameters for invoice creation." };

    try {
        // Resolve subscription ID if not provided explicitly
        let finalSubscriptionId = subscriptionId;
        if (finalSubscriptionId === undefined) {
            const subResult = await getUserSubscription(userId);
            if (subResult.success) finalSubscriptionId = subResult.data;
            else logger.warn(`Could not fetch subscription for user ${userId} during invoice creation. Proceeding without subscription_id.`);
        }

        const { data, error } = await supabaseAdmin
            .from("invoices")
            .insert({
                id: id,
                user_id: userId,
                type: type,
                amount: amount, // Store the amount as provided
                status: 'pending', // Default status
                subscription_id: finalSubscriptionId, // Store resolved ID
                metadata: metadata,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
             })
            .select() // Select the newly created row
            .single(); // Expect only one row

        if (error) {
            // Handle potential unique constraint violation (invoice ID already exists)
            if (error.code === '23505') { // PostgreSQL unique violation code
                 logger.warn(`Invoice with ID ${id} already exists.`);
                 // Optionally fetch and return the existing invoice
                 const existing = await getInvoiceById(id);
                 if (existing.success && existing.data) return { success: true, data: existing.data };
                 return { success: false, error: `Invoice ID ${id} already exists, but failed to retrieve it.` };
            }
            throw error; // Re-throw other errors
        }
        if (!data) return { success: false, error: "Invoice creation returned no data." };

        debugLogger.log(`Invoice ${id} created successfully for user ${userId}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating invoice ${id} for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create invoice" };
    }
};

export const updateInvoiceStatus = async (
    invoiceId: string,
    status: DbInvoice['status'] // Use the type from DbInvoice for status
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!invoiceId || !status) return { success: false, error: "Invoice ID and status are required." };

     try {
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .update({ status: status, updated_at: new Date().toISOString() })
            .eq("id", invoiceId)
            .select() // Select the updated row
            .single(); // Expect one row

        if (error) {
            if (error.code === 'PGRST116') return { success: false, error: `Invoice ${invoiceId} not found.` }; // Row not found
            throw error;
        }
        if (!data) return { success: false, error: "Invoice not found after update attempt." };

        debugLogger.log(`Invoice ${invoiceId} status updated to ${status}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error updating invoice ${invoiceId} status to ${status}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update invoice status" };
    }
};

export const getInvoiceById = async (invoiceId: string): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!invoiceId) return { success: false, error: "Invoice ID is required." };

      try {
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .select("*")
            .eq("id", invoiceId)
            .maybeSingle(); // Use maybeSingle to return null if not found

        if (error) {
            // Note: PGRST116 (not found) isn't thrown by maybeSingle, data will be null instead.
            // Handle other potential errors (like connection issues)
            throw error;
        }
        // Check if data is null (invoice not found)
        if (!data) {
            return { success: false, error: `Invoice ${invoiceId} not found.` };
        }

        debugLogger.log(`Fetched invoice ${invoiceId}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error fetching invoice ${invoiceId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch invoice" };
    }
};

export const getUserInvoices = async (userId: string): Promise<{ success: boolean; data?: DbInvoice[]; error?: string }> => {
    // Decide if this needs admin or authenticated client based on RLS
    // Using admin client for potential broader access needs:
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };
    const client = supabaseAdmin;

    if (!userId) return { success: false, error: "User ID is required." };

    try {
        const { data, error } = await client
            .from("invoices")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }); // Order by most recent

        if (error) throw error;

        debugLogger.log(`Fetched ${data?.length || 0} invoices for user ${userId}.`);
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error(`Error fetching invoices for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user invoices" };
    }
};


// --- Rental Management ---
// Interface combining DB type with potential joined fields for convenience
export interface RentalWithCarDetails extends DbRental {
  car_make?: string | null;
  car_model?: string | null;
  car_image_url?: string | null; // Add other car details if needed
}

export const createRental = async (
    userId: string,
    carId: string,
    startDate: string, // ISO date string format recommended (YYYY-MM-DD)
    endDate: string,   // ISO date string format recommended (YYYY-MM-DD)
    totalCost: number
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!userId || !carId || !startDate || !endDate || totalCost == null || totalCost < 0) {
         return { success: false, error: "Missing or invalid parameters for rental creation." };
     }

    try {
        // Optional: Add check here to ensure car exists and is available?

        const { data, error } = await supabaseAdmin
            .from("rentals")
            .insert({
                user_id: userId,
                car_id: carId,
                start_date: startDate,
                end_date: endDate,
                total_cost: totalCost,
                status: 'pending', // Default status (e.g., needs confirmation or payment)
                payment_status: 'pending', // Default payment status
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select() // Select the newly created rental
            .single(); // Expect one row

        if (error) {
            // Handle foreign key constraint violation (e.g., user_id or car_id doesn't exist)
            if (error.code === '23503') { // PostgreSQL foreign key violation
                 return { success: false, error: "Invalid user ID or car ID provided." };
            }
            throw error;
        }
        if (!data) return { success: false, error: "Rental creation returned no data." };
        debugLogger.log(`Rental created successfully for user ${userId}, car ${carId}. ID: ${data.rental_id}`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating rental for user ${userId}, car ${carId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create rental" };
    }
};

export const getUserRentals = async (userId: string): Promise<{ success: boolean; data?: RentalWithCarDetails[]; error?: string }> => {
     // Decide if this needs admin or authenticated client based on RLS
     // Using admin client for potential broader access needs:
     if (!supabaseAdmin) return { success: false, error: "Admin client not available." };
     const client = supabaseAdmin;

     if (!userId) return { success: false, error: "User ID is required." };

      try {
        // Select rental details and join with cars table for make and model
        const { data, error } = await client
            .from("rentals")
            .select(`
                *,
                cars ( make, model, image_url )
            `) // Select all rental fields and specific car fields
            .eq("user_id", userId)
            .order("start_date", { ascending: false }); // Order by most recent start date

        if (error) throw error;

        // Map the result to the desired flat structure
        const formattedData: RentalWithCarDetails[] = (data || []).map((rental: any) => ({ // Use 'any' carefully, define type if possible
            ...rental, // Spread all fields from the rentals table
            car_make: rental.cars?.make || null, // Access nested car data safely
            car_model: rental.cars?.model || null,
            car_image_url: rental.cars?.image_url || null,
            cars: undefined, // Remove the nested 'cars' object to flatten the structure
        }));

        debugLogger.log(`Fetched ${formattedData.length} rentals for user ${userId}.`);
        return { success: true, data: formattedData };
    } catch (error) {
        logger.error(`Error fetching rentals for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user rentals" };
    }
};

export const updateRentalPaymentStatus = async (
    rentalId: string, // Use rental_id (assuming it's the PK, adjust if different)
    paymentStatus: DbRental['payment_status'] // Use type from DbRental
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!rentalId || !paymentStatus) return { success: false, error: "Rental ID and payment status are required." };

      try {
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
            .eq("rental_id", rentalId) // Use the primary key column name
            .select() // Select the updated row
            .single(); // Expect one row

        if (error) {
             if (error.code === 'PGRST116') return { success: false, error: `Rental ${rentalId} not found.` }; // Row not found
            throw error;
        }
         if (!data) return { success: false, error: "Rental not found after update attempt." };

         debugLogger.log(`Rental ${rentalId} payment status updated to ${paymentStatus}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error updating rental ${rentalId} payment status to ${paymentStatus}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update rental payment status" };
    }
};


// --- Image Upload ---
export const uploadImage = async (bucketName: string, file: File, fileName?: string): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!bucketName || !file) return { success: false, error: "Bucket name and file are required." };

    try {
        const fileExt = file.name.split(".").pop();
        if (!fileExt) {
            return { success: false, error: "Invalid file name (no extension)." };
        }
        // Use provided fileName or generate a unique one (e.g., using UUID)
        const finalFileName = fileName || `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${finalFileName}`; // Store in bucket root or specify a folder path e.g., `public/${finalFileName}`

        debugLogger.log(`Uploading file '${file.name}' to bucket '${bucketName}' as '${filePath}'...`);

        // Upload the file using admin client
        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, file, {
                cacheControl: '3600', // Optional: Cache for 1 hour
                upsert: false         // Optional: false = don't overwrite, true = overwrite
            });

        if (uploadError) {
            // Handle specific errors? e.g., file already exists if upsert: false
            logger.error(`Error uploading image to ${bucketName}/${filePath}:`, uploadError);
            throw uploadError;
        }

        // Get the public URL for the uploaded file
        const { data: urlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
             logger.error(`Failed to get public URL for ${bucketName}/${filePath} after upload.`);
            // Optional: Attempt to delete the uploaded file if URL retrieval fails?
            throw new Error("Failed to get public URL after upload");
        }

         logger.info(`Image uploaded successfully: ${urlData.publicUrl}`);
        return { success: true, publicUrl: urlData.publicUrl };

    } catch (error) {
        logger.error(`Error uploading image to bucket ${bucketName}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to upload image" };
    }
};


// --- Generic Data Fetching (Examples from Reference) ---
// Ensure these tables ('questions', 'answers') exist if you use these functions
export const fetchQuestions = async () => {
    if (!supabaseAnon) throw new Error("Anon client not available.");
    const { data, error } = await supabaseAnon.from("questions").select("*");
    if (error) { logger.error("Error fetching questions:", error); throw error; }
    return data;
};

export const fetchAnswers = async () => {
    if (!supabaseAnon) throw new Error("Anon client not available.");
    const { data, error } = await supabaseAnon.from("answers").select("*");
     if (error) { logger.error("Error fetching answers:", error); throw error; }
    return data;
};

// Fetch all cars (publicly accessible)
export const fetchCars = async (): Promise<{ success: boolean; data?: DbCar[]; error?: string }> => {
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };
  try {
    const { data, error } = await supabaseAnon
        .from("cars")
        .select("*")
        .order("created_at", { ascending: false }); // Example order
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error("Error fetching cars:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch cars" };
  }
}

// Fetch a single car by ID (publicly accessible)
export const fetchCarById = async (id: string): Promise<{ success: boolean; data?: DbCar; error?: string }> => {
  if (!id) return { success: false, error: "Car ID is required." };
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };
  try {
    const { data, error } = await supabaseAnon
        .from("cars")
        .select("*")
        .eq("id", id)
        .maybeSingle(); // Use maybeSingle for single record fetch

    if (error) {
        // maybeSingle returns null data, not error code PGRST116 if not found
        throw error; // Throw other errors
    }
    if (!data) {
        // Handle not found case explicitly
        return { success: false, error: `Car with ID ${id} not found.` };
    }
    return { success: true, data };
  } catch (error) {
    logger.error(`Error fetching car by ID ${id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch car" };
  }
}


// --- User Results (Saving/Fetching user choices/matches - from Reference) ---
// Ensure 'user_results' table exists with appropriate columns (user_id, car_id, created_at)
// Define the type if not already in database.types.ts
type DbUserResult = Database["public"]["Tables"]["user_results"]["Row"];

export const saveUserResult = async (userId: string, carId: string): Promise<{ success: boolean; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        // Insert into user_results table
        const { error } = await client
            .from("user_results")
            .insert({ user_id: userId, car_id: carId }); // Assumes created_at defaults in DB

        if (error) {
             // Handle unique constraint violation (user already has this result)
             if (error.code === '23505') {
                 debugLogger.warn(`User ${userId} already has a result for car ${carId}. Ignoring duplicate.`);
                 return { success: true }; // Treat as success if already exists
             }
             // Handle foreign key violation (invalid user or car ID)
             if (error.code === '23503') {
                  return { success: false, error: "Invalid user ID or car ID." };
             }
             throw error; // Re-throw other errors
        }
        debugLogger.log(`Saved user result for user ${userId}, car ${carId}.`);
        return { success: true };
    } catch (error) {
        logger.error(`Error saving user result for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to save user result" };
    }
};


export const getUserResults = async (userId: string): Promise<{ success: boolean; data?: DbUserResult[]; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        const { data, error } = await client
            .from("user_results")
            .select("car_id, created_at") // Select necessary columns
            .eq("user_id", userId)
            .order("created_at", { ascending: false }); // Order by most recent

        if (error) throw error;
        debugLogger.log(`Fetched ${data?.length || 0} results for user ${userId}.`);
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error(`Error fetching user results for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user results" };
    }
};


// --- END OF /hooks/supabase.ts ---