import { PriceData } from '../types';

let currentTrend = 0;
let volatility = 0.002;

// Configuration for Backend Access
// In a Vercel/Serverless environment, we simply use relative paths '/api/...'
// The vercel.json rewrites handle directing these to the api/ folder.
const getApiBaseUrl = () => {
  // If we are running strictly locally with 'npm run server', we might point to 3001.
  // However, Vite proxy is set up to forward /api to 3001 in dev.
  // In production, /api is handled by Vercel serverless functions.
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const SEED_PRICES: Record<string, number> = {
  'BTCUSDT': 98200.50,
  'ETHUSDT': 2750.00,
  'SOLUSDT': 185.00,
  'NSE:NIFTY50-INDEX': 24350.25,
  'NSE:NIFTYBANK-INDEX': 52420.80,
  'NSE:RELIANCE-EQ': 2850.50,
  'NSE:HDFCBANK-EQ': 1650.10,
  'NSE:SBIN-EQ': 750.25
};

// Fallback for unknown symbols to ensure the UI never breaks
const getSeedPrice = (symbol: string): number => {
  if (SEED_PRICES[symbol]) return SEED_PRICES[symbol];
  // Generate a deterministic seed based on symbol string
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 5000) + 100; // Random price between 100 and 5100
};

const calculateIndicators = (data: PriceData[]): PriceData[] => {
  let prevEma9 = 0;
  let prevEma20 = 0;
  const k9 = 2 / (9 + 1);
  const k20 = 2 / (20 + 1);

  return data.map((item, index) => {
    const updatedItem = { ...item };

    // SMA Calculations
    if (index >= 9) {
      const slice = data.slice(index - 9, index + 1);
      updatedItem.sma10 = slice.reduce((sum, p) => sum + p.price, 0) / 10;
    }
    if (index >= 19) {
      const slice = data.slice(index - 19, index + 1);
      updatedItem.sma20 = slice.reduce((sum, p) => sum + p.price, 0) / 20;
    }

    // EMA Calculations
    if (index === 0) {
      prevEma9 = item.price;
      prevEma20 = item.price;
    } else {
      prevEma9 = (item.price * k9) + (prevEma9 * (1 - k9));
      prevEma20 = (item.price * k20) + (prevEma20 * (1 - k20));
    }
    
    if (index > 9) updatedItem.ema9 = prevEma9;
    if (index > 20) updatedItem.ema20 = prevEma20;

    // RSI Calculation
    if (index >= 14) {
      let gains = 0; let losses = 0;
      for (let i = index - 14; i < index; i++) {
        const diff = data[i+1].price - data[i].price;
        if (diff >= 0) gains += diff; else losses -= diff;
      }
      const rs = (gains / 14) / (losses / 14 || 1);
      updatedItem.rsi = 100 - (100 / (1 + rs));
    }
    return updatedItem;
  });
};

const formatTime = (date: Date): string => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const generateInitialData = (count: number = 200, symbol: string = 'BTCUSDT', timeframe: string = '1m'): PriceData[] => {
  let prevPrice = getSeedPrice(symbol);
  const data: PriceData[] = [];
  const now = Date.now();
  const step = 60000;
  for (let i = count; i >= 0; i--) {
    const time = new Date(now - i * step);
    const change = (Math.random() - 0.5) * volatility;
    const price = prevPrice * (1 + change);
    data.push({
      time: formatTime(time),
      timestamp: time.getTime() / 1000,
      price, open: prevPrice, high: Math.max(price, prevPrice) * 1.001, low: Math.min(price, prevPrice) * 0.999,
      volume: Math.random() * 10
    });
    prevPrice = price;
  }
  return calculateIndicators(data);
};

export const fetchHistoricalData = async (symbol: string, interval: string = '1m', limit: number = 200): Promise<PriceData[]> => {
  // --- FYERS INTEGRATION (Via Backend Proxy) ---
  if (symbol.startsWith('NSE:') || symbol.startsWith('BSE:')) {
    try {
      const resolutionMap: Record<string, string> = { '1m': '1', '5m': '5', '1h': '60', '1d': 'D' };
      const resVal = resolutionMap[interval] || '1';
      
      const toDate = Math.floor(Date.now() / 1000);
      const fromDate = toDate - (limit * 60 * 60 * 24); 
      
      const rangeFrom = new Date(fromDate * 1000).toISOString().split('T')[0];
      const rangeTo = new Date(toDate * 1000).toISOString().split('T')[0];
      
      // Points to /api/history which Vercel routes to api/history.js
      const url = `${API_BASE_URL}/history?symbol=${symbol}&resolution=${resVal}&date_format=1&range_from=${rangeFrom}&range_to=${rangeTo}&cont_flag=1`;
      
      const res = await fetch(url);
      
      if (res.ok) {
          const json = await res.json();
          if (json.s === 'ok' && json.candles) {
            const data = json.candles.map((c: any) => ({
              time: formatTime(new Date(c[0] * 1000)),
              timestamp: c[0],
              open: c[1],
              high: c[2],
              low: c[3],
              price: c[4],
              volume: c[5]
            }));
            return calculateIndicators(data);
          } else if (json.error) {
             console.warn(`Backend API Error: ${json.message}`);
          }
      } else {
        console.warn("Backend reachable but returned error.");
      }
    } catch (e) {
      console.warn("Backend API failed, falling back to simulation.");
    }
    // Fallback if backend is not running or keys invalid
    return generateInitialData(limit, symbol, interval);
  }

  // --- BINANCE INTEGRATION ---
  if (!symbol.endsWith('USDT')) {
    return generateInitialData(limit, symbol, interval);
  }

  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error();
    const raw = await res.json();
    const data = raw.map((d: any) => ({
      time: formatTime(new Date(d[0])),
      timestamp: d[0] / 1000,
      open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), price: parseFloat(d[4]),
      volume: parseFloat(d[5])
    }));
    return calculateIndicators(data);
  } catch {
    return generateInitialData(limit, symbol, interval);
  }
};

export const fetchLatestQuote = async (symbol: string, interval: string = '1m', prevData?: PriceData[]): Promise<PriceData | null> => {
  // --- FYERS INTEGRATION (Via Backend Proxy) ---
  if (symbol.startsWith('NSE:') || symbol.startsWith('BSE:')) {
      try {
        const url = `${API_BASE_URL}/quotes?symbols=${symbol}`;
        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.d && json.d[0]) {
                const d = json.d[0].v;
                const price = d.lp;
                const now = new Date();
                return {
                    time: formatTime(now),
                    timestamp: now.getTime() / 1000,
                    price: price,
                    open: price, // Approximation for single tick
                    high: price,
                    low: price,
                    volume: d.volume
                }
            }
        }
      } catch (e) { 
        // Backend likely offline, ignore
      }
      
      // Fallback Simulation
      if (prevData && prevData.length > 0) {
        const last = prevData[prevData.length - 1];
        const change = (Math.random() - 0.5) * volatility;
        const close = last.price * (1 + change);
        const now = new Date();
        return {
          time: formatTime(now),
          timestamp: now.getTime() / 1000,
          price: close,
          open: last.price,
          high: Math.max(last.price, close) * 1.0005,
          low: Math.min(last.price, close) * 0.9995,
          volume: Math.random() * 5
        };
      }
      return null;
  }

  // --- BINANCE INTEGRATION ---
  if (!symbol.endsWith('USDT')) {
    // Other sim fallback
    if (prevData && prevData.length > 0) {
        const last = prevData[prevData.length - 1];
        const change = (Math.random() - 0.5) * volatility;
        const close = last.price * (1 + change);
        const now = new Date();
        return {
            time: formatTime(now),
            timestamp: now.getTime() / 1000,
            price: close,
            open: last.price,
            high: Math.max(last.price, close) * 1.0005,
            low: Math.min(last.price, close) * 0.9995,
            volume: Math.random() * 5
        };
    }
    return null;
  }

  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1`);
    if (!res.ok) return null;
    const d = (await res.json())[0];
    return {
      time: formatTime(new Date(d[0])),
      timestamp: d[0] / 1000,
      open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), price: parseFloat(d[4]),
      volume: parseFloat(d[5])
    };
  } catch { return null; }
};

export const fetchTicker = async (symbol: string): Promise<{ price: number; changePercent: number } | null> => {
  // --- FYERS INTEGRATION (Via Backend Proxy) ---
  if (symbol.startsWith('NSE:') || symbol.startsWith('BSE:')) {
     try {
         const url = `${API_BASE_URL}/quotes?symbols=${symbol}`;
         const res = await fetch(url);
         if (res.ok) {
             const json = await res.json();
             if (json.d && json.d[0]) {
                 const d = json.d[0].v;
                 return {
                     price: d.lp,
                     changePercent: d.chp
                 };
             }
         }
     } catch (e) {}
     
     // Fallback
     const base = getSeedPrice(symbol);
     return {
        price: base * (1 + (Math.random() - 0.5) * 0.001),
        changePercent: (Math.random() - 0.5) * 2
     };
  }

  if (!symbol.endsWith('USDT')) {
    const base = getSeedPrice(symbol);
    return {
      price: base * (1 + (Math.random() - 0.5) * 0.001),
      changePercent: (Math.random() - 0.5) * 2
    };
  }

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return {
      price: parseFloat(data.lastPrice),
      changePercent: parseFloat(data.priceChangePercent)
    };
  } catch {
    const base = getSeedPrice(symbol);
    return {
      price: base * (1 + (Math.random() - 0.5) * 0.001),
      changePercent: (Math.random() - 0.5) * 2
    };
  }
};

export const mergeQuote = (prevData: PriceData[], quote: PriceData): PriceData[] => {
  const last = prevData[prevData.length - 1];
  let newData;
  if (last && Math.floor(last.timestamp) === Math.floor(quote.timestamp)) {
    newData = [...prevData];
    newData[newData.length - 1] = quote;
  } else {
    newData = [...prevData, quote];
  }
  return calculateIndicators(newData.slice(-200));
};