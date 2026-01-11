
import { supabase } from './supabaseClient';
import { Portfolio, Trade, AIAnalysis, Position } from '../types';

export const db = {
  /**
   * Fetch user's profile (name, email, etc.)
   */
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    return data;
  },

  /**
   * Update user's profile
   * Uses upsert to ensure the profile exists.
   */
  async updateProfile(userId: string, updates: { full_name?: string; email?: string }) {
    // Attempt to update. If the column 'full_name' is missing in the DB, this might throw.
    // We try/catch to ensure app doesn't crash, but we rely on Auth Metadata as primary source in App.tsx now.
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...updates
        });
        
      if (error) {
        console.warn('DB Profile Update Warning:', error.message);
        return error;
      }
    } catch (e) {
      console.warn('DB Profile Update Failed (Schema mismatch?):', e);
    }
    return null;
  },

  /**
   * Fetch user's portfolio. If none exists, returns null.
   */
  async getPortfolio(userId: string): Promise<Portfolio | null> {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching portfolio:', error.message);
      return null;
    }
    
    if (!data) return null;

    // Ensure positions is always an array even if DB returns null
    const safePositions = Array.isArray(data.positions) ? data.positions : [];

    return {
      cash: Number(data.cash),
      assets: Number(data.assets),
      initialValue: Number(data.initial_value),
      avgEntryPrice: 0, // Calculated field, not persistent
      positions: safePositions as unknown as Position[]
    };
  },

  /**
   * Create or Update the user's portfolio
   * USES MANUAL CHECK-THEN-WRITE to avoid "no unique constraint" errors (42P10)
   */
  async upsertPortfolio(userId: string, portfolio: Portfolio) {
    // 1. Sanitize Data: Ensure positions is an array
    const positions = Array.isArray(portfolio.positions) ? portfolio.positions : [];

    // 2. Map and Validate: Ensure no undefined/NaN values pass to the DB
    const cleanPositions = positions.map(p => ({
        id: p.id || Math.random().toString(36).substr(2, 9),
        symbol: p.symbol || 'UNKNOWN',
        type: p.type || 'LONG',
        entryPrice: Number(p.entryPrice) || 0,
        amount: Number(p.amount) || 0,
        leverage: Number(p.leverage) || 1,
        timestamp: Number(p.timestamp) || Date.now(),
        stopLossPct: Number(p.stopLossPct || 0),
        takeProfitPct: Number(p.takeProfitPct || 0)
    }));

    const payload = {
        cash: Number(portfolio.cash) || 0,
        assets: Number(portfolio.assets) || 0,
        initial_value: Number(portfolio.initialValue) || 0,
        positions: cleanPositions as any,
        updated_at: new Date().toISOString()
    };

    try {
        // 3. Check if portfolio exists for this user
        const { data: existing, error: fetchError } = await supabase
            .from('portfolios')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        let error;

        if (existing) {
            // UPDATE
            const { error: updateError } = await supabase
                .from('portfolios')
                .update(payload)
                .eq('user_id', userId);
            error = updateError;
        } else {
            // INSERT
            const { error: insertError } = await supabase
                .from('portfolios')
                .insert({
                    user_id: userId,
                    ...payload
                });
            error = insertError;
        }

        // 4. Improved Error Logging
        if (error) {
            console.error('Error saving portfolio:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
        }
    } catch (e: any) {
        console.error("Critical Portfolio Save Error:", e.message);
    }
  },

  /**
   * Log a new trade
   */
  async logTrade(userId: string, trade: Trade) {
    const { error } = await supabase
      .from('trades')
      .insert({
        user_id: userId,
        symbol: trade.symbol,
        type: trade.type,
        price: trade.price,
        amount: trade.amount,
        leverage: trade.leverage,
        pnl: trade.pnl,
        reasoning: trade.reasoning,
        timestamp: trade.timestamp.toISOString()
      });

    if (error) console.error('Error logging trade:', error.message);
  },

  /**
   * Fetch trade history
   */
  async getTrades(userId: string): Promise<Trade[]> {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Error fetching trades:', error.message);
      return [];
    }
    
    return data.map((t: any) => ({
      id: t.id,
      symbol: t.symbol,
      type: t.type,
      price: Number(t.price),
      amount: Number(t.amount),
      leverage: Number(t.leverage),
      // Fix: Ensure 0 is not treated as undefined
      pnl: (t.pnl !== null && t.pnl !== undefined) ? Number(t.pnl) : undefined,
      reasoning: t.reasoning,
      timestamp: new Date(t.timestamp)
    }));
  },
  
  /**
   * Log AI Analysis for transparency
   */
  async logAnalysis(userId: string, analysis: AIAnalysis, symbol: string) {
     const { error } = await supabase
      .from('ai_analysis_logs')
      .insert({
         user_id: userId,
         symbol: symbol,
         action: analysis.action,
         confidence: analysis.confidence,
         reasoning: analysis.reasoning,
         strategy_used: analysis.strategyUsed
      });
      if (error) console.error('Error logging analysis:', error.message);
  }
};
