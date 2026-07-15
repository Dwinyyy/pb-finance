const STATUS_TONES = Object.freeze({
  approved: 'verified',
  complete: 'verified',
  completed: 'verified',
  active: 'verified',
  pending: 'warning',
  pending_review: 'warning',
  requesting: 'warning',
  rejected: 'danger',
  expired: 'danger',
  error: 'danger',
  uploading: 'processing',
  processing: 'processing',
  draft: 'neutral',
});

export const toneForStatus = (status) => STATUS_TONES[String(status || '').toLowerCase()] || 'neutral';

export const toneForTier = (tier) => ({
  verified: 'verified',
  vip: 'premium',
}[String(tier || '').toLowerCase()] || 'neutral');
