import { useRef, useState } from 'react';
import { ExternalLink, FileUp, LockKeyhole, RefreshCw } from 'lucide-react';

import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { SurfaceCard } from './SurfaceCard';
import {
  canSelectDropzoneFile,
  nextDropzoneDragDepth,
  toneForDropzoneState,
} from './fileDropzoneState.js';

const TONE_CLASSES = {
  danger: 'border-danger-border bg-danger-surface text-danger',
  disabled: 'cursor-not-allowed border-border-subtle bg-surface-muted text-text-muted opacity-70',
  neutral: 'border-border-control bg-surface text-text-primary hover:border-action hover:bg-surface-muted',
  processing: 'border-processing-border bg-processing-surface text-processing',
  trust: 'border-pb-midnight/25 bg-pb-midnight-soft text-pb-midnight dark:border-pb-midnight-soft/25 dark:bg-pb-midnight dark:text-white',
  verified: 'border-verified-border bg-verified-surface text-verified',
  warning: 'border-warning-border bg-warning-surface text-warning',
};

const formatStatus = (status) => String(status || '').replaceAll('_', ' ');

function FileDropzoneState({
  accept,
  capture,
  disabled = false,
  error = '',
  fileMeta = '',
  fileName = '',
  helpText = '',
  id,
  isBusy = false,
  isLocked = false,
  label,
  onFile = () => {},
  onOpen,
  onRequestChange,
  status = '',
}) {
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const hasFile = Boolean(fileName);
  const isUnavailable = disabled || isLocked || isBusy;
  const tone = toneForDropzoneState({
    disabled,
    error,
    hasFile,
    isDragging,
    isLocked,
    isUploading: isBusy,
    status,
  });
  const badgeLabel = isBusy
    ? 'Uploading securely'
    : error
      ? 'Needs attention'
      : status
        ? formatStatus(status)
        : isLocked
          ? 'Locked'
          : hasFile
            ? 'Uploaded'
            : 'Ready';
  const badgeTone = ['danger', 'processing', 'verified', 'warning'].includes(tone)
    ? tone
    : tone === 'trust'
      ? ''
      : 'neutral';
  const promptLabel = isBusy
    ? 'Uploading securely'
    : isLocked
      ? 'Evidence locked'
      : hasFile
        ? 'Replace file'
        : 'Choose file';

  const selectFile = (file) => {
    if (!canSelectDropzoneFile({ disabled, file, isBusy, isLocked })) return;
    onFile(file);
  };

  const updateDragState = (action) => {
    const nextDepth = nextDropzoneDragDepth({
      action,
      depth: dragDepth.current,
      isUnavailable,
    });
    dragDepth.current = nextDepth;
    setIsDragging(nextDepth > 0);
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    updateDragState('enter');
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    updateDragState('leave');
  };

  const handleDrop = (event) => {
    event.preventDefault();
    updateDragState('drop');
    selectFile(event.dataTransfer.files?.[0]);
  };

  return (
    <SurfaceCard as="article" tone={tone === 'trust' ? 'trust' : 'default'} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-label`} className="font-bold text-text-primary">{label}</h2>
          {fileName && <p className="mt-1 truncate text-sm font-semibold text-text-primary">{fileName}</p>}
          {fileMeta && <p className="mt-1 text-xs font-medium capitalize text-text-muted">{fileMeta}</p>}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <StatusBadge label={badgeLabel} status={status} tone={badgeTone} />
        </div>
      </div>

      <label
        htmlFor={id}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isUnavailable) event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mt-4 flex min-h-36 flex-col items-center justify-center rounded-control border-2 border-dashed px-4 py-6 text-center transition-[color,background-color,border-color] focus-within:ring-4 focus-within:ring-focus/25 ${TONE_CLASSES[tone]}`}
      >
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={accept}
          capture={capture}
          disabled={disabled || isLocked || isBusy}
          aria-busy={isBusy || undefined}
          aria-describedby={`${id}-description`}
          aria-labelledby={`${id}-label ${id}-prompt`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {isLocked ? <LockKeyhole className="h-6 w-6" aria-hidden="true" /> : <FileUp className="h-6 w-6" aria-hidden="true" />}
        <span id={`${id}-prompt`} className="mt-3 text-sm font-bold">{promptLabel}</span>
        {!isUnavailable && <span className="mt-1 text-xs font-medium opacity-80">or drag and drop here</span>}
      </label>

      <div id={`${id}-description`} className="mt-3 space-y-2">
        {helpText && <p className="text-xs font-medium leading-relaxed text-text-muted">{helpText}</p>}
        {error && <p role="alert" className="text-xs font-bold leading-relaxed text-danger">{error}</p>}
      </div>

      {(onOpen || onRequestChange) && hasFile && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onOpen && (
            <Button type="button" variant="outline" size="sm" onClick={onOpen}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Open
            </Button>
          )}
          {onRequestChange && (
            <Button type="button" variant="secondary" size="sm" disabled={disabled || isBusy} onClick={onRequestChange}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Request change
            </Button>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}

export function FileDropzone(props) {
  const availabilityKey = props.disabled || props.isLocked || props.isBusy
    ? 'unavailable'
    : 'available';

  return <FileDropzoneState key={availabilityKey} {...props} />;
}
