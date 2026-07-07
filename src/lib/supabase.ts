import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ndjoxbcedhajbiaihpeo.supabase.co'
const supabaseKey = 'sb_publishable__nMaa2erReFaFMc_Z6qR6w_7q_w2Eiy'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Create a separate client that doesn't use the user's session token
// This allows bypassing RLS for storage uploads when policies are missing
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})
