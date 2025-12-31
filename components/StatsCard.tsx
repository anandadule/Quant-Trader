
import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, subValue, trend, icon }) => {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400';
  
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col justify-between hover:bg-slate-800 transition-colors">
      <div className="flex justify-between items-start">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      <div className="mt-2">
        <div className="text-2xl font-bold mono">{value}</div>
        {subValue && (
          <div className={`text-xs mt-1 font-medium ${trendColor}`}>
            {trend === 'up' && '▲ '}{trend === 'down' && '▼ '}{subValue}
          </div>
        )}
      </div>
    </div>
  );
};
