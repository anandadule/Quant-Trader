
import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronDown, Maximize, Minimize, PenTool, ZoomIn, ZoomOut } from 'lucide-react';

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

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const TradingChart: React.FC<TradingChartProps> = ({ 
  timeframe, 
  onTimeframeChange,
  currentSymbol,
  onSymbolChange,
  availablePairs
}) => {
  const containerId = 'tradingview_widget_container';
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const currentSymbolName = availablePairs.find(p => p.symbol === currentSymbol)?.name || currentSymbol;

  const getFullSymbol = (symbol: string) => {
    // Specifically handle NSE indices for the TradingView Widget
    if (symbol === 'NIFTY') return 'NSE:NIFTY';
    if (symbol === 'BANKNIFTY') return 'NSE:BANKNIFTY';
    // Binance for all USDT pairs
    if (symbol.endsWith('USDT')) return `BINANCE:${symbol}`;
    return symbol;
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

  const handleZoomIn = () => {
    const currentIndex = TIMEFRAMES.indexOf(timeframe);
    if (currentIndex > 0) {
      onTimeframeChange(TIMEFRAMES[currentIndex - 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = TIMEFRAMES.indexOf(timeframe);
    if (currentIndex < TIMEFRAMES.length - 1) {
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
    if (containerRef.current) {
      containerRef.current.innerHTML = `<div id="${containerId}" style="height: 100%; width: 100%;"></div>`;
    }

    if (window.TradingView) {
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
  }, [currentSymbol, timeframe, showToolbar]);

  return (
    <div 
      ref={wrapperRef} 
      className={`w-full h-full flex flex-col gap-3 transition-all duration-300 ${isFullscreen ? 'p-6 bg-slate-950 flex flex-col' : ''}`}
    >
      <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-900/60 p-2 sm:p-3 rounded-xl border border-slate-800/50 relative z-10">
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
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
                <button 
                    onClick={handleZoomIn}
                    disabled={TIMEFRAMES.indexOf(timeframe) === 0}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-all"
                    title="Zoom In (Lower Timeframe)"
                >
                    <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button 
                    onClick={handleZoomOut}
                    disabled={TIMEFRAMES.indexOf(timeframe) === TIMEFRAMES.length - 1}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-all"
                    title="Zoom Out (Higher Timeframe)"
                >
                    <ZoomOut className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 overflow-x-auto custom-scrollbar max-w-full hidden sm:flex">
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

            <button 
                onClick={toggleFullscreen}
                className="p-2 bg-slate-800 border border-slate-700/50 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-all shadow-md active:scale-95 shrink-0"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-[350px] lg:min-h-0" ref={containerRef}>
        <div id={containerId} className="absolute inset-0 w-full h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner" />
        <div className="absolute bottom-0 left-0 w-40 h-10 bg-[#0f172a] z-50 pointer-events-auto rounded-bl-xl" />
      </div>
    </div>
  );
};
