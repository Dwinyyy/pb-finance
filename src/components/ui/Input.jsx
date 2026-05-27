import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = React.forwardRef(({ 
  className = '', 
  label, 
  error, 
  type = 'text', 
  icon: Icon,
  ...props 
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon size={18} />
          </div>
        )}
        <input
          ref={ref}
          type={inputType}
          className={`w-full px-5 py-3.5 rounded-2xl border transition-all text-sm font-medium outline-none
            ${Icon ? 'pl-11' : ''}
            ${isPassword ? 'pr-12' : ''}
            ${error 
              ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500 focus:border-transparent dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200' 
              : 'border-slate-200 bg-slate-50 text-slate-900 focus:ring-primary-500 focus:border-transparent focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900'
            }
            focus:ring-2
            ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
