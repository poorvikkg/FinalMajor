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
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
        {trend && (
          <p className={`text-[11px] font-bold mt-1 ${trend.isPositive ? 'text-slate-500' : 'text-slate-500'}`}>
            {trend.isPositive ? '+' : '-'}{trend.value} vs last week
          </p>
        )}
        {description && !trend && (
          <p className="text-[11px] text-slate-400 mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};
