
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
  LineChart as LineChartIcon,
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
  MousePointerClick,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Search,
  Maximize2,
  Minimize2,
  ChevronUp,
  PieChart as PieChartIcon // Renamed to avoid collision if needed, or just use Lucide icon
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
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
const STORAGE_KEY = 'protrader_quant_v1_multi_pos';

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

const STRATEGIES = [
    Strategy.AI_GEMINI,
    Strategy.RSI_MOMENTUM,
    Strategy.SMA_CROSSOVER,
    Strategy.EMA_CROSSOVER
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
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [marketData, setMarketData] = useState<PriceData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AIAnalysis | null>(null);
  const [notifications, setNotifications] = useState<{msg: string, type: 'info' | 'success' | 'error'}[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [currentSymbol, setCurrentSymbol] = useState<string>(() => getSavedItem('currentSymbol', 'BTCUSDT'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => getSavedItem('isSidebarCollapsed', false)); // Desktop sidebar
  const [historyPage, setHistoryPage] = useState(1);
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  
  // Expand/Collapse States
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(() => getSavedItem('isHistoryExpanded', true));
  const [isOpenPositionsExpanded, setIsOpenPositionsExpanded] = useState<boolean>(() => getSavedItem('isOpenPositionsExpanded', true));
  const [isNeuralAnalysisExpanded, setIsNeuralAnalysisExpanded] = useState<boolean>(() => getSavedItem('isNeuralAnalysisExpanded', true));
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');

  // Preferences State
  const [preferences, setPreferences] = useState(() => getSavedItem('preferences', {
    notifications: true,
    twoFactor: true,
    publicLeaderboard: false,
    darkMode: true
  }));

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
  const [historyFilterSymbol, setHistoryFilterSymbol] = useState<string>('');
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
            const defaultPortfolio = { cash: INITIAL_CASH, positions: [], initialValue: INITIAL_CASH, assets: 0, avgEntryPrice: 0 };
            await db.upsertPortfolio(userId, defaultPortfolio);
            setPortfolio(defaultPortfolio);
        }

        const metaName = user?.user_metadata?.full_name;
        const dbName = dbProfile?.full_name;
        const displayName = dbName || metaName || user?.email?.split('@')[0] || "Trader";

        setUserProfile(prev => ({
            ...prev,
            name: displayName,
            email: user?.email || prev.email
        }));

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
    setPortfolio({ cash: INITIAL_CASH, positions: [], initialValue: INITIAL_CASH, assets: 0, avgEntryPrice: 0 });
    setTrades([]);
    setEquityHistory([]);
    setLastAnalysis(null);
    notify("Signed out successfully", "success");
  };


  const handleSymbolChange = useCallback((symbol: string) => {
    setCurrentSymbol(symbol);
    setIsSidebarOpen(false);
    setView('dashboard');
  }, []);

  const currentPrice = useMemo(() => marketData.length > 0 ? marketData[marketData.length - 1].price : 0, [marketData]);

  const priceMap = useMemo(() => {
      const map: Record<string, number> = {};
      watchlist.forEach(w => map[w.symbol] = w.price);
      if (currentPrice > 0) map[currentSymbol] = currentPrice;
      return map;
  }, [watchlist, currentSymbol, currentPrice]);

  const { totalUnrealizedPnL, totalMarginLocked, totalPositionValue } = useMemo(() => {
    let pnl = 0;
    let margin = 0;
    let value = 0;

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

  const filteredWatchlist = useMemo(() => {
    return watchlist.filter(item => 
        item.symbol.toLowerCase().includes(watchlistSearch.toLowerCase()) || 
        item.name.toLowerCase().includes(watchlistSearch.toLowerCase())
    );
  }, [watchlist, watchlistSearch]);

  const stats = useMemo(() => {
    if (trades.length === 0) return { winRate: 0, total: 0 };
    const exits = trades.filter(t => t.reasoning.includes("Close") || t.reasoning.includes("Liquidated") || t.type === 'SELL');
    if (exits.length === 0) return { winRate: 0, total: trades.length };
    const wins = exits.filter(t => t.pnl && t.pnl > 0);
    return { winRate: (wins.length / exits.length) * 100, total: trades.length };
  }, [trades]);

  const maxDrawdown = useMemo(() => {
    if (equityHistory.length < 2) return 0;
    let peak = -Infinity;
    let maxDD = 0;
    
    for (const point of equityHistory) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const dd = (peak - point.equity) / peak;
      if (dd > maxDD) {
        maxDD = dd;
      }
    }
    return maxDD * 100;
  }, [equityHistory]);

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (historyFilterType !== 'ALL' && t.type !== historyFilterType) return false;
      if (historyFilterPnL === 'PROFIT') { if (t.pnl === undefined || t.pnl <= 0) return false; }
      if (historyFilterPnL === 'LOSS') { if (t.pnl === undefined || t.pnl >= 0) return false; }
      
      const tradeDateLocal = t.timestamp.toLocaleDateString('en-CA'); 
      if (historyFilterStartDate && tradeDateLocal < historyFilterStartDate) return false;
      if (historyFilterEndDate && tradeDateLocal > historyFilterEndDate) return false;

      if (historyFilterSymbol && (!t.symbol || !t.symbol.toLowerCase().includes(historyFilterSymbol.toLowerCase()))) return false;

      return true;
    });
  }, [trades, historyFilterType, historyFilterPnL, historyFilterSymbol, historyFilterStartDate, historyFilterEndDate]);

  const HISTORY_ITEMS_PER_PAGE = 5;
  const totalHistoryPages = Math.ceil(filteredTrades.length / HISTORY_ITEMS_PER_PAGE);
  const displayedTrades = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
    return filteredTrades.slice(start, start + HISTORY_ITEMS_PER_PAGE);
  }, [filteredTrades, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilterType, historyFilterPnL, historyFilterStartDate, historyFilterEndDate, historyFilterSymbol]);

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
      `"${t.reasoning.replace(/"/g, '""')}"`
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

  const getPriceFromRoi = useCallback((roi: number, entry: number, leverage: number, type: 'LONG' | 'SHORT') => {
    const priceChangePct = roi / leverage;
    if (type === 'LONG') return entry * (1 + priceChangePct / 100);
    return entry * (1 - priceChangePct / 100);
  }, []);

  const getRoiFromPrice = useCallback((price: number, entry: number, leverage: number, type: 'LONG' | 'SHORT') => {
    const priceChangePct = type === 'LONG' 
      ? ((price - entry) / entry) * 100
      : ((entry - price) / entry) * 100;
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
        const { error: authError } = await supabase.auth.updateUser({
            data: { full_name: tempProfile.name }
        });
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

  const equityRef = useRef(equity);
  useEffect(() => { equityRef.current = equity; }, [equity]);

  useEffect(() => {
    if (equityHistory.length === 0) {
        setEquityHistory([{ timestamp: Date.now(), equity: INITIAL_CASH }]);
    }
    const timer = setInterval(() => {
      setEquityHistory(prev => [...prev, { timestamp: Date.now(), equity: parseFloat(equityRef.current.toFixed(2)) }].slice(-100));
    }, 2000); 
    return () => clearInterval(timer);
  }, []);

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
  
  useEffect(() => {
      if (!session) return; 
      
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

  const handleExitAll = useCallback(async () => {
    const positions = portfolio.positions || [];
    if (positions.length === 0) return;

    let totalPnl = 0;
    let totalMarginReleased = 0;
    const closingTrades: Trade[] = [];

    positions.forEach(pos => {
        const closePrice = priceMap[pos.symbol] || pos.entryPrice;
        const diff = closePrice - pos.entryPrice;
        const pnl = diff * pos.amount * (pos.type === 'LONG' ? 1 : -1);
        const marginReleased = (pos.entryPrice * pos.amount) / pos.leverage;

        totalPnl += pnl;
        totalMarginReleased += marginReleased;

        closingTrades.push({
            id: Math.random().toString(36).substr(2, 9),
            type: pos.type === 'LONG' ? 'SELL' : 'BUY',
            price: closePrice,
            amount: pos.amount,
            leverage: pos.leverage,
            timestamp: new Date(),
            reasoning: `Mass Exit ${pos.symbol}`,
            pnl: pnl,
            symbol: pos.symbol
        });
    });

    const newPortfolio = {
        ...portfolio,
        cash: portfolio.cash + totalMarginReleased + totalPnl,
        positions: []
    };

    setTrades(prev => [...closingTrades, ...prev]);
    setPortfolio(newPortfolio);

    if (session?.user) {
        try {
            await db.upsertPortfolio(session.user.id, newPortfolio);
            for (const trade of closingTrades) {
                 await db.logTrade(session.user.id, trade);
            }
        } catch (e) {
            console.error("Error syncing mass exit to DB", e);
        }
    }

    notify(`Closed ${positions.length} positions. Total PnL: $${totalPnl.toFixed(2)}`, totalPnl >= 0 ? 'success' : 'info');
  }, [portfolio, priceMap, session, notify]);

  useEffect(() => {
      if (totalMarginLocked > 0 && equity < totalMarginLocked * 0.1) {
          handleExitAll();
          notify("ACCOUNT LIQUIDATED - MARGIN CALL", "error");
      }
      
      const safePositions = Array.isArray(portfolio.positions) ? portfolio.positions : [];
      safePositions.forEach(pos => {
          const mark = priceMap[pos.symbol] || pos.entryPrice;
          const diff = mark - pos.entryPrice;
          const pnl = diff * pos.amount * (pos.type === 'LONG' ? 1 : -1);
          const margin = (pos.entryPrice * pos.amount) / pos.leverage;
          const roi = (pnl / margin) * 100;
          
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
      preferences,
      isHistoryExpanded, 
      isOpenPositionsExpanded,
      isNeuralAnalysisExpanded,
      isSidebarCollapsed
    }));
  }, [portfolio, trades, selectedLeverage, mode, currentSymbol, stopLossPct, takeProfitPct, lotSize, equityHistory, activeStrategy, userProfile, preferences, isHistoryExpanded, isOpenPositionsExpanded, isNeuralAnalysisExpanded, isSidebarCollapsed]);

  const getStrategyIcon = (s: Strategy) => {
    switch(s) {
      case Strategy.AI_GEMINI: return <Brain className="w-4 h-4" />;
      case Strategy.RSI_MOMENTUM: return <Zap className="w-4 h-4" />;
      case Strategy.SMA_CROSSOVER: return <LineChartIcon className="w-4 h-4" />;
      case Strategy.EMA_CROSSOVER: return <Gauge className="w-4 h-4" />;
    }
  };

  const getStrategyName = (s: Strategy) => {
    switch(s) {
      case Strategy.AI_GEMINI: return "ProTrader Ultra";
      case Strategy.RSI_MOMENTUM: return "RSI Momentum";
      case Strategy.SMA_CROSSOVER: return "SMA Crossover";
      case Strategy.EMA_CROSSOVER: return "9/20 EMA";
    }
  };

  const renderSettings = () => (
    <div className="max-w-6xl mx-auto animate-slide-up pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setView('dashboard')} className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all group">
                <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-white" />
            </button>
            <h2 className="text-2xl font-black tracking-tight">System Settings</h2>
        </div>

        {/* Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8 shadow-2xl relative overflow-hidden mb-8">
          <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-slate-800 flex items-center justify-center text-emerald-400 shadow-xl relative z-10 shrink-0">
            <User className="w-10 h-10" />
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-slate-900"></div>
          </div>
          <div className="text-center md:text-left relative z-10">
            <h3 className="text-3xl font-black text-white mb-2">{userProfile.name}</h3>
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <span className="text-[10px] font-black text-emerald-950 bg-emerald-500 px-3 py-1 rounded-full uppercase tracking-widest">Pro Analyst</span>
            </div>
            <p className="text-slate-500 text-sm font-medium">Member since {userProfile.memberSince}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Account Security */}
            <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 ml-1">
                    <Shield className="w-4 h-4"/> Account Security
                </h4>
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl space-y-4">
                    {/* Email */}
                    <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800/50 flex items-center gap-4 hover:border-slate-700 transition-colors">
                        <div className="p-3 bg-slate-900 rounded-xl text-blue-400 border border-slate-800"><Mail className="w-5 h-5"/></div>
                        <div className="flex-1">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</span>
                            <span className="text-sm font-bold text-white">{userProfile.email}</span>
                        </div>
                    </div>
                    {/* Subscription */}
                    <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800/50 flex items-center gap-4 hover:border-slate-700 transition-colors">
                        <div className="p-3 bg-slate-900 rounded-xl text-purple-400 border border-slate-800"><CreditCard className="w-5 h-5"/></div>
                        <div className="flex-1">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subscription</span>
                            <span className="text-sm font-bold text-white">Pro Tier ($99/mo)</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">ACTIVE</span>
                    </div>
                    {/* API Key */}
                    <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800/50 flex items-center gap-4 hover:border-slate-700 transition-colors">
                        <div className="p-3 bg-slate-900 rounded-xl text-orange-400 border border-slate-800"><Shield className="w-5 h-5"/></div>
                        <div className="flex-1">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Exchange API Key</span>
                            <span className="text-sm font-bold text-white tracking-widest">{userProfile.apiKey}</span>
                        </div>
                        <button className="text-[10px] font-bold text-slate-500 underline hover:text-white transition-colors">Rotate</button>
                    </div>
                </div>
            </div>

            {/* Preferences */}
            <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 ml-1">
                    <Settings className="w-4 h-4"/> Preferences
                </h4>
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl h-full flex flex-col justify-between">
                    <div className="space-y-6">
                        {/* Toggles */}
                        {[
                            { key: 'notifications', label: 'Trade Notifications', icon: <Bell className="w-5 h-5"/> },
                            { key: 'twoFactor', label: '2FA Authentication', icon: <Shield className="w-5 h-5"/> },
                            { key: 'publicLeaderboard', label: 'Public Leaderboard', icon: <Globe className="w-5 h-5"/> },
                            { key: 'darkMode', label: 'Dark Mode', icon: <Info className="w-5 h-5"/> }
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between group cursor-pointer" onClick={() => setPreferences(prev => ({...prev, [item.key]: !(prev as any)[item.key]}))}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg transition-colors ${(preferences as any)[item.key] ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800 group-hover:text-slate-300'}`}>
                                        {item.icon}
                                    </div>
                                    <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                                </div>
                                <div className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${(preferences as any)[item.key] ? 'bg-emerald-500' : 'bg-slate-700 group-hover:bg-slate-600'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${(preferences as any)[item.key] ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <button onClick={handleSignOut} className="w-full mt-8 py-4 bg-rose-500/10 hover:bg-rose-950/50 border border-rose-500/20 hover:border-rose-500/50 rounded-xl text-xs font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest transition-all flex items-center justify-center gap-2 group">
                        <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" /> Sign Out
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
         <div className="flex-1 md:max-w-md lg:max-w-lg border-r border-slate-800 bg-slate-900/50 flex flex-col h-screen">
             <div className="p-8 border-b border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20"><TrendingUp className="w-8 h-8 text-slate-950" /></div>
                    <div><h1 className="text-2xl font-black tracking-tighter">ProTrader<span className="text-emerald-400">Quant</span></h1><span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Public Data Feed</span></div>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Live Market Matrix</span>
                <div className="space-y-3">
                    {watchlist.map(item => (
                        <div key={item.symbol} className="w-full p-4 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 transition-all group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-slate-300 group-hover:text-emerald-400 transition-colors">{item.name}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%</span>
                        </div>
                        <div className="text-xl font-black mono text-slate-100">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                    ))}
                </div>
             </div>
         </div>
         <div className="flex-1 relative flex items-center justify-center p-8 bg-slate-950">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
             <div className="relative z-10 w-full max-w-md"><Auth /></div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans">
      {/* Modals are kept same as before, simplified for XML length limit, usually they are components */}
      {financialModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-black mb-6 uppercase tracking-widest flex items-center gap-3">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                    {financialModal.type === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
                </h3>
                <input type="number" value={modalAmount} onChange={(e) => setModalAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xl font-black mono text-white focus:border-emerald-500 outline-none transition-all mb-6"/>
                <div className="flex gap-4">
                    <button onClick={() => setFinancialModal({ ...financialModal, isOpen: false })} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all">Cancel</button>
                    <button onClick={handleFinancialAction} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all">Confirm</button>
                </div>
            </div>
        </div>
      )}
      
      {targetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
             <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
                 <h3 className="text-xl font-black mb-4 uppercase tracking-widest">Adjust Targets</h3>
                 <div className="space-y-4 mb-6">
                      <div className="flex justify-between"><label className="text-xs font-bold text-slate-400">Take Profit</label><span className="text-xs font-mono text-emerald-400">{getRoiFromPrice(parseFloat(targetModal.tpPrice), targetModal.entryPrice, targetModal.leverage, targetModal.type).toFixed(2)}%</span></div>
                      <input type="number" value={targetModal.tpPrice} onChange={e => setTargetModal({...targetModal, tpPrice: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" />
                      <div className="flex justify-between"><label className="text-xs font-bold text-slate-400">Stop Loss</label><span className="text-xs font-mono text-rose-400">{getRoiFromPrice(parseFloat(targetModal.slPrice), targetModal.entryPrice, targetModal.leverage, targetModal.type).toFixed(2)}%</span></div>
                      <input type="number" value={targetModal.slPrice} onChange={e => setTargetModal({...targetModal, slPrice: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" />
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => setTargetModal(null)} className="flex-1 py-3 bg-slate-800 rounded-xl text-xs font-bold">Cancel</button>
                    <button onClick={handleSaveTargets} className="flex-1 py-3 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold">Save</button>
                </div>
             </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-slide-up">
                <h3 className="text-xl font-black mb-6 uppercase tracking-widest text-white">Edit Profile</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Full Name</label>
                        <input 
                            type="text" 
                            value={tempProfile.name} 
                            onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500 transition-all placeholder-slate-700"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Email Address</label>
                        <input 
                            type="email" 
                            value={tempProfile.email} 
                            onChange={(e) => setTempProfile({...tempProfile, email: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500 transition-all placeholder-slate-700"
                        />
                    </div>
                </div>
                <div className="flex gap-4 mt-8">
                    <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all text-slate-300 hover:text-white">Cancel</button>
                    <button onClick={handleProfileUpdate} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20">Save Changes</button>
                </div>
            </div>
        </div>
      )}

      {resetConfirmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
               <div className="bg-slate-900 border border-rose-500/30 p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
                    <h3 className="text-xl font-black mb-4 uppercase tracking-widest text-rose-400">Reset System?</h3>
                    <div className="flex gap-4 mt-8">
                        <button onClick={() => setResetConfirmOpen(false)} className="flex-1 py-4 bg-slate-800 rounded-xl text-xs font-bold">Cancel</button>
                        <button onClick={handleResetSystem} className="flex-1 py-4 bg-rose-500 text-slate-950 rounded-xl text-xs font-bold">Confirm</button>
                    </div>
               </div>
          </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 transition-all duration-300 w-96 max-w-[85vw] md:static ${isSidebarCollapsed ? 'md:w-20' : 'md:w-96'} ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
         {/* Header / Toggle */}
         <div className={`p-4 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
             {!isSidebarCollapsed && (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950"><TrendingUp className="w-5 h-5" /></div>
                    <div><h1 className="text-lg font-black tracking-tight leading-none">ProTrader</h1><span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Quant</span></div>
                </div>
             )}
             <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden md:block">
                 {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
             </button>
             {/* Mobile Close Button */}
             <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white md:hidden">
                 <X className="w-4 h-4" />
             </button>
         </div>

         {/* Watchlist Section */}
         <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
             {!isSidebarCollapsed && (
                 <div className="px-4 pt-6 pb-2 space-y-3">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                        <span>Watchlist</span>
                        <span className="text-slate-600">{filteredWatchlist.length} Pairs</span>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input 
                            type="text" 
                            placeholder="Search Pair..." 
                            value={watchlistSearch}
                            onChange={(e) => setWatchlistSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-white placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all"
                        />
                    </div>
                 </div>
             )}
             <div className="p-2 space-y-1">
                 {filteredWatchlist.map(item => (
                     <button 
                        key={item.symbol} 
                        onClick={() => handleSymbolChange(item.symbol)}
                        className={`w-full rounded-xl transition-all border group relative ${isSidebarCollapsed ? 'p-2 flex justify-center aspect-square items-center' : 'p-3 text-left flex justify-between items-center'} ${currentSymbol === item.symbol ? 'bg-emerald-500/10 border-emerald-500/20' : 'border-transparent hover:bg-slate-900'}`}
                        title={isSidebarCollapsed ? `${item.name} ($${item.price})` : ''}
                     >
                         {isSidebarCollapsed ? (
                             <div className="flex flex-col items-center gap-1">
                                <span className={`text-[10px] font-black ${currentSymbol === item.symbol ? 'text-emerald-400' : 'text-slate-400'}`}>{item.symbol.substring(0,3)}</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${item.change24h >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                             </div>
                         ) : (
                             <>
                                <div>
                                    <div className={`text-xs font-black ${currentSymbol === item.symbol ? 'text-emerald-400' : 'text-slate-300'}`}>{item.name}</div>
                                    <div className="text-[10px] text-slate-500 font-mono">{item.symbol}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-mono font-bold text-slate-200">${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                    <div className={`text-[9px] font-bold ${item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%</div>
                                </div>
                             </>
                         )}
                     </button>
                 ))}
             </div>
         </div>

         {/* Bottom Actions */}
         <div className="p-2 border-t border-slate-800 bg-slate-900/50">
             <div className="grid gap-2">
                 {/* Dashboard Link */}
                 <button onClick={() => setView('dashboard')} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${view === 'dashboard' && !isSidebarCollapsed ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                     <LayoutDashboard className="w-5 h-5" />
                     {!isSidebarCollapsed && <span className="text-xs font-bold">Terminal</span>}
                 </button>
                 
                 {/* Settings Link (Restored) */}
                 <button onClick={() => setView('settings')} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${view === 'settings' && !isSidebarCollapsed ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                     <Settings className="w-5 h-5" />
                     {!isSidebarCollapsed && <span className="text-xs font-bold">Settings</span>}
                 </button>

                 {/* Strategies (Restored All) */}
                 {!isSidebarCollapsed && <div className="px-2 mt-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">Active Engine</div>}
                 <div className="flex flex-col gap-1">
                     {STRATEGIES.map(s => (
                         <button 
                            key={s} 
                            onClick={() => setActiveStrategy(s)}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${activeStrategy === s ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                            title={isSidebarCollapsed ? getStrategyName(s) : ''}
                         >
                             {getStrategyIcon(s)}
                             {!isSidebarCollapsed && <span className="text-xs font-bold truncate">{getStrategyName(s)}</span>}
                         </button>
                     ))}
                 </div>

                 {/* Autopilot Toggle - Metallic Skeuomorphic */}
                 <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-3 bg-slate-950 rounded-xl border border-slate-800 mt-2`}>
                     {!isSidebarCollapsed && (
                         <div className="flex items-center gap-2">
                             <Cpu className={`w-4 h-4 ${mode === TradingMode.AUTO ? 'text-emerald-400' : 'text-slate-500'}`} />
                             <span className="text-xs font-bold text-slate-300">Autopilot</span>
                         </div>
                     )}
                     
                     <div 
                        onClick={() => setMode(prev => prev === TradingMode.MANUAL ? TradingMode.AUTO : TradingMode.MANUAL)}
                        className={`relative w-14 h-8 rounded-full cursor-pointer transition-all duration-500 ease-in-out shadow-[inset_0_4px_6px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.1)] border border-slate-900 box-border ${mode === TradingMode.AUTO ? 'bg-emerald-500' : 'bg-[#2a2a2a]'}`}
                    >
                        {/* Switch Knob */}
                        <div className={`absolute top-[3px] w-6 h-6 rounded-full bg-gradient-to-b from-[#e0e0e0] to-[#888] shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-transform duration-500 cubic-bezier(0.3, 1.5, 0.7, 1) flex items-center justify-center border-t border-white/50 ${mode === TradingMode.AUTO ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                             {/* Indicator Light */}
                             <div className={`w-2 h-2 rounded-full transition-all duration-500 ${mode === TradingMode.AUTO ? 'bg-[#ccffcc] shadow-[0_0_10px_2px_rgba(255,255,255,0.8),inset_0_0_2px_rgba(0,0,0,0.2)]' : 'bg-[#444] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'}`} />
                        </div>
                    </div>
                 </div>
             </div>
         </div>
      </aside>
      
      {/* Mobile Header (kept for responsive fallback) */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 absolute top-0 w-full z-40">
        <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /><h1 className="text-sm font-black tracking-tighter">ProTrader<span className="text-emerald-400">Quant</span></h1></div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg text-white"><Menu className="w-5 h-5" /></button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col h-screen pt-14 md:pt-0">
         {view === 'dashboard' ? (
           <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6">
              {/* Header - Exchange Terminal Pro */}
              <div className="mb-8">
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-1">
                    Exchange Terminal
                </h1>
                <div className="text-3xl md:text-5xl font-black text-slate-700 tracking-tighter mb-6">
                    PRO
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Data Feed: Live</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/5 border border-blue-500/20 rounded-full">
                        <Cloud className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Cloud Sync: Active</span>
                    </div>
                </div>
              </div>

              {/* Header Stats Bar */}
              <header className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                 {/* Card 1: Total Equity */}
                 <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-xl">
                     <div className="absolute top-0 right-0 p-12 bg-emerald-500/5 rounded-full -translate-y-1/3 translate-x-1/3 group-hover:bg-emerald-500/10 transition-all blur-xl" />
                     <div className="relative z-10">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2"><Activity className="w-3 h-3"/> Total Equity</span>
                        <div className="text-3xl font-black mono text-white tracking-tight">${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                     </div>
                 </div>

                 {/* Card 2: Available Cash */}
                 <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-xl">
                     <div className="flex justify-between items-end h-full relative z-10">
                         <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2"><Wallet className="w-3 h-3"/> Available Cash</span>
                            <div className="text-3xl font-black mono text-emerald-400 tracking-tight">${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                         </div>
                         <div className="flex gap-2">
                            <button 
                                onClick={() => setFinancialModal({isOpen: true, type: 'withdraw'})} 
                                className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-rose-400 hover:text-white transition-all shadow-lg border border-slate-700 hover:border-rose-500/50 group/btn"
                                title="Withdraw"
                            >
                                <ArrowUpRight className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button 
                                onClick={() => setFinancialModal({isOpen: true, type: 'deposit'})} 
                                className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 rounded-full text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 group/btn"
                                title="Deposit"
                            >
                                <Plus className="w-6 h-6 group-hover/btn:rotate-90 transition-transform" />
                            </button>
                         </div>
                     </div>
                 </div>

                 {/* Card 3: 24h PnL */}
                 <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2"><BarChart4 className="w-3 h-3"/> 24h PnL</span>
                     <div className={`text-3xl font-black mono tracking-tight ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
                     </div>
                 </div>
              </header>

              {/* Main Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-6">
                  {/* Left Column: Charts, Positions, Analysis */}
                  <div className="xl:col-span-8 flex flex-col gap-6">
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl h-[500px] lg:h-[600px] relative">
                          <TradingChart 
                            timeframe={timeframe} 
                            onTimeframeChange={setTimeframe} 
                            currentSymbol={currentSymbol} 
                            onSymbolChange={handleSymbolChange} 
                            availablePairs={AVAILABLE_PAIRS}
                            activeStrategy={activeStrategy}
                          />
                      </div>

                      {/* Open Positions Card */}
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl transition-all duration-300">
                          <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-lg text-emerald-400 flex items-center gap-2"><Target className="w-5 h-5"/> Open Positions</h3>
                              
                              <div className="flex items-center gap-3">
                                {portfolio.positions.length > 0 && (
                                    <>
                                        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${totalUnrealizedPnL >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                                            <span className="text-sm font-bold font-mono">${totalUnrealizedPnL.toFixed(2)} ({totalMarginLocked > 0 ? (totalUnrealizedPnL/totalMarginLocked*100).toFixed(2) : '0.00'}%)</span>
                                        </div>
                                        <button onClick={() => setIsOpenPositionsExpanded(!isOpenPositionsExpanded)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                                            {isOpenPositionsExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                        </button>
                                    </>
                                )}
                              </div>
                          </div>
                          
                          {isOpenPositionsExpanded && (
                            portfolio.positions.length > 0 ? (
                                <div className="w-full">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 mb-3 px-4 gap-2 border-b border-slate-800/50 pb-2">
                                        <div className="col-span-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Matrix</div>
                                        <div className="col-span-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Quantity</div>
                                        <div className="col-span-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Entry / Liq</div>
                                        <div className="col-span-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Targets (TP / SL)</div>
                                        <div className="col-span-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Manage</div>
                                    </div>

                                    {/* Scrollable Container for Rows */}
                                    <div className="space-y-0 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {portfolio.positions.map(pos => {
                                            const mark = priceMap[pos.symbol] || pos.entryPrice;
                                            const pnl = (mark - pos.entryPrice) * pos.amount * (pos.type === 'LONG' ? 1 : -1);
                                            const margin = (pos.entryPrice * pos.amount) / pos.leverage;
                                            const pnlPercent = ((mark - pos.entryPrice) / pos.entryPrice) * 100 * (pos.type === 'LONG' ? 1 : -1) * pos.leverage;
                                            const liqPrice = pos.type === 'LONG' 
                                                ? pos.entryPrice * (1 - 1/pos.leverage)
                                                : pos.entryPrice * (1 + 1/pos.leverage);
                                                
                                            const tpPrice = pos.takeProfitPct 
                                                ? getPriceFromRoi(pos.takeProfitPct, pos.entryPrice, pos.leverage, pos.type)
                                                : 0;
                                            const slPrice = pos.stopLossPct
                                                ? getPriceFromRoi(-pos.stopLossPct, pos.entryPrice, pos.leverage, pos.type)
                                                : 0;

                                            return (
                                                <div key={pos.id} className="grid grid-cols-12 items-center p-4 border-b border-slate-800 hover:bg-slate-900/30 transition-all gap-2 group">
                                                    {/* Asset Matrix (3) */}
                                                    <div className="col-span-3 flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${pos.type === 'LONG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                        <div>
                                                            <div className="text-sm font-black text-white">{pos.symbol}</div>
                                                            <div className={`text-[10px] font-black uppercase mt-0.5 ${pos.type === 'LONG' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {pos.type} {pos.leverage}X
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Quantity (2) */}
                                                    <div className="col-span-2 text-sm font-mono font-bold text-slate-300">
                                                        {pos.amount}
                                                    </div>

                                                    {/* Entry / Liq (2) */}
                                                    <div className="col-span-2">
                                                        <div className="text-sm font-mono font-black text-white">${pos.entryPrice.toLocaleString()}</div>
                                                        <div className="text-[10px] font-mono font-bold text-orange-400 mt-0.5">Liq: ${liqPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                                                    </div>

                                                    {/* Targets (3) - New Design */}
                                                    <div className="col-span-3 flex flex-col gap-1 pr-2">
                                                        {/* TP ROW */}
                                                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded overflow-hidden">
                                                            <div className="bg-emerald-950/30 px-1.5 py-0.5 border-r border-slate-800">
                                                                <span className="text-[9px] font-black text-emerald-500">TP</span>
                                                            </div>
                                                            <div className="px-2 py-0.5 flex-1 flex justify-between items-center">
                                                                <span className="text-[10px] font-bold text-emerald-500">{pos.takeProfitPct ? `${pos.takeProfitPct.toFixed(2)}%` : '--'}</span>
                                                                <span className="text-[10px] font-mono font-bold text-slate-300 border-l border-slate-800 pl-2">
                                                                    {pos.takeProfitPct ? `$${tpPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* SL ROW */}
                                                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded overflow-hidden">
                                                            <div className="bg-rose-950/30 px-1.5 py-0.5 border-r border-slate-800">
                                                                <span className="text-[9px] font-black text-rose-500">SL</span>
                                                            </div>
                                                            <div className="px-2 py-0.5 flex-1 flex justify-between items-center">
                                                                <span className="text-[10px] font-bold text-rose-500">{pos.stopLossPct ? `${pos.stopLossPct.toFixed(2)}%` : '--'}</span>
                                                                <span className="text-[10px] font-mono font-bold text-slate-300 border-l border-slate-800 pl-2">
                                                                    {pos.stopLossPct ? `$${slPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Unrealized PnL & Manage (2) */}
                                                    <div className="col-span-2 flex items-center justify-between gap-2">
                                                        <div className="text-left min-w-[60px]">
                                                            <div className={`text-sm font-mono font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                ${pnl.toFixed(2)}
                                                            </div>
                                                            <div className={`text-[10px] font-mono font-bold ${pnl >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                                                                {pnlPercent.toFixed(2)}%
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button 
                                                                onClick={() => setTargetModal({
                                                                    isOpen: true,
                                                                    positionId: pos.id,
                                                                    symbol: pos.symbol,
                                                                    entryPrice: pos.entryPrice,
                                                                    leverage: pos.leverage,
                                                                    type: pos.type,
                                                                    slPrice: slPrice.toString(),
                                                                    tpPrice: tpPrice.toString()
                                                                })}
                                                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700"
                                                            >
                                                                <Edit3 className="w-3 h-3"/>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleClosePosition(pos.id)} 
                                                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider border border-rose-500/20 transition-all shadow-sm"
                                                            >
                                                                CLOSE
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="pt-3 border-t border-slate-800/50 flex justify-end">
                                         <button 
                                            onClick={handleExitAll} 
                                            className="px-4 py-2 bg-rose-500/10 text-rose-400 text-xs font-black uppercase tracking-widest rounded-lg hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                                        >
                                            Exit All Positions
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center border-2 border-dashed border-slate-800/50 rounded-2xl bg-slate-950/30">
                                    <Layers className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">No Active Positions</div>
                                </div>
                            )
                          )}
                      </div>

                      {/* AI Analysis */}
                      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl transition-all duration-300">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2"><Brain className="w-5 h-5 text-purple-400"/> Neural Analysis</h3>
                            <button onClick={() => setIsNeuralAnalysisExpanded(!isNeuralAnalysisExpanded)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                                {isNeuralAnalysisExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                            </button>
                          </div>
                          
                          {isNeuralAnalysisExpanded && (
                              <>
                                {lastAnalysis ? (
                                    <div className="animate-slide-up">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`text-2xl font-black ${lastAnalysis.action === 'BUY' ? 'text-emerald-400' : lastAnalysis.action === 'SELL' ? 'text-rose-400' : 'text-slate-400'}`}>{lastAnalysis.action}</span>
                                            <span className="text-xs font-bold bg-slate-800 px-2 py-1 rounded text-slate-300">{(lastAnalysis.confidence * 100).toFixed(0)}% Conf.</span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-purple-500/50 pl-4 py-1">
                                            {lastAnalysis.reasoning}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 animate-slide-up">
                                        {isAnalyzing ? <RefreshCcw className="w-8 h-8 mx-auto text-slate-600 animate-spin mb-2" /> : <Brain className="w-8 h-8 mx-auto text-slate-700 mb-2" />}
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{isAnalyzing ? 'Processing...' : 'Waiting for signal'}</span>
                                    </div>
                                )}
                                <button onClick={runAutopilotEngine} disabled={isAnalyzing} className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2">
                                    {isAnalyzing ? <RefreshCcw className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3" />} Generate Analysis
                                </button>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Right Column: Order Entry & Trade History */}
                  <div className="xl:col-span-4 flex flex-col gap-6">
                      {/* Order Entry Panel - Removed Sticky */}
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative z-20">
                          <div className="flex justify-between items-center mb-6">
                              <h2 className="text-lg font-black text-white flex items-center gap-2"><Coins className="w-5 h-5 text-emerald-500"/> Order Entry</h2>
                              <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                                  {['MARKET', 'LIMIT'].map(type => (
                                      <button 
                                        key={type} 
                                        onClick={() => setOrderType(type as any)} 
                                        className={`px-3 py-1 text-[9px] font-black rounded-md transition-all ${orderType === type ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                      >
                                          {type}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          
                          {/* Symbol Price Display */}
                          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-2xl border border-slate-700 mb-6 flex justify-between items-center shadow-inner">
                              <div>
                                  <span className="text-sm font-black text-white block">{currentSymbol}</span>
                                  <span className="text-[10px] font-bold text-slate-400">Perpetual</span>
                              </div>
                              <div className="text-2xl font-mono font-black text-emerald-400">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          </div>

                          {/* Inputs */}
                          <div className="space-y-5 mb-8">
                               <div>
                                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Leverage <span className="text-white ml-1">{selectedLeverage}x</span></label>
                                   <input type="range" min="1" max="125" value={selectedLeverage} onChange={e => setSelectedLeverage(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-emerald-500 cursor-pointer hover:accent-emerald-400 transition-all" />
                                   <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-600"><span>1x</span><span>50x</span><span>125x</span></div>
                               </div>

                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       {/* Renamed Label */}
                                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Size (Lots)</label>
                                       <div className="relative">
                                           <input type="number" value={lotSize} onChange={e => setLotSize(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white font-mono focus:border-emerald-500 outline-none" />
                                       </div>
                                   </div>
                                   <div>
                                       {/* Renamed Label */}
                                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Margin Required</label>
                                       <div className="w-full bg-slate-950/50 border border-slate-800/50 rounded-xl p-3 text-sm font-bold text-slate-400 font-mono flex items-center">
                                           ${estimatedMargin.toFixed(2)}
                                       </div>
                                   </div>
                               </div>

                               <div className="p-4 bg-slate-950/30 rounded-xl border border-slate-800/50 space-y-3">
                                   <div className="flex justify-between items-center gap-4">
                                       <div className="flex-1">
                                           <div className="flex justify-between mb-1">
                                               <span className="text-[10px] font-bold text-slate-500 uppercase">Take Profit (%)</span>
                                               <span className="text-[10px] font-mono text-emerald-400">${getRoiFromPrice(takeProfitPct, currentPrice, selectedLeverage, 'LONG').toFixed(2)}</span>
                                           </div>
                                           <input type="number" value={takeProfitPct} onChange={(e) => setTakeProfitPct(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono" />
                                       </div>
                                       <div className="flex-1">
                                           <div className="flex justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Stop Loss (%)</span>
                                                <span className="text-[10px] font-mono text-rose-400">${getRoiFromPrice(-stopLossPct, currentPrice, selectedLeverage, 'LONG').toFixed(2)}</span>
                                           </div>
                                           <input type="number" value={stopLossPct} onChange={(e) => setStopLossPct(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono" />
                                       </div>
                                   </div>
                               </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                              <button onClick={() => executeTrade('BUY', currentPrice, 'Manual Long')} disabled={portfolio.cash < estimatedMargin} className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 disabled:opacity-50 transition-all active:scale-95">Long</button>
                              <button onClick={() => executeTrade('SELL', currentPrice, 'Manual Short')} disabled={portfolio.cash < estimatedMargin} className="py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 disabled:opacity-50 transition-all active:scale-95">Short</button>
                          </div>
                      </div>

                      {/* Trade History - Renamed from Recent Activity */}
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl transition-all duration-300">
                          <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2"><History className="w-5 h-5 text-blue-400"/> Trade History</h3>
                              <div className="flex gap-2 items-center">
                                  {isHistoryExpanded && (
                                    <>
                                        <button onClick={() => setShowFilters(!showFilters)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><Filter className="w-4 h-4"/></button>
                                        <button onClick={handleDownloadHistory} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><Download className="w-4 h-4"/></button>
                                    </>
                                  )}
                                  <button onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                                    {isHistoryExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                  </button>
                              </div>
                          </div>
                          
                          {/* Filter Panel */}
                          {showFilters && isHistoryExpanded && (
                              <div className="mb-4 p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-3 animate-slide-up">
                                  <div className="grid grid-cols-2 gap-3">
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Symbol</label>
                                          <input type="text" placeholder="BTC..." value={historyFilterSymbol} onChange={e => setHistoryFilterSymbol(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white" />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Type</label>
                                          <select value={historyFilterType} onChange={e => setHistoryFilterType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white">
                                              <option value="ALL">All</option>
                                              <option value="BUY">Buy</option>
                                              <option value="SELL">Sell</option>
                                          </select>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Outcome</label>
                                          <select value={historyFilterPnL} onChange={e => setHistoryFilterPnL(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white">
                                              <option value="ALL">All</option>
                                              <option value="PROFIT">Win</option>
                                              <option value="LOSS">Loss</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date Range</label>
                                          <div className="flex gap-2">
                                            <input type="date" value={historyFilterStartDate} onChange={e => setHistoryFilterStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white" />
                                            <input type="date" value={historyFilterEndDate} onChange={e => setHistoryFilterEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white" />
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          )}

                          {isHistoryExpanded && (
                            <>
                                <div className="space-y-3 animate-slide-up mb-4">
                                    {displayedTrades.map(t => {
                                        // Calculate ROI% for closed trades
                                        // Margin = (Price * Amount) / Leverage
                                        const margin = (t.price * t.amount) / t.leverage;
                                        const roi = t.pnl ? (t.pnl / margin) * 100 : 0;

                                        return (
                                            <div key={t.id} className="flex flex-col p-3 bg-slate-950/50 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-all group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {/* Swapped Position: Symbol First */}
                                                        <span className="text-xs font-bold text-slate-200">{t.symbol}</span>
                                                        {/* Quantity Display Added */}
                                                        <span className="text-[10px] font-mono font-bold text-slate-500 px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800">
                                                            {t.amount} Lots
                                                        </span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${t.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                            {t.type} {t.leverage}X
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 font-mono">{t.timestamp.toLocaleTimeString()}</span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        {/* Replaced Entry Price with Status Text */}
                                                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                            {t.pnl !== undefined ? 'Trade Closed' : 'Trade Begin'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Realized PnL</div>
                                                        {t.pnl !== undefined && (
                                                            <>
                                                                <div className={`text-sm font-mono font-black ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                                                                </div>
                                                                <div className={`text-[10px] font-mono font-bold ${roi >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                                                                    {roi.toFixed(2)}%
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                {t.reasoning && (
                                                    <div className="mt-2 pt-2 border-t border-slate-800/50 text-[10px] text-slate-500 italic truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:text-clip">
                                                        "{t.reasoning}"
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    {displayedTrades.length === 0 && <div className="text-center py-8 text-slate-600 text-xs uppercase tracking-widest border border-dashed border-slate-800 rounded-xl">No history found</div>}
                                </div>
                                
                                {/* Pagination Controls */}
                                {totalHistoryPages > 1 && (
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                                        <button 
                                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                            disabled={historyPage === 1}
                                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4"/>
                                        </button>
                                        <div className="text-[10px] font-bold text-slate-500">
                                            Page {historyPage} of {totalHistoryPages}
                                        </div>
                                        <button 
                                            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                            disabled={historyPage === totalHistoryPages}
                                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4"/>
                                        </button>
                                    </div>
                                )}
                            </>
                          )}
                      </div>
                  </div>
              </div>

              {/* Operations Audit Section */}
              <section className="animate-slide-up pb-20">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                          <PieChartIcon className="w-5 h-5 text-emerald-400" />
                      </div>
                      <h2 className="text-xl font-black text-slate-300 uppercase tracking-widest">Operations Audit</h2>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 relative z-10">
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Alpha Win Rate</span>
                              <div className="text-3xl font-black mono text-emerald-400">{stats.winRate.toFixed(1)}%</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Total Ops</span>
                              <div className="text-3xl font-black mono text-blue-400">{trades.length}</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Drawdown</span>
                              <div className="text-3xl font-black mono text-rose-400">{maxDrawdown.toFixed(2)}%</div>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Risk Rating</span>
                              <div className="text-3xl font-black text-white">
                                  {selectedLeverage > 50 ? 'Tier 3' : selectedLeverage > 20 ? 'Tier 2' : 'Tier 1'}
                              </div>
                          </div>
                      </div>

                      {/* Audit Graph */}
                      <div className="h-[300px] w-full bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={equityHistory.slice(-50)}>
                                  <defs>
                                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                  <XAxis 
                                      dataKey="timestamp" 
                                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      stroke="#475569"
                                      fontSize={10}
                                      tickLine={false}
                                      axisLine={false}
                                      minTickGap={30}
                                  />
                                  <YAxis 
                                      domain={['auto', 'auto']}
                                      stroke="#475569"
                                      fontSize={10}
                                      tickFormatter={(val) => `$${val.toLocaleString()}`}
                                      tickLine={false}
                                      axisLine={false}
                                      width={60}
                                  />
                                  <Tooltip 
                                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                      itemStyle={{ color: '#10b981', fontFamily: 'monospace', fontWeight: 'bold' }}
                                      labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
                                      labelFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                                      formatter={(val: number) => [`$${val.toLocaleString()}`, 'Equity']}
                                  />
                                  <Area 
                                      type="monotone" 
                                      dataKey="equity" 
                                      stroke="#10b981" 
                                      strokeWidth={3}
                                      fillOpacity={1} 
                                      fill="url(#colorEquity)" 
                                      animationDuration={500}
                                  />
                              </AreaChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </section>
           </div>
         ) : (renderSettings())}
      </main>

      {/* Notifications */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n, i) => (
          <div key={i} className={`p-4 rounded-xl shadow-2xl backdrop-blur-md border animate-slide-left flex items-center gap-3 pointer-events-auto min-w-[300px] ${n.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400' : n.type === 'error' ? 'bg-rose-950/80 border-rose-500/30 text-rose-400' : 'bg-slate-900/80 border-slate-700 text-slate-200'}`}>
            {n.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : n.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Info className="w-5 h-5 shrink-0" />}
            <span className="text-xs font-bold">{n.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
