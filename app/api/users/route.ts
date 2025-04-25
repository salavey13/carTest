"use server"// Explicitly mark the route as dynamic because it uses headers
export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabaseAdmin } from "@/hooks/supabase"
import { logger } from "@/lib/logger"

const JWT_SECRET = process.env.SUPABASE_JWT_SECRE

if (!JWT_SECRET) {
  logger.warn("Missing SUPABASE_JWT_SECRET environment variable. JWT operations will not work correctly.")
}

export async function GET(req: NextRequest) {
  try {
    // Verify the JWT token
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header missing or invalid" }, { status: 401 })
    }

    const token = authHeader.split("Bearer ")[1]
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET!) as { chat_id: string }
    } catch (err) {
      logger.error("Invalid token:", err)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Extract `chat_id` from the token payload
    const chatId = decoded.chat_id
    if (!chatId) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 400 })
    }

    // Fetch user data using the Supabase Admin client
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("user_id", chatId).single()

    if (error) {
      logger.error(`Error fetching user with chat_id ${chatId}:`, error)
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 })
    }

    // Return the user data securely
    return NextResponse.json(data)
  } catch (err) {
    logger.error("Unexpected error in /api/users:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}