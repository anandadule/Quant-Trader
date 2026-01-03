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
  Globe
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TradingChart } from './components/TradingChart';
import { PriceData, Trade, Portfolio, TradingMode, AIAnalysis, EquityPoint, WatchlistItem, Strategy } from './types';
import { 
  fetchHistoricalData, 
  fetchLatestQuote, 
  fetchTicker,
  mergeQuote 
} from './services/marketSim';
import { analyzeMarket } from './services/geminiService';

const INITIAL_CASH = 10000;
const STORAGE_KEY = 'gemini_quant_pro_v11_strategies';
const MAINTENANCE_MARGIN_PCT = 0.05;

const AVAILABLE_PAIRS = [
  { symbol: 'BTCUSDT', name: 'BTC/USD' },
  { symbol: 'ETHUSDT', name: 'ETH/USD' },
  { symbol: 'ADAUSDT', name: 'ADA/USD' },
  { symbol: 'NIFTY', name: 'Nifty 50' },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty' },
  { symbol: 'SOLUSDT', name: 'SOL/USD' },
  { symbol: 'RELIANCE', name: 'Reliance' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AAPL', name: 'Apple' },
];

const getSavedItem = (key: string, defaultValue: any) => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultValue;
  try {
    const parsed = JSON.parse(saved);
    const value = parsed[key];
    if (value === undefined) return defaultValue;
    if (key === 'trades') {
      return value.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }));
    }
    return value;
  } catch (e) { return defaultValue; }
};

export default function App() {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => 
    getSavedItem('portfolio', { cash: INITIAL_CASH, assets: 0, initialValue: INITIAL_CASH, avgEntryPrice: 0 })
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
  
  // Background price state for position when not viewing the same chart
  const [bgPrice, setBgPrice] = useState<number>(0);

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

  const marketInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const notify = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotifications(prev => [{ msg, type }, ...prev].slice(0, 5));
  }, []);

  // Symbol Change Handler - Allowed now
  const handleSymbolChange = useCallback((symbol: string) => {
    setCurrentSymbol(symbol);
    setIsSidebarOpen(false);
    setView('dashboard');
  }, []);

  const currentPrice = useMemo(() => marketData.length > 0 ? marketData[marketData.length - 1].price : 0, [marketData]);

  // Track background price for active position if it differs from current chart
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    // Reset bgPrice if we switch back to the position symbol or if no position
    if (!portfolio.positionSymbol || portfolio.positionSymbol === currentSymbol) {
        setBgPrice(0);
        return;
    }

    if (portfolio.assets !== 0 && portfolio.positionSymbol !== currentSymbol) {
        const fetchBg = async () => {
            const t = await fetchTicker(portfolio.positionSymbol!);
            if (t) setBgPrice(t.price);
        };
        fetchBg(); // Initial fetch
        interval = setInterval(fetchBg, 2000); // Update every 2s
    }
    return () => clearInterval(interval);
  }, [portfolio.assets, portfolio.positionSymbol, currentSymbol]);

  // Determine the price to use for PnL calculations
  const activePositionPrice = useMemo(() => {
    if (!portfolio.positionSymbol) return 0;
    // If we are viewing the chart of our position, use the high-frequency chart price
    if (portfolio.positionSymbol === currentSymbol) return currentPrice;
    // Otherwise use the background fetched price, fallback to entry if loading
    return bgPrice || portfolio.avgEntryPrice;
  }, [portfolio.positionSymbol, currentSymbol, currentPrice, bgPrice, portfolio.avgEntryPrice]);
  
  const unrealizedPnL = useMemo(() => {
    if (portfolio.assets === 0) return 0;
    return (activePositionPrice - portfolio.avgEntryPrice) * portfolio.assets;
  }, [portfolio.assets, portfolio.avgEntryPrice, activePositionPrice]);

  const marginLocked = useMemo(() => portfolio.assets !== 0 ? Math.abs(portfolio.assets * portfolio.avgEntryPrice) / selectedLeverage : 0, [portfolio.assets, portfolio.avgEntryPrice, selectedLeverage]);
  const equity = useMemo(() => portfolio.cash + marginLocked + unrealizedPnL, [portfolio.cash, marginLocked, unrealizedPnL]);

  const estimatedMargin = useMemo(() => {
    const amount = parseFloat(lotSize);
    if (isNaN(amount) || amount <= 0) return 0;
    // Estimated margin uses CURRENT chart price because that's what we would buy
    return (currentPrice * amount) / selectedLeverage;
  }, [currentPrice, lotSize, selectedLeverage]);

  const liqPrice = useMemo(() => {
    if (portfolio.assets === 0) return 0;
    const isLong = portfolio.assets > 0;
    const absAssets = Math.abs(portfolio.assets);
    if (isLong) {
      return portfolio.avgEntryPrice + (marginLocked * (MAINTENANCE_MARGIN_PCT - 1) - portfolio.cash) / portfolio.assets;
    } else {
      return portfolio.avgEntryPrice - (marginLocked * (MAINTENANCE_MARGIN_PCT - 1) - portfolio.cash) / absAssets;
    }
  }, [portfolio, marginLocked]);

  const stats = useMemo(() => {
    if (trades.length === 0) return { winRate: 0, total: 0 };
    const exits = trades.filter(t => t.reasoning.includes("EXIT") || t.reasoning.includes("System Closed"));
    if (exits.length === 0) return { winRate: 0, total: trades.length };
    const wins = exits.filter(t => t.pnl && t.pnl > 0);
    return { winRate: (wins.length / exits.length) * 100, total: trades.length };
  }, [trades]);

  // Filter Logic
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      // Type Filter
      if (historyFilterType !== 'ALL' && t.type !== historyFilterType) return false;
      
      // PnL Filter
      if (historyFilterPnL === 'PROFIT') {
        if (t.pnl === undefined || t.pnl < 0) return false;
      }
      if (historyFilterPnL === 'LOSS') {
         if (t.pnl === undefined || t.pnl >= 0) return false;
      }

      // Date Filter
      const tradeDateLocal = t.timestamp.toLocaleDateString('en-CA'); 
      
      if (historyFilterStartDate && tradeDateLocal < historyFilterStartDate) return false;
      if (historyFilterEndDate && tradeDateLocal > historyFilterEndDate) return false;

      return true;
    });
  }, [trades, historyFilterType, historyFilterPnL, historyFilterStartDate, historyFilterEndDate]);

  const HISTORY_ITEMS_PER_PAGE = 10;
  const totalHistoryPages = Math.ceil(filteredTrades.length / HISTORY_ITEMS_PER_PAGE);
  const displayedTrades = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
    return filteredTrades.slice(start, start + HISTORY_ITEMS_PER_PAGE);
  }, [filteredTrades, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilterType, historyFilterPnL, historyFilterStartDate, historyFilterEndDate]);

  // Legacy state migration
  useEffect(() => {
    if (portfolio.assets !== 0 && !portfolio.positionSymbol) {
      setPortfolio(p => ({ ...p, positionSymbol: currentSymbol }));
    }
  }, []);

  const handleResetSystem = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPortfolio({ cash: INITIAL_CASH, assets: 0, initialValue: INITIAL_CASH, avgEntryPrice: 0 });
    setTrades([]);
    setEquityHistory([]);
    setLastAnalysis(null);
    setResetConfirmOpen(false);
    setHistoryPage(1);
    setHistoryFilterType('ALL');
    setHistoryFilterPnL('ALL');
    setHistoryFilterStartDate('');
    setHistoryFilterEndDate('');
    notify("System Fully Reset", "success");
  }, [notify]);

  const handleFinancialAction = useCallback(() => {
    const val = parseFloat(modalAmount);
    if (isNaN(val) || val <= 0) {
      notify("Invalid amount", "error");
      return;
    }

    if (financialModal.type === 'withdraw' && val > portfolio.cash) {
      notify("Insufficient cash balance", "error");
      return;
    }

    setPortfolio(prev => ({
      ...prev,
      cash: financialModal.type === 'deposit' ? prev.cash + val : prev.cash - val,
      initialValue: financialModal.type === 'deposit' ? prev.initialValue + val : prev.initialValue - val
    }));
    
    notify(`${financialModal.type === 'deposit' ? 'Deposited' : 'Withdrew'} $${val.toLocaleString()}`, "success");
    setFinancialModal({ ...financialModal, isOpen: false });
    setModalAmount('');
  }, [modalAmount, financialModal, portfolio.cash, notify]);
  
  const handleProfileUpdate = useCallback(() => {
    setUserProfile(tempProfile);
    setIsEditingProfile(false);
    notify("Profile settings updated", "success");
  }, [tempProfile, notify]);

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

  const handleExitAll = useCallback(() => {
    setPortfolio(prev => {
      if (Math.abs(prev.assets) < 0.000001) return prev;
      
      // We need to use the price of the asset we are closing
      // If we are on the chart of the asset, use currentPrice, else use the background tracked price
      let exitPrice = 0;
      if (prev.positionSymbol === currentSymbol) {
          exitPrice = currentPrice;
      } else {
          // Fallback to bgPrice or just fail safe to entry price if something is really wrong (shouldn't happen with the effects)
          exitPrice = bgPrice || prev.avgEntryPrice;
      }
      
      // If price is 0 or invalid, critical error prevention
      if (exitPrice <= 0) exitPrice = prev.avgEntryPrice;

      const isLong = prev.assets > 0;
      const amount = Math.abs(prev.assets);
      const profit = isLong ? (exitPrice - prev.avgEntryPrice) * amount : (prev.avgEntryPrice - exitPrice) * amount;
      const mReleased = (prev.avgEntryPrice * amount) / selectedLeverage;
      
      setTrades(t => {
        const newTrade = { 
          id: Math.random().toString(36).substr(2, 9), 
          type: isLong ? 'SELL' : 'BUY', 
          price: exitPrice, 
          amount, 
          leverage: selectedLeverage, 
          timestamp: new Date(), 
          reasoning: "System Closed Position",
          pnl: profit, 
          symbol: prev.positionSymbol || 'Unknown'
        } as Trade;
        return [newTrade, ...t];
      });
      notify(`Position Closed: ${amount.toFixed(4)} @ $${exitPrice.toLocaleString()} (Profit: $${profit.toFixed(2)})`, profit >= 0 ? 'success' : 'info');
      return { ...prev, assets: 0, avgEntryPrice: 0, cash: Math.max(0, prev.cash + mReleased + profit) };
    });
  }, [currentPrice, selectedLeverage, notify, currentSymbol, bgPrice]);

  useEffect(() => {
    if (Math.abs(portfolio.assets) > 0) {
      if (equity < marginLocked * MAINTENANCE_MARGIN_PCT) { handleExitAll(); notify("LIQUIDATION ALERT", "error"); }
      const roi = (unrealizedPnL / marginLocked) * 100;
      if (roi <= -stopLossPct || roi >= takeProfitPct) handleExitAll();
    }
  }, [equity, portfolio.assets, marginLocked, stopLossPct, takeProfitPct, unrealizedPnL, handleExitAll, notify]);

  useEffect(() => {
    const init = async () => { 
      const data = await fetchHistoricalData(currentSymbol, timeframe, 150);
      setMarketData(data); 
      setIsLive(true); 
    };
    init();

    marketInterval.current = setInterval(async () => {
      // Capture the current market data to allow simulation fallback to move price from the last close
      setMarketData(prev => {
        const fetchNext = async () => {
            const q = await fetchLatestQuote(currentSymbol, timeframe, prev);
            if (q) {
                setMarketData(current => mergeQuote(current, q));
                setIsLive(true);
            } else {
                // If simulation failed to return (shouldn't happen), stay live
                setIsLive(true);
            }
        };
        fetchNext();
        return prev;
      });
    }, 1000); 

    return () => { if (marketInterval.current) clearInterval(marketInterval.current); };
  }, [timeframe, currentSymbol]);

  const executeTrade = useCallback((action: 'BUY' | 'SELL', price: number, reasoning: string) => {
    setPortfolio(prev => {
      // Block trade if trying to trade a different symbol than the active position
      if (prev.assets !== 0 && prev.positionSymbol !== currentSymbol) {
          notify(`Cannot trade ${currentSymbol} while holding ${prev.positionSymbol}. Close position first.`, "error");
          return prev;
      }

      const amount = parseFloat(lotSize);
      if (isNaN(amount) || amount < 0.01) { notify("Minimum lot size is 0.01", "error"); return prev; }
      const marginReq = (price * amount) / selectedLeverage;
      if (prev.cash < marginReq && prev.assets === 0) { notify("Insuff. Funds", "error"); return prev; }
      const isLong = action === 'BUY';
      
      // If reversing position, close it first
      if ((isLong && prev.assets < 0) || (!isLong && prev.assets > 0)) { handleExitAll(); return prev; }
      
      setTrades(t => {
        const newTrade = { 
          id: Math.random().toString(36).substr(2, 9), 
          type: action, 
          price, 
          amount, 
          leverage: selectedLeverage, 
          timestamp: new Date(), 
          reasoning,
          symbol: currentSymbol
        } as Trade;
        return [newTrade, ...t];
      });
      notify(`${action} Order Executed: ${amount.toFixed(4)} units @ $${price.toLocaleString()}`, 'success');
      return { ...prev, assets: isLong ? prev.assets + amount : prev.assets - amount, avgEntryPrice: price, cash: prev.cash - marginReq, positionSymbol: currentSymbol };
    });
  }, [lotSize, currentSymbol, selectedLeverage, handleExitAll, notify]);

  const runAutopilotEngine = useCallback(async () => {
    if (isAnalyzing || marketData.length < 25) return;
    setIsAnalyzing(true);
    
    try {
      if (activeStrategy === Strategy.AI_GEMINI) {
        const res = await analyzeMarket(marketData, currentSymbol);
        setLastAnalysis({ ...res, strategyUsed: 'Gemini 3 Flash' });
        if (res.action !== 'HOLD' && mode === TradingMode.AUTO) {
          executeTrade(res.action as 'BUY' | 'SELL', currentPrice, res.reasoning);
        }
      } 
      else if (activeStrategy === Strategy.RSI_MOMENTUM) {
        const current = marketData[marketData.length - 1];
        const rsi = current.rsi || 50;
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let reasoning = `RSI is neutral at ${rsi.toFixed(2)}.`;
        
        if (rsi < 30) { action = 'BUY'; reasoning = `RSI Oversold (${rsi.toFixed(2)}) - Bullish Divergence`; }
        else if (rsi > 70) { action = 'SELL'; reasoning = `RSI Overbought (${rsi.toFixed(2)}) - Bearish Reversal`; }

        setLastAnalysis({ action, confidence: Math.abs(50 - rsi) / 50, reasoning, strategyUsed: 'Algorithmic RSI' });
        
        if (action !== 'HOLD' && mode === TradingMode.AUTO) {
          executeTrade(action, currentPrice, reasoning);
        }
      } 
      else if (activeStrategy === Strategy.SMA_CROSSOVER) {
        const current = marketData[marketData.length - 1];
        const prev = marketData[marketData.length - 2];
        const sma10 = current.sma10 || 0;
        const sma20 = current.sma20 || 0;
        const prevSma10 = prev?.sma10 || 0;
        const prevSma20 = prev?.sma20 || 0;

        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let reasoning = "SMA Lines are parallel. No cross detected.";
        
        if (prevSma10 <= prevSma20 && sma10 > sma20) {
           action = 'BUY'; 
           reasoning = "Golden Cross Detected (SMA10 > SMA20)";
        }
        else if (prevSma10 >= prevSma20 && sma10 < sma20) {
           action = 'SELL';
           reasoning = "Death Cross Detected (SMA10 < SMA20)";
        }

        setLastAnalysis({ action, confidence: action !== 'HOLD' ? 0.9 : 0.1, reasoning, strategyUsed: 'SMA Crossover' });
        
        if (action !== 'HOLD' && mode === TradingMode.AUTO) {
          executeTrade(action, currentPrice, reasoning);
        }
      }
      else if (activeStrategy === Strategy.EMA_CROSSOVER) {
        const current = marketData[marketData.length - 1];
        const prev = marketData[marketData.length - 2];
        const ema9 = current.ema9 || 0;
        const ema20 = current.ema20 || 0;
        const prevEma9 = prev?.ema9 || 0;
        const prevEma20 = prev?.ema20 || 0;

        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let reasoning = `EMA9 (${ema9.toFixed(2)}) and EMA20 (${ema20.toFixed(2)}) are tracking.`;

        if (prevEma9 <= prevEma20 && ema9 > ema20) {
          action = 'BUY';
          reasoning = "EMA Golden Cross (9 > 20) - Bullish Momentum.";
        }
        else if (prevEma9 >= prevEma20 && ema9 < ema20) {
          action = 'SELL';
          reasoning = "EMA Death Cross (9 < 20) - Bearish Momentum.";
        }

        setLastAnalysis({ action, confidence: action !== 'HOLD' ? 0.85 : 0.15, reasoning, strategyUsed: '9/20 EMA Strategy' });

        if (action !== 'HOLD' && mode === TradingMode.AUTO) {
           executeTrade(action, currentPrice, reasoning);
        }
      }
    } finally { setIsAnalyzing(false); }
  }, [marketData, mode, isAnalyzing, executeTrade, currentSymbol, currentPrice, activeStrategy]);

  useEffect(() => {
    if (mode === TradingMode.AUTO) {
      const intervalMs = activeStrategy === Strategy.AI_GEMINI ? 30000 : 5000;
      aiInterval.current = setInterval(runAutopilotEngine, intervalMs);
    }
    return () => { if (aiInterval.current) clearInterval(aiInterval.current); };
  }, [mode, runAutopilotEngine, activeStrategy]);

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
      userProfile 
    }));
  }, [portfolio, trades, selectedLeverage, mode, currentSymbol, stopLossPct, takeProfitPct, lotSize, equityHistory, activeStrategy, userProfile]);

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
            <button className="w-full mt-6 py-4 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 rounded-xl text-xs font-black text-rose-400 hover:text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-x-hidden font-sans">
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

      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-[100]">
        <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /><h1 className="text-sm font-black tracking-tighter">Gemini<span className="text-emerald-400">Quant</span></h1></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setView('settings')} className="p-2 bg-slate-800 rounded-lg text-slate-400"><Settings className="w-5 h-5" /></button>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg">{isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
        </div>
      </div>

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
            <div className="absolute top-6 right-6 lg:right-8 z-10 hidden md:block">
              <button onClick={() => setView('settings')} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 md:gap-10 mb-8 md:mb-12">
              <div>
                <h2 className="text-2xl md:text-3xl lg:text-5xl font-black tracking-tighter">Exchange Terminal <span className="text-slate-700">PR0</span></h2>
                <div className="mt-4 inline-flex items-center gap-3 text-[10px] font-black px-4 py-2 rounded-xl border border-slate-800/50 text-emerald-500 bg-emerald-500/5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {isLive ? 'SYSTEM STATUS: ONLINE' : 'DATA LINK: STALE'}
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

                {portfolio.assets !== 0 && (
                  <div className={`px-6 py-5 border rounded-3xl flex flex-col items-end shadow-2xl w-full sm:col-span-2 lg:col-span-1 ${unrealizedPnL >= 0 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
                    <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Unrealized PnL</span>
                    <span className={`text-xl md:text-2xl font-black mono ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8 md:mb-12">
              <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-10 shadow-2xl flex flex-col gap-6">
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
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-4 md:p-8 lg:p-10 h-[450px] md:h-[600px] lg:h-[700px] shadow-2xl flex flex-col transition-all">
                  <TradingChart timeframe={timeframe} onTimeframeChange={setTimeframe} currentSymbol={currentSymbol} onSymbolChange={handleSymbolChange} availablePairs={AVAILABLE_PAIRS} />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
                  <h3 className="font-black text-xl mb-8 flex items-center gap-4 text-emerald-400"><Target className="w-6 h-6" /> Open Positions</h3>
                  {portfolio.assets !== 0 ? (
                    <div className="overflow-x-auto custom-scrollbar pb-4">
                      <table className="w-full text-left min-w-[600px]">
                        <thead><tr className="text-[11px] uppercase font-black text-slate-500 border-b border-slate-800"><th className="pb-6 pl-4">Asset Matrix</th><th className="pb-6">Quantity</th><th className="pb-6">Entry Zone</th><th className="pb-6">Liq. Level</th><th className="pb-6">Delta PnL</th><th className="pb-6 pr-4 text-right">Ops</th></tr></thead>
                        <tbody className="text-sm font-bold">
                          <tr className="border-b border-slate-800/40">
                            <td className="py-8 pl-4 flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${portfolio.assets > 0 ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />{portfolio.positionSymbol}</td>
                            <td className="py-8 mono text-slate-200">{Math.abs(portfolio.assets).toFixed(4)}</td>
                            <td className="py-8 mono text-slate-400">${portfolio.avgEntryPrice.toLocaleString()}</td>
                            <td className="py-8 mono text-rose-400">${liqPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            <td className={`py-8 mono ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
                              <span className="text-[10px] ml-1 opacity-75">
                                ({marginLocked > 0 ? ((unrealizedPnL / marginLocked) * 100).toFixed(2) : '0.00'}%)
                              </span>
                            </td>
                            <td className="py-8 pr-4 text-right"><button onClick={handleExitAll} className="px-6 py-3 bg-slate-800 hover:bg-rose-500 hover:text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest">Close</button></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (<div className="py-20 text-center text-slate-600 uppercase font-black text-xs tracking-[0.2em] opacity-30"><Layers className="w-16 h-16 mx-auto mb-6" /> No Active Signal Detected</div>)}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-12 shadow-2xl">
                  <h3 className="font-black text-2xl mb-10 flex items-center gap-4"><div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400"><Cpu className="w-6 h-6" /></div> Neural Market Synthesis</h3>
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
              </div>

              <div className="order-2 xl:col-span-4 flex flex-col gap-6 md:gap-10">
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-5 md:p-8 lg:p-10 shadow-2xl xl:sticky xl:top-10">
                  <h3 className="font-black text-xl mb-6 md:mb-10 flex justify-between items-center"><span>Order Management</span><span className="text-[10px] font-black text-slate-600 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/50">SECURED SIM</span></h3>
                  <div className="flex flex-col gap-6 md:gap-10">
                    <div>
                      <div className="flex justify-between items-center mb-4"><span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Target Leverage</span><span className="text-xl font-black mono text-emerald-400 bg-emerald-500/5 px-4 py-1.5 rounded-xl border border-emerald-500/20">{selectedLeverage}X</span></div>
                      <input type="range" min="5" max="100" step="5" value={selectedLeverage} onChange={(e) => setSelectedLeverage(parseInt(e.target.value))} className="w-full h-2 bg-slate-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                      <div className="flex flex-col gap-3"><div className="flex justify-between items-center"><span className="text-[10px] text-slate-600 font-black uppercase">Stop Loss</span><span className="text-xs font-black text-rose-400">{stopLossPct}%</span></div><input type="range" min="1" max="50" step="1" value={stopLossPct} onChange={(e) => setStopLossPct(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none accent-rose-500" /></div>
                      <div className="flex flex-col gap-3"><div className="flex justify-between items-center"><span className="text-[10px] text-slate-600 font-black uppercase">Profit Take</span><span className="text-xs font-black text-emerald-400">{takeProfitPct}%</span></div><input type="range" min="5" max="200" step="5" value={takeProfitPct} onChange={(e) => setTakeProfitPct(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none accent-emerald-500" /></div>
                    </div>

                    <div className="bg-slate-950/60 p-4 md:p-6 rounded-3xl border border-slate-800/60 shadow-inner">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[11px] text-slate-500 font-black uppercase flex items-center gap-2">
                          <Coins className="w-4 h-4 text-blue-400" /> Position Size
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase">Units</span>
                      </div>
                      
                      <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1.5 group focus-within:border-blue-500/50 transition-colors">
                        <button 
                          onClick={() => setLotSize((Math.max(0.01, parseFloat(lotSize) - 0.01)).toFixed(2))} 
                          className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all active:scale-95 border border-slate-700/50 shadow-lg"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        
                        <div className="flex-1 flex flex-col items-center justify-center px-2">
                          <input 
                            type="number" 
                            min="0.01" 
                            step="0.01" 
                            value={lotSize} 
                            onChange={(e) => setLotSize(e.target.value)} 
                            className="w-full bg-transparent text-center font-black mono text-3xl text-white outline-none placeholder-slate-700"
                            placeholder="0.00"
                          />
                        </div>

                        <button 
                          onClick={() => setLotSize((parseFloat(lotSize) + 0.01).toFixed(2))} 
                          className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all active:scale-95 border border-slate-700/50 shadow-lg"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {['0.01', '0.10', '0.50', '1.00'].map(val => (
                          <button 
                            key={val}
                            onClick={() => setLotSize(val)}
                            className={`py-2 rounded-lg text-[9px] font-black transition-all border ${lotSize === val ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600 hover:bg-slate-800 hover:text-slate-400'}`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center px-4 py-2 bg-slate-950/30 rounded-xl border border-slate-800/50">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Required Margin</span>
                      <span className={`text-sm font-black mono ${estimatedMargin > portfolio.cash ? 'text-rose-400' : 'text-slate-200'}`}>${estimatedMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                      <button onClick={() => executeTrade('BUY', currentPrice, "Manual Long Strategy")} className="group py-4 md:py-8 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 rounded-[2rem] font-black transition-all shadow-xl flex flex-col items-center gap-3 active:scale-95"><ArrowUpCircle className="w-8 h-8 md:w-12 md:h-12 group-hover:-translate-y-1 transition-transform" /><span>LONG</span></button>
                      <button onClick={() => executeTrade('SELL', currentPrice, "Manual Short Strategy")} className="group py-4 md:py-8 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 border border-rose-500/20 rounded-[2rem] font-black transition-all shadow-xl flex flex-col items-center gap-3 active:scale-95"><ArrowDownCircle className="w-8 h-8 md:w-12 md:h-12 group-hover:translate-y-1 transition-transform" /><span>SHORT</span></button>
                    </div>
                    
                    <button onClick={handleExitAll} className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-[11px] font-black rounded-2xl border border-slate-700 uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"><Ban className="w-4 h-4 text-rose-500" /> Exit All Trades</button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-xl flex items-center gap-2"><span>Trade History</span><History className="w-6 h-6 text-slate-700" /></h3>
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 rounded-xl transition-all ${showFilters ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                    >
                      <Filter className="w-4 h-4" />
                    </button>
                  </div>

                  {showFilters && (
                    <div className="mb-6 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 grid grid-cols-2 gap-4 animate-slide-up">
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Type</label>
                        <select 
                          value={historyFilterType} 
                          onChange={(e) => setHistoryFilterType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-bold text-slate-300 focus:border-emerald-500 outline-none"
                        >
                          <option value="ALL">All Types</option>
                          <option value="BUY">Buy Only</option>
                          <option value="SELL">Sell Only</option>
                        </select>
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Outcome</label>
                        <select 
                          value={historyFilterPnL} 
                          onChange={(e) => setHistoryFilterPnL(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-bold text-slate-300 focus:border-emerald-500 outline-none"
                        >
                          <option value="ALL">All Outcomes</option>
                          <option value="PROFIT">Profit Only</option>
                          <option value="LOSS">Loss Only</option>
                        </select>
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Start Date</label>
                        <div className="relative">
                          <input 
                            type="date" 
                            value={historyFilterStartDate}
                            onChange={(e) => setHistoryFilterStartDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-bold text-slate-300 focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">End Date</label>
                        <div className="relative">
                          <input 
                            type="date" 
                            value={historyFilterEndDate}
                            onChange={(e) => setHistoryFilterEndDate(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] font-bold text-slate-300 focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {displayedTrades.length > 0 ? displayedTrades.map(t => (
                      <div key={t.id} className="p-6 bg-slate-950/50 border border-slate-800 rounded-3xl flex flex-col gap-3 group hover:border-slate-600 transition-colors">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${t.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{t.type}</span>
                              <span className="text-[11px] font-black text-slate-400">{t.symbol || 'Unknown'}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 mono">{t.timestamp.toLocaleTimeString()} <span className="text-slate-700 mx-1">|</span> {t.timestamp.toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="text-base font-black mono text-slate-200">${t.price.toLocaleString()}</div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-slate-500 mb-0.5">Qty: {t.amount}</div>
                                {t.pnl !== undefined && (() => {
                                    const entryPrice = t.type === 'SELL' ? t.price - (t.pnl / t.amount) : t.price + (t.pnl / t.amount);
                                    const margin = (entryPrice * t.amount) / t.leverage;
                                    const roi = margin > 0 ? (t.pnl / margin) * 100 : 0;
                                    return (
                                        <div className={`text-[11px] font-black ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                                            <span className="text-[10px] opacity-75 ml-1">({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-600 truncate italic group-hover:text-slate-400 transition-colors border-t border-slate-800/50 pt-2 mt-1">{t.reasoning}</div>
                      </div>
                    )) : <div className="text-center py-20 text-slate-700 font-black text-[10px] uppercase opacity-40 tracking-[0.2em]">Void Log</div>}
                  </div>

                  {totalHistoryPages > 1 && (
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800/50">
                      <button 
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-400 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Page {historyPage} of {totalHistoryPages}</span>
                      <button 
                        onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                        disabled={historyPage === totalHistoryPages}
                        className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-400 transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-10 h-[300px] md:h-[400px] relative overflow-hidden shadow-2xl mb-12">
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-6 flex items-center gap-3"><Activity className="w-4 h-4" /> Global Performance Graph</h3>
              <div className="w-full h-full pb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityHistory}>
                    <defs><linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                    <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#eqG)" isAnimationActive={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '10px' }} />
                    <XAxis dataKey="timestamp" hide /><YAxis hide domain={['auto', 'auto']} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : renderSettings()}
      </main>

      <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-[100] pointer-events-none max-w-[90vw] sm:max-w-md">
        {notifications.map((n, i) => (
          <div key={i} className={`px-8 py-5 rounded-[1.5rem] shadow-2xl border flex items-center gap-6 animate-slide-up pointer-events-auto backdrop-blur-2xl ${n.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-400' : n.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-400' : 'bg-slate-900/90 border-slate-700 text-slate-200'}`}>
            <div className={`p-2.5 rounded-xl ${n.type === 'success' ? 'bg-emerald-500/20' : n.type === 'error' ? 'bg-rose-500/20' : 'bg-slate-700/50'}`}>{n.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : n.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}</div>
            <span className="text-[13px] font-black tracking-tight leading-snug">{n.msg}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slide-up { from { transform: translateY(30px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
        
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb { 
          -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; 
          background: #f8fafc; cursor: pointer; border: 4px solid currentColor;
          box-shadow: 0 0 15px rgba(0,0,0,0.5); margin-top: -6px;
        }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: #1e293b; border-radius: 10px; }
      `}</style>
    </div>
  );
}