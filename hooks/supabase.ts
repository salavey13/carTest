// /hooks/supabase.ts
// (This should be the "CURRENT SUPABASE HOOK" provided in the prompt,
// ensuring functions like fetchCars, fetchCarById, createInvoice, getUserRentals etc.
// are present as used/needed by the actions and components)
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateJwtToken } from "@/lib/auth";
import type { WebAppUser } from "@/types/telegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; // Use standard logger for errors/warnings
import type { Database } from "@/types/database.types";

// Type Aliases for clarity (from the improved version)
type DbUser = Database["public"]["Tables"]["users"]["Row"];
type DbCar = Database["public"]["Tables"]["cars"]["Row"];
type DbInvoice = Database["public"]["Tables"]["invoices"]["Row"];
type DbRental = Database["public"]["Tables"]["rentals"]["Row"];
type DbTask = Database["public"]["Tables"]["tasks"]["Row"]; // Added for Tasks
type DbCharacter = Database["public"]["Tables"]["characters"]["Row"]; // Added for Characters
type DbVideo = Database["public"]["Tables"]["videos"]["Row"]; // Added for Videos
type DbSubscription = Database["public"]["Tables"]["subscriptions"]["Row"]; // Assuming you have a subscriptions table

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

/** Fetches user data by user ID. Uses admin client for broad access initially. */
export const fetchUserData = async (userId: string): Promise<DbUser | null> => {
    if (!userId) {
        debugLogger.warn("fetchUserData called with empty userId");
        return null;
    }
    debugLogger.log(`Fetching user data for userId: ${userId}`);
    if (!supabaseAdmin) {
        logger.error("Admin client unavailable for fetchUserData.");
        return null;
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(); // Handles user not found returning null instead of error

        if (error) {
            // Log the error but don't throw, return null as user not found/error occurred
            logger.error(`Error fetching user data for ${userId}:`, error);
            return null;
        }

        debugLogger.log(`Fetched user data for ${userId}:`, data ? 'User found' : 'User not found');
        return data; // Returns the user object or null
    } catch (catchError) {
        logger.error(`Exception in fetchUserData for ${userId}:`, catchError);
        return null; // Return null on unexpected errors too
    }
};

/** Creates or updates a user in the database. Uses admin client. */
export const createOrUpdateUser = async (userId: string, userInfo: Partial<WebAppUser & { role?: string; status?: string }>): Promise<DbUser | null> => {
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
        // Prepare user data, ensuring required fields have fallbacks if needed by DB schema
        const userData: Partial<DbUser> = { // Use Partial<DbUser> for upsert flexibility
            user_id: userId,
            username: userInfo.username || null,
            full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || null,
            avatar_url: userInfo.photo_url || null,
            language_code: userInfo.language_code || null,
            // Only include role/status if provided in userInfo, avoid overwriting on updates unless specified
            ...(userInfo.role && { role: userInfo.role }),
            ...(userInfo.status && { status: userInfo.status }),
            // Set default role/status on creation? Upsert handles this if ON CONFLICT DO UPDATE
            updated_at: new Date().toISOString(), // Ensure updated_at is set on upsert
        };
        // Remove undefined keys to prevent overwriting with null during update
        Object.keys(userData).forEach(key => (userData as any)[key] === undefined && delete (userData as any)[key]);


        // Use upsert for create or update logic
        const { data, error } = await supabaseAdmin
            .from("users")
            .upsert(userData, {
                onConflict: 'user_id', // Specify the conflict target
            })
            .select() // Select the resulting row
            .single(); // Expect a single row back

        if (error) {
            logger.error(`Error upserting user ${userId}:`, error);
            throw error; // Throw to indicate failure to the caller
        }

        if (!data) {
            // This shouldn't happen with upsert+select+single unless there's a major issue
             logger.error(`Upsert for user ${userId} returned no data.`);
            throw new Error("Failed to get user data after upsert.");
        }

        debugLogger.log(`User ${userId} upserted successfully.`);
        return data;
    } catch (catchError) {
        logger.error(`Exception in createOrUpdateUser for ${userId}:`, catchError);
        // Depending on desired behavior, you might return null or re-throw
        // Return null to indicate failure without stopping the entire flow
        return null;
        // throw catchError; // Re-throw if the caller needs to handle it explicitly
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
                        embedding, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'new',
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
  description: string;
  image_url: string;
  rent_link: string;
}

export const searchCars = async (embedding: number[], limit: number = 5): Promise<{ success: boolean; data?: CarResult[]; error?: string }> => {
    if (!embedding || embedding.length !== VECTOR_DIMENSIONS) {
        return { success: false, error: `Invalid embedding provided (length ${embedding?.length}, expected ${VECTOR_DIMENSIONS})` };
    }
    if (!supabaseAnon) {
        return { success: false, error: "Anon client is not available for search." };
    }
    try {
        const { data, error } = await supabaseAnon.rpc("search_cars", {
            query_embedding: embedding,
            match_count: limit,
        });

        if (error) {
            logger.error("Error calling search_cars RPC:", error);
            throw error;
        }

        const formattedData: CarResult[] = (data || []).map((item: any) => ({
            id: item.id, make: item.make, model: item.model, similarity: item.similarity,
            description: item.description, image_url: item.image_url,
            rent_link: item.rent_link || `/rent/${item.id}`,
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
        const { data, error } = await supabaseAnon.rpc("similar_cars", {
            p_car_id: carId, // Ensure param names match DB definition
            p_match_count: matchCount,
        });
        if (error) {
             logger.error(`Error calling similar_cars RPC for car ${carId}:`, error);
            throw error;
        }
         return { success: true, data: data || [] };
    } catch (error) {
         logger.error(`Error finding similar cars for ${carId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to find similar cars" };
    }
};


// --- Test Progress --- (Keeping as is, seems unrelated to YouTube)

export const saveTestProgress = async (userId: string, progress: any): Promise<{ success: boolean; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        const { error } = await client
            .from("users")
            .update({ test_progress: progress, updated_at: new Date().toISOString() })
            .eq("user_id", userId);

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
        const { data, error } = await client
            .from("users")
            .select("test_progress")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) {
            logger.error(`Error loading test progress for user ${userId}:`, error);
             if (error.code === 'PGRST116') return { success: true, data: null }; // Not found is not an error here
            throw error;
        }

        debugLogger.log(`Loaded test progress for user ${userId}.`);
        return { success: true, data: data?.test_progress ?? null };
    } catch (error) {
        logger.error(`Exception loading test progress for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to load progress" };
    }
};

// --- Subscriptions --- (Keeping as is, potentially reusable)

export const updateUserSubscription = async (
  userId: string,
  subscriptionId: string | number | null // Allow null to remove subscription
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
    if (!userId) return { success: false, error: "User ID is required." };
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };

    debugLogger.log(`Updating subscription for user ${userId} to ${subscriptionId}`);
    try {
        const { data, error } = await supabaseAdmin
            .from("users")
            .update({ subscription_id: subscriptionId, updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .select()
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
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };

    debugLogger.log(`Fetching subscription for user ${userId}`);
    try {
        const { data, error } = await supabaseAdmin
            .from("users")
            .select("subscription_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) {
            logger.error(`Error fetching user ${userId} subscription:`, error);
            if (error.code === 'PGRST116') {
                 debugLogger.log(`User ${userId} not found when fetching subscription.`);
                return { success: true, data: null };
            }
            throw error;
        }

        debugLogger.log(`Found subscription ID ${data?.subscription_id ?? 'null'} for user ${userId}.`);
        return { success: true, data: data?.subscription_id ?? null };

    } catch (error) {
        logger.error(`Exception in getUserSubscription for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch subscription" };
    }
};


// --- Invoice Management --- (Keeping as is, potentially reusable)

export const createInvoice = async (
    type: string,
    id: string,
    userId: string,
    amount: number,
    subscriptionId?: number | string | null,
    metadata: Record<string, any> = {}
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
    if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
    if (!id || !userId || amount == null) return { success: false, error: "Missing required parameters for invoice creation." };

    try {
        let finalSubscriptionId = subscriptionId;
        if (finalSubscriptionId === undefined) {
            const subResult = await getUserSubscription(userId);
            if (subResult.success) finalSubscriptionId = subResult.data;
            else logger.warn(`Could not fetch subscription for user ${userId} during invoice creation. Proceeding without subscription_id.`);
        }

        const { data, error } = await supabaseAdmin
            .from("invoices")
            .insert({ id, user_id: userId, type, amount, status: 'pending', subscription_id: finalSubscriptionId, metadata,
                     created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                 logger.warn(`Invoice with ID ${id} already exists.`);
                 const existing = await getInvoiceById(id);
                 if (existing.success && existing.data) return { success: true, data: existing.data };
                 return { success: false, error: `Invoice ID ${id} already exists, but failed to retrieve it.` };
            }
            throw error;
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
    status: DbInvoice['status']
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!invoiceId || !status) return { success: false, error: "Invoice ID and status are required." };

     try {
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .update({ status: status, updated_at: new Date().toISOString() })
            .eq("id", invoiceId)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') return { success: false, error: `Invoice ${invoiceId} not found.` };
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
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') return { success: false, error: `Invoice ${invoiceId} not found.` };
            throw error;
        }
        if (!data) return { success: false, error: `Invoice ${invoiceId} not found.` };

        debugLogger.log(`Fetched invoice ${invoiceId}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error fetching invoice ${invoiceId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch invoice" };
    }
};

export const getUserInvoices = async (userId: string): Promise<{ success: boolean; data?: DbInvoice[]; error?: string }> => {
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };
    const client = supabaseAdmin; // Using admin for now

    if (!userId) return { success: false, error: "User ID is required." };

    try {
        const { data, error } = await client
            .from("invoices")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        debugLogger.log(`Fetched ${data?.length || 0} invoices for user ${userId}.`);
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error(`Error fetching invoices for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user invoices" };
    }
};

// --- Rental Management --- (Keeping as is, potentially reusable)

export interface Rental extends DbRental { // Combine DB type with potential joined fields
  car_make?: string | null;
  car_model?: string | null;
}

export const createRental = async (
    userId: string,
    carId: string,
    startDate: string,
    endDate: string,
    totalCost: number
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!userId || !carId || !startDate || !endDate || totalCost == null) {
         return { success: false, error: "Missing required parameters for rental creation." };
     }

    try {
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .insert({
                user_id: userId, car_id: carId, start_date: startDate, end_date: endDate, total_cost: totalCost,
                status: 'pending', payment_status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23503') return { success: false, error: "Invalid user ID or car ID provided." };
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

export const getUserRentals = async (userId: string): Promise<{ success: boolean; data?: Rental[]; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available." };
     const client = supabaseAdmin; // Using admin for now

     if (!userId) return { success: false, error: "User ID is required." };

      try {
        const { data, error } = await client
            .from("rentals")
            .select(`*, cars ( make, model )`)
            .eq("user_id", userId)
            .order("start_date", { ascending: false });

        if (error) throw error;

        const formattedData: Rental[] = (data || []).map((rental: any) => ({
            ...rental, // Spread all fields from the rentals table
            car_make: rental.cars?.make || null,
            car_model: rental.cars?.model || null,
            cars: undefined, // Remove the nested 'cars' object
        }));

        debugLogger.log(`Fetched ${formattedData.length} rentals for user ${userId}.`);
        return { success: true, data: formattedData };
    } catch (error) {
        logger.error(`Error fetching rentals for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user rentals" };
    }
};

export const updateRentalPaymentStatus = async (
    rentalId: string,
    paymentStatus: DbRental['payment_status']
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!rentalId || !paymentStatus) return { success: false, error: "Rental ID and payment status are required." };

      try {
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
            .eq("rental_id", rentalId) // Ensure column name matches DB
            .select()
            .single();

        if (error) {
             if (error.code === 'PGRST116') return { success: false, error: `Rental ${rentalId} not found.` };
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
        const finalFileName = fileName || `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${finalFileName}`; // Upload to bucket root

        debugLogger.log(`Uploading file '${file.name}' to bucket '${bucketName}' as '${filePath}'...`);

        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, file, { upsert: false }); // Default no overwrite

        if (uploadError) {
            logger.error(`Error uploading image to ${bucketName}/${filePath}:`, uploadError);
            throw uploadError;
        }

        const { data: urlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
             logger.error(`Failed to get public URL for ${bucketName}/${filePath} after upload.`);
            throw new Error("Failed to get public URL after upload");
        }

         logger.info(`Image uploaded successfully: ${urlData.publicUrl}`);
        return { success: true, publicUrl: urlData.publicUrl };

    } catch (error) {
        logger.error(`Error uploading image to bucket ${bucketName}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to upload image" };
    }
};


// --- Generic Data Fetching (Examples, potentially reusable) ---

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
    const { data, error } = await supabaseAnon.from("cars").select("*").order("created_at", { ascending: false });
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
    const { data, error } = await supabaseAnon.from("cars").select("*").eq("id", id).maybeSingle();
    if (error) {
        if (error.code === 'PGRST116') return { success: false, error: `Car with ID ${id} not found.` };
        throw error;
    }
    if (!data) return { success: false, error: `Car with ID ${id} not found.` };
    return { success: true, data };
  } catch (error) {
    logger.error(`Error fetching car by ID ${id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch car" };
  }
}

// --- User Results (Saving/Fetching user choices/matches) ---

export const saveUserResult = async (userId: string, carId: string): Promise<{ success: boolean; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        const { error } = await client.from("user_results").insert({ user_id: userId, car_id: carId });
        if (error) {
             if (error.code === '23505') { debugLogger.warn(`User ${userId} already has a result for car ${carId}.`); return { success: true }; }
             if (error.code === '23503') return { success: false, error: "Invalid user ID or car ID." };
             throw error;
        }
        debugLogger.log(`Saved user result for user ${userId}, car ${carId}.`);
        return { success: true };
    } catch (error) {
        logger.error(`Error saving user result for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to save user result" };
    }
};

type DbUserResult = Database["public"]["Tables"]["user_results"]["Row"];

export const getUserResults = async (userId: string): Promise<{ success: boolean; data?: DbUserResult[]; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        const { data, error } = await client
            .from("user_results")
            .select("car_id, created_at") // Select necessary columns
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        debugLogger.log(`Fetched ${data?.length || 0} results for user ${userId}.`);
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error(`Error fetching user results for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user results" };
    }
};

// --- END OF /hooks/supabase.ts ---