import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={twMerge(
            clsx(
              'w-full px-4 py-2.5 text-[13px] rounded-xl border bg-white text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm disabled:opacity-50 disabled:bg-slate-50',
              error
                ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                : 'border-slate-200 hover:border-slate-300'
            ),
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-[10px] font-semibold text-red-750 uppercase tracking-wider">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
