import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ndjoxbcedhajbiaihpeo.supabase.co'

// Publishable anon key — safe to expose in client-side code.
// This key respects Row Level Security (RLS) policies.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kam94YmNlZGhhamJpYWlocGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjMyMzQsImV4cCI6MjA5ODU5OTIzNH0.DE2MVyRG9eoa67UjwYjkVI5zfKLPCj35VE21myJqrR4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ⛔ SECURITY NOTICE — supabaseAdmin
// The Service Role key (which bypasses RLS) has been removed from this file.
// Pages that previously used supabaseAdmin are now temporarily aliased to the
// regular anon supabase client so the app compiles without errors.
// TODO: Replace each supabaseAdmin usage in page components with API calls to
//       /api/admin/* or /api/stripe/* routes in server.ts, which authenticate
//       via JWT and use the Service Role key server-side only.
//
// @deprecated — do not use supabaseAdmin in new code.
export const supabaseAdmin = supabase
