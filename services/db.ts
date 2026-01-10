
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
   */
  async updateProfile(userId: string, updates: { full_name?: string; email?: string }) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
      
    return error;
  },

  /**
   * Fetch user's portfolio. If none exists, returns null.
   * Uses limit(1) to handle cases where duplicate rows might exist due to missing unique constraints.
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
      avgEntryPrice: 0, // Calculated field, not stored
      positions: (data.positions as unknown as Position[]) || []
    };
  },

  /**
   * Create or Update the user's portfolio
   * Implements a manual "check-then-write" strategy to be robust against missing database constraints.
   */
  async upsertPortfolio(userId: string, portfolio: Portfolio) {
    // 1. Check if a record exists for this user
    const { data: existingRows, error: fetchError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (fetchError) {
      console.error('Error checking portfolio state:', fetchError);
      return;
    }

    const payload = {
        cash: portfolio.cash,
        assets: portfolio.assets,
        initial_value: portfolio.initialValue,
        positions: portfolio.positions,
        updated_at: new Date().toISOString()
    };

    if (existingRows && existingRows.length > 0) {
      // 2. UPDATE existing record
      const { error: updateError } = await supabase
        .from('portfolios')
        .update(payload)
        .eq('id', existingRows[0].id);

      if (updateError) console.error('Error updating portfolio:', updateError);
    } else {
      // 3. INSERT new record
      const { error: insertError } = await supabase
        .from('portfolios')
        .insert({
          user_id: userId,
          ...payload
        });

      if (insertError) console.error('Error creating portfolio:', insertError);
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
      pnl: t.pnl ? Number(t.pnl) : undefined,
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
