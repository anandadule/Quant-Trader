
import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronDown, Maximize, Minimize, PenTool, ZoomIn, ZoomOut } from 'lucide-react';
import { Strategy } from '../types';

interface TradingChartProps {
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
  availablePairs: { symbol: string; name: string }[];
  activeStrategy: Strategy;
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

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const TradingChart: React.FC<TradingChartProps> = ({ 
  timeframe, 
  onTimeframeChange,
  currentSymbol,
  onSymbolChange,
  availablePairs,
  activeStrategy
}) => {
  // Use a stable unique ID for the container to avoid React reconciliation issues
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(7)}`).current;
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  const currentSymbolName = availablePairs.find(p => p.symbol === currentSymbol)?.name || currentSymbol;

  const getFullSymbol = (symbol: string) => {
    // If it already has a prefix, use it
    if (symbol.includes(':')) return symbol;
    
    const s = symbol.toUpperCase();
    if (['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'TCS', 'INFY'].includes(s)) {
        return `NSE:${s}`;
    }
    if (['TSLA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META'].includes(s)) {
        return `NASDAQ:${s}`;
    }
    
    // Binance for all USDT pairs
    if (s.endsWith('USDT')) return `BINANCE:${s}`;
    
    // Default fallback
    return s;
  };

  const getStudies = () => {
    switch (activeStrategy) {
      case Strategy.RSI_MOMENTUM:
        return [
          'RSI@tv-basicstudies'
        ];
      case Strategy.SMA_CROSSOVER:
        return [
          { id: 'MASimple@tv-basicstudies', inputs: { length: 10 } },
          { id: 'MASimple@tv-basicstudies', inputs: { length: 20 } }
        ];
      case Strategy.EMA_CROSSOVER:
        return [
          { id: 'MAExp@tv-basicstudies', inputs: { length: 9 } },
          { id: 'MAExp@tv-basicstudies', inputs: { length: 20 } }
        ];
      case Strategy.AI_GEMINI:
      default:
        // Default set for AI analysis
        return ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies', 'MACD@tv-basicstudies'];
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const currentIndex = TIMEFRAMES.indexOf(timeframe);
    if (currentIndex === -1) return;

    if (direction === 'in' && currentIndex > 0) {
        onTimeframeChange(TIMEFRAMES[currentIndex - 1]);
    } else if (direction === 'out' && currentIndex < TIMEFRAMES.length - 1) {
        onTimeframeChange(TIMEFRAMES[currentIndex + 1]);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    // 1. Check if script exists, if not inject it
    if (!document.querySelector('#tradingview-widget-script')) {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        document.head.appendChild(script);
    }

    const initChart = () => {
        if (window.TradingView && widgetContainerRef.current) {
            // Check if the container actually exists in DOM before init
            const containerElement = document.getElementById(containerId);
            if (!containerElement) return;

            // Safe cleanup
            widgetContainerRef.current.innerHTML = '';

            new window.TradingView.widget({
                autosize: true,
                symbol: getFullSymbol(currentSymbol),
                interval: TIMEFRAME_MAP[timeframe] || '1',
                timezone: 'Etc/UTC',
                theme: 'dark',
                style: '1',
                locale: 'en',
                toolbar_bg: '#0f172a',
                enable_publishing: false,
                hide_side_toolbar: !showToolbar,
                allow_symbol_change: false, 
                container_id: containerId,
                backgroundColor: '#0f172a',
                gridColor: 'rgba(30, 41, 59, 0.1)',
                studies: getStudies(),
                disabled_features: [
                    'header_symbol_search',
                    'header_compare',
                    'header_screenshot',
                    'header_saveload'
                ],
            });
        }
    };

    // 2. Wait for script load
    if (!window.TradingView) {
        const timer = setInterval(() => {
            if (window.TradingView) {
                clearInterval(timer);
                initChart();
            }
        }, 300);
        return () => clearInterval(timer);
    } else {
        // Add a small delay to ensure DOM paint
        setTimeout(initChart, 100);
    }
  }, [currentSymbol, timeframe, showToolbar, activeStrategy, containerId]);

  return (
    <div 
      ref={wrapperRef} 
      className={`w-full h-full flex flex-col gap-3 transition-all duration-300 ${isFullscreen ? 'p-1 bg-slate-950 flex flex-col' : ''}`}
    >
      <div className={`flex flex-wrap justify-between items-center gap-2 bg-slate-900/60 p-2 sm:p-3 rounded-xl border border-slate-800/50 relative z-10`}>
        <div className="flex items-center gap-2 shrink-0">
            <div className="relative shrink-0">
                <button 
                    onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] md:text-xs font-black text-emerald-400 hover:bg-slate-700 transition-all shadow-md active:scale-95"
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

            <button 
                onClick={() => setShowToolbar(!showToolbar)}
                className={`p-2 bg-slate-800 border border-slate-700/50 rounded-lg transition-all shadow-md active:scale-95 shrink-0 ${showToolbar ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700'}`}
                title={showToolbar ? "Hide Drawing Tools" : "Show Drawing Tools"}
            >
                <PenTool className="w-3.5 h-3.5" />
            </button>
        </div>

        <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 hidden sm:flex">
            {TIMEFRAMES.map((tf) => (
                <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2 md:px-3 py-1 text-[9px] md:text-[10px] font-black rounded transition-all whitespace-nowrap ${
                    timeframe === tf 
                    ? 'bg-emerald-500 text-slate-950 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                >
                {tf.toUpperCase()}
                </button>
            ))}
            </div>

            <div className="flex items-center gap-1">
                <button 
                    onClick={() => handleZoom('in')}
                    className="p-2 bg-slate-800 border border-slate-700/50 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-all shadow-md active:scale-95 shrink-0"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => handleZoom('out')}
                    className="p-2 bg-slate-800 border border-slate-700/50 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-all shadow-md active:scale-95 shrink-0"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button 
                    onClick={toggleFullscreen}
                    className="p-2 bg-slate-800 border border-slate-700/50 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-all shadow-md active:scale-95 shrink-0"
                >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-[350px]">
        {/* Added explicit height and text for debugging visual */}
        <div id={containerId} ref={widgetContainerRef} className="absolute inset-0 w-full h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner flex items-center justify-center text-slate-600 text-xs font-mono">
            Initializing Chart...
        </div>
      </div>
    </div>
  );
};
