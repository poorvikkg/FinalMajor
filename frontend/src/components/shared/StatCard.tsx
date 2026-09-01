import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
}) => {
  return (
    <Card className="border border-slate-200/90 hover:border-slate-300 transition-all duration-150 hover:shadow-xs relative overflow-hidden bg-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            {title}
          </p>
          {Icon && (
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="mt-2">
          <p className="text-2xl font-black text-slate-900 font-heading tracking-tight">
            {value}
          </p>
        </div>

        {trend && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/60'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {trend.value}
            </span>
            <span className="text-slate-400 text-[10px] font-normal">vs last week</span>
          </div>
        )}

        {description && !trend && (
          <p className="text-[11px] text-slate-500 mt-2 font-medium truncate">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
