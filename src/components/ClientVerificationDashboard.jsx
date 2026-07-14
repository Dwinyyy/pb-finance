import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  IdCard,
  Loader2,
  ShieldCheck,
  Upload,
  UserRound,
  XCircle,
} from 'lucide-react';

import { useBackendResource } from '../hooks/useBackendResource';
import { backendApi } from '../services/api';

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
    icon: IdCard,
    kind: 'valid_id',
    label: 'Valid government ID',
  },
  {
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    capture: 'user',
    description: 'Take a recent, straight-on selfie for PB Finance admins to compare with your ID.',
    icon: Camera,
    kind: 'liveness_selfie',
    label: 'Liveness selfie',
  },
  {
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    description: 'Use a clear head-and-shoulders photo. Proper attire, neutral background, and a professional pose are recommended.',
    icon: UserRound,
    kind: 'profile_photo',
    label: 'Profile picture',
  },
  {
    accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
    description: 'Exactly one regulated business document is required. Generic invoices and utility bills are not accepted.',
    icon: Building2,
    kind: 'business_proof',
    label: 'Proof of business',
  },
];
const STATUS_PRESENTATION = {
  approved: {
    icon: BadgeCheck,
    style: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300',
    text: 'PB Finance approved your identity and business evidence.',
    title: 'Verified client',
  },
  draft: {
    icon: ShieldCheck,
    style: 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
    text: 'Complete all four requirements, then submit them together for manual review.',
    title: 'Verification setup',
  },
  pending_review: {
    icon: Clock3,
    style: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
    text: 'Your evidence is locked while a PB Finance admin reviews it.',
    title: 'Review in progress',
  },
  rejected: {
    icon: XCircle,
    style: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300',
    text: 'Replace the rejected evidence, then submit the complete set again.',
    title: 'Updates required',
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

function EvidenceCard({
  businessDocumentType,
  config,
  document,
  isBusy,
  isLocked,
  onBusinessDocumentTypeChange,
  onOpen,
  onUpload,
}) {
  const Icon = config.icon;
  const inputId = `client-verification-${config.kind}`;
  const complete = Boolean(document && !['rejected', 'superseded'].includes(document.status));

  return (
    <article className={`rounded-3xl border bg-white p-5 shadow-sm transition-colors dark:bg-slate-900 ${
      document?.status === 'rejected'
        ? 'border-red-200 dark:border-red-900/60'
        : complete
          ? 'border-emerald-200 dark:border-emerald-900/50'
          : 'border-slate-200 dark:border-slate-800'
    }`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            complete ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            <Icon size={20} />
          </div>
          <div>
            <h2 className="font-black text-slate-950 dark:text-white">{config.label}</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{config.description}</p>
          </div>
        </div>
        {complete && <CheckCircle2 size={20} className="shrink-0 text-emerald-500" aria-label="Complete" />}
      </div>

      {config.kind === 'business_proof' && (
        <label className="mb-4 block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Accepted document type
          <select
            value={businessDocumentType}
            onChange={(event) => onBusinessDocumentTypeChange(event.target.value)}
            disabled={isLocked || isBusy}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            {BUSINESS_DOCUMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}

      {document && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{document.fileName}</div>
              <div className="mt-1 text-xs font-semibold capitalize text-slate-500">
                {String(document.status || 'draft').replace(/_/g, ' ')} {formatFileSize(document.fileSize) ? `· ${formatFileSize(document.fileSize)}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpen(document)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <ExternalLink size={14} />
              Open
            </button>
          </div>
          {document.rejectedReason && (
            <p className="mt-3 border-t border-red-100 pt-3 text-xs font-bold leading-relaxed text-red-600 dark:border-red-900/40 dark:text-red-300">
              {document.rejectedReason}
            </p>
          )}
        </div>
      )}

      <input
        id={inputId}
        type="file"
        accept={config.accept}
        capture={config.capture}
        disabled={isLocked || isBusy}
        onChange={(event) => onUpload(config.kind, event)}
        className="sr-only"
      />
      <label
        htmlFor={inputId}
        className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition-colors ${
          isLocked || isBusy
            ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800'
            : 'cursor-pointer bg-slate-950 text-white hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-500'
        }`}
      >
        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {document ? 'Replace file' : 'Choose file'}
      </label>
    </article>
  );
}

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

  useEffect(() => {
    if (!feedback.success) return undefined;
    const timeout = window.setTimeout(() => setFeedback((current) => ({ ...current, success: '' })), 3000);
    return () => window.clearTimeout(timeout);
  }, [feedback.success]);

  const handleUpload = async (kind, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
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
    <div className="portal-fade-in">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary-700 dark:border-primary-900/50 dark:bg-primary-950/30 dark:text-primary-300">
            <ShieldCheck size={14} />
            Client trust center
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Onboarding & Verification</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            PB Finance admins manually verify your identity, liveness selfie, profile picture, and regulated business registration before unlocking verified client features.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {completedCount} of 4 requirements ready
        </div>
      </div>

      <div className={`mb-6 rounded-3xl border p-5 ${presentation.style}`}>
        <div className="flex items-start gap-3">
          <StatusIcon size={22} className="mt-0.5 shrink-0" />
          <div>
            <h2 className="font-black">{presentation.title}</h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed opacity-90">{presentation.text}</p>
            {verification.decisionReason && <p className="mt-3 text-sm font-black">Admin note: {verification.decisionReason}</p>}
            {verification.verifiedBusinessName && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/70 px-4 py-3 dark:border-emerald-900/60 dark:bg-slate-950/40">
                <div className="text-[11px] font-black uppercase tracking-wider opacity-70">Verified legal business name</div>
                <div className="mt-1 text-base font-black">{verification.verifiedBusinessName}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(error || feedback.error || feedback.success) && (
        <div className={`mb-6 rounded-2xl border px-5 py-4 text-sm font-bold ${
          error || feedback.error
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
        }`}>
          {error?.message || feedback.error || feedback.success}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Loader2 size={24} className="animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {DOCUMENT_CONFIG.map((config) => (
            <EvidenceCard
              key={config.kind}
              businessDocumentType={businessDocumentType}
              config={config}
              document={verification.documents?.[config.kind]}
              isBusy={busyKind === config.kind}
              isLocked={isLocked || Boolean(busyKind && busyKind !== config.kind)}
              onBusinessDocumentTypeChange={setBusinessDocumentType}
              onOpen={handleOpen}
              onUpload={handleUpload}
            />
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <FileCheck2 size={21} className="mt-0.5 shrink-0 text-primary-600" />
            <div>
              <h2 className="font-black text-slate-950 dark:text-white">Legal name handling</h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                After review, an admin will transcribe the exact Legal Business Name printed on your accepted business document. You cannot edit that protected value; it is reserved for future payment-name cross-checking.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!verification.canSubmit || Boolean(busyKind) || isLocked}
          className="inline-flex min-w-64 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-primary-500/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-800"
        >
          {busyKind === 'submit' ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
          {verification.status === 'pending_review' ? 'Submitted for review' : verification.status === 'approved' ? 'Verification approved' : 'Submit all evidence'}
        </button>
      </div>
    </div>
  );
}
