import { createAuthenticatedClient, supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
//import jwt from "jsonwebtoken";
import axios from 'axios'
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
  logger.warn("Missing JWT secret. Authentication features may not work.");
}

export async function getUserFromChatId(chatId: string) {
  try {
    if (!chatId) throw new Error("Chat ID is required");

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", chatId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error("Error fetching user by chat ID:", error);
    return null;
  }
}

/*export function generateJwtToken(chatId: string) {
  try {
    if (!chatId) throw new Error("Chat ID is required");
    return jwt.sign({ chat_id: chatId }, JWT_SECRET, { expiresIn: "1d" });
  } catch (error) {
    logger.error("Error generating JWT:", error);
    return null;
  }
}

export function verifyJwtToken(token: string) {
  try {
    if (!token) throw new Error("Token is required");
    return jwt.verify(token, JWT_SECRET) as { chat_id: string };
  } catch (error) {
    logger.error("Error verifying JWT:", error);
    return null;
  }
}*/



export async function generateJwtToken(chat_id: string): Promise<string> {
  try {
    const response = await axios.post('/api/auth/jwt', { chat_id})
    return response.data.token
  } catch (error) {
    console.error('Error generating JWT:', error)
    throw new Error('Failed to generate JWT')
  }
}

export async function verifyJwtToken(token: string): Promise<any | null> {
  try {
    const response = await axios.get('/api/auth/jwt', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return response.data.decoded
  } catch (error) {
    console.error('Error verifying JWT:', error)
    return null
  }
}

export async function getUserFromToken(token: string) {
  try {
    if (!token) throw new Error("Token is required");

    const decoded = verifyJwtToken(token);
    if (!decoded) return null;

    return getUserFromChatId(decoded.chat_id);
  } catch (error) {
    logger.error("Error getting user from token:", error);
    return null;
  }
}

