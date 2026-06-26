import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * This bypasses Row Level Security, so it must ONLY ever live on the server.
 * All authorization is enforced in our own middleware (auth + rbac).
 */
export const supabase = createClient(env.supabaseUrl || 'http://localhost', env.supabaseServiceKey || 'service-key', {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Optional anon client (respects RLS) for operations that should run
 * with the public policy set.
 */
export const supabaseAnon = createClient(
  env.supabaseUrl || 'http://localhost',
  env.supabaseAnonKey || 'anon-key',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export default supabase
