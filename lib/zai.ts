// /app/lib/zai.ts
/**
 * ZAI SDK Singleton — Vercel-compatible wrapper
 *
 * Initializes the ZAI SDK from environment variables, bypassing the
 * file-based .z-ai-config that the SDK expects by default.
 *
 * Why: Vercel serverless functions have a read-only filesystem —
 * we can't write .z-ai-config at runtime. But ZAI's constructor
 * accepts a config object directly (new ZAI(config)), so we
 * build it from env vars instead.
 *
 * Required env vars:
 *   ZAI_BASE_URL  — API base URL (e.g. https://internal-api.z.ai/v1)
 *   ZAI_API_KEY   — your API key
 *
 * Optional env vars (for functions.invoke, chat context, etc.):
 *   ZAI_CHAT_ID   — chat context ID
 *   ZAI_USER_ID   — user identifier
 *   ZAI_TOKEN     — JWT token
 *
 * Fallback: if env vars are missing, tries ZAI.create() which reads
 * .z-ai-config from disk (works in local dev where the file exists).
 */

import ZAI from "z-ai-web-dev-sdk";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _zai: InstanceType<typeof ZAI> | null = null;

/**
 * Get or create the ZAI SDK instance.
 *
 * Priority:
 *   1. Env vars → new ZAI(config) — works on Vercel (no filesystem needed)
 *   2. Fallback → ZAI.create() — reads .z-ai-config from disk (local dev)
 */
export async function getZai(): Promise<InstanceType<typeof ZAI>> {
  if (_zai) return _zai;

  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  if (baseUrl && apiKey) {
    // ── Vercel / production path: build config from env vars ───────────
    const config: ZaiConfig = { baseUrl, apiKey };

    // Optional fields
    if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID;
    if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID;
    if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN;

    _zai = new ZAI(config);
  } else {
    // ── Local dev fallback: read .z-ai-config from disk ────────────────
    // This works when you have .z-ai-config in project root or $HOME
    _zai = await ZAI.create();
  }

  return _zai;
}
