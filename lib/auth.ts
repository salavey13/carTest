// /lib/auth.ts
import { logger } from "@/lib/logger"

/**
 * Generates a JWT token by calling the server-side API.
 */
export async function generateJwtToken(chatId: string) {
  try {
    if (!chatId) throw new Error("Chat ID is required")

    const res = await fetch(`/api/auth/jwt`, {
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
 */
export async function verifyJwtToken(token: string) {
  try {
    if (!token) throw new Error("Token is required")

    const res = await fetch(`/api/auth/jwt`, {
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
 * Fetches a user based on a JWT token.
 */
export async function getUserFromToken(token: string) {
  try {
    if (!token) throw new Error("Token is required")

    const decoded = await verifyJwtToken(token)
    if (!decoded) return null

    const res = await fetch(`/api/users/${decoded.chat_id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) throw new Error(`Failed to fetch user: ${res.statusText}`)
    return await res.json()
  } catch (error) {
    logger.error("Error getting user from token:", error)
    return null
  }
}

