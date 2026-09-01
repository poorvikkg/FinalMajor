import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({ children, className, variant = 'neutral', ...props }) => {
  const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium tracking-normal select-none transition-colors';
  
  const variants = {
    primary: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-rose-50 text-rose-700',
    info: 'bg-sky-50 text-sky-700',
    neutral: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant]), className)} {...props}>
      {children}
    </span>
  );
};
