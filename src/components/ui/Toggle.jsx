import { useId } from 'react';

export function Toggle({ checked = false, disabled = false, isBusy = false, label, onChange }) {
  const labelId = useId();
  const isDisabled = disabled || isBusy;

  const handleChange = () => {
    if (!isDisabled) onChange?.(!checked);
  };

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={isBusy || undefined}
        aria-labelledby={labelId}
        disabled={isDisabled}
        onClick={handleChange}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60 motion-reduce:transition-none ${checked ? 'border-action bg-action' : 'border-border-control bg-surface-muted'} ${isBusy ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 size-4.5 rounded-full bg-surface shadow-sm transition-transform motion-reduce:transition-none motion-reduce:transform-none ${checked ? 'translate-x-5 motion-reduce:left-5' : 'translate-x-0'}`}
        />
      </button>
      <span id={labelId} className="text-sm font-semibold text-text-primary">
        {label}
      </span>
    </div>
  );
}
