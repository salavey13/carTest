// hooks/supabase.ts
import { createClient } from "@supabase/supabase-js"
import { generateJwtToken } from "@/lib/auth"
import type { WebAppUser } from "@/types/telegram"
import { debugLogger } from "@/lib/debugLogger"
import type { Database } from "@/types/database.types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4"
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"

export const supabaseAnon = createClient<Database>(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey)


// Match the vector dimensions with the database
const VECTOR_DIMENSIONS = 384;

// Simplified embedding generator (as fallback)
function generateSimplifiedEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return new Array(VECTOR_DIMENSIONS).fill(0);

  const embedding = new Array(VECTOR_DIMENSIONS).fill(0);
  const wordCount: { [key: string]: number } = {};

  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  Object.entries(wordCount).forEach(([word, count], index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) % 10007;
    }
    const baseIdx = Math.abs(hash + index * 23) % VECTOR_DIMENSIONS;
    for (let i = 0; i < 7; i++) {
      const idx = (baseIdx + i * 3) % VECTOR_DIMENSIONS;
      embedding[idx] += (count / words.length) * (1 - i * 0.05);
    }
  });

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

// Updated function to handle Edge Function calls, including /create
export async function generateCarEmbedding(
  carId?: string,
  carData?: {
    make: string;
    model: string;
    description: string;
    specs: Record<string, any>;
    owner_id?: string;
    daily_price?: number;
    image_url?: string;
    rent_link?: string;
  }
) {
  try {
    let endpoint: string;
    let body: string | undefined;

    if (carId && !carData) {
      // Single car update
      endpoint = `${supabaseUrl}/functions/v1/generate-embeddings/single`;
      body = JSON.stringify({ carId });
    } else if (carData) {
      // New car creation
      endpoint = `${supabaseUrl}/functions/v1/generate-embeddings/create`;
      body = JSON.stringify({
        make: carData.make,
        model: carData.model,
        description: carData.description,
        specs: carData.specs,
      });
    } else {
      // Batch processing
      endpoint = `${supabaseUrl}/functions/v1/generate-embeddings/batch`;
      body = undefined;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Edge Function failed: ${await response.text()}`);
    }

    const result = await response.json();
    debugLogger.log(`Edge Function success: ${result.message}`);

    // For /create, update additional fields after creation
    if (carData && carData.owner_id) {
      const { error: updateError } = await supabaseAdmin
        .from("cars")
        .update({
          owner_id: carData.owner_id,
          daily_price: carData.daily_price,
          image_url: carData.image_url,
          rent_link: carData.rent_link,
        })
        .eq("id", result.carId);

      if (updateError) throw new Error(`Failed to update additional fields: ${updateError.message}`);
    }

    return carId || carData ? result : undefined; // Return result for single/create, undefined for batch
  } catch (error) {
    debugLogger.error("Edge Function failed, falling back to simplified embedding:", error);

    // Fallback to simplified embedding
    let combinedText: string;
    if (carId && !carData) {
      const { data, error } = await supabaseAdmin
        .from("cars")
        .select("make, model, description, specs")
        .eq("id", carId)
        .single();
      if (error) throw new Error(`Failed to fetch car: ${error.message}`);
      combinedText = `${data.make} ${data.model} ${data.description} ${JSON.stringify(data.specs || {})}`;
    } else if (carData) {
      combinedText = `${carData.make} ${carData.model} ${carData.description} ${JSON.stringify(carData.specs || {})}`;
    } else {
      throw new Error("Cannot generate embedding for batch in fallback mode");
    }

    const embedding = generateSimplifiedEmbedding(combinedText);

    if (carId) {
      const { error } = await supabaseAdmin
        .from("cars")
        .update({ embedding })
        .eq("id", carId);
      if (error) throw new Error(`Failed to update embedding: ${error.message}`);
    } else if (carData) {
      const { data: newCar, error } = await supabaseAdmin
        .from("cars")
        .insert({
          ...carData,
          embedding,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Failed to create car in fallback: ${error.message}`);
      return { message: "Car created with fallback embedding", carId: newCar.id };
    }

    return carId || carData ? { message: "Embedding generated with fallback" } : undefined;
  }
}



// [Rest of your existing functions remain unchanged...]

export const fetchUserData = async (chatId: string) => {
  debugLogger.log("Fetching user data for chatId:", chatId)
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("user_id", chatId).maybeSingle() // Use maybeSingle to handle no rows gracefully

    if (error) {
      debugLogger.error("Error fetching user data:", error)
      throw error
    }

    debugLogger.log("Fetched user data:", data)
    return data // Returns null if no user found
  } catch (error) {
    debugLogger.error("Error in fetchUserData:", error)
    throw error
  }
}

export const createOrUpdateUser = async (chatId: string, userInfo: Partial<WebAppUser>) => {
  debugLogger.log("Creating or updating user:", { chatId, userInfo })

  try {
    // create a new one
    debugLogger.log("No existing user found, creating new user...")
    const { error: insertError } = await supabaseAdmin.from("users").insert({
      user_id: chatId,
      username: userInfo.username || null,
      full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || null,
      avatar_url: userInfo.photo_url || null,
      language_code: userInfo.language_code || null,
    })

    if (insertError) {
      debugLogger.error("Error inserting new user:", insertError)
      throw insertError
    }

    debugLogger.log("New user created:", chatId)
    const existingUser = await fetchUserData(chatId)

    if (existingUser) {
      debugLogger.log("New user found:", existingUser)
    }
    return existingUser
  } catch (error) {
    debugLogger.error("Error in createOrUpdateUser:", error)
    throw error
  }
}

export interface CarResult {
  id: string
  make: string
  model: string
  similarity: number
  description: string
  image_url: string
  rent_link: string
}

export const searchCars = async (embedding: number[], limit = 5): Promise<CarResult[]> => {
  try {
    const { data, error } = await supabaseAnon.rpc("search_cars", {
      query_embedding: embedding,
      match_count: limit,
    })

    if (error) throw error

    return data.map((item: any) => ({
      id: item.id,
      make: item.make,
      model: item.model,
      similarity: item.similarity,
      description: item.description,
      image_url: item.image_url,
      rent_link: `/rent/${item.id}`, //item.rent_link,
    }))
  } catch (error) {
    debugLogger.error("Error searching cars:", error)
    return []
  }
}

export const createAuthenticatedClient = async (chatId: string) => {
  const token = await generateJwtToken(chatId)
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

export const fetchQuestions = async () => {
  const { data, error } = await supabaseAnon.from("questions").select("*")
  if (error) throw error
  return data
}

export const fetchAnswers = async () => {
  const { data, error } = await supabaseAnon.from("answers").select("*")
  if (error) throw error
  return data
}

export const saveTestProgress = async (chatId: string, progress: any) => {
  const client = await createAuthenticatedClient(chatId)
  const { error } = await client.from("users").update({ test_progress: progress }).eq("user_id", chatId)
  if (error) throw error
}

export const loadTestProgress = async (chatId: string) => {
  const client = await createAuthenticatedClient(chatId)
  const { data, error } = await client.from("users").select("test_progress").eq("user_id", chatId).single()
  if (error && error.message !== "No rows found") throw error
  return data?.test_progress
}






// New invoice related functions
export interface Invoice {
  id: string
  user_id: string
  status: "pending" | "paid" | "cancelled"
  amount: number
  created_at?: string
  updated_at?: string
  metadata?: Record<string, any>
  subscription_id: number
}



export const createInvoice = async (
  type: string,
  id: string,
  userId: string,
  amount: number,
  metadata: Record<string, any> = {}
): Promise<Invoice> => {
  try {
    const subscriptionId = await getUserSubscription(userId)

    // For testing, use supabaseAdmin; switch to createAuthenticatedClient when RLS is enabled
    const client = supabaseAdmin
    //const client = createAuthenticatedClient(userId)// : supabaseAdmin

    const { data, error } = await client.rpc("create_invoice", {
      p_type: type,
      p_id: id,
      p_user_id: userId,
      p_subscription_id: subscriptionId || 0,
      p_amount: amount,
      p_metadata: metadata,
    })

    if (error) throw error
    return data
  } catch (error) {
    debugLogger.error("Error creating invoice:", error)
    throw error
  }
}

export const updateInvoiceStatus = async (
  invoiceId: string,
  status: Invoice["status"],
  jwtToken?: string // Optional JWT for authenticated client
): Promise<Invoice> => {
  try {
    // For testing, use supabaseAdmin; switch to createAuthenticatedClient when RLS is enabled
    const client = supabaseAdmin
    // const client = jwtToken ? createAuthenticatedClient(jwtToken) : supabaseAdmin

    const { data, error } = await client.rpc("update_invoice_status", {
      p_invoice_id: invoiceId,
      p_status: status,
    })

    if (error) throw error
    return data
  } catch (error) {
    debugLogger.error("Error updating invoice status:", error)
    throw error
  }
}

export const getUserInvoices = async (
  userId: string
): Promise<Invoice[]> => {
  try {
    // Use createAuthenticatedClient for RLS when enabled
    const client = createAuthenticatedClient(userId)// : supabaseAdmin

    const { data, error } = await client.rpc("get_user_invoices", {
      p_user_id: userId,
    })

    if (error) throw error
    return data || []
  } catch (error) {
    debugLogger.error("Error fetching user invoices:", error)
    throw error
  }
}

export const getInvoiceById = async (
  invoiceId: string,
  jwtToken?: string // Optional JWT for authenticated client
): Promise<Invoice | null> => {
  try {
    // For admin use, keep supabaseAdmin; for users, use createAuthenticatedClient when RLS is enabled
    const client = supabaseAdmin
    // const client = jwtToken ? createAuthenticatedClient(jwtToken) : supabaseAdmin

    const { data, error } = await client.from("invoices").select("*").eq("id", invoiceId).single()

    if (error) throw error
    return data
  } catch (error) {
    debugLogger.error("Error fetching invoice:", error)
    throw error
  }
}

export const updateUserSubscription = async (
  userId: string,
  subscriptionId: string
) => {
  try {
    // For testing, use supabaseAdmin; switch to createAuthenticatedClient when RLS is enabled
    const client = supabaseAdmin
    //const client = createAuthenticatedClient(userId)// : supabaseAdmin

    const { data, error } = await client
      .from("users")
      .update({ subscription_id: subscriptionId })
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    debugLogger.error("Error updating user subscription:", error)
    throw error
  }
}

export const getUserSubscription = async (
  userId: string
): Promise<number | null> => {
  try {
    // For testing, use supabaseAdmin; switch to createAuthenticatedClient when RLS is enabled
    const client = supabaseAdmin
    //const client = createAuthenticatedClient(userId)// : supabaseAdmin

    const { data, error } = await client.from("users").select("subscription_id").eq("user_id", userId).single()

    if (error) throw error
    return data?.subscription_id || null
  } catch (error) {
    debugLogger.error("Error fetching user subscription:", error)
    return null
  }
}








export const getSimilarCars = async (carId: string, matchCount = 3) => {
  const { data, error } = await supabaseAnon.rpc("similar_cars", {
    car_id: carId,
    match_count: matchCount,
  })
  if (error) throw error
  return data
}

export const saveUserResult = async (chatId: string, carId: string) => {
  const client = await createAuthenticatedClient(chatId)
  const { error } = await client.from("user_results").insert({
    user_id: chatId,
    car_id: carId,
  })
  if (error) throw error
}

export const getUserResults = async (chatId: string) => {
  const client = await createAuthenticatedClient(chatId)
  const { data, error } = await client.from("user_results").select("car_id, created_at").eq("user_id", chatId)
  if (error) throw error
  return data
}

export const uploadImage = async (bucketName: string, file: File, fileName?: string): Promise<string> => {
  try {
    const fileExt = file.name.split(".").pop()
    const finalFileName = fileName || `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `public/${finalFileName}`

    const { error: uploadError, data } = await supabaseAdmin.storage.from(bucketName).upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
      error: publicUrlError,
    } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath)

    if (publicUrlError) {
      throw publicUrlError
    }

    return publicUrl
  } catch (error) {
    console.error("Error uploading image:", error)
    throw error
  }
}

/*export const createInvoice = async (userId: string, subscriptionId: number, amount: number) => {
  const { data, error } = await supabaseAdmin.rpc("create_invoice", {
    user_id: userId,
    subscription_id: subscriptionId,
    amount,
  })
  if (error) throw error
  return data
}

export const updateInvoiceStatus = async (invoiceId: number, newStatus: string) => {
  const { data, error } = await supabaseAdmin.rpc("update_invoice_status", {
    invoice_id: invoiceId,
    new_status: newStatus,
  })
  if (error) throw error
  return data
}

export const getUserInvoices = async (userId: string) => {
  const { data, error } = await supabaseAdmin.rpc("get_user_invoices", {
    user_id: userId,
  })
  if (error) throw error
  return data
}*/

export const fetchCars = async () => {
  const { data, error } = await supabaseAnon.from("cars").select("*")
  if (error) throw error
  return data
}

export const fetchCarById = async (id: string) => {
  const { data, error } = await supabaseAnon.from("cars").select("*").eq("id", id).single()
  if (error) throw error
  return data
}

/*export const fetchUserData = async (chatId: string) => {
  debugLogger.log("Fetching user data for chatId:", chatId)
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("user_id", chatId).single()

    if (error) {
      debugLogger.error("Error fetching user data:", error)
      throw error
    }

    debugLogger.log("Fetched user data:", data)
    return data
  } catch (error) {
    debugLogger.error("Error in fetchUserData:", error)
    throw error
  }
}*/








// hooks/supabase.ts

export interface Rental {
  rental_id: string
  user_id: string
  car_id: string
  start_date: string
  end_date: string
  status: "active" | "completed" | "cancelled"
  payment_status: "pending" | "paid" | "failed"
  total_cost: number
  created_at: string
  updated_at: string
  car_make?: string
  car_model?: string
}

export const createRental = async (
  userId: string,
  carId: string,
  startDate: string,
  endDate: string,
  totalCost: number
): Promise<Rental> => {
  try {
    const client = await createAuthenticatedClient(userId)
    const { data, error } = await client.rpc("create_rental", {
      p_user_id: userId,
      p_car_id: carId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_total_cost: totalCost,
    })

    if (error) throw error
    return data
  } catch (error) {
    debugLogger.error("Error creating rental:", error)
    throw error
  }
}

export const getUserRentals = async (userId: string): Promise<Rental[]> => {
  try {
    //const client = await createAuthenticatedClient(userId)
    const { data, error } = await supabaseAdmin//client
      .from("rentals")
      .select(`
        *,
        cars (
          make,
          model
        )
      `)
      .eq("user_id", userId)

    if (error) throw error
    return data.map((rental: any) => ({
      ...rental,
      car_make: rental.cars.make,
      car_model: rental.cars.model,
    })) || []
  } catch (error) {
    debugLogger.error("Error fetching user rentals:", error)
    throw error
  }
}

export const updateRentalPaymentStatus = async (
  rentalId: string,
  paymentStatus: Rental["payment_status"]
): Promise<Rental> => {
  try {
    const client = supabaseAdmin // Switch to authenticated client when RLS is ready
    const { data, error } = await client
      .from("rentals")
      .update({ payment_status: paymentStatus })
      .eq("rental_id", rentalId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    debugLogger.error("Error updating rental payment status:", error)
    throw error
  }
}

