import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ndjoxbcedhajbiaihpeo.supabase.co'

// Publishable anon key — safe to expose in client-side code.
// This key respects Row Level Security (RLS) policies.
const supabaseAnonKey = 'sb_publishable__nMaa2erReFaFMc_Z6qR6w_7q_w2Eiy'

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
