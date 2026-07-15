export function BrandMark({ className = '', compact = false, label = 'PB Finance' }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label={label}>
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-control bg-pb-midnight text-sm font-black text-white ring-1 ring-premium-detail/35"
      >
        PB
      </span>
      {!compact && <span className="text-lg font-bold tracking-tight text-text-primary">PB Finance</span>}
    </span>
  );
}
