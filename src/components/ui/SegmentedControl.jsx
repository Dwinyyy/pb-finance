import { useRef } from 'react';
import { canActivateControl, nextSegmentedIndex } from './interactionState.js';

export function SegmentedControl({ ariaLabel, disabled = false, onChange, options = [], value }) {
  const buttonRefs = useRef([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const selectOption = (option, index) => {
    if (!canActivateControl({ disabled })) return;
    onChange?.(option.value);
    buttonRefs.current[index]?.focus();
  };

  const handleKeyDown = (event, index) => {
    if (!canActivateControl({ disabled })) return;

    const nextIndex = nextSegmentedIndex({
      currentIndex: index,
      key: event.key,
      optionCount: options.length,
    });
    if (nextIndex === null) return;

    event.preventDefault();
    selectOption(options[nextIndex], nextIndex);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className="inline-flex rounded-control border border-border-subtle bg-surface-muted p-1"
    >
      {options.map((option, index) => {
        const Icon = option.icon;
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            ref={(node) => { buttonRefs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={index === tabStopIndex ? 0 : -1}
            onClick={() => selectOption(option, index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none ${selected ? 'bg-action text-white shadow-sm' : 'text-text-muted hover:bg-surface hover:text-text-primary'}`}
          >
            {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
