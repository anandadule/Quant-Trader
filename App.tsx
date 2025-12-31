import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Wallet, 
  History, 
  Cpu, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertCircle, 
  PlusCircle, 
  Info, 
  Globe, 
  ExternalLink, 
  Target, 
  Ban, 
  Layers, 
  Coins,
  RefreshCcw,
  BarChart4,
  PieChart,
  Menu,
  X,
  ChevronRight,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TradingChart } from './components/TradingChart';
import { PriceData, Trade, Portfolio, TradingMode, AIAnalysis, EquityPoint, WatchlistItem } from './types';
import { 
  updateMarket, 
  fetchHistoricalData, 
  fetchLatestQuote, 
  fetchTicker,
  mergeQuote 
} from './services/marketSim';
import { analyzeMarket } from './services/geminiService';

const INITIAL_CASH = 10000;
const STORAGE_KEY = 'gemini_quant_pro_v10_realtime';
const MAINTENANCE_MARGIN_PCT = 0.05;

const AVAILABLE_PAIRS = [
  { symbol: 'BTCUSDT', name: 'BTC/USD' },
  { symbol: 'ETHUSDT', name: 'ETH/USD' },
  { symbol: 'SOLUSDT', name: 'SOL/USD' },
  { symbol: 'BNBUSDT', name: 'BNB/USD' },
  { symbol: 'XRPUSDT', name: 'XRP/USD' },
  { symbol: 'DOGEUSDT', name: 'DOGE/USD' },
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
  const [timeframe, setTimeframe] = useState<string>('1m');
  const [currentSymbol, setCurrentSymbol] = useState<string>(() => getSavedItem('currentSymbol', 'BTCUSDT'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Modal states
  const [financialModal, setFinancialModal] = useState<{isOpen: boolean, type: 'deposit' | 'withdraw'}>({isOpen: false, type: 'deposit'});
  const [modalAmount, setModalAmount] = useState<string>('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const marketInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPrice = useMemo(() => marketData.length > 0 ? marketData[marketData.length - 1].price : 0, [marketData]);
  const unrealizedPnL = useMemo(() => portfolio.assets !== 0 ? (currentPrice - portfolio.avgEntryPrice) * portfolio.assets : 0, [portfolio.assets, portfolio.avgEntryPrice, currentPrice]);
  const marginLocked = useMemo(() => portfolio.assets !== 0 ? Math.abs(portfolio.assets * portfolio.avgEntryPrice) / selectedLeverage : 0, [portfolio.assets, portfolio.avgEntryPrice, selectedLeverage]);
  const equity = useMemo(() => portfolio.cash + marginLocked + unrealizedPnL, [portfolio.cash, marginLocked, unrealizedPnL]);

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
    const wins = exits.filter(t => t.type === 'SELL');
    return { winRate: (wins.length / exits.length) * 100, total: trades.length };
  }, [trades]);

  const notify = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotifications(prev => [{ msg, type }, ...prev].slice(0, 5));
  }, []);

  const handleResetSystem = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPortfolio({ cash: INITIAL_CASH, assets: 0, initialValue: INITIAL_CASH, avgEntryPrice: 0 });
    setTrades([]);
    setEquityHistory([]);
    setLastAnalysis(null);
    setResetConfirmOpen(false);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (notifications.length > 0) setNotifications(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [notifications]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEquityHistory(prev => [...prev, { timestamp: Date.now(), equity: parseFloat(equity.toFixed(2)) }].slice(-100));
    }, 2000); // Increased update rate for equity history
    return () => clearInterval(timer);
  }, [equity]);

  useEffect(() => {
    const updateWatch = async () => {
      const updated = await Promise.all(AVAILABLE_PAIRS.map(async (p) => {
        const t = await fetchTicker(p.symbol);
        return t ? { ...p, price: t.price, change24h: t.changePercent } : { ...p, price: 0, change24h: 0 };
      }));
      setWatchlist(updated);
    };
    updateWatch();
    const t = setInterval(updateWatch, 2000); // 2 seconds update for watchlist
    return () => clearInterval(t);
  }, []);

  const handleExitAll = useCallback(() => {
    setPortfolio(prev => {
      if (Math.abs(prev.assets) < 0.000001) return prev;
      const price = currentPrice;
      const isLong = prev.assets > 0;
      const amount = Math.abs(prev.assets);
      const profit = isLong ? (price - prev.avgEntryPrice) * amount : (prev.avgEntryPrice - price) * amount;
      const mReleased = (prev.avgEntryPrice * amount) / selectedLeverage;
      setTrades(t => [{ id: Math.random().toString(36).substr(2, 9), type: isLong ? 'SELL' : 'BUY', price, amount, leverage: selectedLeverage, timestamp: new Date(), reasoning: "System Closed Position" }, ...t]);
      notify(`Position Closed: ${amount.toFixed(4)} @ $${price.toLocaleString()} (Profit: $${profit.toFixed(2)})`, profit >= 0 ? 'success' : 'info');
      return { ...prev, assets: 0, avgEntryPrice: 0, cash: prev.cash + mReleased + profit };
    });
  }, [currentPrice, selectedLeverage, notify]);

  useEffect(() => {
    if (Math.abs(portfolio.assets) > 0) {
      if (equity < marginLocked * MAINTENANCE_MARGIN_PCT) { handleExitAll(); notify("LIQUIDATION ALERT", "error"); }
      const roi = (unrealizedPnL / marginLocked) * 100;
      if (roi <= -stopLossPct || roi >= takeProfitPct) handleExitAll();
    }
  }, [equity, portfolio.assets, marginLocked, stopLossPct, takeProfitPct, unrealizedPnL, handleExitAll, notify]);

  useEffect(() => {
    const init = async () => { setMarketData(await fetchHistoricalData(currentSymbol, timeframe, 150)); setIsLive(true); };
    init();
    marketInterval.current = setInterval(async () => {
      const q = await fetchLatestQuote(currentSymbol, timeframe);
      if (q) { setMarketData(prev => mergeQuote(prev, q)); setIsLive(true); } else setIsLive(false);
    }, 1000); // Realtime 1s update for market data
    return () => { if (marketInterval.current) clearInterval(marketInterval.current); };
  }, [timeframe, currentSymbol]);

  const executeTrade = useCallback((action: 'BUY' | 'SELL', price: number, reasoning: string) => {
    setPortfolio(prev => {
      const amount = parseFloat(lotSize);
      
      if (isNaN(amount) || amount < 0.01) {
        notify("Minimum lot size is 0.01", "error");
        return prev;
      }

      const marginReq = (price * amount) / selectedLeverage;
      if (prev.cash < marginReq && prev.assets === 0) { notify("Insuff. Funds", "error"); return prev; }
      const isLong = action === 'BUY';
      if ((isLong && prev.assets < 0) || (!isLong && prev.assets > 0)) { handleExitAll(); return prev; }
      
      setTrades(t => [{ id: Math.random().toString(36).substr(2, 9), type: action, price, amount, leverage: selectedLeverage, timestamp: new Date(), reasoning }, ...t]);
      notify(`${action} Order Executed: ${amount.toFixed(4)} units @ $${price.toLocaleString()}`, 'success');
      
      return { ...prev, assets: isLong ? prev.assets + amount : prev.assets - amount, avgEntryPrice: price, cash: prev.cash - marginReq, positionSymbol: currentSymbol };
    });
  }, [lotSize, currentSymbol, selectedLeverage, handleExitAll, notify]);

  const runAI = useCallback(async () => {
    if (isAnalyzing || marketData.length < 20) return;
    setIsAnalyzing(true);
    try {
      const res = await analyzeMarket(marketData, currentSymbol);
      setLastAnalysis(res);
      if (res.action !== 'HOLD' && mode === TradingMode.AUTO) {
        executeTrade(res.action as 'BUY' | 'SELL', currentPrice, res.reasoning);
      }
    } finally { setIsAnalyzing(false); }
  }, [marketData, mode, isAnalyzing, executeTrade, currentSymbol, currentPrice]);

  useEffect(() => {
    if (mode === TradingMode.AUTO) aiInterval.current = setInterval(runAI, 30000);
    return () => { if (aiInterval.current) clearInterval(aiInterval.current); };
  }, [mode, runAI]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ portfolio, trades, selectedLeverage, mode, currentSymbol, stopLossPct, takeProfitPct, lotSize, equityHistory }));
  }, [portfolio, trades, selectedLeverage, mode, currentSymbol, stopLossPct, takeProfitPct, lotSize, equityHistory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-x-hidden font-sans">
      {/* Financial Modal */}
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

      {/* Reset Confirmation Modal */}
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

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-[100]">
        <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /><h1 className="text-sm font-black tracking-tighter">Gemini<span className="text-emerald-400">Quant</span></h1></div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg">{isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-0 z-50 md:relative md:flex md:translate-x-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 overflow-hidden`}>
        <div className="p-8 border-b border-slate-800 hidden md:block">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl"><TrendingUp className="w-8 h-8 text-slate-950" /></div>
            <div><h1 className="text-2xl font-black tracking-tighter">Gemini<span className="text-emerald-400">Quant</span></h1><span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Alpha v6.0</span></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
          <div className="px-2 mb-1 flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase">Market Watchlist</span><BarChart4 className="w-4 h-4 text-slate-700" /></div>
          {watchlist.map(item => (
            <button key={item.symbol} onClick={() => { setCurrentSymbol(item.symbol); setIsSidebarOpen(false); }} className={`w-full p-4 rounded-2xl border transition-all text-left ${currentSymbol === item.symbol ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950/20 border-slate-800 hover:border-slate-700'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[11px] font-black ${currentSymbol === item.symbol ? 'text-emerald-400' : 'text-slate-400'}`}>{item.name}</span>
                <span className={`text-[9px] font-bold ${item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%</span>
              </div>
              <div className="text-sm font-black mono text-slate-100">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </button>
          ))}
        </div>

        <div className="p-6 bg-slate-800/20 border-t border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${mode === TradingMode.AUTO ? 'bg-emerald-500/20' : 'bg-slate-700/50'}`}><Cpu className={`w-5 h-5 ${mode === TradingMode.AUTO ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} /></div>
              <div className="flex flex-col"><span className="text-xs font-black text-slate-200">Autopilot</span><span className="text-[9px] text-slate-500 font-bold uppercase">{mode}</span></div>
            </div>
            <div onClick={() => setMode(prev => prev === TradingMode.MANUAL ? TradingMode.AUTO : TradingMode.MANUAL)} className={`w-14 h-7 rounded-full relative cursor-pointer transition-all p-1 ${mode === TradingMode.AUTO ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`w-5 h-5 bg-white rounded-full transition-all ${mode === TradingMode.AUTO ? 'translate-x-7' : 'translate-x-0'}`} /></div>
          </div>
          
          <div className="space-y-3">
            <button onClick={runAI} disabled={isAnalyzing} className="w-full py-4 bg-slate-950 border border-slate-800 rounded-2xl text-[10px] font-black transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-40 uppercase tracking-widest hover:bg-slate-900"><RefreshCcw className={`w-4 h-4 text-emerald-400 ${isAnalyzing ? 'animate-spin' : ''}`} /> Scan Market</button>
            <button onClick={() => setResetConfirmOpen(true)} className="w-full py-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-[10px] font-black text-rose-400 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest hover:bg-rose-500/10"><RotateCcw className="w-4 h-4" /> Reset System</button>
          </div>
        </div>
      </aside>

      {/* Main Terminal Body */}
      <main className="flex-1 bg-slate-950 p-6 md:p-10 lg:p-14 overflow-y-auto min-h-screen">
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-10 mb-12">
          <div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter">Exchange Terminal <span className="text-slate-700">PR0</span></h2>
            <div className="mt-4 inline-flex items-center gap-3 text-[10px] font-black px-4 py-2 rounded-xl border border-slate-800/50 text-emerald-500 bg-emerald-500/5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {isLive ? 'SYSTEM STATUS: ONLINE' : 'DATA LINK: STALE'}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row flex-wrap gap-6 items-end">
            <div className="px-8 py-5 bg-slate-900/50 border border-slate-800 rounded-3xl flex flex-col items-end shadow-2xl min-w-[180px]">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Total Equity</span>
              <span className="text-2xl font-black mono text-white">${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            
            <div className="px-8 py-5 bg-slate-900/50 border border-slate-800 rounded-[2rem] flex flex-col items-end shadow-2xl min-w-[280px] relative group border-emerald-500/20">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-3">Available Cash</span>
              <div className="flex flex-col items-end gap-3 w-full">
                <span className="text-2xl font-black mono text-emerald-400">${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
              <div className={`px-8 py-5 border rounded-3xl flex flex-col items-end shadow-2xl min-w-[180px] ${unrealizedPnL >= 0 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
                <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Unrealized PnL</span>
                <span className={`text-2xl font-black mono ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}</span>
              </div>
            )}
          </div>
        </header>

        {/* Operations Audit Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
          <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl flex flex-col gap-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-3"><PieChart className="w-4 h-4" /> Operations Audit</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Alpha Win Rate</span><div className="text-2xl font-black text-emerald-400">{stats.winRate.toFixed(1)}%</div></div>
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Total Ops</span><div className="text-2xl font-black text-blue-400">{stats.total}</div></div>
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Drawdown</span><div className="text-2xl font-black text-rose-400">0.00%</div></div>
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/50"><span className="text-[10px] font-black text-slate-600 uppercase mb-1 block">Risk Rating</span><div className="text-2xl font-black text-slate-200">Tier 1</div></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 mb-12">
          <div className="xl:col-span-8 flex flex-col gap-10">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-10 lg:h-[700px] shadow-2xl flex flex-col">
              <TradingChart timeframe={timeframe} onTimeframeChange={setTimeframe} currentSymbol={currentSymbol} onSymbolChange={setCurrentSymbol} availablePairs={AVAILABLE_PAIRS} />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl">
              <h3 className="font-black text-xl mb-8 flex items-center gap-4 text-emerald-400"><Target className="w-6 h-6" /> Open Positions</h3>
              {portfolio.assets !== 0 ? (
                <div className="overflow-x-auto custom-scrollbar pb-4">
                  <table className="w-full text-left min-w-[600px]">
                    <thead><tr className="text-[11px] uppercase font-black text-slate-500 border-b border-slate-800"><th className="pb-6 pl-4">Asset Matrix</th><th className="pb-6">Entry Zone</th><th className="pb-6">Liq. Level</th><th className="pb-6">Delta PnL</th><th className="pb-6 pr-4 text-right">Ops</th></tr></thead>
                    <tbody className="text-sm font-bold">
                      <tr className="border-b border-slate-800/40">
                        <td className="py-8 pl-4 flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${portfolio.assets > 0 ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />{portfolio.positionSymbol}</td>
                        <td className="py-8 mono text-slate-400">${portfolio.avgEntryPrice.toLocaleString()}</td>
                        <td className="py-8 mono text-rose-400">${liqPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className={`py-8 mono ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}</td>
                        <td className="py-8 pr-4 text-right"><button onClick={handleExitAll} className="px-6 py-3 bg-slate-800 hover:bg-rose-500 hover:text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest">Liquidate</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (<div className="py-20 text-center text-slate-600 uppercase font-black text-xs tracking-[0.2em] opacity-30"><Layers className="w-16 h-16 mx-auto mb-6" /> No Active Signal Detected</div>)}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl">
              <h3 className="font-black text-2xl mb-10 flex items-center gap-4"><div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400"><Cpu className="w-6 h-6" /></div> Neural Market Synthesis</h3>
              {lastAnalysis ? (
                <div className="flex flex-col gap-10">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
                    <div className="md:col-span-4 p-8 bg-slate-950 border border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-center shadow-xl">
                      <span className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-[0.2em]">Signal Matrix</span>
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

          <div className="xl:col-span-4 flex flex-col gap-10">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl xl:sticky xl:top-10">
              <h3 className="font-black text-xl mb-10 flex justify-between items-center"><span>Order Management</span><span className="text-[10px] font-black text-slate-600 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/50">SECURED SIM</span></h3>
              <div className="flex flex-col gap-10">
                <div>
                  <div className="flex justify-between items-center mb-4"><span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Target Leverage</span><span className="text-xl font-black mono text-emerald-400 bg-emerald-500/5 px-4 py-1.5 rounded-xl border border-emerald-500/20">{selectedLeverage}X</span></div>
                  <input type="range" min="5" max="100" step="5" value={selectedLeverage} onChange={(e) => setSelectedLeverage(parseInt(e.target.value))} className="w-full h-2 bg-slate-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-3"><div className="flex justify-between items-center"><span className="text-[10px] text-slate-600 font-black uppercase">Stop Loss</span><span className="text-xs font-black text-rose-400">{stopLossPct}%</span></div><input type="range" min="1" max="50" step="1" value={stopLossPct} onChange={(e) => setStopLossPct(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none accent-rose-500" /></div>
                  <div className="flex flex-col gap-3"><div className="flex justify-between items-center"><span className="text-[10px] text-slate-600 font-black uppercase">Profit Take</span><span className="text-xs font-black text-emerald-400">{takeProfitPct}%</span></div><input type="range" min="5" max="200" step="5" value={takeProfitPct} onChange={(e) => setTakeProfitPct(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 appearance-none accent-emerald-500" /></div>
                </div>

                <div className="bg-slate-950/60 p-6 rounded-3xl border border-slate-800/60 shadow-inner">
                  <div className="flex justify-between items-center mb-6"><span className="text-[11px] text-slate-500 font-black uppercase flex items-center gap-3"><Coins className="w-5 h-5 text-blue-400" /> Lot Size</span><span className="text-lg font-black mono text-blue-400">{lotSize} Units</span></div>
                   <div className="flex items-center gap-4">
                    <button onClick={() => setLotSize((Math.max(0.01, parseFloat(lotSize) - 0.01)).toFixed(2))} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all font-black text-lg">-</button>
                    <input type="number" min="0.01" step="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-center font-black mono text-white focus:border-blue-500 outline-none transition-all" />
                    <button onClick={() => setLotSize((parseFloat(lotSize) + 0.01).toFixed(2))} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all font-black text-lg">+</button>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <button onClick={() => executeTrade('BUY', currentPrice, "Manual Long Strategy")} className="group py-8 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 rounded-[2rem] font-black transition-all shadow-xl flex flex-col items-center gap-3 active:scale-95"><ArrowUpCircle className="w-12 h-12 group-hover:-translate-y-1 transition-transform" /><span>LONG</span></button>
                  <button onClick={() => executeTrade('SELL', currentPrice, "Manual Short Strategy")} className="group py-8 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 border border-rose-500/20 rounded-[2rem] font-black transition-all shadow-xl flex flex-col items-center gap-3 active:scale-95"><ArrowDownCircle className="w-12 h-12 group-hover:translate-y-1 transition-transform" /><span>SHORT</span></button>
                </div>
                
                <button onClick={handleExitAll} className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-[11px] font-black rounded-2xl border border-slate-700 uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"><Ban className="w-4 h-4 text-rose-500" /> Exit All Trades</button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl">
              <h3 className="font-black text-xl mb-8 flex items-center justify-between"><span>Trade History</span><History className="w-6 h-6 text-slate-700" /></h3>
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                {trades.length > 0 ? [...trades].reverse().map(t => (
                  <div key={t.id} className="p-6 bg-slate-950/50 border border-slate-800 rounded-3xl flex flex-col gap-3 group hover:border-slate-600 transition-colors">
                    <div className="flex justify-between items-center"><span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${t.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{t.type}</span><span className="text-[10px] font-bold text-slate-600 mono">{t.timestamp.toLocaleTimeString()}</span></div>
                    <div className="text-base font-black mono text-slate-200">${t.price.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-600 truncate italic group-hover:text-slate-400 transition-colors">{t.reasoning}</div>
                  </div>
                )) : <div className="text-center py-20 text-slate-700 font-black text-[10px] uppercase opacity-40 tracking-[0.2em]">Void Log</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Area: Global Performance Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 lg:p-10 h-[400px] relative overflow-hidden shadow-2xl mb-12">
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-6 flex items-center gap-3"><Activity className="w-4 h-4" /> Global Performance Graph</h3>
          <div className="w-full h-72">
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
      </main>

      {/* Persistent HUD elements */}
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