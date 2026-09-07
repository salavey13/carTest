// Shared env loader for live-DB specs (iter15 doc regen, iter27 cancelled-live,
// iter28 bikes-wall). These specs hit the real Supabase REST API, which needs
// credentials. Resolution order:
//   1) process.env (as exported by the runner);
//   2) the environment secrets file (secrets_all.txt) — KEY=VALUE lines.
// If neither source has creds, `hasSupabaseCreds` is false and the spec
// describe is skipIf-guarded: a fresh clone / CI run reports the suite as
// skipped instead of crashing the whole file at import time (the old
// module-scope readFileSync ENOENT).
import { existsSync, readFileSync } from "fs";

const SECRETS_PATH =
  process.env.SECRETS_ALL_PATH || "/home/z/my-project/upload/secrets_all.txt";

export function loadLiveEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(SECRETS_PATH)) {
    for (const line of readFileSync(SECRETS_PATH, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
    }
  }
  return env;
}

export function liveSupabaseCreds(): { url: string; key: string } {
  const file = loadLiveEnv();
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || file.NEXT_PUBLIC_SUPABASE_URL || "",
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || file.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

export function hasSupabaseCreds(): boolean {
  const { url, key } = liveSupabaseCreds();
  return Boolean(url && key);
}
