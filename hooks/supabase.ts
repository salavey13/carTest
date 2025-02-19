import { createClient } from "@supabase/supabase-js"
import { generateJwtToken } from "@/lib/auth"
import type { WebAppUser } from "@/types/telegram.d"
import { debugLogger } from "@/lib/debugLogger"
import type { Database } from "@/types/database.types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAnon = createClient<Database>(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey)

interface CarResult {
  id: number
  make: string
  model: string
  similarity: number
  description: string
  image_url: string
  rent_link: string
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

export const createOrUpdateUser = async (chatId: string, userInfo: Partial<WebAppUser>) => {
  debugLogger.log("Creating or updating user:", { chatId, userInfo })
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("user_id", chatId)
    .single()

  if (fetchError && fetchError.message !== "No rows found") {
    debugLogger.error("Error fetching existing user:", fetchError)
    throw fetchError
  }

  if (existingUser) {
    debugLogger.log("Existing user found:", existingUser)
    return existingUser
  }

  const { data: newUser, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      user_id: chatId,
      username: userInfo.username,
      full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim(),
      avatar_url: userInfo.photo_url,
      language_code: userInfo.language_code,
      status: "admin",
    })
    .select()
    .single()

  if (insertError) {
    debugLogger.error("Error inserting new user:", insertError)
    throw insertError
  }

  debugLogger.log("New user created:", newUser)
  return newUser
}

export const searchCars = async (embedding: number[], limit = 5): Promise<CarResult[]> => {
  try {
    const { data, error } = await supabaseAnon.rpc("match_cars", {
      query_embedding: embedding,
      match_threshold: 0.5,
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
      rent_link: `/rent/${item.id}`,
    }))
  } catch (error) {
    console.error("Error searching cars:", error)
    return []
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

export const createInvoice = async (userId: string, subscriptionId: number, amount: number) => {
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
}

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

export const fetchUserData = async (chatId: string) => {
  debugLogger.log("Fetching user data for chatId:", chatId)
  const { data, error } = await supabaseAnon.from("users").select("*").eq("user_id", chatId).single()

  if (error) {
    debugLogger.error("Error fetching user data:", error)
    throw error
  }

  debugLogger.log("Fetched user data:", data)
  return data
}

