import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client — uses the service role key.
// Bypasses Row Level Security. NEVER expose this to the browser.
// Only import this file from API routes (app/api/**).
const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { persistSession: false },
})
