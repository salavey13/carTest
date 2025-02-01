// app/actions.ts
'use server';

import { createAuthenticatedClient, supabase , createAdminClient} from "@/hooks/supabase";

import { revalidatePath } from "next/cache"
import axios from "axios"
import { verifyJwtToken, generateJwtToken } from "@/lib/auth"
import type { Database } from "@/types/database"
//import { acquireBadge, fetchUserBadges } from "@/lib/badgeUtils"
import { logger } from "@/lib/logger"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "413553377"


export async function createOrUpdateUser(user: {
  id: string;
  username?: string | null;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  photo_url?: string;
}) {
  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

    // If user exists, return it
    if (existingUser) return existingUser;

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        user_id: user.id,
        username: user.username,
        full_name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
        avatar_url: user.photo_url,
        language_code: user.language_code,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return newUser;
  } catch (error) {
    logger.error("Error creating/updating user:", error);
    throw error;
  }
}

export async function authenticateUser(chatId: string, userInfo?: Partial<WebAppUser>) {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .upsert({
        user_id: chatId,
        username: userInfo?.username,
        full_name: `${userInfo?.first_name || ""} ${userInfo?.last_name || ""}`.trim(),
        avatar_url: userInfo?.photo_url,
        language_code: userInfo?.language_code,
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    
    const token = generateJwtToken(chatId);
    return { user, token };
  } catch (error) {
    throw new Error("Authentication failed");
  }
}

export async function validateToken(token: string) {
  try {
    const decoded = verifyJwtToken(token);
    if (!decoded) return null;

    // Use regular client with RLS for normal operations
    const client = createAuthenticatedClient(token);
    const { data: user } = await client
      .from("users")
      .select("*")
      .eq("user_id", decoded.sub)
      .single();

    return user;
  } catch (error) {
    return null;
  }
}

export async function saveUser(tgUser: TelegramUser) {
  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        id: tgUser.id.toString(),
        avatar_url: tgUser.photo_url,
        full_name: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim(),
        telegram_username: tgUser.username,
      })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving user:', error);
    return null;
  }
}

export async function sendResult(chatId: string, result: any) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: result.imageUrl,
        caption: `*${result.car}*\n${result.description}`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{
            text: 'Rent This Car 🚗',
            url: `https://your-domain.com/rent/${result.slug}`
          }, {
            text: 'Try Again 🔄',
            web_app: { url: 'https://your-domain.com' }
          }]]
        }
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return null;
  }
}

export const generateEmbeddings = async () => {
  const supabaseAdmin = createAdminClient();
  const { data: cars } = await supabaseAdmin
    .from('cars')
    .select('id,description')
    .is('embedding', null);

  if (!cars?.length) return;

  const pipe = await pipeline(
    'feature-extraction',
    'Supabase/gte-small',
    { quantized: true }
  );

  for (const car of cars) {
    const output = await pipe(car.description, {
      pooling: 'mean',
      normalize: true
    });
    
    await supabaseAdmin
      .from('cars')
      .update({ embedding: JSON.stringify(Array.from(output.data)) })
      .eq('id', car.id);
  }
};

export async function sendTelegramInvoice(
  token: string,
  chatId: string,
  title: string,
  description: string,
  payload: string,
  amount: number,
) {
  try {
    const user = await verifyJwtToken(token)
    if (!user) {
      throw new Error("Unauthorized")
    }

    const TEST_PROVIDER_TOKEN = process.env.TEST_PROVIDER_TOKEN
    if (!TEST_PROVIDER_TOKEN) {
      throw new Error("Missing TEST_PROVIDER_TOKEN")
    }

    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendInvoice`, {
      chat_id: chatId,
      title,
      description,
      payload,
      provider_token: TEST_PROVIDER_TOKEN,
      currency: "XTR",
      prices: [{ label: "Tip", amount }],
      start_parameter: "pay",
      need_shipping_address: false,
      is_flexible: false,
    })

    const { error } = await supabase
      .from("tips")
      .insert([{ user_id: chatId, message: description, amount, payload, tip_paid: false }])

    if (error) throw error

    logger.info("Invoice sent and tip information saved successfully")
    return { success: true, data: response.data }
  } catch (error) {
    logger.error("Error in sendTelegramInvoice:", error)
    return { success: false, error: "Failed to send invoice" }
  }
}

export async function checkInvoiceStatus(token: string, invoiceId: string) {
  try {
    const user = await verifyJwtToken(token)
    if (!user) {
      throw new Error("Unauthorized")
    }

    const { data, error } = await supabase.from("invoices").select("status").eq("id", invoiceId).single()

    if (error) throw error

    return { success: true, status: data.status }
  } catch (error) {
    logger.error("Error fetching invoice status:", error)
    return { success: false, error: "Failed to fetch invoice status" }
  }
}

export async function setTelegramWebhook(token: string) {
  try {
    const user = await verifyJwtToken(token)
    if (!user) {
      throw new Error("Unauthorized")
    }

    const WEBHOOK_URL = `https://${process.env.VERCEL_URL}/api/telegramWebhook`

    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      url: WEBHOOK_URL,
    })
    logger.info("Webhook set successfully:", response.data)
    return { success: true, message: "Webhook set successfully" }
  } catch (error) {
    logger.error("Error setting webhook:", error)
    return { success: false, error: "Failed to set webhook" }
  }
}

// app/actions.ts old openai embeddings(don't use)
export async function findSimilarCars(resultEmbedding: number[]) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc('search_cars', {
    query_embedding: resultEmbedding,
    match_count: 3
  });

  return data?.map(car => ({
    ...car,
    similarity: Math.round(car.similarity * 100)
  }));
}

