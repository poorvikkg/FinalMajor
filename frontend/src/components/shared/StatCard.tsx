import React from 'react';
import { Card, CardContent } from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, description, trend }) => {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <p className="text-4xl font-black text-slate-900 mt-2 font-heading tracking-tight">{value}</p>
        {trend && (
          <p className={`text-[12px] font-bold mt-2 flex items-center gap-1 ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value} <span className="text-slate-400 font-normal">vs last week</span>
          </p>
        )}
        {description && !trend && (
          <p className="text-[12px] text-slate-500 mt-2 font-medium">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};
