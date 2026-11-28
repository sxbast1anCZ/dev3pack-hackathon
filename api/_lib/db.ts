import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from './env.js'

let client: SupabaseClient | undefined

// The server-side Supabase client, with the service role key. Never used in the browser.
export function serverDb(): SupabaseClient {
  if (!client) {
    client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
