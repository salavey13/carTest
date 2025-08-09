import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateJwtToken } from "@/lib/auth";
import type { WebAppUser } from "@/types/telegram";
import { logger } from "@/lib/logger"; 
import type { Database } from "@/types/database.types.ts"; 

type DbUser = Database["public"]["Tables"]["users"]["Row"];
type DbCar = Database["public"]["Tables"]["cars"]["Row"];
type DbInvoice = Database["public"]["Tables"]["invoices"]["Row"];
type DbRental = Database["public"]["Tables"]["rentals"]["Row"];
type DbTask = Database["public"]["Tables"]["tasks"]["Row"];
type DbCharacter = Database["public"]["Tables"]["characters"]["Row"];
type DbVideo = Database["public"]["Tables"]["videos"]["Row"];
type DbSubscription = Database["public"]["Tables"]["subscriptions"]["Row"];
type DbArticle = Database["public"]["Tables"]["articles"]["Row"];
type DbArticleSection = Database["public"]["Tables"]["article_sections"]["Row"];
type DbUserResult = Database["public"]["Tables"]["user_results"]["Row"];
type DbFeedback = Database["public"]["Tables"]["feedback"]["Row"];
type DbPageVisit = Database["public"]["Tables"]["page_visits"]["Row"];
type DbUserActivity = Database["public"]["Tables"]["user_activity"]["Row"];
type DbCozeResponse = Database["public"]["Tables"]["coze_responses"]["Row"];
type DbArbitrageUserSettings = Database["public"]["Tables"]["arbitrage_user_settings"]["Row"];
 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

if (!supabaseUrl || !supabaseAnonKey) {
    logger.error("Supabase URL or Anon Key is missing from environment variables.");
}
if (!serviceRoleKey) {
    logger.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations might fail.");
}

export const supabaseAnon: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin: SupabaseClient<Database> = serviceRoleKey
    ? createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        }
    })
    : (()=>{ logger.error("Admin client creation failed due to missing service role key."); return null as any; })(); 

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
            auth: { persistSession: false } 
        });
    } catch (error) {
        logger.error(`Error creating authenticated client for user ${userId}:`, error);
        return null;
    }
};

export const fetchUserData = async (userId: string): Promise<DbUser | null> => {
    if (!userId) {
        logger.warn("fetchUserData called with empty userId");
        return null;
    }
    logger.info(`Fetching user data for userId: ${userId}`);
    if (!supabaseAdmin) { 
        logger.error("[SupabaseHook] fetchUserData: Admin client unavailable.");
        return null;
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("users") 
            .select("*, metadata") 
            .eq("user_id", userId) 
            .maybeSingle();

        if (error) {
            logger.error(`[SupabaseHook] Error fetching user data for ${userId}:`, error);
            return null;
        }

        logger.info(`[SupabaseHook] Fetched user data for ${userId}: ${data ? 'User found' : 'User not found'}`);
        return data;
    } catch (catchError) {
        logger.error(`[SupabaseHook] Exception in fetchUserData for ${userId}:`, catchError);
        return null;
    }
};

export const createOrUpdateUser = async (userId: string, userInfo: Partial<WebAppUser & { role?: DbUser['role']; status?: DbUser['status']; metadata?: Record<string, any> }>): Promise<DbUser | null> => {
     if (!userId) {
        logger.error("[SupabaseHook] createOrUpdateUser called with empty userId");
        return null;
    }
     if (!supabaseAdmin) {
         logger.error("[SupabaseHook] createOrUpdateUser: Admin client unavailable.");
         return null;
     }

    logger.info("[SupabaseHook] Attempting to create or update user:", { userId, username: userInfo.username });

    try {
        const userData: Partial<DbUser> = { 
            user_id: userId, 
            username: userInfo.username || null,
            full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || null,
            avatar_url: userInfo.photo_url || null,
            language_code: userInfo.language_code || null,
            ...(userInfo.role && { role: userInfo.role }),
            ...(userInfo.status && { status: userInfo.status }),
            ...(userInfo.metadata !== undefined && { metadata: userInfo.metadata }), 
            updated_at: new Date().toISOString(),
        };
        
        Object.keys(userData).forEach(key => {
            const k = key as keyof typeof userData;
            if (userData[k] === undefined && k !== 'metadata') {
                 delete userData[k];
            }
        });
        
        const { data, error } = await supabaseAdmin
            .from("users") 
            .upsert(userData as Database["public"]["Tables"]["users"]["Insert"], { 
                onConflict: 'user_id', 
            })
            .select("*, metadata") 
            .single();

        if (error) {
            logger.error(`[SupabaseHook] Error upserting user ${userId}:`, error);
            throw error;
        }

        if (!data) {
             logger.error(`[SupabaseHook] Upsert for user ${userId} returned no data.`);
            throw new Error("Failed to get user data after upsert.");
        }

        logger.info(`[SupabaseHook] User ${userId} upserted successfully.`);
        return data;
    } catch (catchError) {
        logger.error(`[SupabaseHook] Exception in createOrUpdateUser for ${userId}:`, catchError);
        return null;
    }
};

export async function updateUserMetadata(
  userId: string,
  metadata: Record<string, any> | null 
): Promise<{ success: boolean; data?: DbUser; error?: string }> {
  if (!userId) {
    logger.error("[SupabaseHook updateUserMetadata] User ID is required.");
    return { success: false, error: "User ID is required." };
  }
  
  if (!supabaseAdmin) {
    logger.error("[SupabaseHook updateUserMetadata] Supabase admin client is not available.");
    return { success: false, error: "Database admin client is not available." };
  }

  logger.info(`[SupabaseHook updateUserMetadata] Updating metadata for user ${userId} using supabaseAdmin.`);
  try {
    const { data, error } = await supabaseAdmin
      .from("users") 
      .update({ metadata: metadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId) 
      .select("*, metadata") 
      .single();

    if (error) {
      logger.error(`[SupabaseHook updateUserMetadata] Error updating metadata for user ${userId} with supabaseAdmin:`, error);
      if (error.code === 'PGRST116') return { success: false, error: `User ${userId} not found.` };
      throw error; 
    }
    if (!data) {
        logger.warn(`[SupabaseHook updateUserMetadata] User ${userId} not found after metadata update attempt, or update returned no data.`);
        return { success: false, error: `User ${userId} not found after metadata update attempt.` };
    }

    logger.info(`[SupabaseHook updateUserMetadata] Successfully updated metadata for user ${userId} with supabaseAdmin.`);
    return { success: true, data };
  } catch (catchError) {
    logger.error(`[SupabaseHook updateUserMetadata] Exception for user ${userId} (using supabaseAdmin):`, catchError);
    return { success: false, error: catchError instanceof Error ? catchError.message : "Failed to update user metadata due to an unexpected error." };
  }
}

const VECTOR_DIMENSIONS = 384; 

function generateSimplifiedFallbackEmbedding(text: string): number[] {
   logger.warn("Generating simplified FALLBACK embedding for text:", text.substring(0, 50) + "...");
   const embedding = new Array(VECTOR_DIMENSIONS).fill(0);
   if (!text) return embedding;
   const words = text.toLowerCase().split(/\W+/).filter(Boolean);
   words.forEach((word, i) => {
       let hash = 0;
       for (let j = 0; j < word.length; j++) {
           hash = (hash * 31 + word.charCodeAt(j)) | 0;
       }
       embedding[Math.abs(hash + i) % VECTOR_DIMENSIONS] += 1;
   });
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

export async function generateCarEmbedding(
  mode: 'single' | 'batch' | 'create' = 'batch',
  payload?: {
    carId?: string; 
    carData?: {
        make: string; model: string; description: string; specs: Record<string, any>; 
        owner_id?: string; daily_price?: number; image_url?: string; rent_link?: string; status?: string;
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
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings`;
                requestBody = { mode: 'single', carId: payload.carId };
                break;
            case 'create':
                if (!payload?.carData) throw new Error("carData is required for create mode");
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings`;
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
                endpoint = `${supabaseUrl}/functions/v1/generate-embeddings`;
                requestBody = { mode: 'batch' };
                break;
        }

        logger.info(`Calling Edge Function 'generate-embeddings' (mode: ${mode})...`);
        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        if (!response.ok) {
            logger.error(`Edge Function 'generate-embeddings' (${mode}) failed (${response.status}): ${responseText}`);
            throw new Error(`Edge Function failed (${response.status}): ${responseText}`);
        }

        const result = JSON.parse(responseText);
        logger.info(`Edge Function 'generate-embeddings' (${mode}) success: ${result.message}`);

        let createdCarId = result.carId; 
        if (mode === 'create' && createdCarId && payload?.carData) {
            const { owner_id, daily_price, image_url, rent_link, status } = payload.carData;
            const fieldsToUpdate: Partial<DbCar> = {};
            if (owner_id !== undefined) fieldsToUpdate.owner_id = owner_id;
            if (daily_price !== undefined) fieldsToUpdate.daily_price = daily_price;
            if (image_url !== undefined) fieldsToUpdate.image_url = image_url;
            if (rent_link !== undefined) fieldsToUpdate.rent_link = rent_link;
            if (status !== undefined) fieldsToUpdate.status = status;

            if (Object.keys(fieldsToUpdate).length > 0) {
                logger.info(`Updating additional fields for new car ${createdCarId}...`, fieldsToUpdate);
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

            if (carIdToUpdate) {
                 const { error: updateError } = await supabaseAdmin.from("cars").update({ embedding }).eq("id", carIdToUpdate);
                 if (updateError) throw new Error(`Fallback failed: Cannot update embedding for ${carIdToUpdate}. ${updateError.message}`);
                 logger.info(`Successfully updated car ${carIdToUpdate} with fallback embedding.`);
                 return { success: true, message: "Edge function failed, fallback embedding generated and updated.", carId: carIdToUpdate };
            } else if (mode === 'create' && payload?.carData) {
                 const carInsertData: Database["public"]["Tables"]["cars"]["Insert"] = {
                        make: payload.carData.make, model: payload.carData.model, description: payload.carData.description,
                        specs: payload.carData.specs, owner_id: payload.carData.owner_id, daily_price: payload.carData.daily_price,
                        image_url: payload.carData.image_url, rent_link: payload.carData.rent_link,
                        embedding, is_test_result: false, 
                        status: payload.carData.status || 'available', 
                 };
                 const { data: newCar, error: insertError } = await supabaseAdmin
                    .from("cars")
                    .insert(carInsertData)
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

export interface CarResult { 
  id: string;
  make: string;
  model: string;
  similarity: number;
  description?: string | null;
  image_url?: string | null;
  rent_link?: string | null;
  daily_price?: number | null;
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
            id: item.id,
            make: item.make,
            model: item.model,
            similarity: item.similarity,
            description: item.description,
            image_url: item.image_url,
            daily_price: item.daily_price,
            rent_link: item.rent_link || `/rent/${item.id}`,
        }));
        return { success: true, data: formattedData };
    } catch (error) {
        logger.error("Error searching cars:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to search cars" };
    }
};

export const getSimilarCars = async (carId: string, matchCount: number = 3): Promise<{ success: boolean; data?: DbCar[]; error?: string }> => { 
     if (!carId) return { success: false, error: "Car ID is required." };
     if (!supabaseAnon) return { success: false, error: "Anon client not available."};
     try {
        const { data, error } = await supabaseAnon.rpc("similar_cars", {
            p_car_id: carId,
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

export const fetchArticles = async (): Promise<{ success: boolean; data?: DbArticle[]; error?: string }> => {
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };
  try {
    const { data, error } = await supabaseAnon
      .from("articles")
      .select("*")
      .order("title", { ascending: true }); 

    if (error) throw error;
    logger.info(`Fetched ${data?.length || 0} articles.`);
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error("Error fetching articles:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch articles" };
  }
};

export const fetchArticleSections = async (articleId: string): Promise<{ success: boolean; data?: DbArticleSection[]; error?: string }> => {
  if (!articleId) return { success: false, error: "Article ID is required." };
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };

  try {
    const { data, error } = await supabaseAnon
      .from("article_sections")
      .select("*")
      .eq("article_id", articleId)
      .order("section_order", { ascending: true }); 

    if (error) throw error;
    logger.info(`Fetched ${data?.length || 0} sections for article ${articleId}.`);
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error(`Error fetching sections for article ${articleId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch article sections" };
  }
};

export const saveTestProgress = async (userId: string, progress: any): Promise<{ success: boolean; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        const { error } = await client
            .from("users") 
            .update({ test_progress: progress, updated_at: new Date().toISOString() })
            .eq("user_id", userId); 

        if (error) throw error;
        logger.info(`Saved test progress for user ${userId}.`);
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
             if (error.code === 'PGRST116') return { success: true, data: null }; 
            throw error;
        }

        logger.info(`Loaded test progress for user ${userId}.`);
        return { success: true, data: data?.test_progress ?? null };
    } catch (error) {
        logger.error(`Exception loading test progress for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to load progress" };
    }
};

export const updateUserSubscription = async (
  userId: string,
  subscriptionId: string | null 
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
    if (!userId) return { success: false, error: "User ID is required." };
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };

    logger.info(`Attempting to update subscription-related info for user ${userId}. New subscription_id: ${subscriptionId}`);
    try {
        const updatePayload: Partial<DbUser> = { 
            updated_at: new Date().toISOString(),
            subscription_id: subscriptionId, 
        };
        
        const { data, error } = await supabaseAdmin
            .from("users") 
            .update(updatePayload)
            .eq("user_id", userId) 
            .select("*, metadata") 
            .single();

        if (error) {
            logger.error(`Error updating user ${userId} subscription info:`, error);
            if (error.code === 'PGRST116') return { success: false, error: `User ${userId} not found.` };
            throw error;
        }
         if (!data) return { success: false, error: `User ${userId} not found after update attempt.` };

        logger.info(`Successfully updated user ${userId} subscription_id to ${data.subscription_id}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Exception in updateUserSubscription for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update subscription-related info" };
    }
};

export const createInvoice = async (
    type: string,
    id: string, 
    userId: string,
    amount: number,
    subscriptionId?: string | null | number, 
    metadata: Record<string, any> = {}
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
    if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
    if (!id || !userId || amount == null || !type) return { success: false, error: "Missing required parameters for invoice creation." };

    try {
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .insert({
                id: id,
                user_id: userId,
                type: type,
                amount: amount, 
                status: 'pending', 
                subscription_id: subscriptionId, 
                metadata: metadata,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
             })
            .select() 
            .single(); 

        if (error) {
            if (error.code === '23505') { 
                 logger.warn(`Invoice with ID ${id} already exists.`);
                 const existing = await getInvoiceById(id);
                 if (existing.success && existing.data) return { success: true, data: existing.data };
                 return { success: false, error: `Invoice ID ${id} already exists, but failed to retrieve it.` };
            }
            logger.error(`Error inserting invoice ${id}:`, {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
            });
            throw error; 
        }
        if (!data) return { success: false, error: "Invoice creation returned no data." };

        logger.info(`Invoice ${id} created successfully for user ${userId}.`);
        return { success: true, data };
    } catch (error) {
        const castError = error as any;
        logger.error(`Exception creating invoice ${id} for user ${userId}:`, {
            message: castError.message,
            details: castError.details,
            hint: castError.hint,
            code: castError.code,
            fullError: castError,
          });
        return { success: false, error: castError instanceof Error ? castError.message : "Failed to create invoice" };
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

         logger.info(`Invoice ${invoiceId} status updated to ${status}.`);
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
            throw error;
        }
        if (!data) {
            return { success: false, error: `Invoice ${invoiceId} not found.` };
        }

        logger.info(`Fetched invoice ${invoiceId}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error fetching invoice ${invoiceId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch invoice" };
    }
};

export const getUserInvoices = async (userId: string): Promise<{ success: boolean; data?: DbInvoice[]; error?: string }> => {
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };
    const client = supabaseAdmin;

    if (!userId) return { success: false, error: "User ID is required." };

    try {
        const { data, error } = await client
            .from("invoices")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }); 

        if (error) throw error;

        logger.info(`Fetched ${data?.length || 0} invoices for user ${userId}.`);
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error(`Error fetching invoices for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user invoices" };
    }
};

export interface RentalWithCarDetails extends DbRental {
  car_make?: string | null;
  car_model?: string | null;
  car_image_url?: string | null;
}

export const createRental = async (
    userId: string,
    carId: string, 
    startDate: string, 
    endDate: string,   
    totalCost: number
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!userId || !carId || !startDate || !endDate || totalCost == null || totalCost < 0) {
         return { success: false, error: "Missing or invalid parameters for rental creation." };
     }

    try {
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .insert({
                user_id: userId,
                car_id: carId, 
                start_date: startDate,
                end_date: endDate,
                total_cost: totalCost,
                status: 'pending', 
                payment_status: 'pending', 
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select() 
            .single(); 

        if (error) {
            if (error.code === '23503') { 
                 const { data: carExists } = await supabaseAdmin.from("cars").select("id").eq("id", carId).maybeSingle();
                 if (!carExists) return { success: false, error: `Invalid car ID: ${carId}`};
                 const { data: userExists } = await supabaseAdmin.from("users").select("user_id").eq("user_id", userId).maybeSingle();
                 if (!userExists) return { success: false, error: `Invalid user ID: ${userId}`};
                 return { success: false, error: "Invalid user ID or car ID provided." };
            }
            throw error;
        }
        if (!data) return { success: false, error: "Rental creation returned no data." };
        logger.info(`Rental created successfully for user ${userId}, car ${carId}. ID: ${data.rental_id}`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating rental for user ${userId}, car ${carId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create rental" };
    }
};

export const getUserRentals = async (userId: string): Promise<{ success: boolean; data?: RentalWithCarDetails[]; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available." };
     const client = supabaseAdmin;

     if (!userId) return { success: false, error: "User ID is required." };

      try {
        const { data, error } = await client
            .from("rentals")
            .select(`
                *,
                cars ( make, model, image_url ) 
            `) 
            .eq("user_id", userId)
            .order("start_date", { ascending: false }); 

        if (error) throw error;
        
        const formattedData: RentalWithCarDetails[] = (data || []).map((rental: any) => ({ 
            ...rental, 
            car_make: rental.cars?.make || null,
            car_model: rental.cars?.model || null,
            car_image_url: rental.cars?.image_url || null,
            cars: undefined, 
        }));

        logger.info(`Fetched ${formattedData.length} rentals for user ${userId}.`);
        return { success: true, data: formattedData };
    } catch (error) {
        logger.error(`Error fetching rentals for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user rentals" };
    }
};

export const updateRentalPaymentStatus = async (
    rentalId: number, 
    paymentStatus: DbRental['payment_status'] 
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (rentalId === undefined || rentalId === null || !paymentStatus) {
        return { success: false, error: "Rental ID and payment status are required." };
     }

      try {
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
            .eq("rental_id", rentalId) 
            .select() 
            .single(); 

        if (error) {
             if (error.code === 'PGRST116') return { success: false, error: `Rental ${rentalId} not found.` }; 
            throw error;
        }
         if (!data) return { success: false, error: "Rental not found after update attempt." };

         logger.info(`Rental ${rentalId} payment status updated to ${paymentStatus}.`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error updating rental ${rentalId} payment status to ${paymentStatus}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update rental payment status" };
    }
};

export const uploadImage = async (bucketName: string, file: File, fileName?: string): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!bucketName || !file) return { success: false, error: "Bucket name and file are required." };

    try {
        const fileExt = file.name.split(".").pop();
        if (!fileExt) {
            return { success: false, error: "Invalid file name (no extension)." };
        }
        const finalFileName = fileName || `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${finalFileName}`; 

        logger.info(`Uploading file '${file.name}' to bucket '${bucketName}' as '${filePath}'...`);

        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, file, {
                cacheControl: '3600', 
                upsert: false         
            });

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

export const fetchCars = async (): Promise<{ success: boolean; data?: DbCar[]; error?: string }> => {
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };
  try {
    const { data, error } = await supabaseAnon
        .from("cars")
        .select("*")
        .order("model", { ascending: true }); 
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    logger.error("Error fetching cars:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch cars" };
  }
}

export const fetchCarById = async (id: string): Promise<{ success: boolean; data?: DbCar; error?: string }> => {
  if (!id) return { success: false, error: "Car ID is required." };
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };
  try {
    const { data, error } = await supabaseAnon
        .from("cars")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        // CORRECTED LOGIC: Return the error in the object instead of throwing it.
        logger.error(`Error fetching car by ID ${id} from Supabase:`, error);
        return { success: false, error: error.message };
    }
    if (!data) {
        return { success: false, error: `Car with ID ${id} not found.` };
    }
    return { success: true, data };
  } catch (catchError) {
    logger.error(`Exception in fetchCarById for ${id}:`, catchError);
    return { success: false, error: catchError instanceof Error ? catchError.message : "Failed to fetch car" };
  }
}

export const saveUserResult = async (userId: string, carId: string): Promise<{ success: boolean; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        const { error } = await client
            .from("user_results")
            .insert({ user_id: userId, car_id: carId, created_at: new Date().toISOString() });

        if (error) {
             if (error.code === '23505') { 
                 logger.warn(`User ${userId} already has a result for car ${carId}. Ignoring duplicate.`);
                 return { success: true };
             }
             if (error.code === '23503') {
                  return { success: false, error: "Invalid user ID or car ID." };
             }
             throw error;
        }
        logger.info(`Saved user result for user ${userId}, car ${carId}.`);
        return { success: true };
    } catch (error) {
        logger.error(`Error saving user result for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to save user result" };
    }
};

export const getUserSubscription = async (
  userId: string
): Promise<{ success: boolean; data?: string | null; error?: string }> => { 
    if (!userId) return { success: false, error: "User ID is required." };
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };

    try {
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("subscription_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (userError) {
            logger.error(`[getUserSubscription] Error fetching user ${userId} for subscription_id:`, userError);
            throw userError;
        }
        
        const subIdFromDb = userData?.subscription_id; 
        return { success: true, data: subIdFromDb ?? null };

    } catch (error) {
        logger.error(`[getUserSubscription] Exception for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch subscription-related info" };
    }
};

export const getUserResults = async (userId: string): Promise<{ success: boolean; data?: DbUserResult[]; error?: string }> => {
    const client = await createAuthenticatedClient(userId);
    if (!client) return { success: false, error: "Failed to create authenticated client." };

    try {
        const { data, error } = await client
            .from("user_results")
            .select("car_id, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        logger.info(`Fetched ${data?.length || 0} results for user ${userId}.`);
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error(`Error fetching user results for ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user results" };
    }
};