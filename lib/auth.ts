import { createAuthenticatedClient, supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
//import jwt from "jsonwebtoken";
import axios from 'axios'
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
  logger.warn("Missing JWT secret. Authentication features may not work.");
}

/*export async function getUserFromChatId(chatId: string) {
  try {
    if (!chatId) throw new Error("Chat ID is required");

    const { data, error } = await supabaseAdmin
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
}*/

/**
 * Fetches a user by their chat ID using the secure API route.
 * @param chatId - The chat ID of the user.
 * @param token - The JWT token for authentication.
 * @returns The user data or null if not found.
 */
export async function getUserFromChatId(chatId: string, token: string) {
  try {
    if (!chatId || !token) throw new Error("Chat ID and token are required")

    // Call the secure API route
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users?chat_id=${chatId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) throw new Error(`Failed to fetch user: ${res.statusText}`)

    const data = await res.json()
    return data
  } catch (error) {
    logger.error("Error fetching user by chat ID:", error)
    return null
  }
}

/**
 * Generates a JWT token by calling the server-side API.
 * @param chatId - The chat ID to include in the token.
 * @returns The generated JWT token or null if an error occurs.
 */
export async function generateJwtToken(chatId: string) {
  try {
    if (!chatId) throw new Error("Chat ID is required")

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/jwt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    })

    if (!res.ok) throw new Error(`Failed to generate JWT: ${res.statusText}`)

    const { token } = await res.json()
    return token
  } catch (error) {
    logger.error("Error generating JWT:", error)
    return null
  }
}

/**
 * Verifies a JWT token by calling the server-side API.
 * @param token - The JWT token to verify.
 * @returns The decoded token payload or null if invalid.
 */
export async function verifyJwtToken(token: string) {
  try {
    if (!token) throw new Error("Token is required")
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/jwt`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) throw new Error(`Failed to verify JWT: ${res.statusText}`)
    const { valid, decoded } = await res.json()
    return valid ? decoded : null
  } catch (error) {
    logger.error("Error verifying JWT:", error)
    return null
  }
}

/**
 * Fetches a user based on a JWT token by calling the server-side API.
 * @param token - The JWT token to decode and fetch the user.
 * @returns The user data or null if not found.
 */
export async function getUserFromToken(token: string) {
  try {
    if (!token) throw new Error("Token is required")
    const decoded = await verifyJwtToken(token)
    if (!decoded) return null
    return getUserFromChatId(decoded.chat_id)
  } catch (error) {
    logger.error("Error getting user from token:", error)
    return null
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
}



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
}*/

