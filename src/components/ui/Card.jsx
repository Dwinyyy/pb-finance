import React from 'react';

export const Card = React.forwardRef(({ 
  className = '', 
  children, 
  hoverable = false,
  glass = false,
  ...props 
}, ref) => {
  const baseStyles = "rounded-3xl border border-slate-200 dark:border-slate-800/60 overflow-hidden";
  const bgStyles = glass 
    ? "bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl" 
    : "bg-white dark:bg-slate-900";
  const hoverStyles = hoverable 
    ? "transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:-translate-y-1" 
    : "shadow-sm";

  return (
    <div
      ref={ref}
      className={`${baseStyles} ${bgStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-5 border-b border-slate-100 dark:border-slate-800/60 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children, ...props }) => (
  <h3 className={`text-lg font-bold text-slate-900 dark:text-white ${className}`} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);
