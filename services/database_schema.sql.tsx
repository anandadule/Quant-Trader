
export const DatabaseSchema = `
-- Database Schema for AI Quant Trader
-- Optimized for Supabase / PostgreSQL with RLS

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent errors on re-run
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Profile Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. PORTFOLIOS TABLE
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL, 
    cash NUMERIC NOT NULL DEFAULT 0,
    assets NUMERIC NOT NULL DEFAULT 0,
    initial_value NUMERIC NOT NULL DEFAULT 0,
    positions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT portfolios_user_id_key UNIQUE (user_id)
);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own portfolio" ON portfolios;
DROP POLICY IF EXISTS "Users can update own portfolio" ON portfolios;
DROP POLICY IF EXISTS "Users can insert own portfolio" ON portfolios;

CREATE POLICY "Users can view own portfolio" ON portfolios
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio" ON portfolios
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio" ON portfolios
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 4. TRADES TABLE
CREATE TABLE IF NOT EXISTS trades (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
    price NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    leverage NUMERIC DEFAULT 1,
    pnl NUMERIC, 
    reasoning TEXT, 
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trades" ON trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON trades;

CREATE POLICY "Users can view own trades" ON trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades" ON trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 5. EQUITY HISTORY TABLE
CREATE TABLE IF NOT EXISTS equity_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    equity NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE equity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own equity history" ON equity_history;
DROP POLICY IF EXISTS "Users can insert own equity history" ON equity_history;

CREATE POLICY "Users can view own equity history" ON equity_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own equity history" ON equity_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 6. AI ANALYSIS LOGS TABLE
CREATE TABLE IF NOT EXISTS ai_analysis_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    confidence NUMERIC,
    reasoning TEXT,
    strategy_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE ai_analysis_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analysis logs" ON ai_analysis_logs;
DROP POLICY IF EXISTS "Users can insert own analysis logs" ON ai_analysis_logs;

CREATE POLICY "Users can view own analysis logs" ON ai_analysis_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis logs" ON ai_analysis_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_analysis_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete logs older than 24 hours
  DELETE FROM public.ai_analysis_logs
  WHERE created_at < (now() - INTERVAL '1 day');
  
  -- Must return NULL for Statement-level triggers
  RETURN NULL; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup Trigger
DROP TRIGGER IF EXISTS trigger_cleanup_analysis_logs ON ai_analysis_logs;
CREATE TRIGGER trigger_cleanup_analysis_logs
    AFTER INSERT ON ai_analysis_logs
    FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_old_analysis_logs();
`;
