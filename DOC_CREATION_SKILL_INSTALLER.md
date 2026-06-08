# VIP Bike Doc Creation Skill - Complete Installer
# ===================================================
# 
# This file contains all components needed to set up the VLM-based
# document extraction and rental contract generation system.
#
# Architecture:
#   Telegram → /doc → ZAI VLM → Structured JSON → DOCX + QR → Supabase
#
# Installation:
#   1. Copy files to respective paths
#   2. Run migration: supabase/migrations/20260601000000_user_rental_secrets.sql
#   3. Set env vars: ZAI_BASE_URL, ZAI_API_KEY, TELEGRAM_BOT_TOKEN
#   4. Deploy to Vercel

---

# FILE: lib/zai.ts
# ===================
# ZAI SDK Singleton — Vercel-compatible wrapper

import ZAI from "z-ai-web-dev-sdk";

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let _zai: InstanceType<typeof ZAI> | null = null;

export async function getZai(): Promise<InstanceType<typeof ZAI>> {
  if (_zai) return _zai;

  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  if (baseUrl && apiKey) {
    const config: ZaiConfig = { baseUrl, apiKey };
    if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID;
    if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID;
    if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN;
    _zai = new ZAI(config);
  } else {
    _zai = await ZAI.create();
  }

  return _zai;
}

---

# FILE: app/lib/ocr-constants.ts
# =================================

export interface PassportOcrResult {
  fullName: string;
  birthDate: string;
  series: string;
  number: string;
  issuedBy: string;
  issueDate: string;
  divisionCode: string;
  birthPlace: string;
  registration: string;
  gender: string;
}

export interface LicenseOcrResult {
  fullName: string;
  series: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  categories: string[];
  categoryDates: string[];
}

export type AccessTier = "entry" | "mid" | "pro" | "none";

export const LICENSE_CATEGORY_TIER_MAP: Record<string, AccessTier> = {
  M: "entry",
  A1: "mid",
  B: "mid",
  B1: "mid",
  A: "pro",
  C: "pro",
  D: "pro",
};

// ... (regex patterns for passport/license parsing - full file in repo)

---

# FILE: app/lib/derive-access-tier.ts
# =======================================

import { LICENSE_CATEGORY_TIER_MAP, type AccessTier } from "./ocr-constants";

const TIER_PRIORITY: Record<AccessTier, number> = {
  none: 0,
  entry: 1,
  mid: 2,
  pro: 3,
};

export function deriveUserAccessTier(categories: string[]): AccessTier {
  if (!categories || categories.length === 0) return "none";

  let maxTier: AccessTier = "none";
  for (const raw of categories) {
    const cat = raw.trim().toUpperCase();
    const tier = LICENSE_CATEGORY_TIER_MAP[cat];
    if (tier && TIER_PRIORITY[tier] > TIER_PRIORITY[maxTier]) {
      maxTier = tier;
    }
  }

  return maxTier;
}

export function getAccessTierLabel(tier: AccessTier): string {
  switch (tier) {
    case "entry": return "Базовый";
    case "mid":   return "Средний";
    case "pro":   return "Профессиональный";
    case "none":  return "Без допуска";
  }
}

---

# FILE: app/lib/vlm-extract.ts
# ==============================
# VLM Document Extraction with 8s timeout for Vercel

import "server-only";
import { getZai } from "@/lib/zai";
import { logger } from "@/lib/logger";
import type { PassportOcrResult, LicenseOcrResult, AccessTier } from "./ocr-constants";
import { deriveUserAccessTier } from "./derive-access-tier";

export interface VlmExtractResult {
  success: boolean;
  provider: "zai-vlm";
  data?: PassportOcrResult | LicenseOcrResult;
  accessTier?: AccessTier;
  confidence?: number;
  warnings?: string[];
  error?: string;
}

// 8s timeout for Vercel 10s default function timeout
const VLM_TIMEOUT_MS = 8_000;

const PASSPORT_SYSTEM_PROMPT = `You are a precise document data extraction system for Russian internal passports.
Return ONLY valid JSON matching the schema below.

{
  "fullName": "LASTNAME FIRSTNAME PATRONYMIC",
  "birthDate": "DD.MM.YYYY",
  "series": "4 digits",
  "number": "6 digits",
  "issuedBy": "Issuing authority",
  "issueDate": "DD.MM.YYYY",
  "divisionCode": "XXX-XXX",
  "birthPlace": "Place of birth",
  "registration": "Registration address",
  "gender": "M or Ж",
  "confidence": 0.0,
  "warnings": []
}`;

const LICENSE_SYSTEM_PROMPT = `You are a precise document data extraction system for Russian driver's licenses.
Return ONLY valid JSON.

{
  "fullName": "LASTNAME FIRSTNAME PATRONYMIC",
  "series": "2+2 digits (e.g. '99 76')",
  "number": "6 digits",
  "issueDate": "DD.MM.YYYY",
  "expiryDate": "DD.MM.YYYY",
  "categories": ["A", "B", "M"],
  "confidence": 0.0,
  "warnings": []
}`;

function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw.trim());
  } catch {}
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

export async function vlmExtractDocument(
  imageBase64: string,
  docType: "passport" | "license",
): Promise<VlmExtractResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VLM_TIMEOUT_MS);

  try {
    const zai = await getZai();
    const base64Clean = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const mimeType = base64Clean.startsWith("/9j/") ? "image/jpeg" : "image/png";
    const dataUrl = `data:${mimeType};base64,${base64Clean}`;

    const systemPrompt = docType === "passport" ? PASSPORT_SYSTEM_PROMPT : LICENSE_SYSTEM_PROMPT;
    const userPrompt = docType === "passport" 
      ? "Extract all fields from this Russian passport photo. Return strict JSON only."
      : "Extract all fields from this Russian driver's license photo. Pay special attention to categories. Return strict JSON only.";

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      return { success: false, provider: "zai-vlm", error: "VLM returned empty response" };
    }

    const parsed = safeJsonParse(rawContent);
    if (!parsed) {
      return { success: false, provider: "zai-vlm", error: "Failed to parse VLM JSON" };
    }

    const vlmConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.7;
    const vlmWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    delete parsed.confidence;
    delete parsed.warnings;

    const result: VlmExtractResult = {
      success: true,
      provider: "zai-vlm",
      data: parsed as PassportOcrResult | LicenseOcrResult,
      confidence: vlmConfidence,
      warnings: vlmWarnings.length > 0 ? vlmWarnings : undefined,
    };

    if (docType === "license") {
      const categories = (parsed as Record<string, unknown>).categories as string[] || [];
      result.accessTier = deriveUserAccessTier(categories);
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        provider: "zai-vlm",
        error: `VLM extraction timed out after ${VLM_TIMEOUT_MS / 1000}s`,
      };
    }
    return {
      success: false,
      provider: "zai-vlm",
      error: error instanceof Error ? error.message : "Unknown VLM error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

---

# FILE: app/lib/user-rental-secrets.ts
# ======================================
# Private schema storage for rental document data

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

export interface RentalSecrets {
  chat_id: string | null;
  crew_slug: string;
  doc_sha256: string;
  renter_full_name?: string | null;
  renter_passport?: string | null;
  renter_passport_issued_by?: string | null;
  renter_passport_issue_date?: string | null;
  renter_registration?: string | null;
  renter_driver_license?: string | null;
  renter_birth_date?: string | null;
  renter_phone?: string | null;
  renter_email?: string | null;
  renter_address?: string | null;
  source_doc_key?: string | null;
  source_rental_id?: string | null;
  verification_status?: "verified" | "pending" | "revoked";
  template_version?: number | null;
}

export async function saveUserRentalSecrets(data: RentalSecrets): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .schema("private")
      .from("user_rental_secrets")
      .insert({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      logger.error("[user-rental-secrets] Failed to save", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("[user-rental-secrets] Exception", error);
    return false;
  }
}

export async function getUserRentalSecrets(
  chatId: string,
  crewSlug: string,
): Promise<RentalSecrets | null> {
  try {
    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", chatId)
      .eq("crew_slug", crewSlug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as RentalSecrets;
  } catch {
    return null;
  }
}

export async function claimRentalSecretsByDocSha(
  docSha256: string,
  chatId: string,
  crewSlug: string,
): Promise<RentalSecrets | null> {
  try {
    // First check if secret exists and is unclaimed
    const { data: secret } = await supabaseAdmin
      .schema("private")
      .from("user_rental_secrets")
      .select("*")
      .eq("doc_sha256", docSha256)
      .maybeSingle();

    if (!secret) return null;
    if (secret.chat_id && secret.chat_id !== chatId) {
      // Already claimed by different user
      return null;
    }

    // Claim it
    const { data: updated } = await supabaseAdmin
      .schema("private")
      .from("user_rental_secrets")
      .update({ chat_id, updated_at: new Date().toISOString() })
      .eq("doc_sha256", docSha256)
      .select("*")
      .single();

    return updated as RentalSecrets;
  } catch {
    return null;
  }
}

---

# MIGRATION: supabase/migrations/20260601000000_user_rental_secrets.sql
# ======================================================================

-- Create user_rental_secrets table in private schema
-- Stores rental-contextual identity data with doc_sha256 provenance

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.user_rental_secrets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id               TEXT,                   -- NULL until renter scans QR & claims
  crew_slug             TEXT NOT NULL,
  doc_sha256            TEXT NOT NULL,
  renter_full_name      TEXT,
  renter_passport       TEXT,
  renter_passport_issued_by TEXT,
  renter_passport_issue_date TEXT,
  renter_registration   TEXT,
  renter_driver_license TEXT,
  renter_birth_date     TEXT,
  renter_phone          TEXT,
  renter_email          TEXT,
  renter_address        TEXT,
  source_doc_key        TEXT,
  source_rental_id      TEXT,
  verification_status   TEXT NOT NULL DEFAULT 'verified',
  template_version      INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_sha256)
);

CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_doc_sha
  ON private.user_rental_secrets(doc_sha256);

CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_user_crew
  ON private.user_rental_secrets(chat_id, crew_slug, verification_status)
  WHERE chat_id IS NOT NULL;

REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON private.user_rental_secrets FROM anon;
REVOKE ALL ON private.user_rental_secrets FROM authenticated;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.user_rental_secrets TO service_role;

---

# ENVIRONMENT VARIABLES REQUIRED
# ===============================

# ZAI VLM
ZAI_BASE_URL=https://internal-api.z.ai/v1
ZAI_API_KEY=your_zai_api_key_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_admin_chat_id

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

---

# QUICK START GUIDE
# ==================

## 1. Install Dependencies
npm install z-ai-web-dev-sdk sharp

## 2. Run Migration
# Via Supabase dashboard or CLI:
psql < supabase/migrations/20260601000000_user_rental_secrets.sql

## 3. Test VLM Extraction
curl -X POST https://your-app.vercel.app/api/test-vlm \
  -H "Content-Type: application/json" \
  -d '{"imageBase64": "...", "docType": "passport"}'

## 4. Test /doc Command in Telegram
# Send: /doc [bikeId]
# Then upload passport photo
# Then upload license photo
# Then send schedule: "с завтра 18:00 до послезавтра 10:00"

---

# QR CODE FORMAT FOR 1-CLICK NEXT RENT
# =======================================

Format: https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{docSha256}

Example: https://t.me/oneBikePlsBot/app?startapp=rent_abc123_a1b2c3d4...

When user scans QR:
1. Opens Telegram WebApp with start_param
2. WebApp calls claimRentalSecretsByDocSha()
3. Rental secrets are linked to user's chat_id
4. Future rentals auto-fill from saved data

---

# TROUBLESHOOTING
# ================

## VLM Timeout (>8s)
- Enable image downsampling (sharp library)
- Reduce input image size before sending to VLM
- Check Vercel function timeout settings

## QR Code Not Generating
- Check api.qrserver.com availability
- Fallback: send DOCX without QR
- QR link is included in caption as backup

## "cannot read properties of undefined"
- User sent document instead of photo
- Fix: handle both photo and document messages
- Check file_id extraction logic

---

# END OF INSTALLER
# =================
# 
# For full source code, see:
# - app/webhook-handlers/commands/doc.ts
# - app/lib/vlm-extract.ts
# - app/lib/user-rental-secrets.ts
# - scripts/make-rental-contract-skill.mjs
