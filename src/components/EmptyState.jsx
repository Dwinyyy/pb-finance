import React from 'react';
import { FileText } from 'lucide-react';

export function EmptyState({ icon, title, description }) {
  const emptyIcon = icon || FileText;

  return (
    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-5 text-slate-500">
        {React.createElement(emptyIcon, { size: 24 })}
      </div>
      <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-2">{title}</h3>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{description}</p>
    </div>
  );
}
