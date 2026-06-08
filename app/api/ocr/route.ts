/**
 * VIP Bike Rental — OCR/VLM API Endpoint
 *
 * POST /api/ocr
 * Accepts a base64-encoded image and a type ("passport" | "license").
 * Uses ZAI VLM exclusively for extraction — Tesseract.js removed.
 *
 * VLM-first (and only): Vision-language model extracts structured JSON
 * directly from the photo. Best accuracy on real-world photos (shadows,
 * rotation, glare, mixed layouts). Requires ZAI API key.
 *
 * Reusable by both the Telegram bot `/doc` command and the web-app checkout flow.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  type PassportOcrResult,
  type LicenseOcrResult,
  type AccessTier,
  OCR_MAX_IMAGE_SIZE,
} from "@/app/lib/ocr-constants";
import { vlmExtractDocument } from "@/app/lib/vlm-extract";

export const runtime = "nodejs";
export const maxDuration = 30; // VLM can be slow on large images

// ─── Request / Response Types ─────────────────────────────────────────────────

interface OcrRequest {
  image: string; // base64-encoded
  type: "passport" | "license";
}

interface OcrResponse {
  success: boolean;
  provider?: "zai-vlm";
  data?: PassportOcrResult | LicenseOcrResult;
  accessTier?: AccessTier; // for license type only
  confidence?: number;
  warnings?: string[];
  error?: string;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<OcrResponse>> {
  try {
    const body = (await request.json()) as OcrRequest;
    const { image, type } = body;

    if (!image || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: image, type" },
        { status: 400 },
      );
    }

    if (type !== "passport" && type !== "license") {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "passport" or "license"' },
        { status: 400 },
      );
    }

    // Decode base64 → Buffer for validation
    const imageBuffer = decodeBase64Image(image);
    if (!imageBuffer) {
      return NextResponse.json(
        { success: false, error: "Invalid base64 image data" },
        { status: 400 },
      );
    }

    if (imageBuffer.length > OCR_MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Image too large. Max ${OCR_MAX_IMAGE_SIZE / 1024 / 1024} MB` },
        { status: 400 },
      );
    }

    // ── VLM Extraction ──
    const vlmResult = await vlmExtractDocument(image, type);

    if (!vlmResult.success) {
      return NextResponse.json({
        success: false,
        provider: "zai-vlm",
        error: vlmResult.error || "VLM extraction failed",
        warnings: vlmResult.warnings,
      });
    }

    // Build response
    const response: OcrResponse = {
      success: true,
      provider: "zai-vlm",
      data: vlmResult.data,
      confidence: vlmResult.confidence,
      warnings: vlmResult.warnings,
    };

    // For license type, include the access tier
    if (type === "license" && vlmResult.accessTier) {
      response.accessTier = vlmResult.accessTier;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/ocr] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown OCR error",
      },
      { status: 500 },
    );
  }
}

// ─── Base64 Decoder ───────────────────────────────────────────────────────────

function decodeBase64Image(data: string): Buffer | null {
  try {
    // Strip data URL prefix if present: "data:image/jpeg;base64,..."
    const base64 = data.replace(/^data:[^;]+;base64,/, "");
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}