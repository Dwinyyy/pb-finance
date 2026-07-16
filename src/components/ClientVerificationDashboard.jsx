import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { useBackendResource } from '../hooks/useBackendResource';
import { backendApi } from '../services/api';
import { Button } from './ui/Button';
import { Eyebrow } from './ui/Eyebrow';
import { FileDropzone } from './ui/FileDropzone';
import { StatusBadge } from './ui/StatusBadge';
import { SurfaceCard } from './ui/SurfaceCard';

const EMPTY_VERIFICATION = Object.freeze({
  allowedBusinessDocumentTypes: [],
  canSubmit: false,
  decisionReason: '',
  documents: {},
  requirements: {},
  status: 'draft',
  verifiedBusinessName: null,
});
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const BUSINESS_DOCUMENT_OPTIONS = [
  { label: 'US EIN Letter (CP575)', value: 'cp575_ein_letter' },
  { label: 'State Business Registration', value: 'state_business_registration' },
  { label: 'EU VAT Certificate', value: 'eu_vat_certificate' },
];
const DOCUMENT_CONFIG = [
  {
    accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
    description: 'Upload a clear, unexpired government-issued ID. PDF, JPG, or PNG.',
    kind: 'valid_id',
    label: 'Valid government ID',
  },
  {
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    capture: 'user',
    description: 'Take a recent, straight-on selfie for PB Finance admins to compare with your ID.',
    kind: 'liveness_selfie',
    label: 'Liveness selfie',
  },
  {
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    description: 'Use a clear head-and-shoulders photo. Proper attire, neutral background, and a professional pose are recommended.',
    kind: 'profile_photo',
    label: 'Profile picture',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
    description: 'Exactly one regulated business document is required. Generic invoices and utility bills are not accepted.',
    kind: 'business_proof',
    label: 'Proof of business',
  },
];
const STATUS_PRESENTATION = {
  approved: {
    icon: BadgeCheck,
    style: 'border-verified-border bg-verified-surface text-verified',
    text: 'PB Finance approved your identity and business evidence.',
    title: 'Verified client',
    tone: 'verified',
  },
  draft: {
    icon: ShieldCheck,
    style: 'border-border-subtle bg-surface text-text-primary',
    text: 'Complete all four requirements, then submit them together for manual review.',
    title: 'Verification setup',
    tone: 'neutral',
  },
  pending_review: {
    icon: Clock3,
    style: 'border-warning-border bg-warning-surface text-warning',
    text: 'Your evidence is locked while a PB Finance admin reviews it.',
    title: 'Review in progress',
    tone: 'warning',
  },
  rejected: {
    icon: XCircle,
    style: 'border-danger-border bg-danger-surface text-danger',
    text: 'Replace the rejected evidence, then submit the complete set again.',
    title: 'Updates required',
    tone: 'danger',
  },
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Unable to read this file.'));
  reader.readAsDataURL(file);
});

const formatFileSize = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDocumentMeta = (document) => [
  String(document?.status || 'draft').replaceAll('_', ' '),
  formatFileSize(document?.fileSize),
].filter(Boolean).join(' · ');

export function ClientVerificationDashboard() {
  const { data, error, isLoading, mutate } = useBackendResource(
    backendApi.client.getVerification,
    EMPTY_VERIFICATION,
    { refreshInterval: 15000 }
  );
  const verification = data || EMPTY_VERIFICATION;
  const [businessDocumentType, setBusinessDocumentType] = useState('cp575_ein_letter');
  const [busyKind, setBusyKind] = useState('');
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const presentation = STATUS_PRESENTATION[verification.status] || STATUS_PRESENTATION.draft;
  const StatusIcon = presentation.icon;
  const isLocked = ['pending_review', 'approved'].includes(verification.status);
  const completedCount = DOCUMENT_CONFIG.filter((config) => verification.requirements?.[config.kind]?.complete).length;
  const feedbackError = error?.message || feedback.error;

  useEffect(() => {
    if (!feedback.success) return undefined;
    const timeout = window.setTimeout(() => setFeedback((current) => ({ ...current, success: '' })), 3000);
    return () => window.clearTimeout(timeout);
  }, [feedback.success]);

  const handleUpload = async (kind, file) => {
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setFeedback({ error: 'Files must be 3 MB or smaller.', success: '' });
      return;
    }

    setBusyKind(kind);
    setFeedback({ error: '', success: '' });

    try {
      const result = await backendApi.client.uploadVerificationDocument({
        businessDocumentType: kind === 'business_proof' ? businessDocumentType : undefined,
        contentType: file.type,
        fileData: await fileToDataUrl(file),
        fileName: file.name,
        kind,
      });
      mutate(result);
      setFeedback({ error: '', success: 'Evidence uploaded securely.' });
    } catch (uploadError) {
      setFeedback({ error: uploadError.message || 'Unable to upload this file.', success: '' });
    } finally {
      setBusyKind('');
    }
  };

  const handleOpen = async (document) => {
    setFeedback({ error: '', success: '' });
    try {
      const result = await backendApi.client.getVerificationDocumentUrl({ documentId: document.id });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (previewError) {
      setFeedback({ error: previewError.message || 'Unable to open this file.', success: '' });
    }
  };

  const handleSubmit = async () => {
    setBusyKind('submit');
    setFeedback({ error: '', success: '' });
    try {
      const result = await backendApi.client.submitVerification();
      mutate(result);
      setFeedback({ error: '', success: 'Verification submitted to PB Finance admins.' });
    } catch (submitError) {
      setFeedback({ error: submitError.message || 'Unable to submit verification.', success: '' });
    } finally {
      setBusyKind('');
    }
  };

  return (
    <div className="portal-fade-in space-y-6">
      <SurfaceCard as="header" tone="trust" className="overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow className="mb-3 text-xs font-bold text-info">Client trust center</Eyebrow>
            <h1 className="text-3xl font-black tracking-tight text-text-primary">Onboarding & Verification</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-text-muted">
              PB Finance admins manually verify your identity, liveness selfie, profile picture, and regulated business registration before unlocking verified client features.
            </p>
          </div>
          <SurfaceCard as="div" className="flex shrink-0 items-center gap-3 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-verified" aria-hidden="true" />
            <div>
              <div className="text-lg font-black text-text-primary">{completedCount} of 4</div>
              <div className="text-xs font-semibold text-text-muted">requirements ready</div>
            </div>
          </SurfaceCard>
        </div>
      </SurfaceCard>

      <section role="status" aria-live="polite" className={`rounded-card border p-5 shadow-card ${presentation.style}`}>
        <div className="flex items-start gap-3">
          <StatusIcon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black">{presentation.title}</h2>
              <StatusBadge label={String(verification.status || 'draft').replaceAll('_', ' ')} tone={presentation.tone} />
            </div>
            <p className="mt-1 text-sm font-semibold leading-relaxed">{presentation.text}</p>
            {verification.decisionReason && <p className="mt-3 text-sm font-black">Admin note: {verification.decisionReason}</p>}
            {verification.verifiedBusinessName && (
              <div className="mt-4 rounded-control border border-verified-border bg-surface px-4 py-3 text-text-primary">
                <div className="text-xs font-black uppercase tracking-wider text-text-muted">Verified legal business name</div>
                <div className="mt-1 text-base font-black">{verification.verifiedBusinessName}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {(feedbackError || feedback.success) && (
        <div
          role={feedbackError ? 'alert' : 'status'}
          aria-live="polite"
          aria-atomic="true"
          className={`rounded-control border px-5 py-4 text-sm font-bold ${
            feedbackError
              ? 'border-danger-border bg-danger-surface text-danger'
              : 'border-verified-border bg-verified-surface text-verified'
          }`}
        >
          {feedbackError || feedback.success}
        </div>
      )}

      {isLoading ? (
        <SurfaceCard>
          <div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-processing" aria-hidden="true" />
            <span className="sr-only">Loading verification requirements</span>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {DOCUMENT_CONFIG.map((config) => {
            const document = verification.documents?.[config.kind];
            const isCurrentUpload = busyKind === config.kind;

            return (
              <div key={config.kind} className="space-y-3">
                {config.kind === 'business_proof' && (
                  <SurfaceCard as="section" className="p-4">
                    <label htmlFor="client-verification-business-document-type" className="block text-xs font-black uppercase tracking-wider text-text-muted">
                      Accepted document type
                    </label>
                    <select
                      id="client-verification-business-document-type"
                      value={businessDocumentType}
                      onChange={(event) => setBusinessDocumentType(event.target.value)}
                      disabled={isLocked || Boolean(busyKind)}
                      className="mt-2 w-full rounded-control border border-border-control bg-surface px-4 py-3 text-sm font-bold text-text-primary outline-none focus-visible:ring-4 focus-visible:ring-focus/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {BUSINESS_DOCUMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </SurfaceCard>
                )}

                <FileDropzone
                  accept={config.accept}
                  capture={config.capture}
                  disabled={Boolean(busyKind && !isCurrentUpload)}
                  error={document?.status === 'rejected' ? document.rejectedReason || '' : ''}
                  fileMeta={document ? formatDocumentMeta(document) : ''}
                  fileName={document?.fileName || ''}
                  helpText={`${config.description} Maximum file size: 3 MB.`}
                  id={`client-verification-${config.kind}`}
                  isBusy={isCurrentUpload}
                  isLocked={isLocked}
                  label={config.label}
                  onFile={(file) => handleUpload(config.kind, file)}
                  onOpen={document ? () => handleOpen(document) : undefined}
                  status={document?.status || ''}
                />
              </div>
            );
          })}
        </div>
      )}

      <SurfaceCard className="grid gap-5 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
          <div>
            <h2 className="font-black text-text-primary">Legal name handling</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-text-muted">
              After review, an admin will transcribe the exact Legal Business Name printed on your accepted business document. You cannot edit that protected value; it is reserved for future payment-name cross-checking.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={!verification.canSubmit || Boolean(busyKind) || isLocked}
          isLoading={busyKind === 'submit'}
          className="w-full xl:min-w-64"
        >
          {verification.status === 'pending_review'
            ? 'Submitted for review'
            : verification.status === 'approved'
              ? 'Verification approved'
              : 'Submit all evidence'}
        </Button>
      </SurfaceCard>
    </div>
  );
}
