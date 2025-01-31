import { Database } from '@/types/database.types';   //GEN IT "npx supabase gen types typescript --local > types/database.types.ts" OR ASK CHATGPT
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co"
const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4"
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"

// Regular client for client-side usage (respects RLS)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations that need to bypass RLS
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})


interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}


export const createAdminClient = () => {
  return createClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
};


// Client for authenticated user sessions (respects RLS)
export const createAuthenticatedClient = (token: string) => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}

export async function fetchUserData(token: string) {
  const client = createAuthenticatedClient(token)
  try {
    const { data, error } = await client.from("users").select("*").single()
    if (error) throw error
    return data
  } catch (error) {
    logger.error("Error fetching user data:", error)
    throw error
  }
}

export async function createUser(userData: {
  user_id: string
  username: string
  first_name: string
  last_name: string
  language_code: string
  ref_code?: string | null
}) {
  try {
    const { data, error } = await supabase.from("users").upsert(userData).select().single()
    if (error) throw error
    logger.info("User created successfully:", userData.user_id)
    return data
  } catch (error) {
    logger.error("Error creating user:", error)
    throw error
  }
}

export async function fetchRecipients(token: string) {
  const client = createAuthenticatedClient(token)
  try {
    const { data, error } = await client.from("users").select("user_id, username, full_name").order("username")
    if (error) throw error
    return data
  } catch (error) {
    logger.error("Error fetching recipients:", error)
    throw error
  }
}

export async function createInvoice(token: string, invoiceData: any) {
  try {
    const isValidToken = await verifyJwtToken(token)
    if (!isValidToken) {
      throw new Error("Invalid token")
    }

    const user = await getUserFromToken(token)
    if (!user) {
      throw new Error("User not found")
    }

    const client = createAuthenticatedClient(token)
    const { data, error } = await client.from("invoices").insert(invoiceData).select().single()

    if (error) throw error

    // If it's not a template and not a badge purchase, add it to favorites
    if (invoiceData.status !== "template" && !invoiceData.metadata?.type === "badge_purchase") {
      await addToFavorites(token, user.user_id, data.id)
    }

    // If it's a badge purchase, create a notification
    if (invoiceData.metadata?.type === "badge_purchase") {
      await createNotification(token, user.user_id, `Badge purchase initiated: ${invoiceData.title}`)
    }

    return data
  } catch (error) {
    console.error("Error creating invoice:", error)
    throw error
  }
}

export async function updateInvoiceStatus(token: string, invoiceId: string, status: string) {
  const client = createAuthenticatedClient(token)
  try {
    const { data, error } = await client.from("invoices").update({ status }).eq("id", invoiceId).single()
    if (error) throw error
    return data
  } catch (error) {
    logger.error("Error updating invoice status:", error)
    throw error
  }
}

export async function uploadAttachment(token: string, file: File, invoiceUuid: string) {
  const client = createAuthenticatedClient(token)
  try {
    const { data, error } = await client.storage.from("invoice-attachments").upload(`${invoiceUuid}/${file.name}`, file)
    if (error) throw error
    return client.storage.from("invoice-attachments").getPublicUrl(data.path).data.publicUrl
  } catch (error) {
    logger.error("Error uploading attachment:", error)
    throw error
  }
}

export async function fetchInvoiceById(token: string, invoiceId: string) {
  const client = createAuthenticatedClient(token)
  try {
    const { data, error } = await client.from("invoices").select("*").eq("id", invoiceId).single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error("Error fetching invoice by ID:", error)
    throw error
  }
}

export async function updateUserBadges(token: string, userId: string, badges: string[]) {
  const client = createAuthenticatedClient(token)
  try {
    const { data, error } = await client.from("users").update({ badges: badges }).eq("user_id", userId).single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error("Error updating user badges:", error)
    throw error
  }
}

/*export async function addToFavorites(token: string, userId: string, content: string) {
  const client = createAuthenticatedClient(token)
  try {
    const { data, error } = await client
      .from("favorites")
      .insert({ user_id: userId, content, type: "invoice" })
      .single()
    if (error) throw error
    return data
  } catch (error) {
    console.error("Error adding to favorites:", error)
    throw error
  }
}

export async function addToFavorites(userId: string, content: string) {
  const { data, error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, content })
    .single();
  if (error) throw error;
  return data;
}*/

export async function updateLeaderboardScore(userId: string, score: number) {
  try {
    const { data, error } = await supabase.from("leaderboard").upsert({ user_id: userId, score }).single()
    if (error) throw error
    return data
  } catch (error) {
    logger.error("Error updating leaderboard score:", error)
    throw error
  }
}

async function createNotification(token: string, userId: string, message: string) {
  const client = createAuthenticatedClient(token)
  try {
    const { error } = await client.from("notifications").insert({
      user_id: userId,
      message,
      type: "info",
    })
    if (error) throw error
  } catch (error) {
    logger.error("Error creating notification:", error)
    throw error
  }
}

export async function uploadImage(bucketName: string, file: File, fileName?: string): Promise<string> {
  try {
    const fileExt = file.name.split(".").pop()
    const finalFileName = fileName || `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `public/${finalFileName}`

    const { error: uploadError, data } = await supabase.storage.from(bucketName).upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
      error: publicUrlError,
    } = supabase.storage.from(bucketName).getPublicUrl(filePath) // Added download option for expiring links

    if (publicUrlError) {
      throw publicUrlError
    }

    return publicUrl
  } catch (error) {
    console.error("Error uploading image:", error)
    throw error
  }
}

