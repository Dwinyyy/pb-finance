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

export const nextDropzoneDragDepth = ({ depth = 0, action = '', isUnavailable = false } = {}) => {
  const numericDepth = Number(depth);
  const currentDepth = Number.isFinite(numericDepth) ? Math.max(0, Math.trunc(numericDepth)) : 0;

  if (isUnavailable || action === 'drop' || action === 'reset') return 0;
  if (action === 'enter') return currentDepth + 1;
  if (action === 'leave') return Math.max(0, currentDepth - 1);
  return currentDepth;
};

export const canSelectDropzoneFile = ({ disabled, file, isBusy, isLocked } = {}) => (
  Boolean(file) && !disabled && !isLocked && !isBusy
);
