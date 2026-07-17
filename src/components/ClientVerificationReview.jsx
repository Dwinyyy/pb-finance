import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  IdCard,
  Loader2,
  RefreshCcw,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react';

import { DocumentPreviewModal } from './DocumentPreviewModal';
import { Eyebrow } from './ui/Eyebrow';
import { useBackendResource } from '../hooks/useBackendResource';
import { backendApi } from '../services/api';
import { warmDocumentPreviewRenderer } from '../utils/pdfPreview';

const EMPTY_LIST = Object.freeze([]);
const DOCUMENTS = [
  { icon: IdCard, kind: 'valid_id', label: 'Valid government ID' },
  { icon: UserRound, kind: 'liveness_selfie', label: 'Liveness selfie' },
  { icon: UserRound, kind: 'profile_photo', label: 'Profile picture' },
  { icon: Building2, kind: 'business_proof', label: 'Proof of business' },
];
const BUSINESS_DOCUMENT_LABELS = {
  cp575_ein_letter: 'US EIN Letter (CP575)',
  eu_vat_certificate: 'EU VAT Certificate',
  state_business_registration: 'State Business Registration',
};
const ATTESTATIONS = [
  { key: 'idAccepted', label: 'Government ID is clear, valid, and matches the account holder.' },
  { key: 'livenessAccepted', label: 'Liveness selfie appears current and matches the submitted ID.' },
  { key: 'profilePhotoMatches', label: 'Profile picture matches the same person and is professionally suitable.' },
  { key: 'businessProofAccepted', label: 'Business proof is an accepted official document and appears authentic.' },
];
const EMPTY_ATTESTATIONS = Object.freeze({
  businessProofAccepted: false,
  idAccepted: false,
  livenessAccepted: false,
  profilePhotoMatches: false,
});
const STATUS_STYLES = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300',
  draft: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
  rejected: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300',
};

const formatStatus = (value) => String(value || 'draft').replace(/_/g, ' ');
const formatDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Not submitted';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black capitalize ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {formatStatus(status)}
    </span>
  );
}

function DocumentRow({ document, kind, label, icon, onPreview }) {
  const Icon = icon;
  const businessLabel = kind === 'business_proof'
    ? BUSINESS_DOCUMENT_LABELS[document?.businessDocumentType]
    : '';

  return (
    <div className={`rounded-2xl border p-4 ${
      document
        ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        : 'border-dashed border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/10'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-900 dark:text-white">{label}</div>
            {document ? (
              <>
                <div className="truncate text-xs font-semibold text-slate-500">{document.fileName}</div>
                {businessLabel && <div className="mt-1 text-xs font-black text-cyan-700 dark:text-cyan-400">{businessLabel}</div>}
              </>
            ) : (
              <div className="text-xs font-bold text-red-600 dark:text-red-300">Required evidence missing</div>
            )}
          </div>
        </div>
        {document && (
          <button
            type="button"
            onClick={() => onPreview(document)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-cyan-300"
          >
            <ExternalLink size={14} />
            Review
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewForm({ record, busyAction, onDecide, onReset }) {
  const [verifiedBusinessName, setVerifiedBusinessName] = useState('');
  const [verifiedBusinessNameConfirmation, setVerifiedBusinessNameConfirmation] = useState('');
  const [attestations, setAttestations] = useState(EMPTY_ATTESTATIONS);
  const [rejectedKinds, setRejectedKinds] = useState([]);
  const [decisionReason, setDecisionReason] = useState('');
  const [internalReviewNotes, setInternalReviewNotes] = useState(record.internalReviewNotes || '');
  const [resetReason, setResetReason] = useState('');
  const allAttested = ATTESTATIONS.every((attestation) => attestations[attestation.key]);
  const approvalReady = Boolean(
    verifiedBusinessName
    && verifiedBusinessName === verifiedBusinessNameConfirmation
    && allAttested
  );
  const rejectionReady = Boolean(decisionReason.trim() && rejectedKinds.length);

  if (record.status !== 'pending_review') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <RefreshCcw size={20} className="mt-0.5 shrink-0 text-slate-500" />
          <div className="flex-1">
            <h3 className="font-black text-slate-950 dark:text-white">Admin reset</h3>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Reset clears the protected legal name, returns the client to Basic, and requires fresh evidence.
            </p>
            <textarea
              value={resetReason}
              onChange={(event) => setResetReason(event.target.value)}
              rows={3}
              placeholder="Required reason for the audit trail"
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="button"
              onClick={() => onReset(resetReason)}
              disabled={!resetReason.trim() || Boolean(busyAction)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20"
            >
              {busyAction === 'reset' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
              Reset verification
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/10">
        <div className="mb-4 flex items-start gap-3">
          <BadgeCheck size={21} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <h3 className="font-black text-slate-950 dark:text-white">Approve and establish trusted identity</h3>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Transcribe the exact Legal Business Name from the accepted business document twice. Preserve casing, punctuation, accents, suffixes, and internal spacing.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Exact Legal Business Name
            <input
              value={verifiedBusinessName}
              onChange={(event) => setVerifiedBusinessName(event.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-500 dark:border-emerald-900/60 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Confirm exact name
            <input
              value={verifiedBusinessNameConfirmation}
              onChange={(event) => setVerifiedBusinessNameConfirmation(event.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-500 dark:border-emerald-900/60 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>

        {verifiedBusinessNameConfirmation && verifiedBusinessName !== verifiedBusinessNameConfirmation && (
          <p className="mt-2 text-xs font-black text-red-600 dark:text-red-300">The two legal-name entries do not match exactly.</p>
        )}

        <div className="mt-4 space-y-2">
          {ATTESTATIONS.map((attestation) => (
            <label key={attestation.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 dark:border-emerald-900/40 dark:bg-slate-950">
              <input
                type="checkbox"
                checked={attestations[attestation.key]}
                onChange={(event) => setAttestations((current) => ({ ...current, [attestation.key]: event.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-300">{attestation.label}</span>
            </label>
          ))}
        </div>

        <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Internal review notes (admin only)
          <textarea
            value={internalReviewNotes}
            onChange={(event) => setInternalReviewNotes(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-500 dark:border-emerald-900/60 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <button
          type="button"
          onClick={() => onDecide({
            attestations,
            decision: 'approve',
            internalReviewNotes,
            verifiedBusinessName,
            verifiedBusinessNameConfirmation,
          })}
          disabled={!approvalReady || Boolean(busyAction)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Approve verification
        </button>
      </section>

      <section className="rounded-3xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/10">
        <div className="mb-4 flex items-start gap-3">
          <XCircle size={21} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <h3 className="font-black text-slate-950 dark:text-white">Reject selected evidence</h3>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Select every requirement the client must replace and provide a client-visible reason.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOCUMENTS.map((document) => (
            <label key={document.kind} className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 dark:border-red-900/40 dark:bg-slate-950 dark:text-slate-300">
              <input
                type="checkbox"
                checked={rejectedKinds.includes(document.kind)}
                onChange={(event) => setRejectedKinds((current) => (
                  event.target.checked
                    ? [...new Set([...current, document.kind])]
                    : current.filter((kind) => kind !== document.kind)
                ))}
              />
              {document.label}
            </label>
          ))}
        </div>
        <textarea
          value={decisionReason}
          onChange={(event) => setDecisionReason(event.target.value)}
          rows={3}
          placeholder="Required reason shown to the client"
          className="mt-3 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-red-500 dark:border-red-900/60 dark:bg-slate-950 dark:text-white"
        />
        <button
          type="button"
          onClick={() => onDecide({
            decision: 'reject',
            decisionReason,
            internalReviewNotes,
            rejectedKinds,
          })}
          disabled={!rejectionReady || Boolean(busyAction)}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'reject' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
          Reject selected evidence
        </button>
      </section>
    </div>
  );
}

export function ClientVerificationReview({ showHeading = true }) {
  const { data, error, isLoading, mutate } = useBackendResource(
    backendApi.admin.listClientVerifications,
    EMPTY_LIST,
    { refreshInterval: 10000 }
  );
  const records = Array.isArray(data) ? data : EMPTY_LIST;
  const [filter, setFilter] = useState('pending_review');
  const [query, setQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [previewDocument, setPreviewDocument] = useState(null);
  const filteredRecords = useMemo(() => records.filter((record) => {
    const matchesStatus = filter === 'all' || record.status === filter;
    const haystack = `${record.client?.name || ''} ${record.client?.email || ''} ${record.client?.company || ''} ${record.verifiedBusinessName || ''}`.toLowerCase();
    return matchesStatus && haystack.includes(query.trim().toLowerCase());
  }), [filter, query, records]);
  const selectedRecord = records.find((record) => record.client?.id === selectedClientId) || null;

  useEffect(() => {
    if (selectedClientId && !records.some((record) => record.client?.id === selectedClientId)) {
      setSelectedClientId('');
    }
  }, [records, selectedClientId]);

  const replaceRecord = (updated) => {
    mutate((current) => (Array.isArray(current)
      ? current.map((record) => record.client?.id === updated.client?.id ? updated : record)
      : [updated]));
  };

  const handleDecision = async (payload) => {
    if (!selectedRecord) return;
    setBusyAction(payload.decision);
    setActionError('');
    try {
      replaceRecord(await backendApi.admin.decideClientVerification({
        ...payload,
        clientId: selectedRecord.client.id,
      }));
    } catch (decisionError) {
      setActionError(decisionError.message || 'Unable to save this decision.');
    } finally {
      setBusyAction('');
    }
  };

  const handleReset = async (reason) => {
    if (!selectedRecord) return;
    setBusyAction('reset');
    setActionError('');
    try {
      replaceRecord(await backendApi.admin.resetClientVerification({
        clientId: selectedRecord.client.id,
        reason,
      }));
    } catch (resetError) {
      setActionError(resetError.message || 'Unable to reset verification.');
    } finally {
      setBusyAction('');
    }
  };

  const openPreview = (document) => {
    warmDocumentPreviewRenderer(document.contentType, document.fileName);
    setPreviewDocument({
      contentType: document.contentType,
      fileName: document.fileName,
      urlPromise: backendApi.client.getVerificationDocumentUrl({ documentId: document.id }),
    });
  };

  return (
    <div className="portal-fade-in">
      {previewDocument && (
        <DocumentPreviewModal
          previewDocument={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      {showHeading && (
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">PB Finance admins only</Eyebrow>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Client Verification</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500 dark:text-slate-400">
              Review identity and regulated business evidence, then establish the protected legal business name used by future payment middleware.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {records.filter((record) => record.status === 'pending_review').length} awaiting review
          </div>
        </div>
      )}

      {(error || actionError) && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          {error?.message || actionError}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {['pending_review', 'approved', 'rejected', 'draft', 'all'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-xl px-3 py-2 text-xs font-black capitalize transition-colors ${
                filter === status
                  ? 'bg-slate-950 text-white dark:bg-cyan-600'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-950 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {formatStatus(status)}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search client or company"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Loader2 size={24} className="animate-spin text-cyan-600" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <CheckCircle2 size={28} className="mx-auto mb-3 text-slate-400" />
          <h2 className="font-black text-slate-950 dark:text-white">No matching verification cases</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">New client submissions will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredRecords.map((record) => (
            <article key={record.client.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-black text-slate-950 dark:text-white">{record.client.name}</h2>
                    <StatusPill status={record.status} />
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-500">{record.client.email}</p>
                  <p className="mt-1 text-sm font-bold text-cyan-700 dark:text-cyan-400">{record.client.company || 'No editable company name provided'}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">Submitted {formatDate(record.submittedAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClientId(record.client.id)}
                  className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                >
                  Review case
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {DOCUMENTS.map((config) => (
                  <DocumentRow
                    key={config.kind}
                    {...config}
                    document={record.documents?.[config.kind]}
                    onPreview={openPreview}
                  />
                ))}
              </div>

              {record.verifiedBusinessName && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600">Protected verifiedBusinessName</div>
                  <div className="mt-1 font-black text-emerald-900 dark:text-emerald-200">{record.verifiedBusinessName}</div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {selectedRecord && (
        <div className="mt-7 rounded-[2rem] border border-slate-300 bg-slate-50 p-5 shadow-inner dark:border-slate-700 dark:bg-slate-950 sm:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">Reviewing {selectedRecord.client.name}</h2>
                <StatusPill status={selectedRecord.status} />
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">The editable company label above is reference-only; use the business document for the trusted name.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedClientId('')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              Close review
            </button>
          </div>
          <ReviewForm
            key={`${selectedRecord.client.id}:${selectedRecord.status}:${selectedRecord.submittedAt || ''}`}
            record={selectedRecord}
            busyAction={busyAction}
            onDecide={handleDecision}
            onReset={handleReset}
          />
        </div>
      )}
    </div>
  );
}
