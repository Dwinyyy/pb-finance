import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

export const Button = React.forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  className = '', 
  disabled, 
  ...props 
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/25 focus:ring-primary-500",
    secondary: "bg-slate-800 hover:bg-slate-700 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 shadow-lg focus:ring-slate-500",
    outline: "border-2 border-slate-200 hover:border-slate-300 text-slate-700 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-300 focus:ring-slate-500 bg-transparent",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300 focus:ring-slate-500",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 focus:ring-red-500",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <Motion.button
      ref={ref}
      whileHover={{ y: disabled || isLoading ? 0 : -2 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </Motion.button>
  );
});

Button.displayName = 'Button';
