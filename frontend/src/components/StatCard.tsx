import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: number;
  color?: string;
}

export default function StatCard({ label, value, unit, subtitle, icon, trend, color = 'orange' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    orange: 'text-orange-400 bg-orange-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-start justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        {icon && <span className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-100">{value}</span>
        {unit && <span className="text-slate-400 text-sm">{unit}</span>}
      </div>
      {subtitle && <div className="text-xs text-slate-500 mt-1 leading-tight">{subtitle}</div>}
      {trend !== undefined && (
        <div className={`text-xs mt-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs last period
        </div>
      )}
    </div>
  );
}
