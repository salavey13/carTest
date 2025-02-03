import { Database } from '@/types/database.types';   //GEN IT "npx supabase gen types typescript --local > types/database.types.ts" OR ASK CHATGPT
import { createClient } from "@supabase/supabase-js"
import { generateJwtToken } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co"
const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4"
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"



// Create anonymous client
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Create authenticated client on the fly
const createAuthenticatedClient = async (chatId: string) => {
  const token = await generateJwtToken(chatId);
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: Bearer ${token} } },
  });
};

// Create admin client
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Fetch all questions
export const fetchQuestions = async () => {
  const { data, error } = await supabaseAnon.from("questions").select("*");
  if (error) throw error;
  return data;
};

// Fetch all answers
export const fetchAnswers = async () => {
  const { data, error } = await supabaseAnon.from("answers").select("*");
  if (error) throw error;
  return data;
};

// Save test progress for the authenticated user
export const saveTestProgress = async (chatId: string, progress: any) => {
  const client = await createAuthenticatedClient(chatId);
  const { error } = await client
    .from("users")
    .update({ test_progress: progress })
    .eq("user_id", chatId);
  if (error) throw error;
};

// Load test progress for the authenticated user
export const loadTestProgress = async (chatId: string) => {
  const client = await createAuthenticatedClient(chatId);
  const { data, error } = await client
    .from("users")
    .select("test_progress")
    .eq("user_id", chatId)
    .single();
  if (error && error.message !== "No rows found") throw error;
  return data?.test_progress;
};

// Create or fetch user in the database
export const createOrUpdateUser = async (chatId: string, userInfo: Partial<WebAppUser>) => {
  // Check if the user exists
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("user_id", chatId)
    .single();

  if (fetchError && fetchError.message !== "No rows found") throw fetchError;

  if (existingUser) return existingUser;

  // Insert new user if not found
  const { data: newUser, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      user_id: chatId,
      username: userInfo.username,
      full_name: ${userInfo.first_name || ""} ${userInfo.last_name || ""}.trim(),
      avatar_url: userInfo.photo_url,
      language_code: userInfo.language_code,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return newUser;
};

// Perform similarity search on cars
export const searchCars = async (queryEmbedding: number[], matchCount: number) => {
  const { data, error } = await supabaseAnon.rpc("search_cars", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });
  if (error) throw error;
  return data;
};

// Get similar cars based on a given car ID
export const getSimilarCars = async (carId: string, matchCount: number = 3) => {
  const { data, error } = await supabaseAnon.rpc("similar_cars", {
    car_id: carId,
    match_count: matchCount,
  });
  if (error) throw error;
  return data;
};

// Save user's test result
export const saveUserResult = async (chatId: string, carId: string) => {
  const client = await createAuthenticatedClient(chatId);
  const { error } = await client.from("user_results").insert({
    user_id: chatId,
    car_id: carId,
  });
  if (error) throw error;
};

// Fetch user's test results
export const getUserResults = async (chatId: string) => {
  const client = await createAuthenticatedClient(chatId);
  const { data, error } = await client
    .from("user_results")
    .select("car_id, created_at")
    .eq("user_id", chatId);
  if (error) throw error;
  return data;
};

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
    } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath) // Added download option for expiring links

    if (publicUrlError) {
      throw publicUrlError
    }

    return publicUrl
  } catch (error) {
    console.error("Error uploading image:", error)
    throw error
  }
}

