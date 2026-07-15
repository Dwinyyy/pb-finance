export const toneForDropzoneState = ({
  disabled,
  error,
  hasFile,
  isDragging,
  isLocked,
  isUploading,
  status,
} = {}) => {
  if (error || status === 'rejected') return 'danger';
  if (isLocked) return 'trust';
  if (isUploading || isDragging) return 'processing';
  if (status === 'pending_change') return 'warning';
  if (hasFile || status === 'approved') return 'verified';
  if (disabled) return 'disabled';
  return 'neutral';
};
