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

