
import { PriceData } from '../types';

let currentTrend = 0;
let volatility = 0.002;

const SEED_PRICES: Record<string, number> = {
  'BTCUSDT': 98200.50,
  'ETHUSDT': 2750.00,
  'SOLUSDT': 185.00,
  'BNBUSDT': 650.00,
  'XRPUSDT': 2.45,
  'DOGEUSDT': 0.35,
  'ADAUSDT': 1.10
};

const calculateIndicators = (data: PriceData[]): PriceData[] => {
  return data.map((item, index) => {
    const updatedItem = { ...item };
    if (index >= 9) {
      const slice = data.slice(index - 9, index + 1);
      updatedItem.sma10 = slice.reduce((sum, p) => sum + p.price, 0) / 10;
    }
    if (index >= 19) {
      const slice = data.slice(index - 19, index + 1);
      updatedItem.sma20 = slice.reduce((sum, p) => sum + p.price, 0) / 20;
    }
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
  let prevPrice = SEED_PRICES[symbol] || 1000;
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

export const updateMarket = (prevData: PriceData[]): PriceData[] => {
  const lastItem = prevData[prevData.length - 1];
  const open = lastItem.price;
  const change = (Math.random() - 0.5) * volatility;
  const close = open * (1 + change);
  const now = new Date();
  const newItem: PriceData = {
    time: formatTime(now),
    timestamp: now.getTime() / 1000,
    price: close, open, high: Math.max(open, close) * 1.001, low: Math.min(open, close) * 0.999,
    volume: Math.random() * 5
  };
  return calculateIndicators([...prevData, newItem].slice(-200));
};

export const fetchHistoricalData = async (symbol: string, interval: string = '1m', limit: number = 200): Promise<PriceData[]> => {
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

export const fetchLatestQuote = async (symbol: string, interval: string = '1m'): Promise<PriceData | null> => {
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
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return {
      price: parseFloat(data.lastPrice),
      changePercent: parseFloat(data.priceChangePercent)
    };
  } catch {
    const base = SEED_PRICES[symbol] || 1000;
    return {
      price: base * (1 + (Math.random() - 0.5) * 0.01),
      changePercent: (Math.random() - 0.5) * 5
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
