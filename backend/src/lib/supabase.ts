import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export function createSupabaseClient() {
  if (!env.supabaseUrl || !isValidSupabaseUrl(env.supabaseUrl)) {
    throw new SupabaseConfigError(
      "SUPABASE_URL must be set to your project URL, for example https://your-project-ref.supabase.co.",
    );
  }

  if (!env.supabaseServiceRoleKey) {
    throw new SupabaseConfigError("SUPABASE_SERVICE_ROLE_KEY must be set on the backend.");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export class SupabaseConfigError extends Error {
  statusCode = 500;
}

function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}
