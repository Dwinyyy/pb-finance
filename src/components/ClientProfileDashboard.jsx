import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Clock3, Loader2, ShieldCheck, UserRound } from 'lucide-react';

import {
  createClientProfileDraft,
  shouldRequestProtectedNameReason,
  validateClientProfileDraft,
} from '../utils/clientProfileForm.js';
import { backendApi } from '../services/api.js';
import { ClientVerificationDashboard } from './ClientVerificationDashboard.jsx';
import { Button } from './ui/Button.jsx';
import { Eyebrow } from './ui/Eyebrow.jsx';
import { FileDropzone } from './ui/FileDropzone.jsx';
import { FormField } from './ui/FormField.jsx';
import { StatusBadge } from './ui/StatusBadge.jsx';
import { toneForTier } from './ui/statusTone.js';
import { SurfaceCard } from './ui/SurfaceCard.jsx';

const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024;

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Unable to read this image.'));
  reader.readAsDataURL(file);
});

const accountFromUser = (user = {}) => ({
  avatarUrl: user.avatarUrl || user.avatar_url || null,
  clientTier: user.clientTier || user.client_tier || 'basic',
  clientTierLabel: user.clientTierLabel || user.client_tier_label || 'Basic',
  company: user.company || '',
  email: user.email || '',
  fullName: user.name || user.fullName || user.full_name || '',
  id: user.id || '',
  role: user.role || 'client',
});

const applyClientProfileAvatarResult = (current, avatarUrl) => {
  if (!current?.account) return current;

  return {
    ...current,
    account: { ...current.account, avatarUrl },
  };
};

const reconcileClientProfileSaveResult = (current, result) => {
  if (!result?.account) return result;

  const currentHasAvatar = Boolean(current?.account) && Object.hasOwn(current.account, 'avatarUrl');

  return {
    ...result,
    account: {
      ...result.account,
      ...(currentHasAvatar ? { avatarUrl: current.account.avatarUrl } : {}),
    },
  };
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const profileInitials = (value) => String(value || 'Client')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join('');

const nameOutcomeMessage = {
  pending_approval: 'Your display updates were saved and your full-name request was sent to PB Finance admins.',
  unchanged: 'Your account details are up to date.',
  updated: 'Your account details were updated.',
};

export function ClientProfileDashboard({
  user,
  section = 'account',
  onSectionChange = () => {},
  onUserUpdated = () => {},
}) {
  const normalizedSection = section === 'verification' ? 'verification' : 'account';
  const fallbackAccount = accountFromUser(user);
  const [canonical, setCanonical] = useState(null);
  const [draft, setDraft] = useState(() => createClientProfileDraft(fallbackAccount));
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const dirtyRef = useRef(false);
  const loadRequestRef = useRef(0);
  const mutationRevisionRef = useRef(0);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    loadRequestRef.current += 1;
    mutationRevisionRef.current += 1;
    dirtyRef.current = false;
    setCanonical(null);
    setDraft(createClientProfileDraft(accountFromUser(userRef.current)));
    setFieldErrors({});
    setLoadError('');
    setSaveError('');
    setSaveSuccess('');
    setUploadError('');
    setUploadSuccess('');
  }, [user?.id]);

  const loadProfile = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const mutationRevision = mutationRevisionRef.current;
    setLoading(true);
    setLoadError('');

    try {
      const result = await backendApi.client.getMyProfile();

      if (
        requestId !== loadRequestRef.current
        || mutationRevision !== mutationRevisionRef.current
      ) return;

      setCanonical(result);
      if (!dirtyRef.current) setDraft(createClientProfileDraft(result.account));
    } catch (error) {
      if (
        requestId === loadRequestRef.current
        && mutationRevision === mutationRevisionRef.current
      ) {
        setLoadError(error.message || 'Unable to load your account profile.');
      }
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (normalizedSection !== 'account') return;
    loadProfile();
  }, [loadProfile, normalizedSection, user]);

  const account = canonical?.account || fallbackAccount;
  const verification = canonical?.verification || { status: 'draft', verifiedBusinessName: null };
  const pendingNameRequest = canonical?.pendingNameRequest || null;
  const latestNameRequest = canonical?.latestNameRequest || null;
  const hasPendingNameRequest = pendingNameRequest?.status === 'pending';
  const requiresProtectedNameReason = shouldRequestProtectedNameReason(draft, {
    activeFullName: account.fullName,
    verificationStatus: verification.status,
  });

  const updateDraft = (field, value) => {
    dirtyRef.current = true;
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setSaveError('');
    setSaveSuccess('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const errors = validateClientProfileDraft(draft, {
      activeFullName: account.fullName,
      pendingNameRequest,
      verificationStatus: verification.status,
    });

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setSaveError('Review the highlighted account fields.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const result = await backendApi.client.updateMyProfile({
        company: draft.company,
        fullName: draft.fullName,
        requestReason: requiresProtectedNameReason ? draft.requestReason : null,
      });
      mutationRevisionRef.current += 1;
      setCanonical((current) => reconcileClientProfileSaveResult(current, result));
      setDraft(createClientProfileDraft(result.account));
      setFieldErrors({});
      dirtyRef.current = false;
      setSaveSuccess(nameOutcomeMessage[result.nameOutcome] || 'Your account details were saved.');
      if (result.sessionSummary) onUserUpdated(result.sessionSummary);
    } catch (error) {
      setSaveError(error.message || 'Unable to save your account details.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > MAX_PROFILE_PHOTO_BYTES) {
      setUploadError('Choose a JPEG or PNG image no larger than 3 MB.');
      setUploadSuccess('');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const result = await backendApi.client.uploadProfilePhoto({
        contentType: file.type,
        fileData: await fileToDataUrl(file),
        fileName: file.name,
      });
      mutationRevisionRef.current += 1;
      setCanonical((current) => applyClientProfileAvatarResult(current, result.avatarUrl));
      setUploadSuccess('Display avatar updated.');
      if (result.sessionSummary) onUserUpdated(result.sessionSummary);
    } catch (error) {
      setUploadError(error.message || 'Unable to upload your display avatar.');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (!canonical?.account) return;
    setDraft(createClientProfileDraft(canonical.account));
    setFieldErrors({});
    setSaveError('');
    setSaveSuccess('');
    dirtyRef.current = false;
  };

  return (
    <div className="portal-fade-in space-y-6">
      <SurfaceCard as="header" tone="trust" className="overflow-hidden p-5 sm:p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Eyebrow className="mb-3 text-xs font-bold text-info">Client profile</Eyebrow>
            <h1 className="text-3xl font-black tracking-tight text-text-primary">Account & verification</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-text-muted">
              Manage your display account separately from the regulated evidence reviewed by PB Finance admins.
            </p>
          </div>
          <div
            className="flex w-full gap-2 rounded-control border border-border-subtle bg-surface-muted p-1 sm:w-auto"
            role="group"
            aria-label="Profile sections"
          >
            <Button
              type="button"
              variant={normalizedSection === 'account' ? 'primary' : 'ghost'}
              aria-pressed={normalizedSection === 'account'}
              onClick={() => onSectionChange('account')}
              className="min-h-11 flex-1 sm:flex-none"
            >
              Account
            </Button>
            <Button
              type="button"
              variant={normalizedSection === 'verification' ? 'primary' : 'ghost'}
              aria-pressed={normalizedSection === 'verification'}
              onClick={() => onSectionChange('verification')}
              className="min-h-11 flex-1 sm:flex-none"
            >
              Verification
            </Button>
          </div>
        </div>
      </SurfaceCard>

      {normalizedSection === 'verification' ? <ClientVerificationDashboard /> : (
        <section aria-label="Client account settings" className="space-y-6">
          {loading && !canonical && (
            <SurfaceCard as="div" className="flex items-center gap-3 p-5 text-sm font-semibold text-text-muted" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading your account profile
            </SurfaceCard>
          )}

          {loadError && !canonical && (
            <SurfaceCard as="div" tone="muted" className="space-y-3 border-danger-border p-5" role="alert">
              <p className="text-sm font-semibold text-danger">{loadError}</p>
              <Button type="button" variant="secondary" onClick={loadProfile}>Retry</Button>
            </SurfaceCard>
          )}

          {(!loading || canonical) && (!loadError || canonical) && (
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="min-w-0 space-y-6">
                <SurfaceCard as="section" className="p-5 sm:p-6" aria-labelledby="client-display-avatar-title">
                  <div className="mb-5 flex items-center gap-4">
                    {account.avatarUrl ? (
                      <img
                        src={account.avatarUrl}
                        alt={`${account.fullName || 'Client'} profile`}
                        className="size-20 rounded-full border border-border-subtle object-cover shadow-card"
                      />
                    ) : (
                      <div className="grid size-20 place-items-center rounded-full bg-pb-midnight text-xl font-black text-white" aria-hidden="true">
                        {profileInitials(account.fullName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 id="client-display-avatar-title" className="font-black text-text-primary">Display avatar</h2>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-text-muted">
                        This display avatar personalizes your account. It is not verification evidence.
                      </p>
                    </div>
                  </div>
                  <FileDropzone
                    id="client-profile-photo"
                    label="Profile photo"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    fileName={account.avatarUrl ? 'Current display avatar' : ''}
                    helpText="JPEG or PNG only, up to 3 MB. Uploading here never replaces verification evidence."
                    isBusy={uploading}
                    error={uploadError}
                    status={account.avatarUrl ? 'uploaded' : ''}
                    onFile={handlePhoto}
                  />
                  {uploadSuccess && <p className="mt-3 text-sm font-semibold text-verified" role="status">{uploadSuccess}</p>}
                </SurfaceCard>

                <SurfaceCard as="section" tone="muted" className="p-5 sm:p-6" aria-labelledby="client-account-status-title">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 id="client-account-status-title" className="font-black text-text-primary">Account status</h2>
                      <p className="mt-1 text-xs font-medium text-text-muted">Protected account facts are read-only.</p>
                    </div>
                    <StatusBadge label={account.clientTierLabel} status={account.clientTier} tone={toneForTier(account.clientTier)} />
                  </div>
                  <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Email</dt><dd className="mt-1 break-all font-semibold text-text-primary">{account.email || 'Unavailable'}</dd></div>
                    <div><dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Account type</dt><dd className="mt-1 font-semibold capitalize text-text-primary">{account.role || 'client'}</dd></div>
                    <div><dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Verification</dt><dd className="mt-1"><StatusBadge status={verification.status} /></dd></div>
                    <div><dt className="text-xs font-bold uppercase tracking-wider text-text-muted">Verified legal business name</dt><dd className="mt-1 font-semibold text-text-primary">{verification.verifiedBusinessName || 'Not approved'}</dd></div>
                  </dl>
                </SurfaceCard>
              </div>

              <div className="min-w-0 space-y-6">
                <SurfaceCard as="section" className="p-5 sm:p-6" aria-labelledby="client-account-details-title">
                  <div className="mb-5 flex items-start gap-3">
                    <UserRound className="mt-0.5 h-5 w-5 text-action" aria-hidden="true" />
                    <div>
                      <h2 id="client-account-details-title" className="font-black text-text-primary">Account details</h2>
                      <p className="mt-1 text-xs font-medium text-text-muted">Your display company remains separate from any approved legal business name.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSave} className="space-y-5" noValidate>
                    <FormField id="client-full-name" label="Full name" error={fieldErrors.fullName} required>
                      {({ describedBy, ...fieldProps }) => (
                        <input
                          {...fieldProps}
                          data-description-id={describedBy}
                          id="client-full-name"
                          value={draft.fullName}
                          readOnly={hasPendingNameRequest}
                          onChange={(event) => updateDraft('fullName', event.target.value)}
                        />
                      )}
                    </FormField>
                    <FormField id="client-company" label="Display company" error={fieldErrors.company} required>
                      {({ describedBy, ...fieldProps }) => (
                        <input
                          {...fieldProps}
                          data-description-id={describedBy}
                          id="client-company"
                          value={draft.company}
                          onChange={(event) => updateDraft('company', event.target.value)}
                        />
                      )}
                    </FormField>

                    {requiresProtectedNameReason && (
                      <FormField
                        id="client-name-change-reason"
                        label="Why should PB Finance approve this name change?"
                        error={fieldErrors.requestReason}
                        hint="A 1 to 1,000 character explanation is required. Your active name stays unchanged until an admin approves it."
                        required
                      >
                        {({ describedBy, ...fieldProps }) => (
                          <textarea
                            {...fieldProps}
                            data-description-id={describedBy}
                            id="client-name-change-reason"
                            rows={4}
                            value={draft.requestReason}
                            onChange={(event) => updateDraft('requestReason', event.target.value)}
                          />
                        )}
                      </FormField>
                    )}

                    <div aria-live="polite" className="space-y-2">
                      {saveError && <p role="alert" className="text-sm font-semibold text-danger">{saveError}</p>}
                      {saveSuccess && <p role="status" className="text-sm font-semibold text-verified">{saveSuccess}</p>}
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end">
                      <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>Cancel</Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Saving...</> : 'Save changes'}
                      </Button>
                    </div>
                  </form>
                </SurfaceCard>

                {pendingNameRequest && (
                  <SurfaceCard as="section" tone="muted" className="border-warning-border p-5 sm:p-6" aria-labelledby="pending-name-request-title">
                    <div className="flex items-start gap-3 text-warning">
                      <Clock3 className="mt-0.5 h-5 w-5" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 id="pending-name-request-title" className="font-black">Name approval pending</h2>
                          <StatusBadge status={pendingNameRequest.status} />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-text-primary">Requested name: {pendingNameRequest.requestedFullName}</p>
                        <p className="mt-2 text-sm text-text-muted">{pendingNameRequest.requestReason}</p>
                        {pendingNameRequest.createdAt && <p className="mt-3 text-xs font-semibold text-text-muted">Submitted {formatDate(pendingNameRequest.createdAt)}</p>}
                      </div>
                    </div>
                  </SurfaceCard>
                )}

                {latestNameRequest && (
                  <SurfaceCard as="section" tone="muted" className="p-5 sm:p-6" aria-labelledby="latest-name-decision-title">
                    <div className="flex items-start gap-3">
                      {latestNameRequest.status === 'approved'
                        ? <BadgeCheck className="mt-0.5 h-5 w-5 text-verified" aria-hidden="true" />
                        : <ShieldCheck className="mt-0.5 h-5 w-5 text-text-muted" aria-hidden="true" />}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 id="latest-name-decision-title" className="font-black text-text-primary">Latest name decision</h2>
                          <StatusBadge status={latestNameRequest.status} />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-text-primary">{latestNameRequest.requestedFullName}</p>
                        {latestNameRequest.decisionReason && <p className="mt-2 text-sm text-text-muted">{latestNameRequest.decisionReason}</p>}
                        {latestNameRequest.reviewedAt && <p className="mt-3 text-xs font-semibold text-text-muted">Reviewed {formatDate(latestNameRequest.reviewedAt)}</p>}
                      </div>
                    </div>
                  </SurfaceCard>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
