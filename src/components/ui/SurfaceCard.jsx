export function SurfaceCard({ as = 'section', children, className = '', tone = 'default' }) {
  const Component = as;
  const tones = {
    default: 'border-border-subtle bg-surface',
    muted: 'border-border-subtle bg-surface-muted',
    trust: 'border-pb-midnight/20 bg-pb-midnight-soft dark:border-pb-midnight-soft/25 dark:bg-pb-midnight',
    premium: 'border-premium-detail/35 bg-surface',
  };

  return (
    <Component className={`rounded-card border shadow-card ${tones[tone] || tones.default} ${className}`}>
      {children}
    </Component>
  );
}
