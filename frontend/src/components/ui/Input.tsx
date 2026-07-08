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
              'w-full px-3 py-2 text-xs rounded-none border bg-white text-black transition-colors duration-100 focus:outline-none focus:border-black disabled:opacity-50 disabled:bg-slate-100',
              error
                ? 'border-red-650'
                : 'border-slate-300 hover:border-slate-400'
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
