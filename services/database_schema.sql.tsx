
export const DatabaseSchema = `
-- Database Schema for AI Quant Trader
-- Optimized for Supabase / PostgreSQL with RLS

-- ------------------------------------------------------------------
-- IMPORTANT: FIX FOR "MISSING UNIQUE CONSTRAINT" (Error 42P10)
-- Run the following SQL block in the Supabase SQL Editor to fix existing data:
/*
  -- 1. Remove duplicate portfolios, keeping only the most recently updated one
  DELETE FROM portfolios a USING portfolios b
  WHERE a.user_id = b.user_id AND a.updated_at < b.updated_at;

  -- 2. Add the unique constraint to prevent future duplicates and enable native UPSERT
  ALTER TABLE portfolios ADD CONSTRAINT portfolios_user_id_key UNIQUE (user_id);
*/
-- ------------------------------------------------------------------

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
-- Automatically created when a user signs up via the trigger below.
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to allow re-running script safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. PORTFOLIOS
-- Stores cash, assets value, and active positions.
-- Positions are stored as a JSON array as requested: [{ symbol, entryPrice, amount... }]
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL, -- Constraint added via ALTER TABLE command above
    cash NUMERIC NOT NULL DEFAULT 0,
    assets NUMERIC NOT NULL DEFAULT 0, -- Total value of held assets
    initial_value NUMERIC NOT NULL DEFAULT 0,
    positions JSONB DEFAULT '[]'::jsonb, -- Active positions as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio" ON portfolios
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio" ON portfolios
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio" ON portfolios
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 3. TRADES
-- Logs every buy/sell execution.
CREATE TABLE IF NOT EXISTS trades (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
    price NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    leverage NUMERIC DEFAULT 1,
    pnl NUMERIC, -- Null for open trades, populated on close
    reasoning TEXT, -- AI or Manual reasoning
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades" ON trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades" ON trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 4. EQUITY HISTORY
-- Tracks performance over time for charts.
CREATE TABLE IF NOT EXISTS equity_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    equity NUMERIC NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE equity_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own equity history" ON equity_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own equity history" ON equity_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 5. AI ANALYSIS LOGS
-- Logs the AI's decision making process for transparency.
CREATE TABLE IF NOT EXISTS ai_analysis_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL, -- BUY, SELL, HOLD
    confidence NUMERIC,
    reasoning TEXT,
    strategy_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE ai_analysis_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analysis logs" ON ai_analysis_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis logs" ON ai_analysis_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
`;
