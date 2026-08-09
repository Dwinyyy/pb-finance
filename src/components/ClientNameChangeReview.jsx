import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  X,
} from 'lucide-react';

import { backendApi } from '../services/api';
import { Button } from './ui/Button.jsx';
import { FormField } from './ui/FormField.jsx';
import { StatusBadge } from './ui/StatusBadge.jsx';
import { SurfaceCard } from './ui/SurfaceCard.jsx';

const EMPTY_REQUESTS = Object.freeze([]);
const EMPTY_NAME_CHANGE_DATA = Object.freeze({
  pendingCount: 0,
  requests: EMPTY_REQUESTS,
});

const timestampFor = (value) => {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatRequestDate = (value) => {
  const timestamp = timestampFor(value);
  if (!timestamp) return 'Date unavailable';

  return new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatRequestAge = (value) => {
  const timestamp = timestampFor(value);
  if (!timestamp) return 'Age unavailable';

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return 'moments ago';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
};

const pendingFirst = (requests) => [...requests].sort((left, right) => {
  const leftPending = left.status === 'pending' ? 0 : 1;
  const rightPending = right.status === 'pending' ? 0 : 1;

  return leftPending - rightPending || timestampFor(right.createdAt) - timestampFor(left.createdAt);
});

const focusNameChangeReviewElement = (element) => {
  if (typeof element?.focus === 'function') {
    element.focus();
  }
};

const restoreNameChangeRequestFocus = (element) => {
  focusNameChangeReviewElement(element);
};

const canChangeNameReviewContext = (isSubmitting) => !isSubmitting;

const getNameChangeDecisionOutcome = (decision) => (
  decision === 'approved'
    ? {
        message: 'Name change approved. The canonical queue is being refreshed.',
        tone: 'verified',
      }
    : {
        message: 'Name change rejected. The canonical queue is being refreshed.',
        tone: 'danger',
      }
);

const getStaleNameChangeDecisionOutcome = () => ({
  message: 'Another administrator already decided this request. Refreshing the latest queue.',
  tone: 'warning',
});

function FeedbackMessage({ children, tone = 'info' }) {
  const toneClasses = {
    danger: 'border-danger-border bg-danger-surface text-danger',
    info: 'border-info-border bg-info-surface text-info',
    verified: 'border-verified-border bg-verified-surface text-verified',
    warning: 'border-warning-border bg-warning-surface text-warning',
  };

  return (
    <SurfaceCard className={`p-4 text-sm font-semibold ${toneClasses[tone] || toneClasses.info}`}>
      {children}
    </SurfaceCard>
  );
}

function NameComparison({ currentFullName, requestedFullName }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-control border border-border-subtle bg-surface-muted p-4">
        <dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Current full name</dt>
        <dd className="mt-1 text-base font-bold text-text-primary">{currentFullName}</dd>
      </div>
      <div className="rounded-control border border-info-border bg-info-surface p-4">
        <dt className="text-xs font-bold uppercase tracking-wider text-info">Requested full name</dt>
        <dd className="mt-1 text-base font-bold text-text-primary">{requestedFullName}</dd>
      </div>
    </dl>
  );
}

export function ClientNameChangeReview({ nameChangeResource, onBusyChange }) {
  const {
    data = EMPTY_NAME_CHANGE_DATA,
    error = null,
    isLoading = false,
    refetch = async () => EMPTY_NAME_CHANGE_DATA,
  } = nameChangeResource || {};
  const requests = Array.isArray(data?.requests) ? data.requests : EMPTY_REQUESTS;
  const sortedRequests = useMemo(() => pendingFirst(requests), [requests]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [decision, setDecision] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewNoteError, setReviewNoteError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [decisionOutcome, setDecisionOutcome] = useState(null);
  const decisionRegionRef = useRef(null);
  const requestButtonRefs = useRef(new Map());
  const originatingRequestIdRef = useRef('');
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) || null;

  useEffect(() => {
    if (selectedRequestId) {
      focusNameChangeReviewElement(decisionRegionRef.current);
    }
  }, [selectedRequestId]);

  useEffect(() => {
    if (!isSubmitting && selectedRequestId && (decisionOutcome || actionError)) {
      focusNameChangeReviewElement(decisionRegionRef.current);
    }
  }, [actionError, decisionOutcome, isSubmitting, selectedRequestId]);

  const resetDecisionDraft = () => {
    setDecision('');
    setReviewNote('');
    setReviewNoteError('');
    setActionError('');
    setDecisionOutcome(null);
  };

  const selectRequest = (requestId) => {
    if (!canChangeNameReviewContext(isSubmitting)) return;

    originatingRequestIdRef.current = requestId;
    setSelectedRequestId(requestId);
    resetDecisionDraft();
  };

  const closeDecisionRegion = () => {
    if (!canChangeNameReviewContext(isSubmitting)) return;

    const originatingRequestButton = requestButtonRefs.current.get(originatingRequestIdRef.current);
    restoreNameChangeRequestFocus(originatingRequestButton);
    setSelectedRequestId('');
    resetDecisionDraft();
  };

  const startDecision = (nextDecision) => {
    if (!canChangeNameReviewContext(isSubmitting)) return;

    setDecision(nextDecision);
    setReviewNote('');
    setReviewNoteError('');
    setActionError('');
    setDecisionOutcome(null);
  };

  const submitDecision = async (event) => {
    event.preventDefault();
    if (!selectedRequest || selectedRequest.status !== 'pending' || isSubmitting) return;

    if (decision === 'rejected' && !reviewNote.trim()) {
      setReviewNoteError('Enter the client-visible reason for rejecting this request.');
      return;
    }

    if (!['approved', 'rejected'].includes(decision)) return;

    focusNameChangeReviewElement(decisionRegionRef.current);
    setIsSubmitting(true);
    setReviewNoteError('');
    setActionError('');
    setDecisionOutcome(null);
    onBusyChange?.(true);

    try {
      await backendApi.admin.decideClientNameChange({
        requestId: selectedRequest.id,
        decision,
        reviewNote: reviewNote.trim(),
      });
      setDecisionOutcome(getNameChangeDecisionOutcome(decision));
      setDecision('');
      setReviewNote('');

      try {
        await refetch();
      } catch (refreshError) {
        setActionError(
          refreshError.message
            || 'The decision was saved, but the canonical queue could not refresh. Retry the queue.'
        );
      }
    } catch (decisionError) {
      if (decisionError.status === 409) {
        setDecisionOutcome(getStaleNameChangeDecisionOutcome());

        try {
          await refetch();
        } catch (refreshError) {
          setActionError(
            refreshError.message
              || 'This request was already decided, but the canonical queue could not refresh. Retry the queue.'
          );
        }
      } else {
        setActionError(decisionError.message || 'Unable to save this name-change decision.');
      }
    } finally {
      setIsSubmitting(false);
      onBusyChange?.(false);
    }
  };

  const persistentFeedback = (
    <>
      {decisionOutcome && (
        <div role="status" aria-live="polite">
          <FeedbackMessage tone={decisionOutcome.tone}>{decisionOutcome.message}</FeedbackMessage>
        </div>
      )}
      {actionError && (
        <div role="alert">
          <FeedbackMessage tone="danger">{actionError}</FeedbackMessage>
        </div>
      )}
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {persistentFeedback}
        <div role="status" aria-live="polite">
          <SurfaceCard className="flex min-h-48 items-center justify-center gap-3 p-8 text-sm font-semibold text-text-muted">
            <Loader2 className="size-5 animate-spin text-processing" aria-hidden="true" />
            Loading name change requests
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {persistentFeedback}
        <div role="alert">
          <SurfaceCard className="space-y-4 border-danger-border bg-danger-surface p-6 text-danger">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-bold">Unable to load name change requests</h2>
                <p className="mt-1 text-sm font-medium">{error.message || 'Try loading the queue again.'}</p>
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={() => refetch()}>
              <RefreshCcw className="mr-2 size-4" aria-hidden="true" />
              Retry
            </Button>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (sortedRequests.length === 0) {
    return (
      <div className="space-y-6">
        {persistentFeedback}
        <SurfaceCard className="border-dashed p-10 text-center">
          <CheckCircle2 className="mx-auto size-8 text-verified" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-text-primary">No name change requests</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-text-muted">
            New protected-name requests and completed review history will appear here.
          </p>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {persistentFeedback}

      <div className="grid gap-4 xl:grid-cols-2">
        {sortedRequests.map((request) => (
          <SurfaceCard key={request.id} as="article" className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-text-primary">{request.requestedFullName}</h2>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 text-sm font-medium text-text-muted">
                  {request.client.email} · {request.client.company || 'No display company provided'}
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-text-muted">
                  <Clock3 className="size-4" aria-hidden="true" />
                  Requested {formatRequestAge(request.createdAt)} · {formatRequestDate(request.createdAt)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                ref={(node) => {
                  if (node) {
                    requestButtonRefs.current.set(request.id, node);
                  } else {
                    requestButtonRefs.current.delete(request.id);
                  }
                }}
                disabled={isSubmitting}
                aria-controls={selectedRequestId === request.id ? 'name-change-decision-region' : undefined}
                onClick={() => selectRequest(request.id)}
              >
                {request.status === 'pending' ? 'Review request' : 'View history'}
              </Button>
            </div>

            <div className="mt-5">
              <NameComparison
                currentFullName={request.currentFullName}
                requestedFullName={request.requestedFullName}
              />
            </div>

            <div className="mt-4 rounded-control border border-border-subtle bg-surface-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Client explanation</h3>
                <StatusBadge label={`Verification: ${String(request.verificationStatus || 'draft').replaceAll('_', ' ')}`} status={request.verificationStatus || 'draft'} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-text-primary">
                {request.requestReason}
              </p>
            </div>
          </SurfaceCard>
        ))}
      </div>

      {selectedRequest && (
        <section
          id="name-change-decision-region"
          role="region"
          ref={decisionRegionRef}
          tabIndex={-1}
          aria-labelledby={`name-change-decision-${selectedRequest.id}`}
          className="scroll-mt-24 rounded-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
        >
          <SurfaceCard className="space-y-5 border-border-control p-5 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`name-change-decision-${selectedRequest.id}`} className="text-xl font-bold text-text-primary">
                    {selectedRequest.status === 'pending' ? 'Decide name change' : 'Name change history'}
                  </h2>
                  <StatusBadge status={selectedRequest.status} />
                </div>
                <p className="mt-1 text-sm font-medium text-text-muted">
                  Confirm both names below before submitting an irreversible admin decision.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isSubmitting}
                onClick={closeDecisionRegion}
              >
                <X className="mr-2 size-4" aria-hidden="true" />
                Close
              </Button>
            </div>

            <NameComparison
              currentFullName={selectedRequest.currentFullName}
              requestedFullName={selectedRequest.requestedFullName}
            />

            {selectedRequest.status === 'pending' ? (
              <>
                <div className="flex flex-wrap gap-3" role="group" aria-label="Name change decision">
                  <Button
                    type="button"
                    variant={decision === 'approved' ? 'primary' : 'secondary'}
                    aria-pressed={decision === 'approved'}
                    disabled={isSubmitting}
                    onClick={() => startDecision('approved')}
                  >
                    <Check className="mr-2 size-4" aria-hidden="true" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant={decision === 'rejected' ? 'danger' : 'secondary'}
                    aria-pressed={decision === 'rejected'}
                    disabled={isSubmitting}
                    onClick={() => startDecision('rejected')}
                  >
                    <X className="mr-2 size-4" aria-hidden="true" />
                    Reject
                  </Button>
                </div>

                {decision && (
                  <form onSubmit={submitDecision} className="space-y-4">
                    <FormField
                      id={`name-change-review-note-${selectedRequest.id}`}
                      label={decision === 'rejected' ? 'Client-visible rejection reason' : 'Review note (optional)'}
                      required={decision === 'rejected'}
                      error={reviewNoteError}
                      hint={decision === 'approved' ? 'Add context for the audit history if useful.' : ''}
                    >
                      {(fieldProps) => (
                        <textarea
                          {...fieldProps}
                          id={`name-change-review-note-${selectedRequest.id}`}
                          value={reviewNote}
                          onChange={(event) => {
                            setReviewNote(event.target.value);
                            setReviewNoteError('');
                          }}
                          disabled={isSubmitting}
                          rows={4}
                        />
                      )}
                    </FormField>
                    <Button
                      type="submit"
                      variant={decision === 'rejected' ? 'danger' : 'primary'}
                      isLoading={isSubmitting}
                    >
                      {decision === 'approved' ? 'Approve name change' : 'Reject name change'}
                    </Button>
                  </form>
                )}
              </>
            ) : (
              <div className="rounded-control border border-border-subtle bg-surface-muted p-4">
                <div className="flex items-start gap-3">
                  <History className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden="true" />
                  <div>
                    <h3 className="font-bold text-text-primary">Historical decision</h3>
                    <p className="mt-1 text-sm font-medium text-text-muted">
                      This request can no longer be changed from this workspace.
                    </p>
                    {selectedRequest.decisionReason && (
                      <p className="mt-3 whitespace-pre-wrap text-sm font-medium text-text-primary">
                        {selectedRequest.decisionReason}
                      </p>
                    )}
                    {selectedRequest.reviewedAt && (
                      <p className="mt-2 text-xs font-semibold text-text-muted">
                        Reviewed {formatRequestDate(selectedRequest.reviewedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SurfaceCard>
        </section>
      )}
    </div>
  );
}

ClientNameChangeReview.interactionHelpers = Object.freeze({
  canChangeNameReviewContext,
  focusNameChangeReviewElement,
  getNameChangeDecisionOutcome,
  getStaleNameChangeDecisionOutcome,
  restoreNameChangeRequestFocus,
});
