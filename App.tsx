
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  TrendingUp, 
  Activity, 
  History, 
  Cpu, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertCircle, 
  Info, 
  Target, 
  Ban, 
  Layers, 
  Coins,
  RefreshCcw,
  BarChart4,
  PieChart,
  Menu,
  X,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Brain,
  Zap,
  LineChart,
  Gauge,
  Filter,
  Plus,
  Minus,
  Settings,
  User,
  Mail,
  Shield,
  CreditCard,
  Bell,
  LogOut,
  Edit3,
  Globe,
  Play,
  Pause,
  Trash2,
  Wifi,
  WifiOff,
  Cloud,
  Download,
  Wallet,
  MousePointerClick
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TradingChart } from './components/TradingChart';
import { Auth } from './components/Auth';
import { PriceData, Trade, Portfolio, TradingMode, AIAnalysis, EquityPoint, WatchlistItem, Strategy, Position } from './types';
import { 
  fetchHistoricalData, 
  fetchLatestQuote, 
  fetchTicker, 
  mergeQuote 
} from './services/marketSim';
import { analyzeMarket } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { db } from './services/db';

const INITIAL_CASH = 10000;
const STORAGE_KEY = 'gemini_quant_pro_v12_multi_pos';

const AVAILABLE_PAIRS = [
  { symbol: 'BTCUSDT', name: 'BTC/USD' },
  { symbol: 'ETHUSDT', name: 'ETH/USD' },
  { symbol: 'SOLUSDT', name: 'SOL/USD' },
  { symbol: 'XAUUSDT', name: 'Gold/USD' },
  { symbol: 'DOGEUSDT', name: 'DOGE/USD' },
  { symbol: 'XRPUSDT', name: 'XRP/USD' },
  { symbol: 'ADAUSDT', name: 'ADA/USD' },
  { symbol: 'BNBUSDT', name: 'BNB/USD' },
  { symbol: 'NSE:NIFTY50-INDEX', name: 'Nifty 50' },
  { symbol: 'NSE:NIFTYBANK-INDEX', name: 'Bank Nifty' },
  { symbol: 'NSE:RELIANCE-EQ', name: 'Reliance Ind' },
  { symbol: 'NSE:HDFCBANK-EQ', name: 'HDFC Bank' },
  { symbol: 'NSE:SBIN-EQ', name: 'SBI' },
  { symbol: 'NSE:TATASTEEL-EQ', name: 'Tata Steel' },
];

const getSavedItem = (key: string, defaultValue: any) => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultValue;
  try {
    const parsed = JSON.parse(saved);
    const value = parsed[key];
    if (value === undefined) return defaultValue;
    
    // Safety check for portfolio positions to ensure array type
    if (key === 'portfolio' && value && !Array.isArray(value.positions)) {
       return { ...value, positions: [] };
    }

    if (key === 'trades') {
      return value.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }));
    }
    return value;
  } catch (e) { return defaultValue; }
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  
  const [portfolio, setPortfolio] = useState<Portfolio>(() => 
    getSavedItem('portfolio', { cash: INITIAL_CASH, positions: [], initialValue: INITIAL_CASH, assets: 0, avgEntryPrice: 0 })
  );
  const [trades, setTrades] = useState<Trade[]>(() => getSavedItem('trades', []));
  const [mode, setMode] = useState<TradingMode>(() => getSavedItem('mode', TradingMode.MANUAL));
  const [activeStrategy, setActiveStrategy] = useState<Strategy>(() => getSavedItem('activeStrategy', Strategy.AI_GEMINI));
  const [selectedLeverage, setSelectedLeverage] = useState<number>(() => getSavedItem('selectedLeverage', 20));
  const [stopLossPct, setStopLossPct] = useState<number>(() => getSavedItem('stopLossPct', 15));
  const [takeProfitPct, setTakeProfitPct] = useState<number>(() => getSavedItem('takeProfitPct', 45));
  const [lotSize, setLotSize] = useState<string>(() => getSavedItem('lotSize', '0.01'));
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>(() => getSavedItem('equityHistory', []));
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(AVAILABLE_PAIRS.map(p => ({ ...p, price: 0, change24h: 0 })));
  const [marketData, setMarketData] = useState<PriceData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AIAnalysis | null>(null);
  const [notifications, setNotifications] = useState<{msg: string, type: 'info' | 'success' | 'error'}[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [currentSymbol, setCurrentSymbol] = useState<string>(() => getSavedItem('currentSymbol', 'BTCUSDT'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  
  // Expand/Collapse States
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(() => getSavedItem('isHistoryExpanded', true));
  const [isOpenPositionsExpanded, setIsOpenPositionsExpanded] = useState<boolean>(() => getSavedItem('isOpenPositionsExpanded', true));
  const [isNeuralAnalysisExpanded, setIsNeuralAnalysisExpanded] = useState<boolean>(() => getSavedItem('isNeuralAnalysisExpanded', true));
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');

  // Profile State
  const [userProfile, setUserProfile] = useState(() => getSavedItem('userProfile', {
    name: 'Anand Adule',
    email: 'adule.altech@gmail.com',
    apiKey: '••••••••••••ab12',
    memberSince: 'Oct 2023'
  }));
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState(userProfile);

  // History Filters State
  const [historyFilterType, setHistoryFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [historyFilterPnL, setHistoryFilterPnL] = useState<'ALL' | 'PROFIT' | 'LOSS'>('ALL');
  const [historyFilterStartDate, setHistoryFilterStartDate] = useState<string>('');
  const [historyFilterEndDate, setHistoryFilterEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [financialModal, setFinancialModal] = useState<{isOpen: boolean, type: 'deposit' | 'withdraw'}>({isOpen: false, type: 'deposit'});
  const [modalAmount, setModalAmount] = useState<string>('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  
  // Position Target Edit Modal State
  const [targetModal, setTargetModal] = useState<{
    isOpen: boolean, 
    positionId: string, 
    symbol: string, 
    slPrice: string, 
    tpPrice: string,
    entryPrice: number,
    leverage: number,
    type: 'LONG' | 'SHORT'
  } | null>(null);

  const marketInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const notify = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotifications(prev => [{ msg, type }, ...prev].slice(0, 5));
  }, []);

  // Sync with DB on Login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserData(session.user.id, session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadUserData(session.user.id, session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string, user: any) => {
    try {
        const [dbPortfolio, dbTrades, dbProfile] = await Promise.all([
            db.getPortfolio(userId),
            db.getTrades(userId),
            db.getProfile(userId)
        ]);

        if (dbPortfolio) {
            setPortfolio(dbPortfolio);
        } else {
            console.log("Initializing new user portfolio...");
            const defaultPortfolio = { cash: INITIAL_CASH, positions: [], initialValue: INITIAL_CASH, assets: 0, avgEntryPrice: 0 };
            await db.upsertPortfolio(userId, defaultPortfolio);
            setPortfolio(defaultPortfolio);
        }

        // Prioritize User Metadata from Auth if DB profile is missing or doesn't have name
        const metaName = user?.user_metadata?.full_name;
        const dbName = dbProfile?.full_name;
        
        // Use the most relevant name available
        const displayName = dbName || metaName || user?.email?.split('@')[0] || "Trader";

        setUserProfile(prev => ({
            ...prev,
            name: displayName,
            email: user?.email || prev.email
        }));

        // Try to sync back to DB if DB is empty but we have a name
        if (!dbProfile && metaName) {
           await db.updateProfile(userId, { email: user.email, full_name: metaName });
        }

        if (dbTrades) setTrades(dbTrades);
        
        notify("Account synchronized", "success");
    } catch (e) {
        console.error("Failed to load user data", e);
        notify("Working offline (Sync Failed)", "error");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    // Explicitly Clear local state on logout to prevent data leakage
    setPortfolio({ cash: INITIAL_CASH, positions: [], initialValue: INITIAL_CASH, assets: 0, avgEntryPrice: 0 });
    setTrades([]);
    setEquityHistory([]);
    setLastAnalysis(null);
    notify("Signed out successfully", "success");
  };


  // Symbol Change Handler
  const handleSymbolChange = useCallback((symbol: string) => {
    setCurrentSymbol(symbol);
    setIsSidebarOpen(false);
    setView('dashboard');
  }, []);

  const currentPrice = useMemo(() => marketData.length > 0 ? marketData[marketData.length - 1].price : 0, [marketData]);

  // Consolidate all prices (Live chart price + Watchlist prices for other symbols)
  const priceMap = useMemo(() => {
      const map: Record<string, number> = {};
      watchlist.forEach(w => map[w.symbol] = w.price);
      // Override current symbol with most recent high-freq data if available
      if (currentPrice > 0) map[currentSymbol] = currentPrice;
      return map;
  }, [watchlist, currentSymbol, currentPrice]);

  // Portfolio Calculations
  const { totalUnrealizedPnL, totalMarginLocked, totalPositionValue } = useMemo(() => {
    let pnl = 0;
    let margin = 0;
    let value = 0;

    // Safety check: ensure portfolio.positions is an array
    const safePositions = Array.isArray(portfolio.positions) ? portfolio.positions : [];

    safePositions.forEach(pos => {
        const markPrice = priceMap[pos.symbol] || pos.entryPrice;
        const diff = markPrice - pos.entryPrice;
        const posPnl = diff * pos.amount * (pos.type === 'LONG' ? 1 : -1);
        const posMargin = (pos.entryPrice * pos.amount) / pos.leverage;
        const posValue = markPrice * pos.amount;

        pnl += posPnl;
        margin += posMargin;
        value += posValue;
    });

    return { totalUnrealizedPnL: pnl, totalMarginLocked: margin, totalPositionValue: value };
  }, [portfolio.positions, priceMap]);

  const equity = portfolio.cash + totalMarginLocked + totalUnrealizedPnL;

  const estimatedMargin = useMemo(() => {
    const amount = parseFloat(lotSize);
    if (isNaN(amount) || amount <= 0) return 0;
    return (currentPrice * amount) / selectedLeverage;
  }, [currentPrice, lotSize, selectedLeverage]);

  const stats = useMemo(() => {
    if (trades.length === 0) return { winRate: 0, total: 0 };
    const exits = trades.filter(t => t.reasoning.includes("Close") || t.reasoning.includes("Liquidated") || t.type === 'SELL'); // Approximation
    if (exits.length === 0) return { winRate: 0, total: trades.length };
    const wins = exits.filter(t => t.pnl && t.pnl > 0);
    return { winRate: (wins.length / exits.length) * 100, total: trades.length };
  }, [trades]);

  // Filter Logic
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (historyFilterType !== 'ALL' && t.type !== historyFilterType) return false;
      if (historyFilterPnL === 'PROFIT') { if (t.pnl === undefined || t.pnl < 0) return false; }
      if (historyFilterPnL === 'LOSS') { if (t.pnl === undefined || t.pnl >= 0) return false; }
      const tradeDateLocal = t.timestamp.toLocaleDateString('en-CA'); 
      if (historyFilterStartDate && tradeDateLocal < historyFilterStartDate) return false;
      if (historyFilterEndDate && tradeDateLocal > historyFilterEndDate) return false;
      return true;
    });
  }, [trades, historyFilterType, historyFilterPnL, historyFilterStartDate, historyFilterEndDate]);

  const HISTORY_ITEMS_PER_PAGE = 5; // Reduced for card view
  const totalHistoryPages = Math.ceil(filteredTrades.length / HISTORY_ITEMS_PER_PAGE);
  const displayedTrades = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
    return filteredTrades.slice(start, start + HISTORY_ITEMS_PER_PAGE);
  }, [filteredTrades, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilterType, historyFilterPnL, historyFilterStartDate, historyFilterEndDate]);

  const handleDownloadHistory = useCallback(() => {
    if (filteredTrades.length === 0) {
      notify("No trades to download", "error");
      return;
    }

    const headers = ['Date', 'Symbol', 'Type', 'Price', 'Amount', 'Leverage', 'PnL', 'Reasoning'];
    const rows = filteredTrades.map(t => [
      t.timestamp.toISOString(),
      t.symbol,
      t.type,
      t.price,
      t.amount,
      t.leverage,
      t.pnl || 0,
      `"${t.reasoning.replace(/"/g, '""')}"` // Escape quotes
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trade_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Trade history exported", "success");
  }, [filteredTrades, notify]);

  const handleResetSystem = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    const emptyPortfolio = { cash: INITIAL_CASH, positions: [], initialValue: INITIAL_CASH, assets: 0, avgEntryPrice: 0 };
    setPortfolio(emptyPortfolio);
    setTrades([]);
    setEquityHistory([]);
    setLastAnalysis(null);
    setResetConfirmOpen(false);
    setTargetModal(null);
    notify("System Fully Reset", "success");

    if (session?.user) {
        await db.upsertPortfolio(session.user.id, emptyPortfolio);
        // We probably should implement a deleteTrades function if we want a true DB wipe
    }
  }, [notify, session]);

  const handleFinancialAction = useCallback(async () => {
    const val = parseFloat(modalAmount);
    if (isNaN(val) || val <= 0) { notify("Invalid amount", "error"); return; }
    if (financialModal.type === 'withdraw' && val > portfolio.cash) { notify("Insufficient cash", "error"); return; }

    const newPortfolio = {
      ...portfolio,
      cash: financialModal.type === 'deposit' ? portfolio.cash + val : portfolio.cash - val,
      initialValue: financialModal.type === 'deposit' ? portfolio.initialValue + val : portfolio.initialValue - val
    };

    setPortfolio(newPortfolio);
    
    if (session?.user) {
        await db.upsertPortfolio(session.user.id, newPortfolio);
    }

    notify(`${financialModal.type === 'deposit' ? 'Deposited' : 'Withdrew'} $${val.toLocaleString()}`, "success");
    setFinancialModal({ ...financialModal, isOpen: false });
    setModalAmount('');
  }, [modalAmount, financialModal, portfolio, notify, session]);

  // Helper to convert ROI % to Price based on leverage
  const getPriceFromRoi = useCallback((roi: number, entry: number, leverage: number, type: 'LONG' | 'SHORT') => {
    const priceChangePct = roi / leverage;
    if (type === 'LONG') return entry * (1 + priceChangePct / 100);
    return entry * (1 - priceChangePct / 100);
  }, []);

  // Helper to convert Price to ROI % based on leverage
  const getRoiFromPrice = useCallback((price: number, entry: number, leverage: number, type: 'LONG' | 'SHORT') => {
    const priceChangePct = type === 'LONG' 
      ? ((price - entry) / entry) * 100
      : ((entry - price) / entry) * 100;
    // ROI = price delta % * leverage. 
    return priceChangePct * leverage;
  }, []);

  const handleSaveTargets = useCallback(async () => {
      if (!targetModal) return;
      
      const tpRoi = getRoiFromPrice(parseFloat(targetModal.tpPrice), targetModal.entryPrice, targetModal.leverage, targetModal.type);
      const slRoi = getRoiFromPrice(parseFloat(targetModal.slPrice), targetModal.entryPrice, targetModal.leverage, targetModal.type);
      
      const newPortfolio = {
          ...portfolio,
          positions: portfolio.positions.map(p => 
              p.id === targetModal.positionId 
                  ? { ...p, stopLossPct: Math.abs(slRoi), takeProfitPct: tpRoi } 
                  : p
          )
      };

      setPortfolio(newPortfolio);
      
      if (session?.user) {
          await db.upsertPortfolio(session.user.id, newPortfolio);
      }

      notify(`Updated targets for ${targetModal.symbol}`, 'success');
      setTargetModal(null);
  }, [targetModal, notify, getRoiFromPrice, portfolio, session]);
  
  const handleProfileUpdate = useCallback(async () => {
    setUserProfile(tempProfile);
    setIsEditingProfile(false);
    
    if (session?.user) {
        // 1. Update Auth Metadata (Reliable Source)
        const { error: authError } = await supabase.auth.updateUser({
            data: { full_name: tempProfile.name }
        });

        if (authError) {
             console.warn("Auth metadata update failed:", authError);
        }

        // 2. Try Update DB (Best Effort)
        // If the 'profiles' table is broken or missing columns, this won't crash the UI experience
        await db.updateProfile(session.user.id, {
            full_name: tempProfile.name,
            email: tempProfile.email
        });
        
        notify("Profile updated", "success");
    } else {
        notify("Profile updated locally", "success");
    }
  }, [tempProfile, notify, session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (notifications.length > 0) setNotifications(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [notifications]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEquityHistory(prev => [...prev, { timestamp: Date.now(), equity: parseFloat(equity.toFixed(2)) }].slice(-100));
    }, 2000); 
    return () => clearInterval(timer);
  }, [equity]);

  useEffect(() => {
    const updateWatch = async () => {
      const updated = await Promise.all(watchlist.map(async (p) => {
        const t = await fetchTicker(p.symbol);
        return t ? { ...p, price: t.price, change24h: t.changePercent } : { ...p, price: 0, change24h: 0 };
      }));
      setWatchlist(updated);
    };
    updateWatch();
    const t = setInterval(updateWatch, 2000); 
    return () => clearInterval(t);
  }, [watchlist.length]);
  
  // Data Fetching for Chart
  useEffect(() => {
      if (!session) return; // Only fetch detailed chart data if logged in
      
      const initData = async () => {
          setIsLive(false);
          const data = await fetchHistoricalData(currentSymbol, timeframe);
          setMarketData(data);
          setIsLive(true);
      };
      initData();
      
      if (marketInterval.current) clearInterval(marketInterval.current);
      
      marketInterval.current = setInterval(async () => {
          const quote = await fetchLatestQuote(currentSymbol, timeframe, marketData);
          if (quote) {
              setMarketData(prev => mergeQuote(prev, quote));
          }
      }, 2000);
      
      return () => { if (marketInterval.current) clearInterval(marketInterval.current); };
  }, [currentSymbol, timeframe, session]);

  // Execute Trade: Supports multiple positions
  const executeTrade = useCallback(async (action: 'BUY' | 'SELL', price: number, reasoning: string) => {
    const amount = parseFloat(lotSize);
    if (isNaN(amount) || amount < 0.01) { notify("Minimum lot size is 0.01", "error"); return; }
    
    const leverage = selectedLeverage;
    const marginReq = (price * amount) / leverage;
    
    if (portfolio.cash < marginReq) { notify("Insufficient Funds", "error"); return; }
    
    const newPosition: Position = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: currentSymbol,
        type: action === 'BUY' ? 'LONG' : 'SHORT',
        entryPrice: price,
        amount: amount,
        leverage: leverage,
        timestamp: Date.now(),
        stopLossPct: stopLossPct,
        takeProfitPct: takeProfitPct
    };
    
    // Safety check for existing positions array
    const currentPositions = Array.isArray(portfolio.positions) ? portfolio.positions : [];
    
    const newPortfolio = {
        ...portfolio,
        cash: portfolio.cash - marginReq,
        positions: [newPosition, ...currentPositions]
    };

    const newTrade: Trade = {
        id: newPosition.id,
        type: action,
        price,
        amount,
        leverage,
        timestamp: new Date(),
        reasoning,
        symbol: currentSymbol
    };

    setPortfolio(newPortfolio);
    setTrades(t => [newTrade, ...t]);
    
    if (session?.user) {
        await db.upsertPortfolio(session.user.id, newPortfolio);
        await db.logTrade(session.user.id, newTrade);
    }
    
    notify(`${action} Executed: ${amount} ${currentSymbol} @ $${price.toLocaleString()}`, 'success');
  }, [lotSize, currentSymbol, selectedLeverage, portfolio, notify, stopLossPct, takeProfitPct, session]);

  // Close Specific Position
  const handleClosePosition = useCallback(async (id: string) => {
    const pos = (portfolio.positions || []).find(p => p.id === id);
    if (!pos) return;

    const closePrice = priceMap[pos.symbol] || pos.entryPrice;
    const diff = closePrice - pos.entryPrice;
    const pnl = diff * pos.amount * (pos.type === 'LONG' ? 1 : -1);
    const marginReleased = (pos.entryPrice * pos.amount) / pos.leverage;

    const closingTrade: Trade = {
        id: Math.random().toString(36).substr(2, 9),
        type: pos.type === 'LONG' ? 'SELL' : 'BUY',
        price: closePrice,
        amount: pos.amount,
        leverage: pos.leverage,
        timestamp: new Date(),
        reasoning: `Manual Close ${pos.symbol}`,
        pnl: pnl,
        symbol: pos.symbol
    };

    const newPortfolio = {
        ...portfolio,
        cash: portfolio.cash + marginReleased + pnl,
        positions: (portfolio.positions || []).filter(p => p.id !== id)
    };

    setTrades(t => [closingTrade, ...t]);
    setPortfolio(newPortfolio);

    if (session?.user) {
        await db.upsertPortfolio(session.user.id, newPortfolio);
        await db.logTrade(session.user.id, closingTrade);
    }

    notify(`Closed ${pos.symbol}. PnL: $${pnl.toFixed(2)}`, pnl >= 0 ? 'success' : 'info');
  }, [priceMap, notify, portfolio, session]);

  // Close All Positions
  const handleExitAll = useCallback(() => {
    (portfolio.positions || []).forEach(pos => handleClosePosition(pos.id));
  }, [portfolio.positions, handleClosePosition]);

  // Risk Management / Auto Close
  useEffect(() => {
      // Check for liquidation
      if (totalMarginLocked > 0 && equity < totalMarginLocked * 0.1) {
          handleExitAll();
          notify("ACCOUNT LIQUIDATED - MARGIN CALL", "error");
      }
      
      // Check TP/SL for each position
      const safePositions = Array.isArray(portfolio.positions) ? portfolio.positions : [];
      safePositions.forEach(pos => {
          const mark = priceMap[pos.symbol] || pos.entryPrice;
          const diff = mark - pos.entryPrice;
          const pnl = diff * pos.amount * (pos.type === 'LONG' ? 1 : -1);
          const margin = (pos.entryPrice * pos.amount) / pos.leverage;
          const roi = (pnl / margin) * 100;
          
          // Use position-specific settings or fall back to global settings
          const activeSL = pos.stopLossPct ?? stopLossPct;
          const activeTP = pos.takeProfitPct ?? takeProfitPct;

          if (roi <= -activeSL) {
              handleClosePosition(pos.id);
              notify(`Stop Loss Triggered: ${pos.symbol}`, 'error');
          } else if (roi >= activeTP) {
              handleClosePosition(pos.id);
              notify(`Take Profit Triggered: ${pos.symbol}`, 'success');
          }
      });
  }, [priceMap, portfolio.positions, stopLossPct, takeProfitPct, equity, totalMarginLocked, handleClosePosition, handleExitAll, notify]);

  const runAutopilotEngine = useCallback(async () => {
    if (isAnalyzing || marketData.length < 25) return;
    setIsAnalyzing(true);
    try {
        const res = await analyzeMarket(marketData, currentSymbol);
        setLastAnalysis({ ...res, strategyUsed: 'AI Analysis' });
        
        if (session?.user) {
            await db.logAnalysis(session.user.id, res, currentSymbol);
        }

        // Autopilot logic here simply executes based on the signal
        if (mode === TradingMode.AUTO && res.action !== 'HOLD') {
             executeTrade(res.action as 'BUY' | 'SELL', currentPrice, res.reasoning);
        }
    } finally { setIsAnalyzing(false); }
  }, [marketData, mode, isAnalyzing, executeTrade, currentSymbol, currentPrice, session]);

  useEffect(() => {
    if (mode === TradingMode.AUTO && session) {
      const intervalMs = activeStrategy === Strategy.AI_GEMINI ? 30000 : 5000;
      aiInterval.current = setInterval(runAutopilotEngine, intervalMs);
    }
    return () => { if (aiInterval.current) clearInterval(aiInterval.current); };
  }, [mode, runAutopilotEngine, activeStrategy, session]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
      portfolio, 
      trades, 
      selectedLeverage, 
      mode, 
      currentSymbol, 
      stopLossPct, 
      takeProfitPct, 
      lotSize, 
      equityHistory, 
      activeStrategy, 
      userProfile, 
      isHistoryExpanded,
      isOpenPositionsExpanded,
      isNeuralAnalysisExpanded
    }));
  }, [portfolio, trades, selectedLeverage, mode, currentSymbol, stopLossPct, takeProfitPct, lotSize, equityHistory, activeStrategy, userProfile, isHistoryExpanded, isOpenPositionsExpanded, isNeuralAnalysisExpanded]);

  const getStrategyIcon = (s: Strategy) => {
    switch(s) {
      case Strategy.AI_GEMINI: return <Brain className="w-4 h-4" />;
      case Strategy.RSI_MOMENTUM: return <Zap className="w-4 h-4" />;
      case Strategy.SMA_CROSSOVER: return <LineChart className="w-4 h-4" />;
      case Strategy.EMA_CROSSOVER: return <Gauge className="w-4 h-4" />;
    }
  };

  const getStrategyName = (s: Strategy) => {
    switch(s) {
      case Strategy.AI_GEMINI: return "Gemini Ultra";
      case Strategy.RSI_MOMENTUM: return "RSI Momentum";
      case Strategy.SMA_CROSSOVER: return "SMA Crossover";
      case Strategy.EMA_CROSSOVER: return "9/20 EMA";
    }
  };

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto animate-slide-up pb-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('dashboard')} className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all group">
          <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-white" />
        </button>
        <h2 className="text-2xl font-black tracking-tight">System Settings</h2>
      </div>

      <div className="grid gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-slate-800 flex items-center justify-center text-emerald-400 shadow-xl relative z-10">
            <User className="w-10 h-10" />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-slate-900 rounded-full"></div>
          </div>
          <div className="text-center md:text-left relative z-10">
            <h3 className="text-2xl font-black text-white mb-1">{userProfile.name}</h3>
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">Pro Analyst</span>
            <p className="text-slate-500 text-sm mt-3 font-medium">Member since {userProfile.memberSince}</p>
          </div>
          <div className="md:ml-auto flex gap-3 relative z-10">
            <button 
                onClick={() => { setTempProfile(userProfile); setIsEditingProfile(true); }}
                className="px-6 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all shadow-lg flex items-center gap-2"
            >
                <Edit3 className="w-3 h-3" /> Edit Profile
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 md:p-8 shadow-xl">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield className="w-3 h-3" /> Account Security
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 flex items-center gap-4">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Mail className="w-4 h-4" /></div>
                <div className="flex-1">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Email Address</span>
                  <span className="text-sm font-bold text-slate-200">{userProfile.email}</span>
                </div>
              </div>
              <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 flex items-center gap-4">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><CreditCard className="w-4 h-4" /></div>
                <div className="flex-1">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Subscription</span>
                  <span className="text-sm font-bold text-slate-200">Pro Tier ($99/mo)</span>
                </div>
                <span className="text-[10px] font-black text-emerald-400">ACTIVE</span>
              </div>
              <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 flex items-center gap-4">
                <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400"><Shield className="w-4 h-4" /></div>
                <div className="flex-1">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Exchange API Key</span>
                  <span className="text-sm font-bold text-slate-200">{userProfile.apiKey}</span>
                </div>
                <button 
                  onClick={() => { setTempProfile(userProfile); setIsEditingProfile(true); }}
                  className="text-[10px] font-bold text-slate-400 hover:text-white underline"
                >
                  Rotate
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 md:p-8 shadow-xl">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Settings className="w-3 h-3" /> Preferences
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Trade Notifications', icon: <Bell className="w-4 h-4" />, active: true },
                { label: '2FA Authentication', icon: <Shield className="w-4 h-4" />, active: true },
                { label: 'Public Leaderboard', icon: <Globe className="w-4 h-4" />, active: false },
                { label: 'Dark Mode', icon: <Info className="w-4 h-4" />, active: true }
              ].map((pref, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-950/30 rounded-2xl transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${pref.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{pref.icon}</div>
                    <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{pref.label}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-all ${pref.active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${pref.active ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={handleSignOut}
              className="w-full mt-6 py-4 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 rounded-xl text-xs font-black text-rose-400 hover:text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // LANDING PAGE RENDER
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden font-sans text-slate-100">
         {/* Left Side: Market Watchlist */}
         <div className="flex-1 md:max-w-md lg:max-w-lg border-r border-slate-800 bg-slate-900/50 flex flex-col h-screen">
             <div className="p-8 border-b border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20"><TrendingUp className="w-8 h-8 text-slate-950" /></div>
                    <div><h1 className="text-2xl font-black tracking-tighter">Gemini<span className="text-emerald-400">Quant</span></h1><span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Public Data Feed</span></div>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Live Market Matrix</span>
                <div className="space-y-3">
                    {watchlist.map(item => (
                        <div key={item.symbol} className="w-full p-4 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-slate-300 group-hover:text-emerald-400 transition-colors">{item.name}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%</span>
                        </div>
                        <div className="text-xl font-black mono text-slate-100 group-hover:tracking-wider transition-all">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                    ))}
                </div>
             </div>
             <div className="p-6 border-t border-slate-800 bg-slate-900/80">
                 <div className="text-[10px] font-bold text-slate-500 text-center leading-relaxed">
                     Real-time market data simulation powered by Gemini AI engine. <br/> Sign in to access trading terminals.
                 </div>
             </div>
         </div>

         {/* Right Side: Auth Form */}
         <div className="flex-1 relative flex items-center justify-center p-8 bg-slate-950">
             {/* Background Effects */}
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
             
             <div className="relative z-10 w-full max-w-md">
                 <Auth />
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-x-hidden font-sans">
      {/* Modals remain the same... */}
      {financialModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black mb-6 uppercase tracking-widest flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              {financialModal.type === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
            </h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Enter Amount ($)</label>
                <input 
                  type="number" 
                  value={modalAmount} 
                  onChange={(e) => setModalAmount(e.target.value)} 
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xl font-black mono text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setFinancialModal({ ...financialModal, isOpen: false })} 
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleFinancialAction} 
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ... Other modals (targetModal, profileModal, resetConfirm) are unchanged ... */}
      {targetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-slide-up">
            <h3 className="text-xl font-black mb-6 uppercase tracking-widest flex items-center gap-3">
              <Target className="w-6 h-6 text-emerald-400" />
              Adjust Targets: {targetModal.symbol}
            </h3>
            <div className="space-y-6">
              {/* Take Profit Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase block">Take Profit</label>
                    <div className="flex gap-4 text-xs font-black">
                         {(() => {
                            const roi = getRoiFromPrice(parseFloat(targetModal.tpPrice) || targetModal.entryPrice, targetModal.entryPrice, targetModal.leverage, targetModal.type);
                            return <span className="text-emerald-400">{isNaN(roi) ? '0.00' : roi.toFixed(2)}% ROI</span>;
                         })()}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={targetModal.tpPrice}
                      onChange={(e) => setTargetModal({...targetModal, tpPrice: e.target.value})}
                      className="w-24 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-black text-emerald-400 outline-none focus:border-emerald-500"
                      placeholder="Price"
                    />
                    <input 
                      type="range" 
                      min="5" 
                      max="300" 
                      step="5" 
                      value={(() => {
                           const roi = getRoiFromPrice(parseFloat(targetModal.tpPrice) || targetModal.entryPrice, targetModal.entryPrice, targetModal.leverage, targetModal.type);
                           return isNaN(roi) ? 5 : Math.max(5, roi);
                      })()}
                      onChange={(e) => {
                          const newRoi = parseFloat(e.target.value);
                          setTargetModal({
                              ...targetModal, 
                              tpPrice: getPriceFromRoi(newRoi, targetModal.entryPrice, targetModal.leverage, targetModal.type).toFixed(2)
                          });
                      }}
                      className="flex-1 h-2 bg-slate-800 rounded-full appearance-none accent-emerald-500 cursor-pointer"
                    />
                </div>
              </div>

              {/* Stop Loss Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase block">Stop Loss</label>
                     <div className="flex gap-4 text-xs font-black">
                         {(() => {
                            const roi = getRoiFromPrice(parseFloat(targetModal.slPrice) || targetModal.entryPrice, targetModal.entryPrice, targetModal.leverage, targetModal.type);
                            return <span className="text-rose-400">{isNaN(roi) ? '0.00' : Math.abs(roi).toFixed(2)}% ROI</span>;
                         })()}
                    </div>
                </div>
                 <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={targetModal.slPrice}
                      onChange={(e) => setTargetModal({...targetModal, slPrice: e.target.value})}
                      className="w-24 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-black text-rose-400 outline-none focus:border-rose-500"
                      placeholder="Price"
                    />
                    <input 
                      type="range" 
                      min="1" 
                      max="95" 
                      step="1" 
                      value={(() => {
                           const roi = getRoiFromPrice(parseFloat(targetModal.slPrice) || targetModal.entryPrice, targetModal.entryPrice, targetModal.leverage, targetModal.type);
                           return isNaN(roi) ? 1 : Math.abs(roi);
                      })()}
                      onChange={(e) => {
                          const newRoiMag = parseFloat(e.target.value);
                          // SL is negative ROI
                          setTargetModal({
                              ...targetModal, 
                              slPrice: getPriceFromRoi(-newRoiMag, targetModal.entryPrice, targetModal.leverage, targetModal.type).toFixed(2)
                          });
                      }}
                      className="flex-1 h-2 bg-slate-800 rounded-full appearance-none accent-rose-500 cursor-pointer"
                    />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setTargetModal(null)} 
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveTargets} 
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Targets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-slide-up">
                 <h3 className="text-xl font-black mb-6 uppercase tracking-widest flex items-center gap-3">
                  <User className="w-6 h-6 text-emerald-400" />
                  Edit Profile
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Display Name</label>
                        <input 
                            value={tempProfile.name}
                            onChange={e => setTempProfile({...tempProfile, name: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Email Address</label>
                        <input 
                            value={tempProfile.email}
                            onChange={e => setTempProfile({...tempProfile, email: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Exchange API Key (Simulated)</label>
                        <input 
                            value={tempProfile.apiKey}
                            onChange={e => setTempProfile({...tempProfile, apiKey: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-4 mt-6">
                        <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all">Cancel</button>
                        <button onClick={handleProfileUpdate} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-rose-500/30 p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black mb-4 uppercase tracking-widest text-rose-400 flex items-center gap-3">
              <RotateCcw className="w-6 h-6" />
              Reset System?
            </h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              This will permanently wipe all trade history, account funds, and performance data. The system will revert to the initial $10,000 seed.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setResetConfirmOpen(false)} 
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleResetSystem} 
                className="flex-1 py-4 bg-rose-500 hover:bg-rose-400 text-slate-950 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-[100]">
        <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /><h1 className="text-sm font-black tracking-tighter">Gemini<span className="text-emerald-400">Quant</span></h1></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setView('settings')} className="p-2 bg-slate-800 rounded-lg text-slate-400"><Settings className="w-5 h-5" /></button>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg">{isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
        </div>
      </div>

      {/* Sidebar (unchanged content, skipping repetition for brevity) */}
      <aside className={`fixed inset-0 z-50 md:relative md:flex md:translate-x-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-full md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 overflow-hidden`}>
        <div className="p-6 border-b border-slate-800 hidden md:block">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl"><TrendingUp className="w-8 h-8 text-slate-950" /></div>
            <div><h1 className="text-2xl font-black tracking-tighter">Gemini<span className="text-emerald-400">Quant</span></h1><span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Alpha v11.0</span></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
          <div className="px-2 mb-1 flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase">Market Watchlist</span><BarChart4 className="w-4 h-4 text-slate-700" /></div>
          {watchlist.map(item => (
            <button key={item.symbol} onClick={() => handleSymbolChange(item.symbol)} className={`w-full p-3 rounded-xl border transition-all text-left ${currentSymbol === item.symbol ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900/20 border-slate-800 hover:border-slate-700'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[11px] font-black ${currentSymbol === item.symbol ? 'text-emerald-400' : 'text-slate-400'}`}>{item.name}</span>
                <span className={`text-[9px] font-bold ${item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%</span>
              </div>
              <div className="text-sm font-black mono text-slate-100">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </button>
          ))}
        </div>

        <div className="p-4 bg-slate-800/20 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${mode === TradingMode.AUTO ? 'bg-emerald-500/20' : 'bg-slate-700/50'}`}><Cpu className={`w-4 h-4 ${mode === TradingMode.AUTO ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} /></div>
              <div className="flex flex-col"><span className="text-[11px] font-black text-slate-200">Autopilot</span><span className="text-[9px] text-slate-500 font-bold uppercase">{mode === TradingMode.AUTO ? 'ON' : 'OFF'}</span></div>
            </div>
            <div onClick={() => setMode(prev => prev === TradingMode.MANUAL ? TradingMode.AUTO : TradingMode.MANUAL)} className={`w-10 h-5 rounded-full relative cursor-pointer transition-all p-0.5 ${mode === TradingMode.AUTO ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-all ${mode === TradingMode.AUTO ? 'translate-x-5' : 'translate-x-0'}`} /></div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => { setView('dashboard'); runAutopilotEngine(); }} disabled={isAnalyzing} className="py-3 bg-slate-950 border border-slate-800 rounded-xl text-[9px] font-black transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 uppercase tracking-widest hover:bg-slate-900"><RefreshCcw className={`w-3 h-3 text-emerald-400 ${isAnalyzing ? 'animate-spin' : ''}`} /> Analysis</button>
            <button onClick={() => setResetConfirmOpen(true)} className="py-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-[9px] font-black text-rose-400 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-widest hover:bg-rose-500/10"><RotateCcw className="w-3 h-3" /> Reset</button>
          </div>

          <div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Trading Engine</span>
            <div className="grid grid-cols-2 gap-2">
              {[Strategy.AI_GEMINI, Strategy.RSI_MOMENTUM, Strategy.SMA_CROSSOVER, Strategy.EMA_CROSSOVER].map(s => (
                <button 
                  key={s} 
                  onClick={() => setActiveStrategy(s)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${activeStrategy === s ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                >
                  {getStrategyIcon(s)}
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase leading-none">{getStrategyName(s)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-slate-950 p-3 md:p-6 lg:p-8 overflow-y-auto min-h-screen relative">
        {view === 'dashboard' ? (
          <>
            {/* Top Right User Info & Settings */}
            <div className="absolute top-6 right-6 lg:right-8 z-10 hidden md:flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
                 <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                    <User className="w-3.5 h-3.5" />
                 </div>
                 <span className="text-xs font-bold text-slate-300">{userProfile.name}</span>
              </div>
              <button onClick={() => setView('settings')} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 md:gap-10 mb-8 md:mb-12">
              <div>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-black tracking-tighter">Exchange Terminal <span className="text-slate-700">PR0</span></h2>
                <div className="mt-4 flex flex-wrap gap-2">
                   {isLive ? (
                        <div className="inline-flex items-center gap-3 text-[10px] font-black px-4 py-2 rounded-xl border border-emerald-500/20 text-emerald-500 bg-emerald-500/5">
                            <Wifi className="w-3 h-3" />
                            <span>DATA FEED: LIVE</span>
                        </div>
                   ) : (
                        <div className="inline-flex items-center gap-3 text-[10px] font-black px-4 py-2 rounded-xl border border-rose-500/20 text-rose-500 bg-rose-500/5">
                            <WifiOff className="w-3 h-3" />
                            <span>DATA FEED: SIMULATED</span>
                        </div>
                   )}
                   <div className="inline-flex items-center gap-3 text-[10px] font-black px-4 py-2 rounded-xl border border-blue-500/20 text-blue-400 bg-blue-500/5">
                        <Cloud className="w-3 h-3" />
                        <span>CLOUD SYNC: ACTIVE</span>
                   </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full xl:w-auto">
                <div className="px-6 py-5 bg-slate-900/50 border border-slate-800 rounded-3xl flex flex-col items-end shadow-2xl w-full">
                  <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Total Equity</span>
                  <span className="text-xl md:text-2xl font-black mono text-white">${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                
                <div className="px-6 py-5 bg-slate-900/50 border border-slate-800 rounded-[2rem] flex flex-col items-end shadow-2xl w-full relative group border-emerald-500/20">
                  <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-3">Available Cash</span>
                  <div className="flex flex-col items-end gap-3 w-full">
                    <span className="text-xl md:text-2xl font-black mono text-emerald-400">${Math.max(0, portfolio.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <div className="flex items-center gap-2 w-full">
                      <button onClick={() => setFinancialModal({isOpen: true, type: 'deposit'})} className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-[9px] font-black rounded-xl transition-all border border-emerald-500/20 uppercase tracking-tighter shadow-lg">
                        <ArrowDownLeft className="w-3 h-3" /> Deposit
                      </button>
                      <button onClick={() => setFinancialModal({isOpen: true, type: 'withdraw'})} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-black rounded-xl transition-all border border-slate-700 uppercase tracking-tighter shadow-lg">
                        <ArrowUpRight className="w-3 h-3" /> Withdraw
                      </button>
                    </div>
                  </div>
                </div>

                {portfolio.positions.length > 0 && (
                  <div className={`px-6 py-5 border rounded-3xl flex flex-col items-end shadow-2xl w-full sm:col-span-2 lg:col-span-1 ${totalUnrealizedPnL >= 0 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
                    <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Unrealized PnL</span>
                    <span className={`text-xl md:text-2xl font-black mono ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8 md:mb-12">
              <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-8 shadow-2xl flex flex-col gap-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-3"><PieChart className="w-4 h-4" /> Operations Audit</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                  <div className="bg-slate-950 p-4 md:p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Alpha Win Rate</span><div className="text-lg md:text-2xl font-black text-emerald-400">{stats.winRate.toFixed(1)}%</div></div>
                  <div className="bg-slate-950 p-4 md:p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Total Ops</span><div className="text-lg md:text-2xl font-black text-blue-400">{stats.total}</div></div>
                  <div className="bg-slate-950 p-4 md:p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Drawdown</span><div className="text-lg md:text-2xl font-black text-rose-400">0.00%</div></div>
                  <div className="bg-slate-950 p-4 md:p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Risk Rating</span><div className="text-lg md:text-2xl font-black text-slate-200">Tier 1</div></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col xl:grid xl:grid-cols-12 gap-6 md:gap-10 mb-12">
              <div className="order-1 xl:col-span-8 flex flex-col gap-6 md:gap-10">
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-4 md:p-8 shadow-2xl flex flex-col transition-all h-[450px] md:h-[600px] lg:h-[700px]">
                  <TradingChart 
                    timeframe={timeframe} 
                    onTimeframeChange={setTimeframe} 
                    currentSymbol={currentSymbol} 
                    onSymbolChange={handleSymbolChange} 
                    availablePairs={AVAILABLE_PAIRS}
                    activeStrategy={activeStrategy}
                  />
                </div>
                {/* ... (Rest of dashboard: Open Positions, Neural Analysis, etc.) ... */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-8 shadow-2xl transition-all">
                  <div 
                    className="flex items-center justify-between cursor-pointer group mb-6"
                    onClick={() => setIsOpenPositionsExpanded(!isOpenPositionsExpanded)}
                  >
                    <h3 className="font-black text-xl flex items-center gap-4 text-emerald-400">
                      <Target className="w-6 h-6" /> Open Positions
                    </h3>
                    <div className="flex items-center gap-3">
                       {portfolio.positions.length > 0 && (
                          <div className={`text-sm font-black mono px-3 py-1.5 rounded-lg border flex items-center gap-2 ${totalUnrealizedPnL >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              <span>{totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}</span>
                              <span className="opacity-75">
                                ({totalMarginLocked > 0 ? ((totalUnrealizedPnL / totalMarginLocked) * 100).toFixed(2) : '0.00'}%)
                              </span>
                          </div>
                       )}
                       <button className={`p-2 bg-slate-800 rounded-xl text-slate-400 transition-transform duration-300 ${isOpenPositionsExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                       </button>
                    </div>
                  </div>

                  {isOpenPositionsExpanded && (
                      <div className="animate-slide-up">
                        {portfolio.positions.length > 0 ? (
                            <>
                            <div className="overflow-x-auto custom-scrollbar pb-4 mb-4">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="text-[10px] uppercase font-black text-slate-500 border-b border-slate-800">
                                        <th className="pb-4 pl-4 w-[200px]">Asset Matrix</th>
                                        <th className="pb-4 w-[120px]">Quantity</th>
                                        <th className="pb-4 w-[200px]">Entry / Liq</th>
                                        <th className="pb-4 w-[260px]">Targets (TP / SL)</th>
                                        <th className="pb-4 w-[180px]">Unrealized PnL</th>
                                        <th className="pb-4 pr-4 text-right">Manage</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-bold">
                                {portfolio.positions.map(pos => {
                                    const mark = priceMap[pos.symbol] || pos.entryPrice;
                                    const diff = mark - pos.entryPrice;
                                    const pnl = diff * pos.amount * (pos.type === 'LONG' ? 1 : -1);
                                    
                                    const marginLocked = (pos.entryPrice * pos.amount) / pos.leverage;
                                    const liqPrice = pos.type === 'LONG' 
                                        ? pos.entryPrice * (1 - (1/pos.leverage) + 0.005) 
                                        : pos.entryPrice * (1 + (1/pos.leverage) - 0.005);
                                    
                                    const tpPct = pos.takeProfitPct ?? takeProfitPct;
                                    const slPct = pos.stopLossPct ?? stopLossPct;
                                    const roi = (pnl / marginLocked) * 100;

                                    return (
                                    <tr key={pos.id} className="border-b border-slate-800/40 hover:bg-slate-900/60 transition-colors">
                                        <td className="py-5 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${pos.type === 'LONG' ? 'bg-emerald-500' : 'bg-rose-500'} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                                                <div className="flex flex-col">
                                                    <span className="text-slate-200 leading-none mb-1">{pos.symbol}</span>
                                                    <span className={`text-[9px] ${pos.type === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>{pos.type} {pos.leverage}X</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5 font-mono text-slate-400">{pos.amount}</td>
                                        <td className="py-5 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-slate-300 font-bold">${pos.entryPrice.toLocaleString()}</span>
                                                <span className="font-mono text-rose-400/80 text-[10px] mt-1">Liq: ${liqPrice > 0 ? liqPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="py-5">
                                            <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
                                                {/* TP Row */}
                                                <div className="flex items-center justify-between text-[10px] bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                                                    <span className="font-black text-emerald-500">TP</span>
                                                    <div className="flex items-center gap-2 font-mono">
                                                        <span className="text-emerald-400 font-bold">{tpPct.toFixed(2)}%</span>
                                                        <span className="text-slate-600">|</span>
                                                        <span className="text-slate-400">${getPriceFromRoi(tpPct, pos.entryPrice, pos.leverage, pos.type).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                                {/* SL Row */}
                                                <div className="flex items-center justify-between text-[10px] bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10">
                                                    <span className="font-black text-rose-500">SL</span>
                                                    <div className="flex items-center gap-2 font-mono">
                                                        <span className="text-rose-400 font-bold">{slPct.toFixed(2)}%</span>
                                                        <span className="text-slate-600">|</span>
                                                        <span className="text-slate-400">${getPriceFromRoi(-slPct, pos.entryPrice, pos.leverage, pos.type).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5">
                                             <div className={`font-mono text-base ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                 {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                             </div>
                                             <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                                 {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                                             </div>
                                        </td>
                                        <td className="py-5 pr-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button 
                                                    onClick={() => setTargetModal({ 
                                                        isOpen: true, 
                                                        positionId: pos.id, 
                                                        symbol: pos.symbol,
                                                        tpPrice: getPriceFromRoi(pos.takeProfitPct ?? takeProfitPct, pos.entryPrice, pos.leverage, pos.type).toFixed(2), 
                                                        slPrice: getPriceFromRoi(-(pos.stopLossPct ?? stopLossPct), pos.entryPrice, pos.leverage, pos.type).toFixed(2),
                                                        entryPrice: pos.entryPrice,
                                                        leverage: pos.leverage,
                                                        type: pos.type
                                                    })}
                                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all border border-slate-700/50"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleClosePosition(pos.id)} className="h-8 px-4 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50 text-slate-400 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider border border-slate-700/50">Close</button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                            </div>
                            <div className="flex justify-end pt-4 border-t border-slate-800">
                                <button onClick={handleExitAll} className="px-8 py-4 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-[10px] font-black rounded-xl border border-slate-700/50 hover:border-rose-500/50 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg"><Ban className="w-4 h-4" /> Exit All Trades</button>
                            </div>
                            </>
                        ) : (<div className="py-20 text-center text-slate-600 uppercase font-black text-xs tracking-[0.2em] opacity-30"><Layers className="w-16 h-16 mx-auto mb-6" /> No Active Signal Detected</div>)}
                      </div>
                  )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-12 shadow-2xl transition-all">
                  <div 
                    className="flex items-center justify-between cursor-pointer group mb-10"
                    onClick={() => setIsNeuralAnalysisExpanded(!isNeuralAnalysisExpanded)}
                  >
                    <h3 className="font-black text-2xl flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400"><Cpu className="w-6 h-6" /></div> Neural Market Synthesis
                    </h3>
                    <button className={`p-2 bg-slate-800 rounded-xl text-slate-400 transition-transform duration-300 ${isNeuralAnalysisExpanded ? 'rotate-180' : ''}`}>
                         <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {isNeuralAnalysisExpanded && (
                      <div className="animate-slide-up">
                        {lastAnalysis ? (
                            <div className="flex flex-col gap-10">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
                                <div className="md:col-span-4 p-8 bg-slate-950 border border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-center shadow-xl">
                                <span className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-[0.2em]">{lastAnalysis.strategyUsed || 'Signal Matrix'}</span>
                                <span className={`text-4xl font-black mb-4 ${lastAnalysis.action === 'BUY' ? 'text-emerald-400' : lastAnalysis.action === 'SELL' ? 'text-rose-400' : 'text-blue-400'}`}>{lastAnalysis.action}</span>
                                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${lastAnalysis.action === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${lastAnalysis.confidence * 100}%` }} /></div>
                                <span className="mt-3 text-[10px] font-black text-slate-500">PROBABILITY Index: {(lastAnalysis.confidence * 100).toFixed(0)}%</span>
                                </div>
                                <div className="md:col-span-8 p-10 bg-slate-950/40 border border-slate-800 rounded-[2rem] shadow-inner">
                                <span className="text-[10px] font-black text-slate-500 mb-4 block uppercase tracking-widest flex items-center gap-2"><Info className="w-4 h-4" /> Engine Commentary</span>
                                <p className="text-base text-slate-400 leading-relaxed font-medium italic border-l-2 border-slate-800 pl-8">"{lastAnalysis.reasoning}"</p>
                                </div>
                            </div>
                            </div>
                        ) : (<div className="py-20 text-center text-slate-700 font-black text-xs uppercase tracking-widest opacity-40 animate-pulse"><RefreshCcw className="w-8 h-8 mx-auto mb-4 animate-spin" /> Deep Signal Parsing...</div>)}
                      </div>
                  )}
                </div>
              </div>

              {/* Order Management Panel - OVERHAULED UI */}
              <div className="order-2 xl:col-span-4 flex flex-col gap-6 md:gap-10">
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-5 md:p-6 shadow-2xl xl:sticky xl:top-10">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="font-black text-lg flex items-center gap-2">
                        <Coins className="w-5 h-5 text-emerald-400" /> Order Entry
                      </h3>
                      <div className="bg-slate-950 p-1 rounded-lg flex text-[10px] font-bold border border-slate-800">
                           <button 
                             onClick={() => setOrderType('MARKET')}
                             className={`px-4 py-1.5 rounded-md transition-all ${orderType === 'MARKET' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                           >
                             MARKET
                           </button>
                           <button 
                             onClick={() => setOrderType('LIMIT')}
                             className={`px-4 py-1.5 rounded-md transition-all ${orderType === 'LIMIT' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                           >
                             LIMIT
                           </button>
                      </div>
                  </div>
                  
                  {/* Symbol Header */}
                  <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-slate-950 to-slate-900 p-4 rounded-xl border border-slate-800 shadow-inner">
                       <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black text-xs text-slate-400 border border-slate-700">
                               {currentSymbol.substring(0,1)}
                           </div>
                           <div>
                               <span className="text-sm font-black text-white block">{currentSymbol}</span>
                               <span className="text-[10px] font-bold text-slate-500 block">Perpetual Contract</span>
                           </div>
                       </div>
                       <span className="text-3xl font-mono text-emerald-400 font-bold">${currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  {/* Leverage Selector - Improved Pills */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Leverage</label>
                      <span className="text-xs font-black text-emerald-400 mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{selectedLeverage}x</span>
                    </div>
                    
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 custom-scrollbar">
                        {[1, 5, 10, 20, 50, 100, 125].map(lev => (
                            <button 
                                key={lev}
                                onClick={() => setSelectedLeverage(lev)}
                                className={`flex-1 min-w-[3rem] py-1.5 rounded-full text-[10px] font-black border transition-all ${selectedLeverage === lev ? 'bg-slate-100 text-slate-900 border-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}
                            >
                                {lev}x
                            </button>
                        ))}
                    </div>
                    
                    <div className="relative h-6 flex items-center">
                        <input 
                        type="range" 
                        min="1" 
                        max="125" 
                        value={selectedLeverage} 
                        onChange={(e) => setSelectedLeverage(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                        />
                    </div>
                  </div>

                  {/* Lot Size & Margin - Better Inputs */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Position Size</label>
                      <div className="relative group">
                          <input 
                            type="number" 
                            value={lotSize}
                            onChange={(e) => setLotSize(e.target.value)}
                            step="0.01"
                            min="0.01"
                            className="w-full bg-slate-950 border border-slate-800 group-hover:border-slate-700 rounded-xl p-4 text-base font-bold text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all font-mono"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 bg-slate-900 px-2 py-1 rounded">UNITS</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                        <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2"><Wallet className="w-3 h-3" /> Margin Required</span>
                        <span className="text-sm font-mono font-bold text-slate-200">${estimatedMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* TP / SL Settings - Improved Sliders */}
                   <div className="bg-slate-950/30 p-4 rounded-2xl border border-slate-800/50 mb-6 space-y-5">
                       <div>
                           <div className="flex justify-between mb-2">
                                <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> Take Profit</span>
                                <span className="text-[10px] font-mono font-bold text-slate-300">{takeProfitPct}% ROI</span>
                           </div>
                           <input 
                            type="range" 
                            min="1" max="500" step="1"
                            value={takeProfitPct}
                            onChange={(e) => setTakeProfitPct(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                          />
                       </div>
                       <div>
                           <div className="flex justify-between mb-2">
                                <span className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" /> Stop Loss</span>
                                <span className="text-[10px] font-mono font-bold text-slate-300">{stopLossPct}% ROI</span>
                           </div>
                           <input 
                            type="range" 
                            min="1" max="95" step="1"
                            value={stopLossPct}
                            onChange={(e) => setStopLossPct(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400"
                          />
                       </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => executeTrade('BUY', currentPrice, 'Manual Long')} 
                      disabled={portfolio.cash < estimatedMargin || currentPrice === 0}
                      className="group relative overflow-hidden py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 border-b-4 border-emerald-800 hover:border-emerald-700 active:border-0 active:translate-y-1"
                    >
                      <span className="text-sm flex items-center gap-2 relative z-10">Buy / Long <ArrowUpRight className="w-4 h-4" /></span>
                      <span className="text-[9px] opacity-70 font-mono relative z-10 text-emerald-100">{currentPrice > 0 ? currentPrice.toFixed(2) : '---'}</span>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    </button>
                    
                    <button 
                      onClick={() => executeTrade('SELL', currentPrice, 'Manual Short')} 
                      disabled={portfolio.cash < estimatedMargin || currentPrice === 0}
                      className="group relative overflow-hidden py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-rose-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 border-b-4 border-rose-800 hover:border-rose-700 active:border-0 active:translate-y-1"
                    >
                      <span className="text-sm flex items-center gap-2 relative z-10">Sell / Short <ArrowDownLeft className="w-4 h-4" /></span>
                      <span className="text-[9px] opacity-70 font-mono relative z-10 text-rose-100">{currentPrice > 0 ? currentPrice.toFixed(2) : '---'}</span>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    </button>
                  </div>
                </div>

                {/* Trade History - REDESIGNED CARDS BELOW ORDER ENTRY */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-8 shadow-2xl transition-all">
                  <div 
                    className="flex items-center justify-between cursor-pointer group mb-6"
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  >
                    <h3 className="font-black text-xl flex items-center gap-4 text-slate-200">
                      <History className="w-6 h-6 text-blue-400" /> Trade History
                    </h3>
                     <div className="flex items-center gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters); }}
                            className={`p-2 rounded-lg transition-all ${showFilters ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                         <button onClick={(e) => { e.stopPropagation(); handleDownloadHistory(); }} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wide"><Download className="w-4 h-4" /></button>
                         <button className={`p-2 bg-slate-800 rounded-xl text-slate-400 transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                       </button>
                     </div>
                  </div>

                  {isHistoryExpanded && (
                    <div className="animate-slide-up">
                        {showFilters && (
                            <div className="mb-6 p-4 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 animate-slide-up">
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Type</label>
                                    <select value={historyFilterType} onChange={e => setHistoryFilterType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-slate-300 outline-none">
                                        <option value="ALL">All Sides</option>
                                        <option value="BUY">Long / Buy</option>
                                        <option value="SELL">Short / Sell</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Result</label>
                                    <select value={historyFilterPnL} onChange={e => setHistoryFilterPnL(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-slate-300 outline-none">
                                        <option value="ALL">All Results</option>
                                        <option value="PROFIT">Win Only</option>
                                        <option value="LOSS">Loss Only</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">From Date</label>
                                    <input type="date" value={historyFilterStartDate} onChange={e => setHistoryFilterStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-slate-300 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">To Date</label>
                                    <input type="date" value={historyFilterEndDate} onChange={e => setHistoryFilterEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-slate-300 outline-none" />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            {displayedTrades.length > 0 ? displayedTrades.map((trade) => {
                                const isProfit = trade.pnl && trade.pnl > 0;
                                const isLoss = trade.pnl && trade.pnl < 0;
                                const isOpen = trade.pnl === undefined || trade.pnl === null;
                                
                                // Estimation for ROI% for display purposes if not stored
                                const marginUsed = (trade.price * trade.amount) / trade.leverage;
                                const roi = trade.pnl ? (trade.pnl / marginUsed) * 100 : 0;

                                return (
                                <div key={trade.id} className="p-5 rounded-[1.5rem] bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-all group shadow-sm hover:shadow-md">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                                {trade.type === 'BUY' ? 'BUY' : 'SELL'}
                                            </span>
                                            <span className="text-sm font-black text-white">{trade.symbol}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-500 text-right leading-tight">
                                            {trade.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} <span className="mx-1 text-slate-700">|</span> {trade.timestamp.toLocaleDateString()}
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="text-xl font-black text-white tracking-tight">
                                            ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-slate-500 mb-1">Qty: {trade.amount}</div>
                                            {!isOpen ? (
                                                <div className={`text-sm font-black font-mono ${isProfit ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}`}>
                                                    {isProfit ? '+' : ''}${trade.pnl?.toFixed(2)} <span className="opacity-75 text-xs">({isProfit ? '+' : ''}{roi.toFixed(2)}%)</span>
                                                </div>
                                            ) : (
                                                <div className="text-xs font-black text-blue-400 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Active Order</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="text-[10px] font-medium text-slate-600 italic border-t border-slate-800/50 pt-3 mt-1">
                                        {trade.reasoning}
                                    </div>
                                </div>
                                )
                            }) : (
                                <div className="py-12 text-center text-slate-600 uppercase font-black text-[10px] tracking-widest opacity-50 bg-slate-950/30 rounded-2xl border border-slate-800/50 border-dashed">No trading records found</div>
                            )}
                        </div>
                        
                        {/* Pagination */}
                        {totalHistoryPages > 1 && (
                            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
                                <button 
                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                    disabled={historyPage === 1}
                                    className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 disabled:opacity-30 hover:bg-slate-800 text-[10px] font-bold uppercase transition-all"
                                >
                                    Previous
                                </button>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">Page {historyPage} of {totalHistoryPages}</span>
                                <button 
                                    onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                    disabled={historyPage === totalHistoryPages}
                                    className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 disabled:opacity-30 hover:bg-slate-800 text-[10px] font-bold uppercase transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          renderSettings()
        )}
      </main>

      {/* Notifications */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n, i) => (
          <div key={i} className={`p-4 rounded-xl shadow-2xl backdrop-blur-md border animate-slide-left flex items-center gap-3 pointer-events-auto min-w-[300px] ${
            n.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400' : 
            n.type === 'error' ? 'bg-rose-950/80 border-rose-500/30 text-rose-400' : 
            'bg-slate-900/80 border-slate-700 text-slate-200'
          }`}>
            {n.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : n.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Info className="w-5 h-5 shrink-0" />}
            <span className="text-xs font-bold">{n.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
