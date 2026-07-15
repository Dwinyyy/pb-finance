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
  const baseStyles = "inline-flex items-center justify-center rounded-control font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-pb-fluid hover:-translate-y-px active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none";
  
  const variants = {
    primary: "bg-action text-white shadow-card hover:bg-action/90",
    secondary: "border border-border-subtle bg-surface-muted text-text-primary shadow-card hover:bg-surface",
    outline: "border border-border-control bg-transparent text-text-primary hover:bg-surface-muted",
    ghost: "bg-transparent text-text-primary hover:bg-surface-muted",
    danger: "border border-danger-border bg-danger-surface text-danger hover:bg-danger-surface/80",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <Motion.button
      ref={ref}
      whileHover={{ y: disabled || isLoading ? 0 : -1 }}
      whileTap={{ y: disabled || isLoading ? 0 : 1, scale: disabled || isLoading ? 1 : 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </Motion.button>
  );
});

Button.displayName = 'Button';
