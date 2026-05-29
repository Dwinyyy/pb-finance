import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building,
  CheckCircle,
  Clock3,
  Download,
  EyeOff,
  FileText,
  Loader2,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Users,
  XCircle,
} from 'lucide-react';

import FadeIn from '../components/FadeIn';
import { NotificationBell } from '../components/NotificationBell';
import { useBackendResource } from '../hooks/useBackendResource';
import { useNotifications } from '../hooks/useNotifications';
import { PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS, REGULATED_TITLE_REQUIREMENTS } from '../data/constants';
import { backendApi } from '../services/api';
import { countUnreadNotificationsByTab, getUnreadNotificationsForTab } from '../utils/notificationRouting';

const EMPTY_LIST = Object.freeze([]);
const STATUS_OPTIONS = ['pending_review', 'approved', 'hidden', 'rejected'];
const DOCUMENT_REJECTION_MESSAGES = [
  'Document is unreadable or blurry.',
  'Document does not match the selected professional title.',
  'Name or identifying details do not match the profile.',
  'Document appears expired or incomplete.',
  'Please upload the official certificate, license, or verification page.',
];
const ADMIN_TABS = ['overview', 'talent', 'agencies'];
const ADMIN_NOTIFICATION_TAB_FALLBACKS = {
  agency_submitted: 'agencies',
  talent_profile_submitted: 'talent',
};

const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};
const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString()}` : value || 'Pending');
const statusLabel = (status) => String(status || 'draft').replace(/_/g, ' ');
const formatFileSize = (value) => {
  const size = Number(value || 0);

  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
const getCredentialStatusStyle = (status) => ({
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
}[status] || 'border-slate-200 bg-slate-50 text-slate-600');
const getDocumentIdentity = (document) => document.key || document.id || document.label || document.fileName;
const getExpectedDocumentLabels = (profile) => {
  const titles = asList(profile.titles).length ? asList(profile.titles) : asList(profile.title || profile.role);

  return [...new Set(titles.flatMap((title) => asList(PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS[title])))];
};
const documentMatchesLabel = (document, label) => (
  document?.label === label
  || document?.key === label
  || String(document?.key || '').endsWith(`:${label}`)
);
const documentMatchesAnyLabel = (document, labels) => asList(labels).some((label) => documentMatchesLabel(document, label));
const hasUploadedDocument = (documents, label) => documents.some((document) => documentMatchesLabel(document, label));
const getProfileWorkPreferences = (profile) => {
  const wp = profile.workPreferences || profile.work_preferences;
  return typeof wp === 'object' && wp !== null ? wp : {};
};
const getProfileResume = (profile) => profile.resume || getProfileWorkPreferences(profile).resume || null;
const getProfileSupportingDocuments = (profile) => asList(profile.supportingDocuments || getProfileWorkPreferences(profile).supportingDocuments);
const getProfileRegulatedInputs = (profile) => {
  const wp = getProfileWorkPreferences(profile);
  return (wp.regulatedInputs && typeof wp.regulatedInputs === 'object') ? wp.regulatedInputs : {};
};
const validateRegulatedInputValue = (field, value) => {
  const text = String(value || '').trim();

  if (!field.required && !text) return true;
  if (field.pattern) return new RegExp(field.pattern, 'i').test(text);

  return Boolean(text);
};
const getRegulatedInputBlocker = (profile) => {
  const inputs = getProfileRegulatedInputs(profile);

  for (const title of (asList(profile.titles).length ? asList(profile.titles) : asList(profile.title || profile.role))) {
    const requirements = REGULATED_TITLE_REQUIREMENTS[title];

    if (!requirements?.inputFields) continue;

    for (const field of requirements.inputFields) {
      const value = inputs[field.id];
      if (field.required && !String(value || '').trim()) {
        return `Missing required regulatory input: ${field.label} for ${title}.`;
      }
      if (String(value || '').trim() && !validateRegulatedInputValue(field, value)) {
        return `Invalid regulatory input: ${field.label} for ${title}.`;
      }
    }
  }

  return '';
};
const getProfileExternalLinks = (profile) => asList(profile.externalLinks || getProfileWorkPreferences(profile).externalLinks);

const getReviewDocuments = (profile) => {
  const requiredLabels = getExpectedDocumentLabels(profile);
  const resume = getProfileResume(profile);
  const supportingDocs = getProfileSupportingDocuments(profile);

  return [
    ...(resume ? [{
      ...resume,
      documentType: 'resume',
      reviewLabel: 'Resume',
      reviewScope: 'required',
    }] : []),
    ...supportingDocs.map((document) => {
      const isRequired = documentMatchesAnyLabel(document, requiredLabels);

      return {
        ...document,
        documentType: document.kind || (isRequired ? 'certification' : 'other_document'),
        reviewLabel: document.label || (isRequired ? 'Certification document' : 'Other document'),
        reviewScope: isRequired ? 'required' : 'optional',
      };
    }),
  ];
};
const getReviewDocumentKindLabel = (document) => {
  if (document.documentType === 'resume' || document.kind === 'resume') return 'Resume';
  if (document.documentType === 'certification' || document.kind === 'certification' || document.reviewScope === 'required') return 'Certification';
  if (document.documentType === 'other_document' || document.kind === 'other_document') return 'Other document';

  return 'Supporting document';
};
const getCredentialReviewState = (profile, documents = getReviewDocuments(profile)) => {
  const resume = documents.find((document) => document.documentType === 'resume');
  const supportingDocuments = documents.filter((document) => document.documentType !== 'resume');
  const allSupportingDocs = [...supportingDocuments, ...getProfileSupportingDocuments(profile)];
  const missingDocuments = getExpectedDocumentLabels(profile)
    .filter((label) => !hasUploadedDocument(allSupportingDocs, label));
  const requiredDocuments = documents.filter((document) => (
    document.documentType === 'resume' || document.reviewScope === 'required'
  ));
  const pendingDocuments = requiredDocuments.filter((document) => (document.status || 'pending_review') === 'pending_review');
  const rejectedDocuments = requiredDocuments.filter((document) => document.status === 'rejected');
  const approvedDocuments = requiredDocuments.filter((document) => document.status === 'approved');
  const optionalCount = documents.filter((document) => document.reviewScope === 'optional').length;
  let approvalBlocker = '';

  if (!resume) {
    approvalBlocker = 'Resume approval is required before this profile can be approved.';
  } else if (missingDocuments.length) {
    approvalBlocker = `${missingDocuments.length} required certification document${missingDocuments.length === 1 ? '' : 's'} still need to be uploaded.`;
  } else if (rejectedDocuments.length) {
    approvalBlocker = `${rejectedDocuments.length} required document${rejectedDocuments.length === 1 ? '' : 's'} need a replacement upload.`;
  } else if (pendingDocuments.length) {
    approvalBlocker = `${pendingDocuments.length} required document${pendingDocuments.length === 1 ? '' : 's'} still need admin review.`;
  } else {
    approvalBlocker = getRegulatedInputBlocker(profile);
  }

  return {
    approvalBlocker,
    approvedCount: approvedDocuments.length,
    missingDocuments,
    optionalCount,
    pendingCount: pendingDocuments.length,
    rejectedCount: rejectedDocuments.length,
    resume,
    requiredCount: requiredDocuments.length,
    totalCount: documents.length,
  };
};

const statusStyles = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  hidden: 'border-slate-300 bg-slate-100 text-slate-700',
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
};

const STATUS_ACTIONS = [
  { icon: CheckCircle, label: 'Approve', status: 'approved', variant: 'primary' },
  { icon: Clock3, label: 'Pending', status: 'pending_review', variant: 'neutral' },
  { icon: EyeOff, label: 'Hide', status: 'hidden', variant: 'neutral' },
  { icon: XCircle, label: 'Reject', status: 'rejected', variant: 'danger' },
];

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[status] || statusStyles.draft}`}>
      {statusLabel(status)}
    </span>
  );
}

function StatusSummary({ records }) {
  const counts = STATUS_OPTIONS.map((status) => ({
    status,
    count: records.filter((record) => record.status === status).length,
  }));

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {counts.map((item) => (
        <div key={item.status} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{statusLabel(item.status)}</div>
          <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{item.count}</div>
        </div>
      ))}
    </div>
  );
}

function StatusActions({ busyKey, currentStatus, disabledStatusReasons = {}, onUpdate, record, rejected = true }) {
  const availableActions = STATUS_ACTIONS.filter((action) => (
    action.status !== currentStatus && (rejected || action.status !== 'rejected')
  ));
  const recordBusy = Boolean(busyKey) && availableActions.some((action) => busyKey === `${record.id}:${action.status}`);

  return (
    <div className={`grid gap-2 ${rejected ? 'sm:grid-cols-3 xl:grid-cols-4' : 'sm:grid-cols-3'}`}>
      {availableActions.map((action) => {
        const Icon = action.icon;
        const actionBusy = busyKey === `${record.id}:${action.status}`;
        const disabledReason = disabledStatusReasons[action.status] || '';
        const className = action.variant === 'primary'
          ? 'bg-slate-950 text-white hover:bg-emerald-600 disabled:opacity-70'
          : action.variant === 'danger'
            ? 'border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-70 dark:border-red-900/40 dark:hover:bg-red-950/20'
            : 'border border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:text-slate-300';

        return (
          <button
            key={action.status}
            onClick={() => onUpdate(record, action.status)}
            disabled={recordBusy || Boolean(disabledReason)}
            title={disabledReason || action.label}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors disabled:cursor-default ${className}`}
          >
            {actionBusy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

function CredentialReviewPanel({
  busyKey,
  documents,
  onDownload,
  onApprove,
  onReviewChangeRequest,
  onReject,
  onView,
  profile,
  rejectDraft,
  reviewState,
  setRejectDraft,
}) {
  if (!documents.length) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        No resume or supporting documents uploaded yet.
      </div>
    );
  }

  const rejectKey = (document) => `${profile.id}:${document.documentType}:${getDocumentIdentity(document)}`;
  const state = reviewState || getCredentialReviewState(profile, documents);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-slate-400">Documents</div>
          <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
            {state.requiredCount} required / {state.optionalCount} optional submitted
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">{state.approvedCount} required approved</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">{state.pendingCount} required pending</span>
          {state.rejectedCount > 0 && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-black text-red-700">{state.rejectedCount} required rejected</span>
          )}
          <FileText size={19} className="text-cyan-600" />
        </div>
      </div>

      {state.missingDocuments.length > 0 && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          Missing required certifications: {state.missingDocuments.slice(0, 4).join(', ')}
          {state.missingDocuments.length > 4 ? ` and ${state.missingDocuments.length - 4} more` : ''}
        </div>
      )}

      <div className="space-y-3">
        {documents.map((document) => {
          const documentKey = rejectKey(document);
          const isRejecting = rejectDraft?.key === documentKey;
          const approveBusy = busyKey === `${documentKey}:approved`;
          const rejectBusy = busyKey === `${documentKey}:rejected`;
          const changeRequestBusy = busyKey.startsWith(`${documentKey}:change_request`);
          const selectedPreset = isRejecting ? rejectDraft.preset : DOCUMENT_REJECTION_MESSAGES[0];
          const customMessage = isRejecting ? rejectDraft.custom : '';
          const rejectMessage = selectedPreset === 'custom' ? customMessage.trim() : selectedPreset;

          return (
            <div key={documentKey} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-slate-950 dark:text-white">{document.reviewLabel}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${getCredentialStatusStyle(document.status)}`}>
                      {statusLabel(document.status || 'pending_review')}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
                      document.reviewScope === 'required'
                        ? 'border-amber-100 bg-amber-50 text-amber-700'
                        : 'border-cyan-100 bg-cyan-50 text-cyan-700'
                    }`}>
                      {document.reviewScope === 'required' ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-slate-600 dark:text-slate-300">{document.fileName || 'Uploaded file'}</div>
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-400">
                    {[getReviewDocumentKindLabel(document), formatFileSize(document.fileSize)].filter(Boolean).join(' - ')}
                  </div>
                  {(document.rejectionReason || document.reviewMessage) && (
                    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold leading-relaxed ${
                      document.status === 'rejected'
                        ? 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
                        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                    }`}>
                      {document.rejectionReason || document.reviewMessage}
                    </div>
                  )}
                  {document.changeRequestStatus === 'pending' && (
                    <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-semibold leading-relaxed text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
                      Change request: {document.changeRequest?.reason || 'No reason provided.'}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => onView(profile, document)}
                    disabled={Boolean(busyKey)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-default disabled:opacity-70 dark:border-slate-800 dark:text-slate-300"
                  >
                    <FileText size={14} />
                    View
                  </button>
                  <button
                    onClick={() => onDownload(profile, document)}
                    disabled={Boolean(busyKey)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-default disabled:opacity-70 dark:border-slate-800 dark:text-slate-300"
                  >
                    <Download size={14} />
                    Download
                  </button>
                  {document.changeRequestStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => onReviewChangeRequest(profile, document, 'approved')}
                        disabled={Boolean(busyKey)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-cyan-700 disabled:cursor-default disabled:opacity-70"
                      >
                        {changeRequestBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Approve Change
                      </button>
                      <button
                        onClick={() => onReviewChangeRequest(profile, document, 'rejected')}
                        disabled={Boolean(busyKey)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-2 text-xs font-black text-red-600 transition-colors hover:bg-red-50 disabled:cursor-default disabled:opacity-70 dark:border-red-900/40 dark:hover:bg-red-950/20"
                      >
                        {changeRequestBusy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                        Reject Change
                      </button>
                    </>
                  )}
                  {document.status !== 'approved' && (
                    <button
                      onClick={() => onApprove(profile, document)}
                      disabled={Boolean(busyKey)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-default disabled:opacity-70"
                    >
                      {approveBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Approve
                    </button>
                  )}
                  {document.status !== 'rejected' && (
                    <button
                      onClick={() => setRejectDraft({ custom: '', key: documentKey, preset: DOCUMENT_REJECTION_MESSAGES[0] })}
                      disabled={Boolean(busyKey)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-2 text-xs font-black text-red-600 transition-colors hover:bg-red-50 disabled:cursor-default disabled:opacity-70 dark:border-red-900/40 dark:hover:bg-red-950/20"
                    >
                      {rejectBusy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                      Reject
                    </button>
                  )}
                </div>
              </div>

              {isRejecting && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-red-700 dark:text-red-300">
                    <MessageSquare size={15} />
                    Rejection message
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                    <select
                      value={selectedPreset}
                      onChange={(event) => setRejectDraft((current) => ({ ...current, preset: event.target.value }))}
                      className="rounded-xl border border-red-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-red-400 dark:border-red-900/40 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {DOCUMENT_REJECTION_MESSAGES.map((message) => (
                        <option key={message} value={message}>{message}</option>
                      ))}
                      <option value="custom">Custom message</option>
                    </select>
                    <textarea
                      value={customMessage}
                      onChange={(event) => setRejectDraft((current) => ({ ...current, custom: event.target.value }))}
                      disabled={selectedPreset !== 'custom'}
                      rows={2}
                      placeholder="Write a custom reason"
                      className="rounded-xl border border-red-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-red-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      onClick={() => setRejectDraft(null)}
                      className="rounded-xl border border-red-100 bg-white px-4 py-2 text-xs font-black text-slate-600 transition-colors hover:text-slate-950 dark:border-red-900/40 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => onReject(profile, document, rejectMessage)}
                      disabled={!rejectMessage || Boolean(busyKey)}
                      className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-red-700 disabled:cursor-default disabled:opacity-70"
                    >
                      Reject Document
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminHeader({ user, activeTab, setActiveTab, onLogout, isDarkMode, toggleDarkMode }) {
  const notificationState = useNotifications(user?.id);
  const { markRead, notifications } = notificationState;
  const tabUnreadCounts = countUnreadNotificationsByTab(
    notifications,
    ADMIN_TABS,
    ADMIN_NOTIFICATION_TAB_FALLBACKS
  );

  useEffect(() => {
    const activeTabNotifications = getUnreadNotificationsForTab(
      notifications,
      activeTab,
      ADMIN_TABS,
      ADMIN_NOTIFICATION_TAB_FALLBACKS
    );

    activeTabNotifications.forEach((notification) => {
      markRead(notification);
    });
  }, [activeTab, markRead, notifications]);

  return (
    <header className="sticky top-0 z-50 bg-slate-950 text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 font-bold shadow-inner">
            PB
          </div>
          <div>
            <div className="text-sm font-black leading-tight">Admin Console</div>
            <div className="text-xs font-medium text-slate-400">{user.email}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell notificationState={notificationState} unreadClassName="bg-cyan-500" userId={user.id} />
          <button onClick={toggleDarkMode} className="text-slate-400 transition-colors hover:text-white" title="Toggle Dark Mode">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={onLogout} className="text-slate-400 transition-colors hover:text-red-300" title="Log out">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1600px] gap-8 overflow-x-auto px-4 pt-4 sm:px-6 lg:px-8">
          {[
            { icon: ShieldCheck, id: 'overview', label: 'Overview' },
            { icon: Users, id: 'talent', label: 'Talent Review' },
            { icon: Building, id: 'agencies', label: 'Agencies' },
          ].map((tab) => {
            const Icon = tab.icon;
            const unreadCount = tabUnreadCounts[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-bold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-600 px-1.5 text-[11px] font-black leading-none text-white shadow-sm shadow-cyan-500/20">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

function EmptyPanel({ icon, title, description }) {
  const Icon = icon || ShieldCheck;

  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950">
        <Icon size={24} />
      </div>
      <h3 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">{title}</h3>
      <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function AdminOverview({ setActiveTab }) {
  const { data: talentData, error: talentError, isLoading: isTalentLoading } = useBackendResource(
    backendApi.admin.listTalent,
    EMPTY_LIST,
    {
      realtime: [
        { table: 'professional_profiles' },
      ],
      refreshInterval: 10000,
    }
  );
  const { data: agencyData, error: agencyError, isLoading: isAgencyLoading } = useBackendResource(
    backendApi.admin.listAgencies,
    EMPTY_LIST,
    {
      realtime: [
        { table: 'agencies' },
      ],
      refreshInterval: 30000,
    }
  );
  const talent = asList(talentData);
  const agencies = asList(agencyData);
  const isLoading = isTalentLoading || isAgencyLoading;
  const pendingTalent = talent.filter((profile) => profile.status === 'pending_review').length;
  const pendingAgencies = agencies.filter((agency) => agency.status === 'pending_review').length;
  const approvedTalent = talent.filter((profile) => profile.status === 'approved').length;
  const approvedAgencies = agencies.filter((agency) => agency.status === 'approved').length;
  const hiddenTotal = [...talent, ...agencies].filter((record) => record.status === 'hidden').length;
  const rejectedTotal = [...talent, ...agencies].filter((record) => record.status === 'rejected').length;
  const latestTalent = talent.slice(0, 3);
  const latestAgencies = agencies.slice(0, 3);

  return (
    <div className="portal-fade-in">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Admin Overview</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Review marketplace readiness, publishable supply, and records that need attention.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {isLoading ? 'Refreshing admin data' : `${talent.length + agencies.length} records tracked`}
        </div>
      </div>

      {(talentError || agencyError) && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {talentError?.message || agencyError?.message}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Clock3, label: 'Needs Review', value: pendingTalent + pendingAgencies, text: `${pendingTalent} talent / ${pendingAgencies} agencies` },
          { icon: Users, label: 'Approved Talent', value: approvedTalent, text: 'Visible in the client directory' },
          { icon: Building, label: 'Approved Agencies', value: approvedAgencies, text: 'Visible in managed pods' },
          { icon: EyeOff, label: 'Hidden / Rejected', value: hiddenTotal + rejectedTotal, text: `${hiddenTotal} hidden / ${rejectedTotal} rejected` },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <FadeIn key={item.label}>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-cyan-600">
                  <Icon size={20} />
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</div>
                <div className="mt-2 text-4xl font-black tracking-tight text-slate-950 dark:text-white">{item.value}</div>
                <div className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{item.text}</div>
              </div>
            </FadeIn>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <FadeIn>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-white">Review Queues</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Jump straight into the records that shape what clients can see.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button onClick={() => setActiveTab('talent')} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-cyan-200 hover:bg-cyan-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-900/50 dark:hover:bg-cyan-950/20">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm dark:bg-slate-900">
                    <Users size={18} />
                  </div>
                  <span className="text-2xl font-black text-slate-950 dark:text-white">{pendingTalent}</span>
                </div>
                <div className="font-black text-slate-950 dark:text-white">Talent Review</div>
                <div className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Approve professional profiles before they appear in search.</div>
              </button>
              <button onClick={() => setActiveTab('agencies')} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-cyan-200 hover:bg-cyan-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-900/50 dark:hover:bg-cyan-950/20">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm dark:bg-slate-900">
                    <Building size={18} />
                  </div>
                  <span className="text-2xl font-black text-slate-950 dark:text-white">{pendingAgencies}</span>
                </div>
                <div className="font-black text-slate-950 dark:text-white">Agency Records</div>
                <div className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Create and publish managed firm profiles for clients.</div>
              </button>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-5 text-lg font-black text-slate-950 dark:text-white">Recent Records</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Talent</div>
                {latestTalent.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">No talent profiles yet.</div>
                ) : (
                  <div className="space-y-2">
                    {latestTalent.map((profile) => (
                      <div key={profile.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-950 dark:text-white">{profile.name || profile.fullName || 'Unnamed profile'}</div>
                          <div className="truncate text-xs font-semibold text-slate-500">{profile.title || profile.role || 'Role pending'}</div>
                        </div>
                        <StatusBadge status={profile.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Agencies</div>
                {latestAgencies.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">No agencies yet.</div>
                ) : (
                  <div className="space-y-2">
                    {latestAgencies.map((agency) => (
                      <div key={agency.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-950 dark:text-white">{agency.name}</div>
                          <div className="truncate text-xs font-semibold text-slate-500">{agency.specialty || 'Specialty pending'}</div>
                        </div>
                        <StatusBadge status={agency.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function TalentReview() {
  const { data, error, isLoading } = useBackendResource(
    backendApi.admin.listTalent,
    EMPTY_LIST,
    {
      realtime: [
        { table: 'professional_profiles' },
      ],
      refreshInterval: 10000,
    }
  );
  const [talent, setTalent] = useState(EMPTY_LIST);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectDraft, setRejectDraft] = useState(null);

  useEffect(() => {
    setTalent(asList(data));
  }, [data]);

  const updateTalentStatus = async (record, status, extraPayload = {}) => {
    setBusyId(`${record.id}:${status}`);
    setActionError('');

    try {
      const updated = await backendApi.admin.updateTalentStatus({
        professionalId: record.id,
        status,
        ...extraPayload,
      });

      setTalent((current) => current.map((item) => (
        item.id === record.id ? { ...item, ...updated } : item
      )));
    } catch (updateError) {
      setActionError(updateError.message || 'Unable to update talent status.');
    } finally {
      setBusyId('');
    }
  };

  const updateCredentialStatus = async (profile, document, status, message = '') => {
    const documentKey = document.key || document.id || document.label;
    const busyKey = `${profile.id}:${document.documentType}:${documentKey}:${status}`;

    setBusyId(busyKey);
    setActionError('');

    try {
      const updated = await backendApi.admin.updateTalentStatus({
        credentialReview: {
          documentKey,
          message,
          status,
          targetType: document.documentType,
        },
        professionalId: profile.id,
      });

      setTalent((current) => current.map((item) => (
        item.id === profile.id ? { ...item, ...updated } : item
      )));
      setRejectDraft(null);
    } catch (updateError) {
      setActionError(updateError.message || 'Unable to update this document.');
    } finally {
      setBusyId('');
    }
  };

  const openDocument = async (profile, document, { download = false } = {}) => {
    const documentKey = document.key || document.id || document.label;
    const busyKey = `${profile.id}:${document.documentType}:${documentKey}:${download ? 'download' : 'view'}`;

    setBusyId(busyKey);
    setActionError('');

    try {
      const result = await backendApi.documents.getUrl({
        documentKey,
        documentType: document.documentType,
        path: document.path,
        professionalId: profile.id,
      });

      if (result?.url) {
        const link = window.document.createElement('a');
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        if (download) link.download = result.fileName || document.fileName || 'document';
        link.click();
      }
    } catch (openError) {
      setActionError(openError.message || 'Unable to open this document.');
    } finally {
      setBusyId('');
    }
  };

  const reviewDocumentChangeRequest = async (profile, document, status) => {
    const documentKey = document.key || document.id || document.label;
    const busyKey = `${profile.id}:${document.documentType}:${documentKey}:change_request:${status}`;

    setBusyId(busyKey);
    setActionError('');

    try {
      const updated = await backendApi.admin.updateTalentStatus({
        credentialReview: {
          documentKey,
          message: status === 'approved' ? 'Change request approved.' : 'Change request rejected.',
          reviewKind: 'change_request',
          status,
          targetType: document.documentType,
        },
        professionalId: profile.id,
      });

      setTalent((current) => current.map((item) => (
        item.id === profile.id ? { ...item, ...updated } : item
      )));
    } catch (updateError) {
      setActionError(updateError.message || 'Unable to review this change request.');
    } finally {
      setBusyId('');
    }
  };

  const pendingCount = talent.filter((profile) => profile.status === 'pending_review').length;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Talent Review</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Approve, hide, or reject professional profiles before they appear in the client directory.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {isLoading ? 'Loading profiles' : `${pendingCount} pending review`}
        </div>
      </div>

      {talent.length > 0 && <StatusSummary records={talent} />}

      {(error || actionError) && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError || error.message}
        </div>
      )}

      {talent.length === 0 ? (
        <EmptyPanel icon={Users} title={isLoading ? 'Loading talent' : 'No talent profiles yet'} description="Submitted professional profiles will appear here after talent completes onboarding." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {talent.map((profile, index) => {
            const reviewDocuments = getReviewDocuments(profile);
            const reviewState = getCredentialReviewState(profile, reviewDocuments);

            return (
            <FadeIn key={profile.id} delay={(index % 6) * 50} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-950 dark:text-white">{profile.name || profile.fullName || 'Unnamed profile'}</h2>
                    <StatusBadge status={profile.status} />
                  </div>
                  <p className="text-sm font-bold text-cyan-700 dark:text-cyan-400">{profile.title || profile.role || 'Role pending'}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{profile.email}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Rate</div>
                  <div className="text-2xl font-black text-slate-950 dark:text-white">{formatMoney(profile.rate || profile.hourlyRate)}</div>
                </div>
              </div>

              {profile.manualTriageRequired && (
                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <div className="mb-2 font-bold text-sm">
                    Manual triage required{profile.manualTriageDomain ? ` for ${profile.manualTriageDomain}` : ''}
                  </div>
                  <p className="mb-3">{profile.manualTriageReason || 'Review this account before approval.'}</p>
                  
                  <button 
                    onClick={() => updateTalentStatus(profile, undefined, { clearTriage: true })}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-white font-bold transition-colors hover:bg-amber-700 disabled:opacity-70"
                    disabled={Boolean(busyId)}
                  >
                    {busyId === `${profile.id}:undefined` ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    Mark as verified
                  </button>
                </div>
              )}

              {(() => {
                const regulatedInputs = getProfileRegulatedInputs(profile);
                return Object.keys(regulatedInputs).length > 0 && (
                <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400 mb-3">Submitted Regulatory Data</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(regulatedInputs).map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{key}</span>
                        <span className="font-bold font-mono text-sm text-slate-950 dark:text-white px-3 py-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
              })()}

              {profile.status === 'approved' && (
                <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-xs font-semibold leading-relaxed text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-200">
                  <div className="mb-2 font-bold text-sm">Executive Title Management</div>
                  <p className="mb-3 text-cyan-700 dark:text-cyan-300">Assign restricted executive roles manually after interviewing the professional.</p>
                  <div className="flex flex-wrap gap-2">
                    {['Fractional CFO', 'FP&A Director'].map((execTitle) => {
                      const hasTitle = (profile.titles || []).includes(execTitle);
                      return (
                        <button
                          key={execTitle}
                          onClick={() => {
                            const newTitles = hasTitle 
                              ? (profile.titles || []).filter(t => t !== execTitle)
                              : [...(profile.titles || []), execTitle];
                            updateTalentStatus(profile, undefined, { titles: newTitles });
                          }}
                          disabled={Boolean(busyId)}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-bold transition-colors disabled:opacity-70 ${
                            hasTitle 
                              ? 'bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700' 
                              : 'bg-white text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-slate-900 dark:border-cyan-900 dark:text-cyan-400 dark:hover:bg-cyan-950/50'
                          }`}
                        >
                          {busyId === `${profile.id}:undefined` ? <Loader2 size={14} className="animate-spin" /> : (hasTitle ? <CheckCircle size={14} /> : <Plus size={14} />)}
                          {hasTitle ? `Revoke ${execTitle}` : `Assign ${execTitle}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="mb-5 line-clamp-3 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                {profile.bio || 'No bio submitted yet.'}
              </p>

              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Location</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{profile.location || 'Not Specified'}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Experience</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{profile.experience || profile.exp || 'Pending'}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Work Availability</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{profile.availability || profile.available || 'Not Specified'}</div>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {[...new Set([...asList(profile.skills), ...asList(profile.tools)])].slice(0, 8).map((tool) => (
                  <span key={tool} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    {tool}
                  </span>
                ))}
              </div>

              {getProfileExternalLinks(profile).length > 0 && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Professional Links</div>
                  <div className="flex flex-wrap gap-3">
                    {getProfileExternalLinks(profile).map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-cyan-400 transition-colors"
                      >
                        {link.label || 'Link'}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <CredentialReviewPanel
                busyKey={busyId}
                documents={reviewDocuments}
                onDownload={(record, document) => openDocument(record, document, { download: true })}
                onApprove={(record, document) => updateCredentialStatus(record, document, 'approved')}
                onReviewChangeRequest={reviewDocumentChangeRequest}
                onReject={(record, document, message) => updateCredentialStatus(record, document, 'rejected', message)}
                onView={(record, document) => openDocument(record, document)}
                profile={profile}
                rejectDraft={rejectDraft}
                reviewState={reviewState}
                setRejectDraft={setRejectDraft}
              />

              {reviewState.approvalBlocker && profile.status !== 'approved' && (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  {reviewState.approvalBlocker}
                </div>
              )}

              <StatusActions
                busyKey={busyId}
                currentStatus={profile.status}
                disabledStatusReasons={{ approved: reviewState.approvalBlocker }}
                onUpdate={updateTalentStatus}
                record={profile}
              />
            </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgenciesAdmin() {
  const { data, error, isLoading } = useBackendResource(
    backendApi.admin.listAgencies,
    EMPTY_LIST,
    {
      realtime: [
        { table: 'agencies' },
      ],
      refreshInterval: 30000,
    }
  );
  const [agencies, setAgencies] = useState(EMPTY_LIST);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({
    certifications: '',
    description: '',
    location: '',
    monthlyRate: '',
    name: '',
    specialty: '',
    status: 'pending_review',
    teamSize: '',
    tools: '',
  });

  useEffect(() => {
    setAgencies(asList(data));
  }, [data]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const createAgency = async (event) => {
    event.preventDefault();
    setBusyAction('create-agency');
    setActionError('');

    try {
      const created = await backendApi.admin.createAgency({
        ...form,
        monthlyRate: form.monthlyRate ? Number(form.monthlyRate) : null,
        certifications: form.certifications,
        tools: form.tools,
      });

      setAgencies((current) => [created, ...current]);
      setForm({
        certifications: '',
        description: '',
        location: '',
        monthlyRate: '',
        name: '',
        specialty: '',
        status: 'pending_review',
        teamSize: '',
        tools: '',
      });
    } catch (createError) {
      setActionError(createError.message || 'Unable to create agency.');
    } finally {
      setBusyAction('');
    }
  };

  const updateAgencyStatus = async (agency, status) => {
    setBusyAction(`${agency.id}:${status}`);
    setActionError('');

    try {
      const updated = await backendApi.admin.updateAgency({
        ...agency,
        monthlyRate: agency.monthlyRate || agency.rate,
        status,
      });

      setAgencies((current) => current.map((item) => (
        item.id === agency.id ? { ...item, ...updated } : item
      )));
    } catch (updateError) {
      setActionError(updateError.message || 'Unable to update agency.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Agencies</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Create managed firms and control which agency records are visible in the client portal.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {isLoading ? 'Loading agencies' : `${agencies.length} agency records`}
        </div>
      </div>

      {(error || actionError) && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError || error.message}
        </div>
      )}

      <form onSubmit={createAgency} className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-2">
          <Plus size={18} className="text-cyan-600" />
          <h2 className="text-lg font-black text-slate-950 dark:text-white">New Agency</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Name
            <input required value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Specialty
            <input value={form.specialty} onChange={(event) => updateForm('specialty', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Status
            <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950">
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Location
            <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Team size
            <input value={form.teamSize} onChange={(event) => updateForm('teamSize', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Monthly rate
            <input type="number" min="0" value={form.monthlyRate} onChange={(event) => updateForm('monthlyRate', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Tools
            <input value={form.tools} onChange={(event) => updateForm('tools', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Certifications
            <input value={form.certifications} onChange={(event) => updateForm('certifications', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300 lg:col-span-3">
            Description
            <textarea rows={3} value={form.description} onChange={(event) => updateForm('description', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
        </div>

        <button disabled={busyAction === 'create-agency'} className="mt-5 flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-70">
          {busyAction === 'create-agency' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Create Agency
        </button>
      </form>

      {agencies.length > 0 && <StatusSummary records={agencies} />}

      {agencies.length === 0 ? (
        <EmptyPanel icon={Building} title={isLoading ? 'Loading agencies' : 'No agencies yet'} description="Agency records you create will appear here and can be published to the client portal." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {agencies.map((agency, index) => (
            <FadeIn key={agency.id} delay={(index % 6) * 50} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-950 dark:text-white">{agency.name}</h2>
                    <StatusBadge status={agency.status} />
                  </div>
                  <p className="text-sm font-bold text-cyan-700 dark:text-cyan-400">{agency.specialty || 'Specialty pending'}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{agency.location || 'Location pending'} &middot; {agency.size || 'Team size pending'}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Pricing</div>
                  <div className="text-2xl font-black text-slate-950 dark:text-white">{formatMoney(agency.monthlyRate || agency.rate)}</div>
                </div>
              </div>

              <p className="mb-5 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{agency.description || 'No description yet.'}</p>

              <div className="mb-5 flex flex-wrap gap-2">
                {[...asList(agency.tools), ...asList(agency.certifications)].slice(0, 8).map((item) => (
                  <span key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    {item}
                  </span>
                ))}
              </div>

              <StatusActions
                busyKey={busyAction}
                currentStatus={agency.status}
                onUpdate={updateAgencyStatus}
                record={agency}
              />
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminPortal({ user, onLogout, isDarkMode, toggleDarkMode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'overview';
  const activeTab = ['overview', 'talent', 'agencies'].includes(requestedTab) ? requestedTab : 'overview';
  const setActiveTab = (tab) => setSearchParams({ tab });

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <AdminHeader
        activeTab={activeTab}
        isDarkMode={isDarkMode}
        onLogout={onLogout}
        setActiveTab={setActiveTab}
        toggleDarkMode={toggleDarkMode}
        user={user}
      />
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'overview' && <AdminOverview setActiveTab={setActiveTab} />}
        {activeTab === 'talent' && <TalentReview />}
        {activeTab === 'agencies' && <AgenciesAdmin />}
      </main>
    </div>
  );
}
