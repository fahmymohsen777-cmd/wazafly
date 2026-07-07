import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ndjoxbcedhajbiaihpeo.supabase.co'
const supabaseKey = 'sb_publishable__nMaa2erReFaFMc_Z6qR6w_7q_w2Eiy'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Create an admin client to bypass RLS and manage users
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kam94YmNlZGhhamJpYWlocGVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzAyMzIzNCwiZXhwIjoyMDk4NTk5MjM0fQ.96j59Xv-CJ6qrPZy0QE-MdlQMFhWmkMWMRrVk8reoXA';
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})
