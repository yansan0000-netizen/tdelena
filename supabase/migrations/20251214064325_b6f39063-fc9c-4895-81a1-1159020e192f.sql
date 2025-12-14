-- Create enum for run modes
CREATE TYPE public.run_mode AS ENUM ('1C_RAW', 'RAW', 'PROCESSED');

-- Create enum for run status
CREATE TYPE public.run_status AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'ERROR');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create runs table for processing jobs
CREATE TABLE public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mode run_mode NOT NULL,
  status run_status NOT NULL DEFAULT 'QUEUED',
  input_filename TEXT NOT NULL,
  input_file_path TEXT,
  processed_file_path TEXT,
  result_file_path TEXT,
  period_start DATE,
  period_end DATE,
  periods_found INTEGER,
  rows_processed INTEGER,
  last_period TEXT,
  error_message TEXT,
  log JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Runs policies
CREATE POLICY "Users can view own runs"
  ON public.runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own runs"
  ON public.runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own runs"
  ON public.runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own runs"
  ON public.runs FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger function for profiles on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('sales-input', 'sales-input', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('sales-processed', 'sales-processed', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('sales-results', 'sales-results', false);

-- Storage policies for sales-input bucket
CREATE POLICY "Users can upload own files to sales-input"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sales-input' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files in sales-input"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sales-input' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files in sales-input"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sales-input' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for sales-processed bucket
CREATE POLICY "Users can upload own files to sales-processed"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sales-processed' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files in sales-processed"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sales-processed' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files in sales-processed"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sales-processed' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for sales-results bucket
CREATE POLICY "Users can upload own files to sales-results"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sales-results' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files in sales-results"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sales-results' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files in sales-results"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sales-results' AND auth.uid()::text = (storage.foldername(name))[1]);