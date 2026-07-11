-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('job_seeker', 'hr', 'admin')),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  hr_role TEXT CHECK (hr_role IN ('admin_hr', 'recruiter')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  job_title TEXT,
  skills TEXT[],
  experience_years INTEGER DEFAULT 0,
  city TEXT,
  district TEXT,
  military_status TEXT CHECK (military_status IN ('Exempted', 'Completed', 'Postponed')),
  salary_expectation INTEGER,
  bio TEXT,
  cv_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create shortlists table
CREATE TABLE IF NOT EXISTS public.shortlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create candidate_notes table
CREATE TABLE IF NOT EXISTS public.candidate_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create profile_views table
CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  hr_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE
);

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- SECURITY: users and profiles are restricted to authenticated
-- users only — anon key cannot read PII even via REST API.
-- ============================================================

-- FIX (was: viewable by everyone → anyone with anon key could read all PII)
CREATE POLICY "Users viewable by authenticated" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own record" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Companies viewable by everyone" ON public.companies FOR SELECT USING (true);

-- FIX (was: viewable by everyone → anyone could read salary, phone, bio etc.)
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Shortlists viewable by everyone" ON public.shortlists FOR SELECT USING (true);
CREATE POLICY "Shortlists insertable by everyone" ON public.shortlists FOR INSERT WITH CHECK (true);
CREATE POLICY "Shortlists deletable by everyone" ON public.shortlists FOR DELETE USING (true);

CREATE POLICY "Notes viewable by everyone" ON public.candidate_notes FOR SELECT USING (true);
CREATE POLICY "Notes insertable by everyone" ON public.candidate_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Notes deletable by everyone" ON public.candidate_notes FOR DELETE USING (true);

CREATE POLICY "HR can insert views" ON public.profile_views FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'hr')
);
CREATE POLICY "Job seekers can view their own profile views" ON public.profile_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = profile_views.profile_id AND user_id = auth.uid())
);

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
-- SECURITY: payments bucket is PRIVATE — receipts accessible only via signed URLs from backend
INSERT INTO storage.buckets (id, name, public) VALUES ('payments', 'payments', false) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Resumes are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'resumes');
CREATE POLICY "Users can upload resumes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own resumes" ON storage.objects FOR UPDATE USING (bucket_id = 'resumes' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own resumes" ON storage.objects FOR DELETE USING (bucket_id = 'resumes' AND auth.uid() = owner);

CREATE POLICY "Avatars are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- SECURITY: payment receipts are private — users can only access their own
CREATE POLICY "Users view their own payment receipts" ON storage.objects FOR SELECT USING (bucket_id = 'payments' AND auth.uid() = owner);
CREATE POLICY "Users can upload payments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own payments" ON storage.objects FOR UPDATE USING (bucket_id = 'payments' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own payments" ON storage.objects FOR DELETE USING (bucket_id = 'payments' AND auth.uid() = owner);

-- MIGRATION SCRIPT (For users keeping old data)
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hr_role TEXT CHECK (hr_role IN ('admin_hr', 'recruiter'));
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS military_status TEXT CHECK (military_status IN ('Exempted', 'Completed', 'Postponed'));

-- ==========================================
-- CV BANK TABLES (Added Phase 9)
-- ==========================================

-- Folders
CREATE TABLE IF NOT EXISTS public.folders (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and team manage folders" ON public.folders
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u1, public.users u2
      WHERE u1.id = auth.uid() AND u2.id = folders.user_id 
      AND u1.company_id = u2.company_id AND u1.company_id IS NOT NULL
    )
  ) WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u1, public.users u2
      WHERE u1.id = auth.uid() AND u2.id = folders.user_id 
      AND u1.company_id = u2.company_id AND u1.company_id IS NOT NULL
    )
  );

-- Resumes
CREATE TABLE IF NOT EXISTS public.resumes (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  age INTEGER,
  governorate TEXT,
  email TEXT,
  phone TEXT,
  applied_for TEXT,
  skills TEXT[],
  ai_summary TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  is_favorited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and team manage resumes" ON public.resumes
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u1, public.users u2
      WHERE u1.id = auth.uid() AND u2.id = resumes.user_id 
      AND u1.company_id = u2.company_id AND u1.company_id IS NOT NULL
    )
  ) WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u1, public.users u2
      WHERE u1.id = auth.uid() AND u2.id = resumes.user_id 
      AND u1.company_id = u2.company_id AND u1.company_id IS NOT NULL
    )
  );

-- Comments
CREATE TABLE IF NOT EXISTS public.comments (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  resume_id BIGINT REFERENCES public.resumes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and team manage cv comments" ON public.comments
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u1, public.users u2
      WHERE u1.id = auth.uid() AND u2.id = comments.user_id 
      AND u1.company_id = u2.company_id AND u1.company_id IS NOT NULL
    )
  ) WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u1, public.users u2
      WHERE u1.id = auth.uid() AND u2.id = comments.user_id 
      AND u1.company_id = u2.company_id AND u1.company_id IS NOT NULL
    )
  );
