-- ==============================================================================
-- 🛠️ WAZAFLY STORAGE FIX SCRIPT
-- ==============================================================================
-- This script safely updates or creates the missing RLS policies for the
-- 'resumes' and 'avatars' buckets, which may have been skipped if the 
-- previous migration failed halfway through.
--
-- Instructions: Run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Ensure buckets exist (idempotent)
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- 2. Drop existing policies to avoid "policy already exists" errors
DROP POLICY IF EXISTS "Resumes are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- 3. Recreate policies for 'resumes' bucket
CREATE POLICY "Resumes are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'resumes');

CREATE POLICY "Users can upload resumes" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'resumes' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own resumes" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'resumes' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own resumes" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'resumes' AND auth.uid() = owner);

-- 4. Recreate policies for 'avatars' bucket
CREATE POLICY "Avatars are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Done!
