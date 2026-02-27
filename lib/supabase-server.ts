/**
 * Server-only Supabase Admin Client
 *
 * This file MUST only be imported by server-side code:
 * - Server Components
 * - API Routes (Route Handlers)
 * - Server Actions
 *
 * Importing this in client components will cause a build error.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
if (typeof window !== "undefined") {
  throw new Error("lib/supabase-server must only be imported on the server.");
}

import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function validateServiceRoleKey(): { valid: boolean; error?: string } {
  if (!serviceRoleKey) {
    const error = "SUPABASE_SERVICE_ROLE_KEY is missing. Set this environment variable for admin operations.";
    logger.error(error);
    return { valid: false, error };
  }
  return { valid: true };
}

export const supabaseAdmin: SupabaseClient<Database> = (() => {
  if (!serviceRoleKey) {
    logger.warn("SUPABASE_SERVICE_ROLE_KEY not found. Admin operations will fail until this is configured.");

    return new Proxy({} as SupabaseClient<Database>, {
      get(_target, prop) {
        if (prop === "from") {
          return () => {
            throw new Error(
              "supabaseAdmin cannot be used: SUPABASE_SERVICE_ROLE_KEY is missing.\n" +
                "Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.\n" +
                "See: https://supabase.com/dashboard/project/_/settings/api",
            );
          };
        }
        if (typeof prop === "string" && ["auth", "storage", "rpc", "functions", "realtime"].includes(prop)) {
          return new Proxy(
            {},
            {
              get() {
                throw new Error(
                  `supabaseAdmin.${prop} is not available: SUPABASE_SERVICE_ROLE_KEY is missing.\n` +
                    "Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.",
                );
              },
            },
          );
        }
        return undefined;
      },
    });
  }

  logger.info("Supabase Admin client initialized with service role key.");

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
})();

export function isSupabaseAdminAvailable(): boolean {
  return !!serviceRoleKey;
}

export function getSupabaseAdminError(): string | null {
  if (!serviceRoleKey) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations require this environment variable.";
  }
  return null;
}

export function getServiceRoleKey(): string | null {
  return serviceRoleKey ?? null;
}

export async function withSupabaseAdmin<T>(
  operation: (client: SupabaseClient<Database>) => Promise<T>,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const validation = validateServiceRoleKey();
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const result = await operation(supabaseAdmin);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Supabase admin operation failed:", error);
    return { success: false, error: message };
  }
}
