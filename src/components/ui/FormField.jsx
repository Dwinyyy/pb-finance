export const formControlClassName = 'min-h-11 w-full rounded-control border border-border-control bg-surface px-4 py-3 text-sm font-medium text-text-primary outline-none transition-[border-color,box-shadow,background-color] placeholder:text-text-muted/70 focus-visible:border-focus focus-visible:ring-4 focus-visible:ring-focus/15 aria-invalid:border-danger aria-invalid:ring-danger/10 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted';

export function FormField({ children, error = '', hint = '', id, label, required = false }) {
  const descriptionId = `${id}-description`;
  const hasDescription = Boolean(error || hint);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text-primary">
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
      </label>
      {children({
        className: formControlClassName,
        describedBy: descriptionId,
        'aria-describedby': hasDescription ? descriptionId : undefined,
        'aria-invalid': Boolean(error),
        required,
      })}
      {hasDescription && (
        <p
          id={descriptionId}
          className={`text-xs font-medium ${error ? 'text-danger' : 'text-text-muted'}`}
          role={error ? 'alert' : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
