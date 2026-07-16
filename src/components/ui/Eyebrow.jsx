export function Eyebrow({ as = 'p', children, className = '' }) {
  const Component = as;
  return <Component className={className}>{children}</Component>;
}
