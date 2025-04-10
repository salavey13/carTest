// /hooks/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateJwtToken } from "@/lib/auth";
import type { WebAppUser } from "@/types/telegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; // Use standard logger for errors/warnings
import type { Database } from "@/types/database.types";

// Type Aliases for clarity
type DbUser = Database["public"]["Tables"]["users"]["Row"];
type DbCar = Database["public"]["Tables"]["cars"]["Row"];
type DbInvoice = Database["public"]["Tables"]["invoices"]["Row"];
type DbRental = Database["public"]["Tables"]["rentals"]["Row"];

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or Anon Key is missing from environment variables.");
}
if (!serviceRoleKey) {
    // Log warning but don't throw, admin client might not be needed everywhere immediately
    logger.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.");
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
    : (()=>{ logger.error("Admin client creation skipped due to missing service role key."); return null as any; })(); // Handle missing key

// Function to create an authenticated client for a specific user (respects RLS)
// Should ideally be used within server actions or API routes after validating the user's JWT
export const createAuthenticatedClient = async (jwtToken: string): Promise<SupabaseClient<Database> | null> => {
    // Here you might want to validate the token first before creating the client
    // For now, assume token is valid when this function is called.
    if (!jwtToken) {
        logger.warn("Attempted to create authenticated client without a token.");
        return null;
    }
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${jwtToken}` } },
        auth: { persistSession: false } // Usually don't persist session for server-side authenticated clients
    });
};


// --- User Management ---

/** Fetches user data by user ID. Uses admin client for broad access. */
export const fetchUserData = async (userId: string): Promise<DbUser | null> => {
    if (!userId) {
        debugLogger.warn("fetchUserData called with empty userId");
        return null;
    }
    debugLogger.log(`Fetching user data for userId: ${userId}`);
    if (!supabaseAdmin) return null; // Guard if admin client failed init

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
export const createOrUpdateUser = async (userId: string, userInfo: Partial<WebAppUser>): Promise<DbUser | null> => {
    if (!userId) {
        debugLogger.error("createOrUpdateUser called with empty userId");
        return null;
    }
     if (!supabaseAdmin) return null; // Guard

    debugLogger.log("Attempting to create or update user:", { userId, username: userInfo.username });

    try {
        // Prepare user data, ensuring required fields have fallbacks if needed by DB schema
        const userData = {
            user_id: userId,
            username: userInfo.username || null,
            full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || null,
            avatar_url: userInfo.photo_url || null,
            language_code: userInfo.language_code || null,
            // Set default role/status on creation? Example:
            // role: 'user',
            // status: 'active',
            // Be careful not to overwrite existing role/status on update unless intended
        };

        // Use upsert for create or update logic
        const { data, error } = await supabaseAdmin
            .from("users")
            .upsert(userData, {
                onConflict: 'user_id', // Specify the conflict target
                // ignoreDuplicates: false, // Default: update on conflict
            })
            .select() // Select the resulting row
            .single(); // Expect a single row back

        if (error) {
            logger.error(`Error upserting user ${userId}:`, error);
            throw error; // Throw to indicate failure
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
        return null; // Return null on failure
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
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings/single`; // Adjust endpoint name if needed
                requestBody = { carId: payload.carId };
                break;
            case 'create':
                if (!payload?.carData) throw new Error("carData is required for create mode");
                 // Pass only data needed for embedding generation to the function
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings/create`;
                requestBody = {
                    make: payload.carData.make,
                    model: payload.carData.model,
                    description: payload.carData.description,
                    specs: payload.carData.specs,
                 };
                break;
            case 'batch':
            default:
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings/batch`;
                requestBody = undefined; // No body for batch usually, function finds cars itself
                break;
        }

        logger.info(`Calling Edge Function '${mode}' at ${endpoint}...`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: requestBody ? JSON.stringify(requestBody) : undefined,
        });

        const responseText = await response.text(); // Get text first for better error reporting
        if (!response.ok) {
            logger.error(`Edge Function '${mode}' failed (${response.status}): ${responseText}`);
            throw new Error(`Edge Function failed (${response.status}): ${responseText}`);
        }

        const result = JSON.parse(responseText); // Parse JSON only if response is ok
        logger.info(`Edge Function '${mode}' success: ${result.message}`);

        // Handle post-creation updates for 'create' mode if necessary
        let createdCarId = result.carId;
        if (mode === 'create' && createdCarId && payload?.carData && supabaseAdmin) {
            const { owner_id, daily_price, image_url, rent_link } = payload.carData;
            if (owner_id || daily_price != null || image_url || rent_link) {
                logger.info(`Updating additional fields for new car ${createdCarId}...`);
                 const { error: updateError } = await supabaseAdmin
                    .from("cars")
                    .update({ owner_id, daily_price, image_url, rent_link, updated_at: new Date().toISOString() })
                    .eq("id", createdCarId);
                 if (updateError) {
                     // Log error but don't necessarily fail the whole operation, embedding was created
                     logger.error(`Failed to update additional fields for car ${createdCarId}: ${updateError.message}`);
                 }
            }
        }

        return { success: true, message: result.message, carId: createdCarId };

    } catch (error) {
        logger.error(`generateCarEmbedding (${mode}) failed, attempting fallback:`, error);

        // --- Fallback Logic ---
        if (!supabaseAdmin) {
            return { success: false, message: "Edge function failed, and fallback unavailable (no admin client).", error: error instanceof Error ? error.message : String(error) };
        }

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
                 // Fallback needs to create the car *then* update embedding
            } else {
                 // Cannot fallback for batch mode easily
                 return { success: false, message: "Edge function failed, fallback not supported for batch mode.", error: error instanceof Error ? error.message : String(error) };
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
                        ...payload.carData, // Include all original data
                        embedding,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        status: 'new', // Set default status
                    })
                    .select("id")
                    .single();
                 if (insertError || !newCar) throw new Error(`Fallback failed: Cannot create car. ${insertError?.message}`);
                 logger.info(`Successfully created car ${newCar.id} with fallback embedding.`);
                 return { success: true, message: "Edge function failed, fallback embedding generated and car created.", carId: newCar.id };
            }

             // Should not be reached if logic is correct
             return { success: false, message: "Edge function failed, and fallback logic path unclear.", error: error instanceof Error ? error.message : String(error) };

        } catch (fallbackError) {
            logger.error("Fallback embedding generation also failed:", fallbackError);
            return { success: false, message: "Edge function and fallback embedding failed.", error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) };
        }
    }
}


/** Searches for cars using vector similarity via RPC */
export const searchCars = async (embedding: number[], limit: number = 5): Promise<{ success: boolean; data?: DbCar[]; error?: string }> => {
    if (!embedding || embedding.length !== VECTOR_DIMENSIONS) {
        return { success: false, error: `Invalid embedding provided (length ${embedding?.length}, expected ${VECTOR_DIMENSIONS})` };
    }
    try {
        // Use anon client as searching is likely public
        const { data, error } = await supabaseAnon.rpc("search_cars", {
            query_embedding: embedding,
            match_count: limit,
        });

        if (error) {
            logger.error("Error calling search_cars RPC:", error);
            throw error;
        }

        // Optional: Add similarity score or formatting here if needed
        // const formattedData = data.map((item: any) => ({ ...item, similarity: item.similarity ? Math.round(item.similarity * 100) : 0 }));

        return { success: true, data: data || [] };
    } catch (error) {
        logger.error("Error searching cars:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to search cars" };
    }
};

/** Gets similar cars based on a car ID via RPC */
export const getSimilarCars = async (carId: string, matchCount: number = 3): Promise<{ success: boolean; data?: DbCar[]; error?: string }> => {
     if (!carId) return { success: false, error: "Car ID is required." };
     try {
        // Use anon client for public search
        const { data, error } = await supabaseAnon.rpc("similar_cars", { // Ensure RPC name is correct
            p_car_id: carId, // Match parameter name in RPC definition
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


// --- Invoice Management ---
// Using supabaseAdmin for now, switch to authenticatedClient + RLS for user-facing calls

export const createInvoice = async (
    type: string,
    id: string, // The unique invoice payload ID
    userId: string,
    amount: number, // Amount in XTR (confirm unit)
    subscriptionId: number = 0,
    metadata: Record<string, any> = {}
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
    if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
    try {
        // Consider calling an RPC function `create_invoice` if complex logic/validation is needed
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .insert({
                id,
                user_id: userId,
                type,
                amount,
                status: 'pending',
                subscription_id: subscriptionId,
                metadata,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
             })
            .select()
            .single();

        if (error) throw error;
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
     try {
         // Use RPC 'update_invoice_status' or direct update
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .update({ status: status, updated_at: new Date().toISOString() })
            .eq("id", invoiceId)
            .select()
            .single();

        if (error) throw error;
        if (!data) return { success: false, error: "Invoice not found after update attempt." };
        return { success: true, data };
    } catch (error) {
        logger.error(`Error updating invoice ${invoiceId} status to ${status}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update invoice status" };
    }
};

export const getInvoiceById = async (invoiceId: string): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
      try {
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .select("*")
            .eq("id", invoiceId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return { success: false, error: "Invoice not found." };
        return { success: true, data };
    } catch (error) {
        logger.error(`Error fetching invoice ${invoiceId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch invoice" };
    }
};

// --- Rental Management ---
// Using supabaseAdmin, consider switching to authenticated client + RLS

export const createRental = async (
    userId: string,
    carId: string,
    startDate: string, // ISO format string
    endDate: string,   // ISO format string
    totalCost: number // Cost in XTR
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
    try {
        // Consider RPC 'create_rental' for atomicity/validation (e.g., check car availability)
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .insert({
                user_id: userId,
                car_id: carId,
                start_date: startDate,
                end_date: endDate,
                total_cost: totalCost,
                status: 'pending', // Initial status, maybe 'active' if payment confirmed?
                payment_status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating rental for user ${userId}, car ${carId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create rental" };
    }
};

export const getUserRentals = async (userId: string): Promise<{ success: boolean; data?: (DbRental & { car_make?: string, car_model?: string })[]; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
      try {
        // Fetch rentals and join with car details
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .select(`*, cars (make, model)`) // Join with cars table
            .eq("user_id", userId)
            .order("created_at", { ascending: false }); // Order by most recent

        if (error) throw error;

        // Format data to include car make/model directly
        const formattedData = data?.map((rental: any) => ({
            ...rental,
            car_make: rental.cars?.make || null,
            car_model: rental.cars?.model || null,
            cars: undefined, // Remove nested 'cars' object
        })) || [];

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
      try {
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
            .eq("rental_id", rentalId) // Ensure primary key column name is correct
            .select()
            .single();

        if (error) throw error;
         if (!data) return { success: false, error: "Rental not found after update attempt." };
        return { success: true, data };
    } catch (error) {
        logger.error(`Error updating rental ${rentalId} payment status to ${paymentStatus}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update rental payment status" };
    }
};


// --- Image Upload ---

export const uploadImage = async (bucketName: string, file: File, fileName?: string): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
    try {
        const fileExt = file.name.split(".").pop();
        if (!fileExt) {
            return { success: false, error: "Invalid file name (no extension)." };
        }
        const finalFileName = fileName || `${crypto.randomUUID()}.${fileExt}`; // Use crypto.randomUUID
        const filePath = `public/${finalFileName}`; // Assuming 'public' path within the bucket

        // Upload file
        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, file, {
                // cacheControl: '3600', // Optional: Cache control
                upsert: false, // Optional: Set to true to overwrite existing file with same name
            });

        if (uploadError) {
            logger.error(`Error uploading image to ${bucketName}/${filePath}:`, uploadError);
            throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
             logger.error(`Failed to get public URL for ${bucketName}/${filePath} after upload.`);
             // Optional: Attempt to delete the uploaded file if URL fails?
            throw new Error("Failed to get public URL after upload");
        }

         logger.info(`Image uploaded successfully: ${urlData.publicUrl}`);
        return { success: true, publicUrl: urlData.publicUrl };

    } catch (error) {
        logger.error(`Error uploading image to bucket ${bucketName}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to upload image" };
    }
};


// --- Generic Data Fetching (Example: Questions/Answers) ---

export const fetchQuestions = async () => {
    // Use anon client for public data
    const { data, error } = await supabaseAnon.from("questions").select("*");
    if (error) {
        logger.error("Error fetching questions:", error);
        throw error; // Re-throw for calling function to handle
    }
    return data;
};

export const fetchAnswers = async () => {
     // Use anon client for public data
    const { data, error } = await supabaseAnon.from("answers").select("*");
     if (error) {
        logger.error("Error fetching answers:", error);
        throw error;
    }
    return data;
};

// --- Other functions (keep as needed) ---

// export const saveTestProgress = async (chatId: string, progress: any) => { ... }
// export const loadTestProgress = async (chatId: string) => { ... }
// export const updateUserSubscription = async (userId: string, subscriptionId: number) => { ... } // Adjust type if needed
// export const getUserSubscription = async (userId: string): Promise<number | null> => { ... } // Adjust type if needed
// export const fetchCars = async () => { ... } // Use supabaseAnon
// export const fetchCarById = async (id: string) => { ... } // Use supabaseAnon