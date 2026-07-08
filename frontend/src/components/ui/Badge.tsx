import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({ children, className, variant = 'neutral', ...props }) => {
  const baseStyles = 'inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider border select-none';
  
  const variants = {
    primary: 'bg-slate-50 text-slate-800 border-slate-300',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    warning: 'bg-amber-50 text-amber-800 border-amber-300',
    danger: 'bg-red-50 text-red-800 border-red-300',
    info: 'bg-sky-50 text-sky-800 border-sky-300',
    neutral: 'bg-slate-50 text-slate-700 border-slate-350',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant]), className)} {...props}>
      {children}
    </span>
  );
};
