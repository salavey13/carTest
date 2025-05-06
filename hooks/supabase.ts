import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateJwtToken } from "@/lib/auth";
import type { WebAppUser } from "@/types/telegram";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; 
import type { Database } from "@/types/database.types";

// --- Type Aliases ---
type DbUser = Database["public"]["Tables"]["users"]["Row"];
// type DbCar = Database["public"]["Tables"]["cars"]["Row"]; // Removed
type DbInvoice = Database["public"]["Tables"]["invoices"]["Row"];
type DbRental = Database["public"]["Tables"]["rentals"]["Row"]; // Retained for now, might be reused or removed later
type DbTask = Database["public"]["Tables"]["tasks"]["Row"]; 
type DbCharacter = Database["public"]["Tables"]["characters"]["Row"]; 
type DbVideo = Database["public"]["Tables"]["videos"]["Row"]; 
type DbSubscription = Database["public"]["Tables"]["subscriptions"]["Row"]; 
type DbArticle = Database["public"]["Tables"]["articles"]["Row"]; 
type DbArticleSection = Database["public"]["Tables"]["article_sections"]["Row"]; 


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

// --- User Management ---

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
            .select("*, metadata") 
            .eq("user_id", userId) 
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
            .upsert(userData, {
                onConflict: 'user_id', 
            })
            .select("*, metadata") 
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

export const updateUserMetadata = async (
  userId: string,
  metadata: Record<string, any> | null 
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
  if (!userId) return { success: false, error: "User ID is required." };

  const client = await createAuthenticatedClient(userId);
  if (!client) return { success: false, error: "Failed to create authenticated client." };

  debugLogger.log(`Updating metadata for user ${userId}`, metadata);
  try {
    const { data, error } = await client
      .from("users") 
      .update({ metadata: metadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId) 
      .select("*, metadata") 
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

// --- Embeddings & Search (Car-specific logic removed) ---
// const VECTOR_DIMENSIONS = 384; // Removed, as it was car-specific

// generateCarEmbedding function removed
// searchCars function removed
// getSimilarCars function removed

// --- Advice Articles & Sections ---

export const fetchArticles = async (): Promise<{ success: boolean; data?: DbArticle[]; error?: string }> => {
  if (!supabaseAnon) return { success: false, error: "Anon client not available." };
  try {
    const { data, error } = await supabaseAnon
      .from("articles")
      .select("*")
      .order("title", { ascending: true }); 

    if (error) throw error;
    debugLogger.log(`Fetched ${data?.length || 0} articles.`);
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
             if (error.code === 'PGRST116') return { success: true, data: null }; 
            throw error;
        }

        debugLogger.log(`Loaded test progress for user ${userId}.`);
        return { success: true, data: data?.test_progress ?? null };
    } catch (error) {
        logger.error(`Exception loading test progress for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to load progress" };
    }
};


// --- Subscriptions ---
export const updateUserSubscription = async (
  userId: string,
  subscriptionId: string | number | null 
): Promise<{ success: boolean; data?: DbUser; error?: string }> => {
    if (!userId) return { success: false, error: "User ID is required." };
    if (!supabaseAdmin) return { success: false, error: "Admin client not available." };

    debugLogger.log(`Updating subscription for user ${userId} to ${subscriptionId}`);
    try {
        const { data, error } = await supabaseAdmin
            .from("users") 
            .update({ subscription_id: subscriptionId, updated_at: new Date().toISOString() })
            .eq("user_id", userId) 
            .select("*, metadata") 
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


// --- Invoice Management ---
export const createInvoice = async (
    type: string,
    id: string, 
    userId: string,
    amount: number,
    subscriptionId?: number | string | null, 
    metadata: Record<string, any> = {}
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
    if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
    if (!id || !userId || amount == null || !type) return { success: false, error: "Missing required parameters for invoice creation." };

    try {
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
                amount: amount, 
                status: 'pending', 
                subscription_id: finalSubscriptionId, 
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
            throw error;
        }
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

        debugLogger.log(`Fetched ${data?.length || 0} invoices for user ${userId}.`);
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error(`Error fetching invoices for user ${userId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch user invoices" };
    }
};


// --- Rental Management --- (Retained for now, can be adapted or removed)
export interface RentalWithDetails extends DbRental { // Renamed to avoid conflict if car-specific details were used
  // Add any generic or new details needed for rentals in Fit10min if this table is reused
  // For example, if rentals could be for equipment or premium plans:
  item_name?: string | null;
  item_image_url?: string | null;
}

export const createRental = async (
    userId: string,
    itemId: string, // Changed from carId to itemId
    startDate: string, 
    endDate: string,   
    totalCost: number
): Promise<{ success: boolean; data?: DbRental; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available."};
     if (!userId || !itemId || !startDate || !endDate || totalCost == null || totalCost < 0) {
         return { success: false, error: "Missing or invalid parameters for rental creation." };
     }

    try {
        const { data, error } = await supabaseAdmin
            .from("rentals")
            .insert({
                user_id: userId,
                car_id: itemId, // Assuming car_id column is reused for a generic item_id
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
                 return { success: false, error: "Invalid user ID or item ID provided." };
            }
            throw error;
        }
        if (!data) return { success: false, error: "Rental creation returned no data." };
        debugLogger.log(`Rental created successfully for user ${userId}, item ${itemId}. ID: ${data.rental_id}`);
        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating rental for user ${userId}, item ${itemId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create rental" };
    }
};

export const getUserRentals = async (userId: string): Promise<{ success: boolean; data?: RentalWithDetails[]; error?: string }> => {
     if (!supabaseAdmin) return { success: false, error: "Admin client not available." };
     const client = supabaseAdmin;

     if (!userId) return { success: false, error: "User ID is required." };

      try {
        // Adjust select if joining with a new 'items' table instead of 'cars'
        const { data, error } = await client
            .from("rentals")
            .select(`
                *,
                cars ( make, model, image_url ) 
            `) // Kept cars join for now, needs update if schema changes
            .eq("user_id", userId)
            .order("start_date", { ascending: false }); 

        if (error) throw error;
        
        // This mapping will need to change if 'cars' table is removed/renamed
        const formattedData: RentalWithDetails[] = (data || []).map((rental: any) => ({ 
            ...rental, 
            item_name: rental.cars?.make ? `${rental.cars.make} ${rental.cars.model}` : null, // Example adaption
            item_image_url: rental.cars?.image_url || null,
            cars: undefined, 
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
            .eq("rental_id", rentalId) 
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
        const filePath = `${finalFileName}`; 

        debugLogger.log(`Uploading file '${file.name}' to bucket '${bucketName}' as '${filePath}'...`);

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


// --- Generic Data Fetching ---
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

// fetchCars function removed
// fetchCarById function removed
// saveUserResult function removed (was car-specific)
// getUserResults function removed (was car-specific)


// --- END OF /hooks/supabase.ts ---