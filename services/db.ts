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
      // Suppress network errors for profile fetch, just return null
      if (!error.message.includes('Failed to fetch')) {
          console.error('Error fetching profile:', error.message);
      }
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
    } catch (e: any) {
       // Graceful fallback
       if (e.message && e.message.includes('Failed to fetch')) {
           console.warn("Profile update skipped (Offline Mode)");
       } else {
           console.warn('DB Profile Update Failed:', e);
       }
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
      if (!error.message.includes('Failed to fetch')) {
          console.error('Error fetching portfolio:', error.message);
      }
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
   * Uses Select -> Update/Insert pattern for maximum robustness against schema constraint variations
   */
  async upsertPortfolio(userId: string, portfolio: Portfolio) {
    // 1. Sanitize Data: Ensure positions is an array
    const positions = Array.isArray(portfolio.positions) ? portfolio.positions : [];

    // Helper to ensure numbers are finite and safe for Postgres numeric types
    const safeNum = (val: any) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : 0;
    };

    // 2. Map and Validate: Ensure no undefined/NaN values pass to the DB
    const cleanPositions = positions.map(p => ({
        id: p.id || Math.random().toString(36).substr(2, 9),
        symbol: p.symbol || 'UNKNOWN',
        type: p.type || 'LONG',
        entryPrice: safeNum(p.entryPrice),
        amount: safeNum(p.amount),
        leverage: safeNum(p.leverage) || 1,
        timestamp: safeNum(p.timestamp) || Date.now(),
        stopLossPct: safeNum(p.stopLossPct),
        takeProfitPct: safeNum(p.takeProfitPct)
    }));

    const payload = {
        user_id: userId, // Required for matching
        cash: safeNum(portfolio.cash),
        assets: safeNum(portfolio.assets),
        initial_value: safeNum(portfolio.initialValue),
        positions: cleanPositions as any,
        updated_at: new Date().toISOString()
    };

    try {
        // Strategy: Check existence first.
        // This avoids issues where 'upsert' fails because the unique constraint on user_id might be missing or named differently.
        const { data: existing, error: fetchError } = await supabase
            .from('portfolios')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError && !fetchError.message.includes('Failed to fetch')) {
             console.warn("Error checking portfolio existence:", fetchError.message);
        }

        let error;

        if (existing) {
            // Update existing record
            const res = await supabase
                .from('portfolios')
                .update(payload)
                .eq('user_id', userId);
            error = res.error;
        } else {
            // Insert new record
            const res = await supabase
                .from('portfolios')
                .insert(payload);
            error = res.error;
        }

        if (error) {
            // Check specifically for fetch errors (Offline/Network issues)
            if (error.message && error.message.includes('Failed to fetch')) {
                 console.warn("Database sync failed (Network/Offline). Continuing in local mode.");
                 return;
            }
            
            // Log full stringified error to debug [object Object] issues
            console.error('Error saving portfolio:', JSON.stringify(error, null, 2));
        }
    } catch (e: any) {
        if (e.message && e.message.includes('Failed to fetch')) {
            console.warn("Database sync failed (Network/Offline). Continuing in local mode.");
        } else {
            console.error("Critical Portfolio Save Error:", e);
        }
    }
  },

  /**
   * Log a new trade
   */
  async logTrade(userId: string, trade: Trade) {
    try {
        // Safe Number conversion
        const safeNum = (val: any) => Number.isFinite(Number(val)) ? Number(val) : 0;

        const { error } = await supabase
        .from('trades')
        .insert({
            user_id: userId,
            symbol: trade.symbol,
            type: trade.type,
            price: safeNum(trade.price),
            amount: safeNum(trade.amount),
            leverage: safeNum(trade.leverage),
            pnl: (trade.pnl !== undefined && trade.pnl !== null) ? safeNum(trade.pnl) : null,
            reasoning: trade.reasoning,
            timestamp: trade.timestamp.toISOString()
        });

        if (error) {
            if (!error.message.includes('Failed to fetch')) {
                console.error('Error logging trade:', error.message);
            }
        }
    } catch (e) {
        // Ignore network errors for logging
    }
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
      if (!error.message.includes('Failed to fetch')) {
          console.error('Error fetching trades:', error.message);
      }
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
     try {
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
          if (error && !error.message.includes('Failed to fetch')) {
              console.error('Error logging analysis:', error.message);
          }
     } catch(e) {
         // Ignore logging errors
     }
  }
};