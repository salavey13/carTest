// app/api/auth/jwt/route.ts
import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { logger } from "@/lib/logger"

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET

if (!JWT_SECRET) {
  logger.warn("Missing SUPABASE_JWT_SECRET environment variable. JWT operations will not work correctly.")
}

export async function POST(req: NextRequest) {
  const { chat_id } = await req.json()

  if (!chat_id) {
    return NextResponse.json({ error: "chat_id is required" }, { status: 400 })
  }

  if (!JWT_SECRET) {
    logger.error("Cannot generate JWT: Missing JWT_SECRET")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  try {
    const token = jwt.sign({ sub: chat_id, chat_id: chat_id }, JWT_SECRET, { expiresIn: "13h" })
    return NextResponse.json({ token })
  } catch (error) {
    logger.error("Error generating JWT:", error)
    return NextResponse.json({ error: "Failed to generate JWT" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.split("Bearer ")[1]

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  if (!JWT_SECRET) {
    logger.error("Cannot verify JWT: Missing JWT_SECRET")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return NextResponse.json({ valid: true, decoded })
  } catch (error) {
    logger.error("Error verifying JWT:", error)
    return NextResponse.json({ valid: false, error: "Invalid token" }, { status: 401 })
  }
}

