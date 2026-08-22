import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type PublicSchema = Database["public"];
type PublicTables = PublicSchema["Tables"];
type PublicTableName = keyof PublicTables;
type TableInsert<T extends PublicTableName> = PublicTables[T]["Insert"];
type TableUpdate<T extends PublicTableName> = PublicTables[T]["Update"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requiredEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY", value: string | undefined): string {
  if (!value) {
    throw new Error(`[supabaseAdmin] Missing required env: ${name}`);
  }

  return value;
}

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export const supabaseAdmin = createSupabaseAdminClient();

export async function insertRow<T extends PublicTableName>(
  table: T,
  values: TableInsert<T> | TableInsert<T>[],
) {
  return supabaseAdmin.from(table).insert(values).select();
}

export async function upsertRow<T extends PublicTableName>(
  table: T,
  values: TableInsert<T> | TableInsert<T>[],
  options?: {
    onConflict?: string;
    ignoreDuplicates?: boolean;
  },
) {
  return supabaseAdmin.from(table).upsert(values, options).select();
}

export async function updateRows<T extends PublicTableName>(
  table: T,
  values: TableUpdate<T>,
) {
  return supabaseAdmin.from(table).update(values);
}

export async function rpcCall<TResult = unknown>(fn: string, args?: Record<string, unknown>) {
  return supabaseAdmin.rpc(fn, args);
}
