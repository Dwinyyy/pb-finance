import { toneForStatus } from './statusTone.js';

const TONE_CLASSES = {
  neutral: 'border-border-subtle bg-surface-muted text-text-muted',
  info: 'border-info-border bg-info-surface text-info',
  verified: 'border-verified-border bg-verified-surface text-verified',
  processing: 'border-processing-border bg-processing-surface text-processing',
  warning: 'border-warning-border bg-warning-surface text-warning',
  danger: 'border-danger-border bg-danger-surface text-danger',
  premium: 'border-premium-detail/50 bg-pb-midnight text-white',
};

export function StatusBadge({ label, status = '', tone = '' }) {
  const resolvedTone = tone || toneForStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[resolvedTone] || TONE_CLASSES.neutral}`}>
      {label || String(status).replaceAll('_', ' ')}
    </span>
  );
}
