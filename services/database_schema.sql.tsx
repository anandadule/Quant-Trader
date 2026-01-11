
export const DatabaseSchema = `
-- AI Quant Trader Database Schema & Fixes
-- Run this in the Supabase SQL Editor to initialize or repair your database.

-- ==========================================
-- 1. CRITICAL FIXES (Run these if you have existing tables)
-- ==========================================

-- Fix 1: Ensure 'full_name' column exists in profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN 
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT; 
    END IF; 
END $$;

-- Fix 2: Ensure 'user_id' in portfolios is UNIQUE (Required for upsert)
-- We first remove duplicates if any exist (keeping the most recent)
DELETE FROM public.portfolios a USING public.portfolios b
WHERE a.id < b.id AND a.user_id = b.user_id;

-- Then we verify/add the constraint
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portfolios_user_id_key') THEN 
        ALTER TABLE public.portfolios ADD CONSTRAINT portfolios_user_id_key UNIQUE (user_id); 
    END IF; 
END $$;


-- ==========================================
-- 2. TABLE DEFINITIONS (Idempotent)
-- ==========================================

-- Cleanup triggers that might cause issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Portfolios
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  cash NUMERIC DEFAULT 10000,
  assets NUMERIC DEFAULT 0,
  initial_value NUMERIC DEFAULT 10000,
  positions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Ensure constraint exists if creating from scratch
  CONSTRAINT portfolios_user_id_key UNIQUE (user_id)
);

-- Trades
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  leverage NUMERIC DEFAULT 1,
  pnl NUMERIC,
  reasoning TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AI Analysis Logs
CREATE TABLE IF NOT EXISTS public.ai_analysis_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    symbol TEXT,
    action TEXT,
    confidence NUMERIC,
    reasoning TEXT,
    strategy_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Equity History
CREATE TABLE IF NOT EXISTS public.equity_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    equity NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. SECURITY POLICIES (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equity_history ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Portfolios
DROP POLICY IF EXISTS "Users can manage own portfolio" ON public.portfolios;
CREATE POLICY "Users can manage own portfolio" ON public.portfolios
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trades
DROP POLICY IF EXISTS "Users can manage own trades" ON public.trades;
CREATE POLICY "Users can manage own trades" ON public.trades
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI Logs
DROP POLICY IF EXISTS "Users can manage own logs" ON public.ai_analysis_logs;
CREATE POLICY "Users can manage own logs" ON public.ai_analysis_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  
-- Equity History
DROP POLICY IF EXISTS "Users can manage own equity" ON public.equity_history;
CREATE POLICY "Users can manage own equity" ON public.equity_history
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 4. PERMISSIONS
-- ==========================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
`;
