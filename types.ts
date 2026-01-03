
export interface PriceData {
  time: string;
  timestamp: number; // Unix timestamp in seconds
  price: number; // This acts as 'close'
  open: number;
  high: number;
  low: number;
  volume: number;
  sma10?: number;
  sma20?: number;
  ema9?: number;
  ema20?: number;
  rsi?: number;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  price: number;
  amount: number;
  leverage: number;
  timestamp: Date;
  reasoning: string;
  pnl?: number;
  symbol?: string;
}

export interface Position {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  amount: number;
  leverage: number;
  timestamp: number;
  stopLossPct?: number;
  takeProfitPct?: number;
}

export interface Portfolio {
  cash: number;
  assets: number;
  initialValue: number;
  avgEntryPrice: number; 
  positionSymbol?: string;
  positions: Position[];
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

export enum TradingMode {
  MANUAL = 'MANUAL',
  AUTO = 'AUTO'
}

export enum Strategy {
  AI_GEMINI = 'AI_GEMINI',
  RSI_MOMENTUM = 'RSI_MOMENTUM',
  SMA_CROSSOVER = 'SMA_CROSSOVER',
  EMA_CROSSOVER = 'EMA_CROSSOVER'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AIAnalysis {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  suggestedPrice?: number;
  sources?: GroundingSource[];
  strategyUsed?: string;
}