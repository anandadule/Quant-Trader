import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';

interface TradingChartProps {
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
  availablePairs: { symbol: string; name: string }[];
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D'
};

const TIMEFRAMES = ['1m', '15m', '1h', '1d'];

export const TradingChart: React.FC<TradingChartProps> = ({ 
  timeframe, 
  onTimeframeChange,
  currentSymbol,
  onSymbolChange,
  availablePairs
}) => {
  const containerId = 'tradingview_widget_container';
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSymbolName = availablePairs.find(p => p.symbol === currentSymbol)?.name || currentSymbol;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = `<div id="${containerId}" style="height: 100%; width: 100%;"></div>`;
    }

    if (window.TradingView) {
      new window.TradingView.widget({
        autosize: true,
        symbol: `BINANCE:${currentSymbol}`,
        interval: TIMEFRAME_MAP[timeframe] || '1',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0f172a',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        container_id: containerId,
        backgroundColor: '#0f172a',
        gridColor: 'rgba(30, 41, 59, 0.1)',
        studies: [
          'RSI@tv-basicstudies',
          'MASimple@tv-basicstudies'
        ],
        disabled_features: [
          'header_symbol_search',
          'header_compare',
          'header_screenshot',
          'header_saveload'
        ],
      });
    }
  }, [currentSymbol, timeframe]);

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-900/60 p-2 sm:p-3 rounded-xl border border-slate-800/50">
        <div className="relative">
          <button 
            onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] font-black text-emerald-400 hover:bg-slate-700 transition-all shadow-md"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="tracking-tight uppercase">{currentSymbolName}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showSymbolDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showSymbolDropdown && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setShowSymbolDropdown(false)} />
              <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[70] py-1 overflow-hidden backdrop-blur-xl">
                {availablePairs.map((pair) => (
                  <button
                    key={pair.symbol}
                    onClick={() => {
                      onSymbolChange(pair.symbol);
                      setShowSymbolDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-slate-800 transition-colors flex justify-between items-center ${currentSymbol === pair.symbol ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-400'}`}
                  >
                    <span>{pair.name}</span>
                    {currentSymbol === pair.symbol && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
           {TIMEFRAMES.map((tf) => (
             <button
               key={tf}
               onClick={() => onTimeframeChange(tf)}
               className={`px-2.5 py-1 text-[9px] font-black rounded transition-all ${
                 timeframe === tf 
                   ? 'bg-emerald-500 text-slate-950 shadow-sm' 
                   : 'text-slate-500 hover:text-slate-300'
               }`}
             >
               {tf.toUpperCase()}
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-[350px] lg:min-h-0" ref={containerRef}>
        <div id={containerId} className="absolute inset-0 w-full h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner" />
      </div>
    </div>
  );
};