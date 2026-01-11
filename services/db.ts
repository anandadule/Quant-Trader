
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
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  },

  /**
   * Update user's profile
   * Uses upsert to ensure the profile exists even if the signup trigger failed.
   */
  async updateProfile(userId: string, updates: { full_name?: string; email?: string }) {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...updates
      });
      
    return error;
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
      console.error('Error fetching portfolio:', error);
      return null;
    }
    
    if (!data) return null;

    return {
      cash: Number(data.cash),
      assets: Number(data.assets),
      initialValue: Number(data.initial_value),
      avgEntryPrice: 0, // Calculated field, not persistent
      positions: (data.positions as unknown as Position[]) || []
    };
  },

  /**
   * Create or Update the user's portfolio
   * Uses atomic UPSERT to handle race conditions and simplify logic.
   */
  async upsertPortfolio(userId: string, portfolio: Portfolio) {
    // Sanitize positions to ensure no undefined values or non-serializable objects
    const cleanPositions = portfolio.positions.map(p => ({
        ...p,
        stopLossPct: p.stopLossPct || 0,
        takeProfitPct: p.takeProfitPct || 0,
        // Ensure no Date objects if they exist
    }));

    // Uses the unique constraint on 'user_id' to automatically Insert or Update
    const { error } = await supabase
      .from('portfolios')
      .upsert({
        user_id: userId,
        cash: portfolio.cash,
        assets: portfolio.assets,
        initial_value: portfolio.initialValue,
        positions: cleanPositions as any, // Supabase handles JSONB conversion
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) console.error('Error upserting portfolio:', error);
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

    if (error) console.error('Error logging trade:', error);
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
      console.error('Error fetching trades:', error);
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
      if (error) console.error('Error logging analysis:', error);
  }
};
