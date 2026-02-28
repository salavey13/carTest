/**
 * Server-only Supabase Admin Client
 *
 * This file MUST only be imported by server-side code:
 * - Server Components
 * - API Routes (Route Handlers)
 * - Server Actions
 *
 * Importing this in client components will cause a build error.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
if (typeof window !== "undefined") {
  throw new Error("lib/supabase-server must only be imported on the server.");
}

import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function validateServiceRoleKey(): { valid: boolean; error?: string } {
  if (!serviceRoleKey) {
    const error = "SUPABASE_SERVICE_ROLE_KEY is missing. Set this environment variable for admin operations.";
    logger.error(error);
    return { valid: false, error };
  }
  return { valid: true };
}

export const supabaseAdmin: SupabaseClient<Database> = (() => {
  if (!serviceRoleKey) {
    logger.warn("SUPABASE_SERVICE_ROLE_KEY not found. Admin operations will fail until this is configured.");

    return new Proxy({} as SupabaseClient<Database>, {
      get(_target, prop) {
        if (prop === "from") {
          return () => {
            throw new Error(
              "supabaseAdmin cannot be used: SUPABASE_SERVICE_ROLE_KEY is missing.\n" +
                "Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.\n" +
                "See: https://supabase.com/dashboard/project/_/settings/api",
            );
          };
        }
        if (typeof prop === "string" && ["auth", "storage", "rpc", "functions", "realtime"].includes(prop)) {
          return new Proxy(
            {},
            {
              get() {
                throw new Error(
                  `supabaseAdmin.${prop} is not available: SUPABASE_SERVICE_ROLE_KEY is missing.\n` +
                    "Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.",
                );
              },
            },
          );
        }
        return undefined;
      },
    });
  }

  logger.info("Supabase Admin client initialized with service role key.");

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
})();

export function isSupabaseAdminAvailable(): boolean {
  return !!serviceRoleKey;
}

export function getSupabaseAdminError(): string | null {
  if (!serviceRoleKey) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations require this environment variable.";
  }
  return null;
}

export function getServiceRoleKey(): string | null {
  return serviceRoleKey ?? null;
}

export async function withSupabaseAdmin<T>(
  operation: (client: SupabaseClient<Database>) => Promise<T>,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const validation = validateServiceRoleKey();
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const result = await operation(supabaseAdmin);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Supabase admin operation failed:", error);
    return { success: false, error: message };
  }
}

export const fetchUserData = async (userId: string): Promise<DbUser | null> => {
    if (!userId) {
        logger.warn("fetchUserData called with empty userId");
        return null;
    }
    
    // Guard against Client-Side usage
    if (typeof window !== "undefined") {
        logger.error("fetchUserData called on CLIENT. This function uses supabaseAdmin and must be Server-Only.");
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
     // Guard against Client-Side usage
     if (typeof window !== "undefined") {
         logger.error("[SupabaseHook] createOrUpdateUser called on CLIENT. Aborting.");
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
    return { success: false, error: "User ID is required." };
  }
  
  // Guard against Client-Side usage
  if (typeof window !== "undefined") {
      return { success: false, error: "Cannot update user metadata from client side directly. Use a Server Action." };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("users") 
      .update({ metadata: metadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId) 
      .select("*, metadata") 
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { success: false, error: `User ${userId} not found.` };
      throw error; 
    }
    if (!data) {
        return { success: false, error: `User ${userId} not found after metadata update attempt.` };
    }

    return { success: true, data };
  } catch (catchError) {
    logger.error(`[SupabaseHook] Exception for user ${userId}:`, catchError);
    return { success: false, error: catchError instanceof Error ? catchError.message : "Failed to update user metadata." };
  }
}

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

export const createInvoice = async (
    type: string,
    id: string, 
    userId: string,
    amount: number,
    subscriptionId?: number, 
    metadata: Record<string, any> = {}
): Promise<{ success: boolean; data?: DbInvoice; error?: string }> => {
    // Guard against Client
    if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
     // Guard against Client
     if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
     // Guard against Client
     if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
    // Guard against Client
    if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
    // Guard against Client
    if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };

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
     // Guard against Client
     if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
     // Guard against Client
     if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
     // Guard against Client
     if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
     // Guard against Client
     if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };
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
    // Guard against Client
    if (typeof window !== "undefined") return { success: false, error: "Cannot use Admin client on client-side." };

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