import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://auijtttwlkphkngbpogw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWp0dHR3bGtwaGtuZ2Jwb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg0MDI5MiwiZXhwIjoyMDg4NDE2MjkyfQ.C7wbcw9U4s1qVWibYDtHmt05D57cnkdB4doRyE-4_Os'

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
