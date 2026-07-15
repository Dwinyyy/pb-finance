import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, MapPin, Building, Star, Filter, 
  CheckCircle, ArrowRight, User, Briefcase, 
  Menu, X, Calculator, PieChart, ShieldCheck, 
  Mail, Lock, LogOut, Sparkles, Layers3, 
  BarChart3, BadgeCheck, Clock3, Handshake, 
  Globe2, TrendingDown, ChevronDown, ChevronUp,
  Camera, Eye, EyeOff, IdCard,
  Bookmark, MessageSquare, SlidersHorizontal,
  ChevronRight, FileText, Calendar, Video, Download, CreditCard, Receipt,
  DollarSign, CheckSquare, Settings, Bot, Send, Loader2, Sun, Moon, Trash2, Plus,
  Upload, Link2, ExternalLink
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { NotificationBell } from '../components/NotificationBell';
import { EmptyState } from '../components/EmptyState';
import { BrandMark } from '../components/ui/BrandMark';
import { Button } from '../components/ui/Button';
import { FormField, formControlClassName } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Toggle } from '../components/ui/Toggle';
import { toneForTier } from '../components/ui/statusTone';
import { useBackendResource } from '../hooks/useBackendResource';
import { useNotifications } from '../hooks/useNotifications';
import { useTabNotificationIndicators } from '../hooks/useTabNotificationIndicators';
import { backendApi } from '../services/api';
import {
  getDocumentPreviewCacheKey,
  loadCachedDocumentPreview,
  loadCachedDocumentPreviewUrl,
  preloadCachedDocumentPreviewUrl,
} from '../utils/documentPreview';
import { warmDocumentPreviewRenderer } from '../utils/pdfPreview';
import { mergeRealtimeTalentProfile } from '../utils/profileRealtime';

const EMPTY_LIST = Object.freeze([]);
const EMPTY_PROFILE = Object.freeze({});
const EMPTY_EARNINGS = Object.freeze({
  availableToWithdraw: 0,
  pendingReview: 0,
  timesheets: EMPTY_LIST,
  totalEarnedYtd: 0,
});
const SUCCESS_MESSAGE_TIMEOUT_MS = 2500;
const PROFESSIONAL_TABS = ['profile', 'opportunities', 'earnings'];
const UNVERIFIED_PROFESSIONAL_PERMISSIONS = Object.freeze({
  canAccessDashboard: false,
  canAppearInTalentPool: false,
  canCommentOnJobPosts: false,
  canContactClientsFromJobs: false,
  canToggleProfileVisibility: false,
  canViewFullClientProfiles: false,
  label: 'Unverified',
  tier: 'unverified',
});
const PROFESSIONAL_NOTIFICATION_TAB_FALLBACKS = {
  document_status_updated: 'profile',
  interview_cancelled: 'opportunities',
  interview_requested: 'opportunities',
  profile_status_updated: 'profile',
  resume_status_updated: 'profile',
};
const MAX_CREDENTIAL_UPLOAD_BYTES = 3 * 1024 * 1024;
const DOCUMENT_ACCEPTS = {
  certification: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  other_document: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  resume: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
};
const DOCUMENT_EXTENSIONS = {
  certification: ['.pdf', '.jpg', '.jpeg', '.png'],
  other_document: ['.pdf', '.jpg', '.jpeg', '.png'],
  resume: ['.pdf', '.jpg', '.jpeg', '.png'],
};
const EMPTY_CREDENTIAL_FORM = Object.freeze({
  certifications: EMPTY_LIST,
  externalLinks: EMPTY_LIST,
  resume: null,
  supportingDocuments: EMPTY_LIST,
});
const createOtherDocumentRow = () => ({
  id: `other-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  label: '',
});

const asList = (value) => (Array.isArray(value) ? value : []);
const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString()}` : value || 'Pending');
const formatMoneyAmount = (value) => formatMoney(value).replace(/^\$/, '');
const listToText = (value) => asList(value).join(', ');
const textToList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
// Exported for executable preservation contracts alongside this page module.
// eslint-disable-next-line react-refresh/only-export-components
export const getProfessionalPortalPermissions = (record = {}) => {
  const permissions = record.professionalPermissions;

  if (permissions && typeof permissions === 'object') {
    return {
      ...UNVERIFIED_PROFESSIONAL_PERMISSIONS,
      ...permissions,
      tier: permissions.tier || record.professionalTier || record.professional_tier || 'unverified',
    };
  }

  return record.professionalTier === 'verified' || record.professional_tier === 'verified'
    ? {
      canAccessDashboard: true,
      canAppearInTalentPool: true,
      canCommentOnJobPosts: true,
      canContactClientsFromJobs: true,
      canToggleProfileVisibility: true,
      canViewFullClientProfiles: true,
      label: 'Verified',
      tier: 'verified',
    }
    : UNVERIFIED_PROFESSIONAL_PERMISSIONS;
};
const placeholderTitles = new Set(['Complete your profile', 'Finance Professional']);
const cleanProfileTitle = (value) => {
  const title = String(value || '').trim();

  return title && !placeholderTitles.has(title) ? title : '';
};
import {
  AVAILABILITY_OPTIONS,
  EXTERNAL_LINK_OPTIONS,
  PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS,
  PROFESSIONAL_TITLE_OTHER_DOCUMENT_OPTIONS,
  PROFESSIONAL_TITLE_OPTIONS,
  REGULATED_TITLE_REQUIREMENTS,
  SKILLS_OPTIONS,
  SOFTWARE_OPTIONS,
} from '../data/constants';

const getProfileReadiness = (profile, titles) => {
  const profileSkills = asList(profile.skills);
  const profileTools = asList(profile.tools);
  const identityDocuments = getIdentityDocuments(profile);
  const checks = [
    { label: 'Identity', done: Boolean(profile.name || profile.fullName) },
    { label: 'Valid ID', done: hasIdentityArtifact(identityDocuments.validIdFront) },
    { label: 'Liveness', done: hasIdentityArtifact(identityDocuments.livenessSelfie) },
    { label: 'Role title', done: cleanProfileTitles(titles).length > 0 },
    { label: 'Location', done: Boolean(profile.location) },
    { label: 'Bio', done: Boolean(profile.bio) },
    { label: 'Rate', done: Boolean(profile.rate || profile.hourlyRate) },
    { label: 'Skills', done: profileSkills.length > 0 },
    { label: 'Software', done: profileTools.length > 0 },
    { label: 'Resume', done: Boolean(getProfileResume(profile)) },
  ];
  const completed = checks.filter((item) => item.done).length;

  return {
    checks,
    completed,
    percent: Math.round((completed / checks.length) * 100),
  };
};

const cleanProfileTitles = (value, fallback = []) => {
  const source = value === undefined ? fallback : value;
  const rawTitles = Array.isArray(source)
    ? source
    : String(source || '').split(',');

  return [...new Set(rawTitles.map(cleanProfileTitle).filter(Boolean))];
};
const formatProfileTitles = (titles) => cleanProfileTitles(titles).join(', ');
const getWorkPreferences = (profile) => (
  typeof profile?.workPreferences === 'object' && profile.workPreferences !== null
    ? profile.workPreferences
    : {}
);
const getProfileResume = (profile) => profile?.resume || getWorkPreferences(profile).resume || null;
const getProfileAvatar = (profile) => profile?.avatarUrl || profile?.avatar_url || '';
const getIdentityDocuments = (profile) => (
  typeof profile?.identityVerificationDocuments === 'object' && profile.identityVerificationDocuments !== null
    ? profile.identityVerificationDocuments
    : {}
);
const hasIdentityArtifact = (document) => Boolean(document?.path || document?.fileName);
const getExternalLinks = (profile) => asList(profile?.externalLinks || getWorkPreferences(profile).externalLinks);
const getSupportingDocuments = (profile) => asList(profile?.supportingDocuments || getWorkPreferences(profile).supportingDocuments);
const formatFileSize = (value) => {
  const size = Number(value || 0);

  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
const getCredentialStatusLabel = (status) => (
  status === 'draft' ? 'saved' : String(status || 'saved').replace(/_/g, ' ')
);
const getCredentialStatusStyle = (status) => ({
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
  rejected: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
  draft: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
}[status || 'draft'] || 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400');
const getCredentialStatusHint = (credential, missingText) => {
  if (!credential) return missingText;
  if (credential.status === 'approved') return 'Approved by admin';
  if (credential.status === 'rejected') return 'Needs a replacement upload';
  if (credential.status === 'pending_review') return 'Pending admin review';

  return 'Saved in your portal';
};
const getCredentialReviewMessage = (credential) => (
  credential?.rejectionReason || (credential?.status === 'rejected' ? credential?.reviewMessage : '')
);
const requiredCredentialMissingExpiry = (credential) => (
  Boolean(credential)
  && !credential.noExpiryRequired
  && !String(credential.expiryDate || '').trim()
);
const getCredentialDisplayLabel = (credential, fallback = 'document') => (
  credential?.reviewLabel || credential?.label || credential?.fileName || fallback
);
const getDocumentKey = (document) => document?.key || document?.id || document?.label || document?.fileName || document?.documentType || '';
const normalizeLinkFields = (links = []) => {
  const linkMap = new Map(asList(links).map((link) => [link.id, link]));

  return EXTERNAL_LINK_OPTIONS.map((option) => ({
    ...option,
    url: linkMap.get(option.id)?.url || '',
  }));
};
const normalizeCredentialUrl = (value) => {
  const rawUrl = String(value || '').trim();
  const url = rawUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;

  if (!url) return '';

  try {
    const parsed = new URL(url);

    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
};
const getContentTypeForFile = (file) => {
  if (file?.type) return file.type;

  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';

  return 'application/octet-stream';
};
const getFileExtension = (fileName) => {
  const match = String(fileName || '').toLowerCase().match(/\.[a-z0-9]+$/);

  return match ? match[0] : '';
};
const validateCredentialFile = (file, documentType) => {
  if (!file) return 'Choose a file to upload.';
  if (file.size > MAX_CREDENTIAL_UPLOAD_BYTES) return 'Upload must be 3 MB or smaller.';

  const extension = getFileExtension(file.name);
  const allowedExtensions = DOCUMENT_EXTENSIONS[documentType] || DOCUMENT_EXTENSIONS.other_document;

  if (!allowedExtensions.includes(extension)) {
    if (documentType === 'resume') return 'Resume uploads must be a PDF, JPG, or PNG.';
    if (documentType === 'certification') return 'Certification uploads must be a PDF, JPG, or PNG.';
    return 'Supporting document uploads must be a PDF, JPG, or PNG.';
  }

  return '';
};
const validateImageFile = (file, label = 'Image') => {
  if (!file) return `Choose a ${label.toLowerCase()} to upload.`;
  if (file.size > MAX_CREDENTIAL_UPLOAD_BYTES) return 'Upload must be 3 MB or smaller.';

  const extension = getFileExtension(file.name);

  if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
    return `${label} must be a JPG or PNG.`;
  }

  return '';
};
const documentMatchesLabel = (document, label) => (
  document?.label === label
  || document?.key === label
  || String(document?.key || '').endsWith(`:${label}`)
);
const documentMatchesAnyLabel = (document, labels) => asList(labels).some((label) => documentMatchesLabel(document, label));
const getDocumentOptionsForTitles = (titles, optionsByTitle, excludedLabels = []) => {
  const excluded = new Set(excludedLabels);
  const optionsByLabel = new Map();

  cleanProfileTitles(titles).forEach((title) => {
    asList(optionsByTitle[title]).forEach((label) => {
      if (excluded.has(label)) return;

      const existing = optionsByLabel.get(label);

      if (existing) {
        existing.titles.push(title);
        return;
      }

      optionsByLabel.set(label, {
        label,
        titles: [title],
      });
    });
  });

  return [...optionsByLabel.values()];
};
const buildCredentialRequirements = (titles, uploadedDocuments = [], optionsByTitle = PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS) => {
  const uploadedRecords = asList(uploadedDocuments);
  const uploadedMap = new Map();

  uploadedRecords.forEach((document) => {
    [document.key, document.label].filter(Boolean).forEach((identity) => {
      uploadedMap.set(identity, document);
    });
  });

  const requirementsByLabel = new Map();

  cleanProfileTitles(titles).forEach((title) => {
    asList(optionsByTitle[title]).forEach((label) => {
      const existing = requirementsByLabel.get(label);

      if (existing) {
        existing.titles.push(title);
        return;
      }

      requirementsByLabel.set(label, {
        key: label,
        label,
        titles: [title],
      });
    });
  });

  return [...requirementsByLabel.values()].map((requirement) => ({
    ...requirement,
    title: requirement.titles.join(' / '),
    upload: uploadedMap.get(requirement.key)
      || uploadedMap.get(requirement.label)
      || uploadedRecords.find((document) => documentMatchesLabel(document, requirement.label))
      || null,
  }));
};
const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
};
const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const bytes = new Uint8Array(reader.result);
    resolve(`data:${getContentTypeForFile(file)};base64,${bytesToBase64(bytes)}`);
  };
  reader.onerror = () => reject(new Error('Unable to read this file.'));
  reader.readAsArrayBuffer(file);
});
// Exported for executable preservation contracts alongside this page module.
// eslint-disable-next-line react-refresh/only-export-components
export const buildProfileSavePayload = (profile, overrides = {}) => {
  const workPreferences = {
    ...getWorkPreferences(profile),
    ...(overrides.workPreferences || {}),
  };
  const titles = cleanProfileTitles(
    overrides.titles ?? profile.titles,
    cleanProfileTitles(profile.title || profile.role)
  );

  return {
    availability: profile.availability || profile.available || 'Immediate Start',
    bio: profile.bio || '',
    certifications: asList(overrides.certifications ?? profile.certifications),
    fullName: profile.name || profile.fullName || '',
    hourlyRate: profile.rate || profile.hourlyRate || null,
    location: profile.location || '',
    skills: asList(profile.skills),
    submitForReview: Boolean(overrides.submitForReview),
    titles,
    tools: asList(profile.tools),
    workPreferences,
    yearsExperience: profile.yearsExperience || null,
  };
};



function MultiSelectPicker({
  className = formControlClassName,
  describedBy,
  disabled = false,
  getRemoveDisabledReason,
  id,
  value,
  onChange,
  optionsList,
  placeholder,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');
  const selectedItems = cleanProfileTitles(value);
  const selectedSet = new Set(selectedItems);
  const options = [...new Set([...selectedItems, ...asList(optionsList)])];
  const toggleItem = (item) => {
    if (disabled) return;
    const disabledReason = selectedSet.has(item) ? getRemoveDisabledReason?.(item) : '';
    if (disabledReason) {
      setBlockedMessage(disabledReason);
      return;
    }

    const nextItems = selectedSet.has(item)
      ? selectedItems.filter((i) => i !== item)
      : [...selectedItems, item];

    setBlockedMessage('');
    onChange(nextItems);
  };

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        aria-describedby={describedBy}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setIsOpen((current) => !current);
        }}
        disabled={disabled}
        className={`flex items-center justify-between gap-3 text-left ${className}`}
      >
        <span>{selectedItems.length ? `${selectedItems.length} selected` : placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {selectedItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            (() => {
              const disabledReason = getRemoveDisabledReason?.(item) || '';

              return (
            <button
              key={item}
              type="button"
              onClick={() => toggleItem(item)}
              disabled={disabled}
              title={disabledReason || `Remove ${item}`}
              className="inline-flex min-h-11 items-center rounded-control border border-info-border bg-info-surface px-3 py-2 text-xs font-bold text-info transition-colors hover:bg-info-surface/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {item} <span className="ml-1" aria-hidden="true">×</span>
            </button>
              );
            })()
          ))}
        </div>
      )}
      {blockedMessage && (
        <div className="mt-2 rounded-control border border-warning-border bg-warning-surface px-3 py-2 text-xs font-semibold leading-relaxed text-warning" role="status">
          {blockedMessage}
        </div>
      )}

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-14 z-30 max-h-72 overflow-y-auto rounded-card border border-border-subtle bg-surface p-2 shadow-modal" role="listbox" aria-label={placeholder}>
          {options.map((item) => {
            const isSelected = selectedSet.has(item);

            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleItem(item)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/20 ${
                  isSelected
                    ? 'bg-info-surface text-info'
                    : 'text-text-muted hover:bg-surface-muted hover:text-text-primary'
                }`}
              >
                <span>{item}</span>
                <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${isSelected ? 'border-action bg-action text-white' : 'border-border-control'}`}>
                  {isSelected ? <CheckCircle size={11} aria-hidden="true" /> : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CredentialUploadRow({
  busyUpload,
  canRemoveApprovedChange = false,
  detail,
  documentKey,
  documentLabel,
  documentType,
  isRequired = false,
  onView,
  onPreviewWarmup,
  onUpload,
  onRemove,
  onRequestChange,
  onChangeExpiry,
  onChangeNoExpiryRequired,
  upload,
}) {
  const isBusy = busyUpload === documentKey;
  const isApproved = upload?.status === 'approved';
  const isRejected = upload?.status === 'rejected';
  const isUnderRequest = upload?.changeRequestStatus === 'pending';
  const canRemoveUpload = upload && (!isApproved || isRejected || canRemoveApprovedChange);
  const isLockedApproved = isApproved && !canRemoveApprovedChange;
  const removeBusy = busyUpload === `remove:${documentKey}`;
  const statusText = isUnderRequest ? 'Under request' : getCredentialStatusLabel(upload?.status);
  const statusStyle = isUnderRequest
    ? 'border-cyan-100 bg-cyan-50 text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300'
    : getCredentialStatusStyle(upload?.status);
  const noExpiryRequired = Boolean(upload?.noExpiryRequired);
  const isExpiryMissing = isRequired && requiredCredentialMissingExpiry(upload);
  const isExpiryLocked = isLockedApproved;

  return (
    <div className={`rounded-2xl border p-4 ${
      isRejected
        ? 'border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/10'
        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
    }`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-black text-slate-950 dark:text-white">{documentLabel}</div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
              isRequired
                ? 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                : 'border-cyan-100 bg-cyan-50 text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300'
            }`}>
              {isRequired ? 'Required' : 'Optional'}
            </span>
          </div>
          <div className="mt-1 text-xs font-bold text-slate-400">
            {upload
              ? `${upload.fileName} ${formatFileSize(upload.fileSize) ? `- ${formatFileSize(upload.fileSize)}` : ''}`
              : detail}
          </div>
          
          {upload && (
            <div className="mt-3 flex flex-col gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar size={14} />
                <span>Expires:</span>
                <input
                  type="date"
                  value={upload.expiryDate || ''}
                  disabled={isExpiryLocked || noExpiryRequired}
                  required={isRequired && !noExpiryRequired}
                  onChange={(e) => onChangeExpiry && onChangeExpiry(upload.id, e.target.value)}
                  className={`rounded border bg-transparent px-2 py-0.5 text-xs outline-none disabled:opacity-50 dark:border-slate-800 ${
                    isExpiryMissing
                      ? 'border-amber-300 focus:border-amber-500 dark:border-amber-900/60'
                      : 'border-slate-200 focus:border-cyan-500'
                  }`}
                />
              </div>
              <label className="inline-flex w-fit items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={noExpiryRequired}
                  disabled={isExpiryLocked}
                  onChange={(event) => onChangeNoExpiryRequired?.(upload.id, event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
                />
                No expiration date
              </label>
              {isLockedApproved && (
                <div className="text-xs font-semibold text-slate-400">
                  Request change to update expiration details.
                </div>
              )}
              {isExpiryMissing && (
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Required for verification unless this document does not expire.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {upload && (
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black capitalize ${statusStyle}`}>
              {statusText}
            </span>
          )}
          {upload && (
            <button
              type="button"
              onClick={() => onView?.(upload)}
              onFocus={() => onPreviewWarmup?.(upload)}
              onMouseEnter={() => onPreviewWarmup?.(upload)}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <ExternalLink size={14} />
              View
            </button>
          )}
          {isLockedApproved ? (
            !isUnderRequest && (
              <button
                onClick={() => onRequestChange && onRequestChange({ documentKey, documentLabel, documentType })}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
              >
                Request Change/Removal
              </button>
            )
          ) : (
            <>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {upload ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept={DOCUMENT_ACCEPTS[documentType] || DOCUMENT_ACCEPTS.other_document}
                  className="hidden"
                  onChange={(event) => {
                    onUpload({
                      documentKey,
                      documentType,
                      file: event.target.files?.[0],
                      label: documentLabel,
                    });
                    event.target.value = '';
                  }}
                />
              </label>
              {canRemoveUpload && onRemove && (
                <button
                  onClick={() => onRemove({ documentKey, documentType, label: documentLabel })}
                  disabled={removeBusy || Boolean(busyUpload)}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 transition-colors hover:bg-red-50 disabled:cursor-default disabled:opacity-60 dark:border-red-900/40 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/20"
                >
                  {removeBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {getCredentialReviewMessage(upload) && (
        <div className="mt-3 flex gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          <MessageSquare size={14} className="mt-0.5 shrink-0" />
          <span>{getCredentialReviewMessage(upload)}</span>
        </div>
      )}
    </div>
  );
}

function DashboardMetric({ detail, icon, label, value, variant = 'slate' }) {
  const MetricIcon = icon;
  const variantStyles = {
    amber: 'border-warning-border bg-warning-surface text-warning',
    cyan: 'border-processing-border bg-processing-surface text-processing',
    emerald: 'border-verified-border bg-verified-surface text-verified',
    slate: 'border-border-subtle bg-surface text-text-primary',
  };

  return (
    <SurfaceCard as="div" className={`p-4 ${variantStyles[variant] || variantStyles.slate}`}>
      <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider opacity-80">
        <MetricIcon size={14} aria-hidden="true" />
        {label}
      </div>
      <div className="text-xl font-black leading-tight tracking-tight">{value}</div>
      {detail && <div className="mt-1 text-xs font-bold opacity-75">{detail}</div>}
    </SurfaceCard>
  );
}

// ==========================================
// 3. PROFESSIONAL PORTAL (TALENT EXPERIENCE)
// ==========================================
export function ProfessionalPortal({ user, onLogout, isDarkMode, toggleDarkMode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'profile';
  const professionalPermissions = getProfessionalPortalPermissions(user);
  const availableTabs = professionalPermissions.canAccessDashboard ? PROFESSIONAL_TABS : ['profile'];
  const appView = availableTabs.includes(requestedTab) ? requestedTab : 'profile';
  const setAppView = (tab) => setSearchParams({ tab });
  const notificationState = useNotifications(user?.id);
  const { notifications } = notificationState;
  const tabUnreadCounts = useTabNotificationIndicators({
    activeTab: appView,
    fallbackByType: PROFESSIONAL_NOTIFICATION_TAB_FALLBACKS,
    notifications,
    storageKey: `pb_professional_page_notification_indicators:${user?.id || user?.email || 'unknown'}`,
    tabIds: availableTabs,
  });

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas font-sans text-text-primary">
      {/* App Header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/95 shadow-card backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-2">
            <div className="order-1 flex min-w-0 items-center gap-3">
              <BrandMark compact className="shrink-0" />
              <span className="hidden text-sm font-bold tracking-tight text-text-primary sm:inline">Professional Portal</span>
            </div>

            <SurfaceCard
              as="div"
              tone="muted"
              className="order-2 ml-auto flex min-w-0 items-center gap-2 px-2.5 py-1.5 shadow-none lg:order-3"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-pb-midnight text-sm font-black text-white" aria-hidden="true">
                {(user.name || '?').charAt(0)}
              </div>
              <div className="min-w-0 text-right">
                <div className="max-w-20 truncate text-xs font-bold leading-tight text-text-primary sm:max-w-40 sm:text-sm">{user.name || 'Profile pending'}</div>
                <div className="hidden max-w-40 truncate text-xs font-medium text-text-muted md:block">{cleanProfileTitle(user.title) || 'Complete your profile'}</div>
              </div>
              <StatusBadge label={professionalPermissions.label} tone={toneForTier(professionalPermissions.tier)} />
            </SurfaceCard>

            <div className="order-3 flex w-full items-center justify-end gap-1 border-t border-border-subtle pt-2 lg:order-2 lg:ml-auto lg:w-auto lg:border-0 lg:pt-0" aria-label="Professional account controls">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
                className="min-h-11 min-w-11 !p-2 text-text-muted"
                title="Toggle Dark Mode"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
              </Button>
              <div className="[&>div]:h-11 [&>div]:w-11 [&>div>button]:min-h-11 [&>div>button]:min-w-11 [&>div>button]:rounded-control [&>div>button]:text-text-muted [&>div>button:hover]:!text-action [&>div>button:focus-visible]:!text-action [&>div>button]:focus-visible:outline-none [&>div>button]:focus-visible:ring-4 [&>div>button]:focus-visible:ring-focus/25 [&>div>div]:!fixed [&>div>div]:!inset-x-4 [&>div>div]:!top-32 [&>div>div]:!w-auto sm:[&>div>div]:!absolute sm:[&>div>div]:!inset-x-auto sm:[&>div>div]:!right-0 sm:[&>div>div]:!top-12 sm:[&>div>div]:!w-[min(22rem,calc(100vw-2rem))]">
                <NotificationBell notificationState={notificationState} unreadClassName="bg-action" userId={user.id} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="min-h-11 min-w-11 !p-2 text-danger"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={18} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        {/* App Sub-Navigation */}
        <nav className="border-t border-border-subtle bg-surface" aria-label="Professional workspace navigation">
          <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
              {[
                { id: 'profile', label: professionalPermissions.canAccessDashboard ? 'My Profile' : 'Verification Center' },
                { id: 'opportunities', label: 'Opportunities' },
                { id: 'earnings', label: 'Timesheets & Earnings' },
              ].filter((tab) => availableTabs.includes(tab.id)).map(tab => {
                const unreadCount = tabUnreadCounts[tab.id] || 0;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAppView(tab.id)}
                    aria-current={appView === tab.id ? 'page' : undefined}
                    className={`relative inline-flex min-h-11 shrink-0 items-center rounded-control px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 ${appView === tab.id ? 'bg-action text-white shadow-card' : 'text-text-muted hover:bg-surface-muted hover:text-text-primary'}`}
                  >
                    {tab.label}
                    {unreadCount > 0 && (
                      <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black leading-none ${appView === tab.id ? 'bg-white text-action' : 'bg-action text-white'}`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      {/* App Workspace */}
      <main className="flex-1 bg-canvas">
        <div className="relative mx-auto w-full max-w-[1600px] scroll-smooth px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
          {!professionalPermissions.canAccessDashboard && (
            <SurfaceCard className="mb-6 border-warning-border bg-warning-surface p-5 text-sm font-semibold leading-relaxed text-warning" role="status">
              Professional dashboard access unlocks after admin approves your identity, resume, and required documents. Your profile stays hidden from clients until then.
            </SurfaceCard>
          )}
          {appView === 'profile' && <AppTalentProfileView user={user} />}
          {appView === 'opportunities' && <AppTalentOpportunitiesView user={user} />}
          {appView === 'earnings' && <AppTalentEarningsView />}
        </div>
      </main>
    </div>
  );
}

function AppTalentProfileView({ user }) {
  const { data: profile, isLoading: isProfileLoading } = useBackendResource(
    backendApi.talent.getMyProfile,
    EMPTY_PROFILE,
    {
      realtime: [
        user?.id ? { filter: `user_id=eq.${user.id}`, table: 'professional_profiles' } : null,
      ],
      onRealtimeChange: (currentProfile, payload) => (
        payload?.new?.user_id === user?.id
          ? mergeRealtimeTalentProfile(currentProfile, payload.new, { includeDraftPending: true, usePending: true })
          : undefined
      ),
      refreshInterval: 15000,
    }
  );
  const [savedProfile, setSavedProfile] = useState(EMPTY_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isVisibilitySaving, setIsVisibilitySaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileForm, setProfileForm] = useState({});
  const [previewTier, setPreviewTier] = useState('');
  const [previewProfile, setPreviewProfile] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    setSavedProfile(profile || EMPTY_PROFILE);
  }, [profile]);

  const displayProfile = {
    ...user,
    ...savedProfile,
  };
  const profileTitles = cleanProfileTitles(displayProfile.titles, cleanProfileTitles(displayProfile.title || displayProfile.role));
  const profileTitleText = formatProfileTitles(profileTitles);
  const profileSkills = asList(displayProfile.skills);
  const profileTools = asList(displayProfile.tools);
  const skills = [...new Set([...profileSkills, ...profileTools])];
  const profileAvatar = getProfileAvatar(displayProfile);
  const readiness = getProfileReadiness(displayProfile, profileTitles);
  const professionalPermissions = getProfessionalPortalPermissions(displayProfile);
  const profileVisibility = displayProfile.profileVisibility || displayProfile.profile_visibility || 'hidden';
  const isProfileVisible = professionalPermissions.canToggleProfileVisibility && profileVisibility === 'visible';
  const profileRequirements = buildCredentialRequirements(profileTitles, getSupportingDocuments(displayProfile));
  const resume = getProfileResume(displayProfile);
  const approvedRequiredCount = [resume, ...profileRequirements.map((requirement) => requirement.upload)]
    .filter((upload) => upload?.status === 'approved').length;
  const credentialTotal = 1 + profileRequirements.length;
  const credentialComplete = approvedRequiredCount;
  const credentialPercent = credentialTotal ? Math.round((credentialComplete / credentialTotal) * 100) : 0;
  const activeCredentialTitles = isEditing && editingSection === 'profile'
    ? cleanProfileTitles(profileForm.titles, profileTitles)
    : profileTitles;
  const getTitleRemoveDisabledReason = (title) => {
    const requiredLabels = asList(PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS[title]);
    const supportingDocuments = getSupportingDocuments(displayProfile);
    const relatedUploads = supportingDocuments.filter((document) => (
      requiredLabels.some((label) => documentMatchesLabel(document, label))
    ));
    const allApproved = requiredLabels.length > 0
      && requiredLabels.every((label) => (
        supportingDocuments.some((document) => documentMatchesLabel(document, label) && document.status === 'approved')
      ));

    if (relatedUploads.length) {
      return `${title} has uploaded documents. Remove eligible uploads or request a document change before deselecting this title.`;
    }
    if (allApproved) {
      return `${title} has approved requirements and cannot be deselected here.`;
    }

    return '';
  };

  const buildProfileForm = (overrides = {}) => ({
    avatarUrl: profileAvatar,
    titles: profileTitles,
    availability: displayProfile.availability || displayProfile.available || 'Immediate Start',
    bio: displayProfile.bio || '',
    certifications: listToText(displayProfile.certifications),
    fullName: displayProfile.name || displayProfile.fullName || '',
    hourlyRate: displayProfile.rate || displayProfile.hourlyRate || '',
    location: displayProfile.location || '',
    skills: listToText(displayProfile.skills),
    tools: listToText(displayProfile.tools),
    yearsExperience: displayProfile.yearsExperience || '',
    ...overrides,
  });

  const openEditor = (section = 'profile', overrides = {}) => {
    setProfileError('');
    setProfileMessage('');
    setEditingSection(section);
    setProfileForm(buildProfileForm(overrides));
    setIsEditing(true);
  };

  const handleProfileChange = (field, value) => {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setProfileError('');
    setProfileMessage('');

    if (!profileForm.avatarUrl) {
      setProfileError('Upload a profile photo before saving profile settings.');
      setIsSaving(false);
      return;
    }

    try {
      const nextTitles = cleanProfileTitles(profileForm.titles);
      const updated = await backendApi.talent.updateMyProfile({
        ...profileForm,
        certifications: textToList(profileForm.certifications),
        hourlyRate: profileForm.hourlyRate === '' ? null : Number(profileForm.hourlyRate),
        skills: textToList(profileForm.skills),
        titles: nextTitles,
        tools: textToList(profileForm.tools),
        yearsExperience: profileForm.yearsExperience === '' ? null : Number(profileForm.yearsExperience),
      });
      setSavedProfile(updated);
      setIsEditing(false);
      setProfileMessage('Profile saved.');
    } catch (saveError) {
      setProfileError(saveError.message || 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfilePhotoUpload = async (file) => {
    const fileError = validateImageFile(file, 'Profile photo');

    if (fileError) {
      throw new Error(fileError);
    }

    const fileData = await fileToDataUrl(file);
    const upload = await backendApi.talent.uploadProfilePhoto({
      contentType: getContentTypeForFile(file),
      fileData,
      fileName: file.name,
    });

    setSavedProfile((current) => ({
      ...current,
      avatarUrl: upload.avatarUrl,
      avatar_url: upload.avatarUrl,
    }));
    setProfileForm((current) => ({
      ...current,
      avatarUrl: upload.avatarUrl,
    }));
    setProfileMessage('Profile photo uploaded.');

    return upload;
  };

  const openProfilePreview = async (tier) => {
    setPreviewTier(tier);
    setPreviewProfile(null);
    setPreviewError('');
    setIsPreviewLoading(true);

    try {
      const preview = await backendApi.talent.getProfilePreview({ tier });
      setPreviewProfile(preview);
    } catch (error) {
      setPreviewError(error.message || 'Unable to load profile preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const toggleProfileVisibility = async () => {
    if (!professionalPermissions.canToggleProfileVisibility) return;

    const nextVisibility = profileVisibility === 'visible' ? 'hidden' : 'visible';

    setIsVisibilitySaving(true);
    setProfileError('');
    setProfileMessage('');

    try {
      const updated = await backendApi.talent.updateVisibility({ visibility: nextVisibility });
      setSavedProfile(updated);
      setProfileMessage(nextVisibility === 'visible' ? 'Profile is visible to clients.' : 'Profile is hidden from clients.');
    } catch (visibilityError) {
      setProfileError(visibilityError.message || 'Unable to update profile visibility.');
    } finally {
      setIsVisibilitySaving(false);
    }
  };

  return (
    <div className="portal-fade-in mx-auto max-w-7xl space-y-6">
      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge label={professionalPermissions.label} tone={toneForTier(professionalPermissions.tier)} />
              <StatusBadge
                label={isProfileVisible ? 'Client visible' : professionalPermissions.canAccessDashboard ? 'Verified hidden' : 'Admin review required'}
                tone={isProfileVisible ? 'verified' : professionalPermissions.canAccessDashboard ? 'neutral' : 'warning'}
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-text-primary">
              {professionalPermissions.canAccessDashboard ? 'Professional Dashboard' : 'Verification Center'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-text-muted">
              {displayProfile.name || 'Your profile'} {profileTitleText ? `- ${profileTitleText}` : '- complete your title, credentials, and availability.'}
            </p>
            {professionalPermissions.canToggleProfileVisibility && (
              <SurfaceCard as="div" tone="muted" className="mt-4 flex max-w-xl flex-col gap-2 p-3 shadow-none sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-text-primary">Profile visibility</p>
                  <p className="text-xs font-medium text-text-muted">Control whether eligible clients can discover your approved profile.</p>
                </div>
                <div className="flex min-h-11 shrink-0 items-center [&>div]:min-h-11">
                  <Toggle
                    checked={profileVisibility === 'visible'}
                    isBusy={isVisibilitySaving}
                    label={profileVisibility === 'visible' ? 'Visible' : 'Hidden'}
                    onChange={toggleProfileVisibility}
                  />
                </div>
              </SurfaceCard>
            )}
            <div className="mt-4 flex flex-col items-start gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-text-muted">View Profile As</span>
              <div className="max-w-full overflow-x-auto pb-1 [&>div>button]:min-h-11">
                <SegmentedControl
                  ariaLabel="View profile as"
                  disabled={isPreviewLoading}
                  onChange={openProfilePreview}
                  options={[
                    { icon: EyeOff, label: 'Basic Client', value: 'basic' },
                    { icon: Eye, label: 'Verified Client', value: 'verified' },
                  ]}
                  value={previewTier}
                />
              </div>
              <span className="min-h-5 text-xs font-medium text-processing" aria-live="polite">
                {isPreviewLoading ? `Loading ${previewTier === 'verified' ? 'Verified Client' : 'Basic Client'} preview…` : ''}
              </span>
            </div>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-2xl">
            <DashboardMetric
              detail={`${readiness.completed}/${readiness.checks.length} profile fields`}
              icon={CheckSquare}
              label="Profile"
              value={`${readiness.percent}%`}
              variant={readiness.percent >= 80 ? 'emerald' : 'cyan'}
            />
            <DashboardMetric
              detail={`${credentialComplete}/${credentialTotal} required items approved`}
              icon={BadgeCheck}
              label="Credentials"
              value={`${credentialPercent}%`}
              variant={credentialPercent >= 80 ? 'emerald' : 'amber'}
            />
            <DashboardMetric
              detail={displayProfile.availability || displayProfile.available || 'Availability pending'}
              icon={DollarSign}
              label="Rate"
              value={displayProfile.rate || displayProfile.hourlyRate ? `${formatMoney(displayProfile.rate || displayProfile.hourlyRate)}/hr` : 'Pending'}
              variant="slate"
            />
          </div>
        </div>
      </SurfaceCard>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      {/* Left Column: Quick Profile Card */}
      <div className="min-w-0 w-full">
        <SurfaceCard className="overflow-hidden">
          <div className="h-24 bg-pb-midnight" aria-hidden="true" />
          <div className="relative p-6">
            <div className="absolute -top-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border-4 border-surface bg-surface-muted text-3xl font-bold text-action shadow-card">
              {profileAvatar ? (
                <img src={profileAvatar} alt={`${displayProfile.name || 'Professional'} profile`} className="h-full w-full object-cover" />
              ) : (
                (displayProfile.name || '?').charAt(0)
              )}
            </div>

            <div className="mb-6 mt-12">
              <h2 className="text-xl font-bold leading-tight text-text-primary">{displayProfile.name || 'Profile pending'}</h2>
              <p className="mb-4 text-sm font-medium text-text-muted">{profileTitleText || 'Add your professional title'}</p>

              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text-muted">
                <MapPin size={16} aria-hidden="true" /> {displayProfile.location || 'Add location'}
              </div>
              <div className="mb-6 flex items-center gap-2 text-sm font-medium text-text-muted">
                <Star size={16} className="text-premium-detail" aria-hidden="true" /> {displayProfile.rating ? `${displayProfile.rating} Average Rating` : 'No ratings yet'}
              </div>

              <SurfaceCard as="div" tone="muted" className="mb-6 p-4 shadow-none">
                <label htmlFor="professional-dashboard-availability" className="mb-2 block text-xs font-bold uppercase text-text-muted">Availability Status</label>
                <select
                  id="professional-dashboard-availability"
                  className={formControlClassName}
                  value={displayProfile.availability || displayProfile.available || 'Immediate Start'}
                  onChange={(event) => {
                    openEditor('profile', { availability: event.target.value });
                  }}
                >
                  <option value="" disabled>Select Availability</option>
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </SurfaceCard>

              <SurfaceCard as="div" tone="muted" className="mb-6 p-4 shadow-none">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Profile readiness</span>
                  <span className="text-sm font-black text-text-primary">{readiness.percent}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-label="Profile readiness"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={readiness.percent}
                >
                  <div className="h-full rounded-full bg-processing transition-[width] motion-reduce:transition-none" style={{ width: `${readiness.percent}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {readiness.checks.map((item) => (
                    <StatusBadge
                      key={item.label}
                      label={item.label}
                      tone={item.done ? 'verified' : 'neutral'}
                    />
                  ))}
                </div>
              </SurfaceCard>

              <Button type="button" variant="secondary" onClick={() => openEditor('profile')} className="min-h-11 w-full gap-2">
                 <Settings size={16} aria-hidden="true" /> Profile Settings
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Right Column: Detailed Profile Form/View */}
      <div className="min-w-0 flex-1 w-full space-y-6">
        <div aria-live="polite" className="space-y-3">
          {profileError && (
            <div className="rounded-card border border-danger-border bg-danger-surface px-5 py-4 text-sm font-semibold text-danger" role="alert">
              {profileError}
            </div>
          )}
          {profileMessage && (
            <div className="rounded-card border border-verified-border bg-verified-surface px-5 py-4 text-sm font-semibold text-verified" role="status">
              {profileMessage}
            </div>
          )}
        </div>

        <FadeIn>
          <SurfaceCard className="p-5 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-text-primary">Professional Bio</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => openEditor('bio')} className="min-h-11 text-action">Edit</Button>
            </div>
            {displayProfile.bio ? (
              <p className="leading-relaxed text-text-muted">{displayProfile.bio}</p>
            ) : (
              <EmptyState
                icon={FileText}
                title="No bio yet"
                description="Your professional summary will appear here once your profile is completed."
              />
            )}
          </SurfaceCard>
        </FadeIn>

        <FadeIn delay={100}>
          <SurfaceCard className="p-5 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-text-primary">Rates & Skills</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => openEditor('rates')} className="min-h-11 text-action">Edit</Button>
            </div>

            <>
            <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Current Hourly Rate</div>
                <div className="text-3xl font-black tracking-tight text-text-primary">{formatMoney(displayProfile.rate || displayProfile.hourlyRate)} <span className="text-sm font-bold text-text-muted">/hr</span></div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Total Experience</div>
                <div className="text-lg font-bold text-text-primary">{displayProfile.experience || displayProfile.exp || 'Pending'}</div>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-6">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Skills & Software</div>
              <div className="flex flex-wrap gap-2">
                {skills.length === 0 && (
                  <span className="text-sm font-medium text-text-muted">No skills or tools added yet.</span>
                )}
                {skills.map(tool => (
                  <span key={tool} className="rounded-control border border-border-subtle bg-surface-muted px-3 py-1.5 text-sm font-bold text-text-primary">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            </>
          </SurfaceCard>
        </FadeIn>

        <FadeIn delay={200}>
          <ProfessionalIdentityVerificationPanel
            onProfileUpdated={setSavedProfile}
            profile={savedProfile}
          />
        </FadeIn>

        <FadeIn delay={250}>
          <AppTalentCredentialsSection
            isLoading={isProfileLoading}
            onProfileUpdated={setSavedProfile}
            profile={savedProfile}
            selectedTitles={activeCredentialTitles}
            user={user}
          />
        </FadeIn>
      </div>
      </div>
      <ProfileSettingsModal
        activeSection={editingSection}
        error={profileError}
        form={profileForm}
        getTitleRemoveDisabledReason={getTitleRemoveDisabledReason}
        isSaving={isSaving}
        message={profileMessage}
        onChange={handleProfileChange}
        onClose={() => setIsEditing(false)}
        onPhotoUpload={handleProfilePhotoUpload}
        onSectionChange={setEditingSection}
        onSubmit={handleProfileSubmit}
        open={isEditing}
      />
      {previewTier && (
        <ProfessionalProfilePreviewModal
          error={previewError}
          isLoading={isPreviewLoading}
          onClose={() => {
            setPreviewTier('');
            setPreviewProfile(null);
            setPreviewError('');
          }}
          profile={previewProfile}
          tier={previewTier}
        />
      )}
    </div>
  );
}

function ProfileSettingsModal({
  activeSection,
  error,
  form,
  getTitleRemoveDisabledReason,
  isSaving,
  message,
  onChange,
  onClose,
  onPhotoUpload,
  onSectionChange,
  onSubmit,
  open,
}) {
  const [photoError, setPhotoError] = useState('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const uploadGenerationRef = useRef(0);
  const sections = [
    { value: 'profile', icon: User, label: 'Profile' },
    { value: 'bio', icon: FileText, label: 'Bio' },
    { value: 'rates', icon: DollarSign, label: 'Rates' },
  ];

  useEffect(() => {
    if (open) return;

    uploadGenerationRef.current += 1;
    setPhotoError('');
    setIsPhotoUploading(false);
  }, [open]);

  const uploadPhoto = async (file) => {
    if (!file) return;

    const uploadGeneration = ++uploadGenerationRef.current;
    setPhotoError('');
    setIsPhotoUploading(true);

    try {
      await onPhotoUpload(file);
    } catch (error) {
      if (uploadGenerationRef.current === uploadGeneration) {
        setPhotoError(error.message || 'Unable to upload profile photo.');
      }
    } finally {
      if (uploadGenerationRef.current === uploadGeneration) {
        setIsPhotoUploading(false);
      }
    }
  };

  return (
    <Modal
      description="Keep the profile clients see accurate, complete, and ready for review."
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-xs font-semibold text-text-muted" aria-live="polite">
            {isSaving ? 'Saving your profile settings…' : error || message || 'Changes apply after you save.'}
          </div>
          <div className="flex flex-col-reverse gap-2 min-[360px]:flex-row min-[360px]:justify-end">
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-11">
              Cancel
            </Button>
            <Button
              type="submit"
              form="professional-profile-settings-form"
              isLoading={isSaving}
              disabled={isPhotoUploading}
              className="min-h-11 gap-2"
            >
              {!isSaving && <CheckCircle size={16} aria-hidden="true" />}
              {isSaving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        </div>
      )}
      open={open}
      title="Profile Settings"
      size="wide"
      onClose={onClose}
    >
      <form id="professional-profile-settings-form" onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <SurfaceCard as="aside" tone="muted" className="h-fit p-4 shadow-none">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-card border border-border-subtle bg-surface">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={`${form.fullName || 'Professional'} profile`} className="h-full w-full object-cover" />
                ) : (
                  <Camera size={24} className="text-text-muted" aria-hidden="true" />
                )}
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-text-muted">Required Photo</div>
                <div className="text-sm font-black text-text-primary">{form.avatarUrl ? 'Photo uploaded' : 'Upload a photo'}</div>
              </div>
            </div>
            <p className="mb-4 text-xs font-semibold leading-relaxed text-text-muted">
              Use a clear head-and-shoulders photo in proper attire, facing the camera with neutral lighting and a professional pose.
            </p>
            {photoError && (
              <div className="mb-3 rounded-control border border-danger-border bg-danger-surface px-3 py-2 text-xs font-semibold text-danger" role="alert">
                {photoError}
              </div>
            )}
            <input
              ref={photoInputRef}
              id="professional-photo-upload"
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="sr-only"
              aria-label="Upload profile photo"
              onChange={async (event) => {
                await uploadPhoto(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="secondary"
              isLoading={isPhotoUploading}
              onClick={() => photoInputRef.current?.click()}
              className="min-h-11 w-full gap-2"
              aria-controls="professional-photo-upload"
            >
              {!isPhotoUploading && <Upload size={16} aria-hidden="true" />}
              {isPhotoUploading ? 'Uploading…' : 'Upload Photo'}
            </Button>
          </SurfaceCard>

          <div className="min-w-0">
            <div className="mb-6 max-w-full overflow-x-auto pb-1 [&>div>button]:min-h-11">
              <SegmentedControl
                ariaLabel="Profile settings section"
                onChange={onSectionChange}
                options={sections}
                value={activeSection}
              />
            </div>

            <div className="mb-5" aria-live="polite">
              {error && <p className="rounded-control border border-danger-border bg-danger-surface px-4 py-3 text-sm font-semibold text-danger" role="alert">{error}</p>}
              {!error && message && <p className="rounded-control border border-verified-border bg-verified-surface px-4 py-3 text-sm font-semibold text-verified" role="status">{message}</p>}
            </div>

            {activeSection === 'profile' && (
              <section aria-labelledby="professional-profile-details-heading">
                <h3 id="professional-profile-details-heading" className="mb-4 text-base font-bold text-text-primary">Profile details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="professional-full-name" label="Full name">
                    {({ describedBy, ...controlProps }) => <input id="professional-full-name" data-description-id={describedBy} value={form.fullName || ''} onChange={(event) => onChange('fullName', event.target.value)} {...controlProps} />}
                  </FormField>
                  <FormField id="professional-location" label="Location">
                    {({ describedBy, ...controlProps }) => <input id="professional-location" data-description-id={describedBy} value={form.location || ''} onChange={(event) => onChange('location', event.target.value)} {...controlProps} />}
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField id="professional-titles" label="Professional titles">
                      {({ describedBy }) => (
                        <MultiSelectPicker
                          id="professional-titles"
                          className={formControlClassName}
                          describedBy={describedBy}
                          getRemoveDisabledReason={getTitleRemoveDisabledReason}
                          value={form.titles || []}
                          onChange={(titles) => onChange('titles', titles)}
                          optionsList={PROFESSIONAL_TITLE_OPTIONS}
                          placeholder="Select professional titles"
                        />
                      )}
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <FormField id="professional-availability" label="Availability">
                      {({ describedBy, ...controlProps }) => (
                        <select id="professional-availability" data-description-id={describedBy} value={form.availability || 'Immediate Start'} onChange={(event) => onChange('availability', event.target.value)} {...controlProps}>
                          {AVAILABILITY_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )}
                    </FormField>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'bio' && (
              <section aria-labelledby="professional-bio-heading">
                <h3 id="professional-bio-heading" className="mb-4 text-base font-bold text-text-primary">Professional bio</h3>
                <FormField id="professional-bio" label="Bio" hint="Summarize the finance work, industries, and outcomes clients should know about.">
                  {({ className, describedBy, ...controlProps }) => <textarea id="professional-bio" data-description-id={describedBy} value={form.bio || ''} onChange={(event) => onChange('bio', event.target.value)} rows={8} {...controlProps} className={`${className} leading-relaxed`} />}
                </FormField>
              </section>
            )}

            {activeSection === 'rates' && (
              <section aria-labelledby="professional-rates-heading" className="space-y-5">
                <h3 id="professional-rates-heading" className="text-base font-bold text-text-primary">Rates and expertise</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="professional-hourly-rate" label="Hourly rate">
                    {({ describedBy, ...controlProps }) => <input id="professional-hourly-rate" data-description-id={describedBy} type="number" min="0" step="1" value={form.hourlyRate || ''} onChange={(event) => onChange('hourlyRate', event.target.value)} {...controlProps} />}
                  </FormField>
                  <FormField id="professional-years-experience" label="Years experience">
                    {({ describedBy, ...controlProps }) => <input id="professional-years-experience" data-description-id={describedBy} type="number" min="0" step="1" value={form.yearsExperience || ''} onChange={(event) => onChange('yearsExperience', event.target.value)} {...controlProps} />}
                  </FormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="professional-skills" label="Skills">
                    {({ describedBy }) => <MultiSelectPicker id="professional-skills" className={formControlClassName} describedBy={describedBy} value={form.skills || []} onChange={(skills) => onChange('skills', skills)} optionsList={SKILLS_OPTIONS} placeholder="Select skills" />}
                  </FormField>
                  <FormField id="professional-tools" label="Tools / Software">
                    {({ describedBy }) => <MultiSelectPicker id="professional-tools" className={formControlClassName} describedBy={describedBy} value={form.tools || []} onChange={(tools) => onChange('tools', tools)} optionsList={SOFTWARE_OPTIONS} placeholder="Select software" />}
                  </FormField>
                </div>
              </section>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ProfessionalProfilePreviewModal({ error, isLoading, onClose, profile, tier }) {
  const [previewDocument, setPreviewDocument] = useState(null);
  const [documentError, setDocumentError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const canViewFullDocuments = Boolean(profile?.canViewFullDocuments);
  const resume = profile?.resume || null;
  const supportingDocuments = asList(profile?.supportingDocuments);
  const skills = [...new Set([...asList(profile?.skills), ...asList(profile?.tools)])];
  const tierLabel = tier === 'verified' ? 'Verified Client' : 'Basic Client';

  useEffect(() => {
    setPreviewDocument(null);
    setDocumentError('');
    setBusyKey('');
  }, [profile?.id, tier]);

  const openPreviewDocument = async (document, fallbackType = 'supporting_document') => {
    if (!profile?.id || !document) return;

    const documentKey = getDocumentKey(document);
    const documentType = document.documentType || document.kind || fallbackType;

    setDocumentError('');
    setBusyKey(`${documentType}:${documentKey}`);

    try {
      const result = await backendApi.documents.getUrl({
        documentKey,
        documentType,
        previewTier: tier,
        professionalId: profile.id,
      });

      setPreviewDocument({
        contentType: result?.contentType || document.contentType,
        fileName: result?.fileName || document.fileName || document.label || 'Document preview',
        previewUrl: result?.url,
      });
    } catch (openError) {
      setDocumentError(openError.message || 'Unable to open this document.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <>
      {previewDocument && (
        <DocumentPreviewModal
          key={previewDocument.previewUrl || previewDocument.fileName || 'preview-document'}
          previewDocument={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
      <Modal
        description="This audience preview is read-only and never changes your professional account tier or visibility."
        open={Boolean(tier)}
        title={`View Profile As ${tierLabel}`}
        size="wide"
        onClose={onClose}
      >
        {isLoading ? (
          <SurfaceCard className="flex items-center justify-center gap-3 border-processing-border bg-processing-surface p-8 text-sm font-bold text-processing">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Loading preview
          </SurfaceCard>
        ) : error ? (
          <div className="rounded-card border border-danger-border bg-danger-surface px-5 py-4 text-sm font-semibold text-danger" role="alert">
            {error}
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <SurfaceCard tone="muted" className="flex flex-col gap-4 p-5 shadow-none sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border border-border-subtle bg-surface text-2xl font-black text-action">
                {getProfileAvatar(profile) ? (
                  <img src={getProfileAvatar(profile)} alt={`${profile.name || profile.fullName || 'Professional'} profile`} className="h-full w-full object-cover" />
                ) : (
                  (profile.name || profile.fullName || '?').charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  {canViewFullDocuments ? <Eye size={16} className="text-verified" aria-hidden="true" /> : <EyeOff size={16} className="text-text-muted" aria-hidden="true" />}
                  <StatusBadge label={tierLabel} tone={toneForTier(tier)} />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-text-primary">{profile.name || profile.fullName || 'Professional profile'}</h3>
                <p className="mt-1 text-sm font-bold text-action">{profile.title || profile.role || 'Finance Professional'}</p>
                <p className="mt-2 text-sm font-medium text-text-muted">{profile.location || 'Location pending'} <span aria-hidden="true">·</span> {profile.rate ? `${formatMoney(profile.rate)}/hr` : 'Rate pending'}</p>
              </div>
            </SurfaceCard>

            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <SurfaceCard className="space-y-5 p-5 shadow-none">
                <div>
                  <h4 className="mb-2 text-sm font-black text-text-primary">Bio</h4>
                  <p className="text-sm font-medium leading-relaxed text-text-muted">{profile.bio || 'No bio is visible yet.'}</p>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-black text-text-primary">Skills & Software</h4>
                  <div className="flex flex-wrap gap-2">
                    {skills.length ? skills.map((skill) => (
                      <span key={skill} className="rounded-control border border-border-subtle bg-surface-muted px-3 py-1.5 text-xs font-bold text-text-primary">
                        {skill}
                      </span>
                    )) : (
                      <span className="text-sm font-semibold text-text-muted">No skills visible yet.</span>
                    )}
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="p-5 shadow-none">
                <h4 className="mb-3 text-sm font-black text-text-primary">Verified Qualifications & Resume</h4>
                {documentError && (
                  <div className="mb-3 rounded-control border border-danger-border bg-danger-surface px-4 py-3 text-sm font-semibold text-danger" role="alert">
                    {documentError}
                  </div>
                )}
                {!canViewFullDocuments ? (
                  <div className="rounded-card border border-border-subtle bg-surface-muted p-5 text-sm font-semibold text-text-muted">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-control bg-surface text-text-muted">
                      <EyeOff size={22} aria-hidden="true" />
                    </div>
                    Resume and required documents are hidden for Basic clients.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[resume, ...supportingDocuments].filter(Boolean).map((document, index) => {
                      const documentType = document.documentType || document.kind || (index === 0 ? 'resume' : 'supporting_document');
                      const key = getDocumentKey(document);
                      const busy = busyKey === `${documentType}:${key}`;

                      return (
                        <SurfaceCard as="div" key={`${documentType}:${key}`} tone="muted" className="p-4 shadow-none">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-sm font-black text-text-primary">{document.label || document.fileName || 'Verified document'}</div>
                              <div className="text-xs font-semibold text-text-muted">{document.fileName || 'Approved credential'}</div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openPreviewDocument(document, documentType)}
                              isLoading={busy}
                              className="min-h-11 gap-2"
                            >
                              {!busy && <FileText size={14} aria-hidden="true" />}
                              {busy ? 'Opening…' : 'View'}
                            </Button>
                          </div>
                        </SurfaceCard>
                      );
                    })}
                    {!resume && supportingDocuments.length === 0 && (
                      <div className="rounded-card border border-border-subtle bg-surface-muted p-5 text-sm font-semibold text-text-muted">
                        No approved documents are visible to Verified clients yet.
                      </div>
                    )}
                  </div>
                )}
              </SurfaceCard>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function ProfessionalIdentityVerificationPanel({ onProfileUpdated, profile }) {
  const [busyKind, setBusyKind] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const identityDocuments = getIdentityDocuments(profile);
  const identityApproved = (profile?.identityVerificationStatus || profile?.identity_verification_status) === 'approved';
  const [expiryDates, setExpiryDates] = useState({
    valid_id_back: identityDocuments.validIdBack?.expiryDate || '',
    valid_id_front: identityDocuments.validIdFront?.expiryDate || '',
  });
  const [changeRequestRow, setChangeRequestRow] = useState(null);
  const [changeRequestReason, setChangeRequestReason] = useState('');
  const [changeRequestCustomReason, setChangeRequestCustomReason] = useState('');
  const [changeRequestBusy, setChangeRequestBusy] = useState(false);

  useEffect(() => {
    setExpiryDates({
      valid_id_back: identityDocuments.validIdBack?.expiryDate || '',
      valid_id_front: identityDocuments.validIdFront?.expiryDate || '',
    });
  }, [identityDocuments.validIdBack?.expiryDate, identityDocuments.validIdFront?.expiryDate]);

  const rows = [
    {
      accept: DOCUMENT_ACCEPTS.other_document,
      description: 'Government-issued ID, front side. PDF, JPG, or PNG.',
      document: identityDocuments.validIdFront,
      icon: IdCard,
      kind: 'valid_id_front',
      label: 'Valid ID front',
      required: true,
      requiresExpiry: true,
      validator: (file) => validateCredentialFile(file, 'other_document'),
    },
    {
      accept: DOCUMENT_ACCEPTS.other_document,
      description: 'Back side if your ID has separate rear details.',
      document: identityDocuments.validIdBack,
      icon: IdCard,
      kind: 'valid_id_back',
      label: 'Valid ID back',
      required: false,
      requiresExpiry: true,
      validator: (file) => validateCredentialFile(file, 'other_document'),
    },
    {
      accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
      description: 'A fresh selfie facing the camera for liveness review.',
      document: identityDocuments.livenessSelfie,
      icon: Camera,
      kind: 'liveness_selfie',
      label: 'Liveness selfie',
      required: true,
      requiresExpiry: false,
      validator: (file) => validateImageFile(file, 'Liveness selfie'),
    },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const isFutureExpiryDate = (value) => Boolean(value && value > today);
  const requiredComplete = rows.filter((row) => row.required).every((row) => (
    hasIdentityArtifact(row.document)
    && (!row.requiresExpiry || isFutureExpiryDate(row.document?.expiryDate || expiryDates[row.kind]))
  ));

  const uploadIdentityFile = async (row, file) => {
    if (!file) return;

    const fileError = row.validator(file);

    if (fileError) {
      setError(fileError);
      return;
    }

    if (row.requiresExpiry && !isFutureExpiryDate(expiryDates[row.kind])) {
      setError(`Add a future ${row.label.toLowerCase()} expiration date before uploading.`);
      return;
    }

    setBusyKind(row.kind);
    setError('');
    setMessage('');

    try {
      const fileData = await fileToDataUrl(file);
      const updated = await backendApi.talent.uploadIdentity({
        contentType: getContentTypeForFile(file),
        fileData,
        fileName: file.name,
        kind: row.kind,
        expiryDate: expiryDates[row.kind],
      });

      onProfileUpdated(updated);
      setMessage(`${row.label} uploaded for identity verification.`);
    } catch (uploadError) {
      setError(uploadError.message || `Unable to upload ${row.label.toLowerCase()}.`);
    } finally {
      setBusyKind('');
    }
  };

  const closeChangeRequest = () => {
    setChangeRequestRow(null);
    setChangeRequestReason('');
    setChangeRequestCustomReason('');
  };

  const submitIdentityChangeRequest = async (event) => {
    event.preventDefault();
    const reason = changeRequestReason === 'Other'
      ? changeRequestCustomReason.trim()
      : changeRequestReason;

    if (!reason || !changeRequestRow?.document) return;

    setChangeRequestBusy(true);
    setError('');
    setMessage('');

    try {
      const updated = await backendApi.talent.requestDocumentChange({
        documentKey: changeRequestRow.document.key || changeRequestRow.document.id,
        documentName: changeRequestRow.label,
        documentType: 'identity',
        reason,
      });
      onProfileUpdated(updated);
      setMessage('Identity document change/removal request submitted to PB Finance admins.');
      closeChangeRequest();
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit identity document request.');
    } finally {
      setChangeRequestBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            <IdCard size={14} />
            Professional onboarding
          </div>
          <h3 className="text-xl font-bold text-slate-950 dark:text-white">Valid ID & Liveness Check</h3>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Dashboard access stays locked until PB Finance manually approves your identity and required documents.</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
          requiredComplete
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
        }`}>
          {requiredComplete ? <CheckCircle size={14} /> : <Clock3 size={14} />}
          {requiredComplete ? 'Ready for review' : 'Required'}
        </span>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

        <div className="grid gap-3 md:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const uploaded = hasIdentityArtifact(row.document);
          const busy = busyKind === row.kind;
          const changeRequestPending = row.document?.changeRequestStatus === 'pending';

          return (
            <div key={row.kind} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-cyan-700 dark:bg-slate-900 dark:text-cyan-300">
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-950 dark:text-white">{row.label}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{row.required ? 'Required' : 'Optional'}</div>
                  </div>
                </div>
                <span className={`rounded-lg border px-2 py-1 text-[11px] font-black ${
                  uploaded
                    ? getCredentialStatusStyle(identityApproved ? 'approved' : (row.document?.status || 'draft'))
                    : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900'
                }`}>
                  {uploaded ? getCredentialStatusLabel(identityApproved ? 'approved' : row.document?.status) : 'Missing'}
                </span>
              </div>
              <p className="mb-4 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{row.description}</p>
              {uploaded && (
                <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <div className="truncate">{row.document.fileName || row.document.label}</div>
                  {row.requiresExpiry && row.document.expiryDate && (
                    <div className="text-[11px] text-slate-400">Expires {row.document.expiryDate}</div>
                  )}
                </div>
              )}
              {row.requiresExpiry && !identityApproved && (
                <label className="mb-3 block text-xs font-black text-slate-600 dark:text-slate-300">
                  {row.kind === 'valid_id_front' ? 'Valid ID expiration date' : 'ID back expiration date'}
                  <input
                    type="date"
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                    value={expiryDates[row.kind] || ''}
                    onChange={(event) => setExpiryDates((current) => ({
                      ...current,
                      [row.kind]: event.target.value,
                    }))}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                </label>
              )}
              {identityApproved && uploaded ? (
                <button
                  type="button"
                  disabled={changeRequestPending}
                  onClick={() => setChangeRequestRow(row)}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-black text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-default disabled:opacity-60 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-300"
                >
                  {changeRequestPending ? 'Request pending' : 'Request Change/Removal'}
                </button>
              ) : (
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-cyan-600">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {busy ? 'Uploading...' : uploaded ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    accept={row.accept}
                    className="hidden"
                    onChange={async (event) => {
                      await uploadIdentityFile(row, event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
        </div>
      </div>
      <Modal open={Boolean(changeRequestRow)} title="Request Identity Document Change/Removal" onClose={closeChangeRequest}>
        {changeRequestRow && (
          <form onSubmit={submitIdentityChangeRequest} className="space-y-4">
            <p className="text-sm font-medium text-slate-500">
              <strong className="text-slate-900 dark:text-white">{changeRequestRow.label}</strong> is approved and locked. PB Finance must review your reason before it can be replaced or removed.
            </p>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Reason for change or removal
              <select
                value={changeRequestReason}
                onChange={(event) => setChangeRequestReason(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="" disabled>Select a reason...</option>
                <option value="Document expired / needs renewal">Document expired / needs renewal</option>
                <option value="Incorrect document uploaded">Incorrect document uploaded</option>
                <option value="Details are outdated">Details are outdated</option>
                <option value="Remove this document">Remove this document</option>
                <option value="Other">Other</option>
              </select>
            </label>
            {changeRequestReason === 'Other' && (
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Please specify
                <textarea
                  value={changeRequestCustomReason}
                  onChange={(event) => setChangeRequestCustomReason(event.target.value)}
                  required
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none dark:border-slate-800 dark:bg-slate-900"
                />
              </label>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeChangeRequest} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                Cancel
              </button>
              <button type="submit" disabled={changeRequestBusy || !changeRequestReason || (changeRequestReason === 'Other' && !changeRequestCustomReason.trim())} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70">
                {changeRequestBusy ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function AppTalentCredentialsSection({ isLoading, onProfileUpdated, profile, selectedTitles, user }) {
  const [credentialForm, setCredentialForm] = useState(EMPTY_CREDENTIAL_FORM);
  const [credentialDirty, setCredentialDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [busyUpload, setBusyUpload] = useState('');
  const [credentialError, setCredentialError] = useState('');
  const [credentialMessage, setCredentialMessage] = useState('');
  const [documentTab, setDocumentTab] = useState('certifications');
  const [previewDocument, setPreviewDocument] = useState(null);
  const [otherDocumentRows, setOtherDocumentRows] = useState(() => [createOtherDocumentRow()]);

  const [changeRequestDocument, setChangeRequestDocument] = useState('');
  const [changeRequestReason, setChangeRequestReason] = useState('');
  const [changeRequestCustomReason, setChangeRequestCustomReason] = useState('');
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);

  useEffect(() => {
    if (credentialDirty || isSaving || busyUpload) return;

    const nextProfile = profile || EMPTY_PROFILE;
    setCredentialForm({
      certifications: asList(nextProfile.certifications),
      externalLinks: normalizeLinkFields(getExternalLinks(nextProfile)),
      resume: getProfileResume(nextProfile),
      supportingDocuments: getSupportingDocuments(nextProfile),
      regulatedInputs: getWorkPreferences(nextProfile).regulatedInputs || {},
    });
  }, [busyUpload, credentialDirty, isSaving, profile]);

  useEffect(() => {
    if (!credentialMessage) return undefined;

    const timeoutId = window.setTimeout(() => setCredentialMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [credentialMessage]);

  const displayProfile = {
    ...user,
    ...(profile || EMPTY_PROFILE),
  };
  const identityDocuments = getIdentityDocuments(displayProfile);
  const savedProfileTitles = cleanProfileTitles(displayProfile.titles, cleanProfileTitles(displayProfile.title || displayProfile.role));
  const profileTitles = cleanProfileTitles(selectedTitles, savedProfileTitles);
  const profileTitleKey = profileTitles.join('|');
  const certificationRequirements = buildCredentialRequirements(
    profileTitles,
    credentialForm.supportingDocuments,
    PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS
  );
  const allCertificationLabels = new Set(Object.values(PROFESSIONAL_TITLE_CERTIFICATION_OPTIONS).flatMap((labels) => asList(labels)));
  const preservedCertificationRequirements = credentialForm.supportingDocuments
    .filter((document) => (
      (document.kind === 'certification' || allCertificationLabels.has(document.label))
      && !certificationRequirements.some((requirement) => documentMatchesLabel(document, requirement.label))
    ))
    .map((document) => ({
      key: document.label || document.key,
      label: document.label || 'Certification document',
      title: 'Title not selected',
      titles: [],
      upload: document,
    }));
  const visibleCertificationRequirements = [
    ...certificationRequirements,
    ...preservedCertificationRequirements,
  ];
  const requiredLabels = certificationRequirements.map((requirement) => requirement.label);
  const otherDocumentOptions = getDocumentOptionsForTitles(
    profileTitles,
    PROFESSIONAL_TITLE_OTHER_DOCUMENT_OPTIONS,
    requiredLabels
  );
  const otherDocuments = credentialForm.supportingDocuments.filter((document) => (
    document.kind !== 'certification'
    && !allCertificationLabels.has(document.label)
    && !documentMatchesAnyLabel(document, requiredLabels)
  ));
  const certificationHelperText = certificationRequirements.length
    ? `Hard requirements for: ${formatProfileTitles(profileTitles)}.`
    : profileTitles.length
      ? 'No hard certification requirements are mapped for the selected title yet.'
      : 'Choose at least one professional title to see required certifications.';
  const otherDocumentHelperText = otherDocumentOptions.length
    ? `Optional supporting documents for: ${formatProfileTitles(profileTitles)}.`
    : profileTitles.length
      ? 'No optional supporting documents are mapped for the selected title yet.'
      : 'Choose a professional title to see optional supporting documents.';
  const activeRegulatedInputs = [];
  profileTitles.forEach((title) => {
    if (REGULATED_TITLE_REQUIREMENTS[title]) {
      REGULATED_TITLE_REQUIREMENTS[title].inputFields.forEach((field) => {
        activeRegulatedInputs.push({ ...field, title });
      });
    }
  });
  const requiredRegulatedInputs = activeRegulatedInputs.filter((field) => field.required);
  const hasRequiredRegulatedInputs = requiredRegulatedInputs.length > 0;

  const approvalRequirementText = certificationRequirements.length
    ? `To get approved, upload Valid ID, complete liveness, upload your resume${hasRequiredRegulatedInputs ? ', complete Required Regulatory Inputs,' : ''} and all ${certificationRequirements.length} required certification document${certificationRequirements.length === 1 ? '' : 's'}. Admin must approve each required upload. Other Documents are optional and will not block approval.`
    : `To get approved, upload Valid ID, complete liveness, upload your resume${hasRequiredRegulatedInputs ? ' and complete Required Regulatory Inputs' : ''}. Required certification documents appear after you choose a mapped professional title; Other Documents are optional and will not block approval.`;
  const resume = credentialForm.resume;
  const uploadedCertificationCount = certificationRequirements.filter((requirement) => requirement.upload).length;
  const missingCertificationCount = certificationRequirements.length - uploadedCertificationCount;
  const approvedUploadCount = [resume, ...certificationRequirements.map((requirement) => requirement.upload)]
    .filter((upload) => upload?.status === 'approved').length;
  const rejectedUploadCount = [resume, ...certificationRequirements.map((requirement) => requirement.upload)]
    .filter((upload) => upload?.status === 'rejected').length;
  const pendingUploadCount = [resume, ...certificationRequirements.map((requirement) => requirement.upload)]
    .filter((upload) => (upload?.status || '') === 'pending_review').length;
  const savedUploadCount = [resume, ...certificationRequirements.map((requirement) => requirement.upload)]
    .filter((upload) => upload && !['approved', 'pending_review', 'rejected'].includes(upload.status || 'draft')).length;
  const requiredCredentialUploads = [resume, ...certificationRequirements.map((requirement) => requirement.upload)]
    .filter(Boolean);
  const missingExpiryUploads = requiredCredentialUploads
    .filter((upload) => upload.status !== 'rejected')
    .filter(requiredCredentialMissingExpiry);
  const validateRegulatedInput = (field, value) => {
    const text = String(value || '').trim();
    if (!field.required && !text) return true;
    if (field.pattern) return new RegExp(field.pattern, 'i').test(text);
    return Boolean(text);
  };
  const invalidRegulatedInputs = activeRegulatedInputs.filter((field) => (
    !validateRegulatedInput(field, credentialForm.regulatedInputs?.[field.id])
  ));
  const missingRequiredRegulatedInputs = requiredRegulatedInputs.filter((field) => (
    !String(credentialForm.regulatedInputs?.[field.id] || '').trim()
  ));
  const verifyBlockers = [
    !hasIdentityArtifact(identityDocuments.validIdFront) ? 'Upload Valid ID front.' : '',
    !hasIdentityArtifact(identityDocuments.livenessSelfie) ? 'Complete liveness selfie.' : '',
    !resume ? 'Upload your resume.' : '',
    ...certificationRequirements
      .filter((requirement) => !requirement.upload)
      .map((requirement) => `Upload ${requirement.label}.`),
    ...[resume, ...certificationRequirements.map((requirement) => requirement.upload)]
      .filter((upload) => upload?.status === 'rejected')
      .map((upload) => `Replace rejected document: ${upload.label || upload.fileName}.`),
    ...missingExpiryUploads
      .map((upload) => `Add an expiry date for ${getCredentialDisplayLabel(upload)} or mark it no expiration date.`),
    ...missingRequiredRegulatedInputs.map((field) => `Complete ${field.label}.`),
    ...invalidRegulatedInputs
      .filter((field) => String(credentialForm.regulatedInputs?.[field.id] || '').trim())
      .map((field) => `Fix ${field.label}.`),
  ].filter(Boolean);
  const isFullyApproved = String(displayProfile.status || '').toLowerCase() === 'approved'
    && !displayProfile.reviewStatus;
  const shouldShowVerify = !isFullyApproved
    || verifyBlockers.length > 0
    || savedUploadCount > 0
    || pendingUploadCount > 0
    || rejectedUploadCount > 0
    || missingCertificationCount > 0;
  const canVerify = verifyBlockers.length === 0 && !isSaving && !busyUpload;

  useEffect(() => {
    setOtherDocumentRows([createOtherDocumentRow()]);
  }, [profileTitleKey]);

  const updateLink = (linkId, url, { save = false } = {}) => {
    const hasChanged = credentialForm.externalLinks.some((link) => link.id === linkId && link.url !== url);
    const externalLinks = credentialForm.externalLinks.map((link) => (
      link.id === linkId ? { ...link, url } : link
    ));
    const nextForm = {
      ...credentialForm,
      externalLinks,
    };

    if (hasChanged) {
      setCredentialDirty(true);
      setCredentialForm(nextForm);
    }

    if (save && (credentialDirty || hasChanged)) {
      saveCredentialForm(nextForm);
    }
  };

  const updateOtherDocumentRow = (rowId, label) => {
    setOtherDocumentRows((current) => current.map((row) => (
      row.id === rowId ? { ...row, label } : row
    )));
  };

  const removeOtherDocumentRow = (rowId) => {
    setOtherDocumentRows((current) => (
      current.length > 1 ? current.filter((row) => row.id !== rowId) : [{ ...current[0], label: '' }]
    ));
  };

  const getOtherDocumentOptionsForRow = (row) => {
    const selectedLabels = new Set(otherDocumentRows
      .filter((item) => item.id !== row.id)
      .map((item) => item.label)
      .filter(Boolean));

    return otherDocumentOptions.filter((option) => (
      !selectedLabels.has(option.label)
      && (option.label === row.label || !otherDocuments.some((document) => documentMatchesLabel(document, option.label)))
    ));
  };

  const hasEmptyOtherDocumentRow = otherDocumentRows.some((row) => !row.label);
  const canAddOtherDocumentRow = !hasEmptyOtherDocumentRow && otherDocumentOptions.some((option) => (
    !otherDocumentRows.some((row) => row.label === option.label)
    && !otherDocuments.some((document) => documentMatchesLabel(document, option.label))
  ));

  const saveCredentialForm = async (nextForm = credentialForm, { submitForReview = false } = {}) => {
    setIsSaving(true);
    setSavingAction(submitForReview ? 'verify' : 'save');
    setCredentialError('');
    setCredentialMessage('');

    const externalLinks = asList(nextForm.externalLinks)
      .map((link) => ({
        id: link.id,
        label: link.label,
        url: normalizeCredentialUrl(link.url),
      }))
      .filter((link) => link.url);
    const activeRegulatedInputIds = new Set(activeRegulatedInputs.map((field) => field.id));
    const regulatedInputs = Object.fromEntries(Object.entries(nextForm.regulatedInputs || {})
      .filter(([key]) => activeRegulatedInputIds.has(key)));
    const workPreferences = {
      ...getWorkPreferences(displayProfile),
      externalLinks,
      resume: nextForm.resume || null,
      supportingDocuments: asList(nextForm.supportingDocuments),
      regulatedInputs,
    };

    try {
      const updated = await backendApi.talent.updateMyProfile(buildProfileSavePayload(displayProfile, {
        certifications: asList(nextForm.certifications),
        submitForReview,
        titles: profileTitles,
        workPreferences,
      }));
      onProfileUpdated(updated);
      setCredentialForm({
        certifications: asList(updated.certifications),
        externalLinks: normalizeLinkFields(getExternalLinks(updated)),
        resume: getProfileResume(updated),
        supportingDocuments: getSupportingDocuments(updated),
        regulatedInputs: getWorkPreferences(updated).regulatedInputs || {},
      });
      setCredentialDirty(false);
      setCredentialMessage(submitForReview
        ? 'Credentials submitted for admin verification.'
        : 'Credentials saved.');
      return updated;
    } catch (saveError) {
      setCredentialError(saveError.message || 'Unable to save credentials.');
      return null;
    } finally {
      setIsSaving(false);
      setSavingAction('');
    }
  };

  const uploadCredentialFile = async ({ documentKey, documentType, file, label }) => {
    if (!file) return;

    const fileError = validateCredentialFile(file, documentType);
    if (fileError) {
      setCredentialError(fileError);
      return;
    }

    setCredentialError('');
    setCredentialMessage('');
    setBusyUpload(documentKey);

    try {
      const fileData = await fileToDataUrl(file);
      const upload = await backendApi.talent.uploadCredential({
        contentType: getContentTypeForFile(file),
        documentKey,
        documentLabel: label,
        documentType,
        fileData,
        fileName: file.name,
      });
      const previousUpload = documentType === 'resume'
        ? credentialForm.resume
        : credentialForm.supportingDocuments.find((document) => (
          document.key === documentKey
          || document.label === label
          || String(document.key || '').endsWith(`:${label}`)
        ));
      const nextUpload = previousUpload
        ? {
          ...upload,
          previousFileName: previousUpload.fileName || '',
          previousStatus: previousUpload.status || '',
          replacedAt: new Date().toISOString(),
          replacedDocumentId: previousUpload.id || '',
          replacedDocumentPath: previousUpload.path || '',
        }
        : upload;
      const nextForm = documentType === 'resume'
        ? { ...credentialForm, resume: nextUpload }
        : {
          ...credentialForm,
          supportingDocuments: [
            ...credentialForm.supportingDocuments.filter((document) => (
              document.key !== documentKey
              && document.label !== label
              && !String(document.key || '').endsWith(`:${label}`)
            )),
            nextUpload,
          ],
        };

      setCredentialForm(nextForm);
      const saved = await saveCredentialForm(nextForm);

      return saved ? nextUpload : null;
    } catch (uploadError) {
      setCredentialError(uploadError.message || 'Unable to upload this file.');
      return null;
    } finally {
      setBusyUpload('');
    }
  };

  const updateUploadExpiry = async (uploadId, expiryDate) => {
    const nextExpiryDate = String(expiryDate || '').trim();
    let nextForm = { ...credentialForm };
    let found = false;

    if (nextForm.resume?.id === uploadId) {
      nextForm.resume = {
        ...nextForm.resume,
        expiryDate: nextExpiryDate,
        noExpiryRequired: nextExpiryDate ? false : nextForm.resume.noExpiryRequired,
      };
      found = true;
    } else {
      nextForm.supportingDocuments = nextForm.supportingDocuments.map((doc) => {
        if (doc.id === uploadId) {
          found = true;
          return {
            ...doc,
            expiryDate: nextExpiryDate,
            noExpiryRequired: nextExpiryDate ? false : doc.noExpiryRequired,
          };
        }
        return doc;
      });
    }

    if (found) {
      setCredentialDirty(true);
      setCredentialForm(nextForm);
      await saveCredentialForm(nextForm);
    }
  };

  const updateUploadNoExpiryRequired = async (uploadId, noExpiryRequired) => {
    let nextForm = { ...credentialForm };
    let found = false;
    const nextNoExpiryRequired = Boolean(noExpiryRequired);

    if (nextForm.resume?.id === uploadId) {
      nextForm.resume = {
        ...nextForm.resume,
        expiryDate: nextNoExpiryRequired ? '' : nextForm.resume.expiryDate,
        noExpiryRequired: nextNoExpiryRequired,
      };
      found = true;
    } else {
      nextForm.supportingDocuments = nextForm.supportingDocuments.map((doc) => {
        if (doc.id === uploadId) {
          found = true;
          return {
            ...doc,
            expiryDate: nextNoExpiryRequired ? '' : doc.expiryDate,
            noExpiryRequired: nextNoExpiryRequired,
          };
        }
        return doc;
      });
    }

    if (found) {
      setCredentialDirty(true);
      setCredentialForm(nextForm);
      await saveCredentialForm(nextForm);
    }
  };

  const removeRejectedDocument = async ({ documentKey, documentType, label }) => {
    setBusyUpload(`remove:${documentKey}`);
    setCredentialError('');
    setCredentialMessage('');

    try {
      let nextForm;
      let removedUpload;

      if (documentType === 'resume') {
        removedUpload = credentialForm.resume;
        nextForm = { ...credentialForm, resume: null };
      } else {
        removedUpload = credentialForm.supportingDocuments.find((document) => (
          document.key === documentKey
          || document.label === label
          || String(document.key || '').endsWith(`:${label}`)
        ));
        nextForm = {
          ...credentialForm,
          supportingDocuments: credentialForm.supportingDocuments.filter((document) => (
            document.key !== documentKey
            && document.label !== label
            && !String(document.key || '').endsWith(`:${label}`)
          )),
        };
      }

      setCredentialForm(nextForm);
      const saved = await saveCredentialForm(nextForm);

      if (saved) {
        setCredentialMessage(removedUpload?.status === 'rejected'
          ? 'Rejected document removed.'
          : 'Document removed.');
      }
    } catch (removeError) {
      setCredentialError(removeError.message || 'Unable to remove this document.');
    } finally {
      setBusyUpload('');
    }
  };

  const getUploadedDocumentPreview = (document) => {
    if (!document) return;

    const payload = {
      documentKey: document.key || document.id || document.label,
      documentType: document.kind,
      path: document.path,
    };
    const cacheKey = getDocumentPreviewCacheKey(
      'professional',
      'blob',
      user?.id,
      document.path,
      document.id,
      document.key || document.label,
      document.fileName,
      document.fileSize
    );
    const urlCacheKey = getDocumentPreviewCacheKey(
      'professional',
      'url',
      user?.id,
      document.path,
      document.id,
      document.key || document.label,
      document.fileName,
      document.fileSize
    );
    const load = () => backendApi.documents.getBlob(payload);
    const loadUrl = () => backendApi.documents.getUrl(payload);

    return { cacheKey, load, loadUrl, urlCacheKey };
  };

  const preloadUploadedDocument = (document) => {
    const preview = getUploadedDocumentPreview(document);
    if (!preview) return;

    warmDocumentPreviewRenderer(document.contentType, document.fileName);
    preloadCachedDocumentPreviewUrl(preview.urlCacheKey, preview.loadUrl);
  };

  const openUploadedDocument = (document) => {
    const preview = getUploadedDocumentPreview(document);
    if (!preview) return;

    setCredentialError('');

    setPreviewDocument({
      blobLoader: () => loadCachedDocumentPreview(preview.cacheKey, preview.load),
      cacheKey: preview.cacheKey,
      contentType: document.contentType,
      fileName: document.fileName || 'Document preview',
      urlPromise: loadCachedDocumentPreviewUrl(preview.urlCacheKey, preview.loadUrl),
    });
  };

  const submitChangeRequest = async (e) => {
    e.preventDefault();
    setIsSubmittingChange(true);
    setCredentialError('');
    setCredentialMessage('');
    const reasonText = changeRequestReason === 'Other' ? changeRequestCustomReason.trim() : changeRequestReason;

    if (!reasonText) {
      setCredentialError('Please select or enter a reason for the change request.');
      setIsSubmittingChange(false);
      return;
    }
    
    try {
      const updated = await backendApi.talent.requestDocumentChange({
        documentKey: changeRequestDocument.documentKey,
        documentName: changeRequestDocument.documentLabel,
        documentType: changeRequestDocument.documentType,
        reason: reasonText,
      });
      onProfileUpdated(updated);
      setCredentialMessage('Change request submitted to admin. You will be notified once it is reviewed.');
      setChangeRequestDocument('');
      setChangeRequestReason('');
      setChangeRequestCustomReason('');
    } catch (err) {
      setCredentialError(err.message || 'Unable to submit change request.');
    } finally {
      setIsSubmittingChange(false);
    }
  };

  const handleRegulatedInputChange = (id, value, { save = false } = {}) => {
    const hasChanged = (credentialForm.regulatedInputs || {})[id] !== value;
    const nextInputs = { ...(credentialForm.regulatedInputs || {}), [id]: value };
    const nextForm = {
      ...credentialForm,
      regulatedInputs: nextInputs,
    };

    if (hasChanged) {
      setCredentialDirty(true);
      setCredentialForm(nextForm);
    }

    if (save && (credentialDirty || hasChanged)) {
      saveCredentialForm(nextForm);
    }
  };

  const uploadOtherDocumentRow = async (row, file) => {
    if (!row.label) return;

    const upload = await uploadCredentialFile({
      documentKey: `other:${row.label}`,
      documentType: 'other_document',
      file,
      label: row.label,
    });

    if (upload) {
      removeOtherDocumentRow(row.id);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
      {previewDocument && (
        <DocumentPreviewModal
          key={previewDocument.cacheKey || previewDocument.fileName || 'document-preview'}
          previewDocument={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            <ShieldCheck size={14} />
            Verification
          </div>
          <h3 className="text-xl font-bold text-slate-950 dark:text-white">Credential Review</h3>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Resume, professional links, certifications, and proof documents aligned with your selected title.</p>
        </div>
        {shouldShowVerify && (
          <button
            type="button"
            data-credential-action="verify"
            onClick={() => saveCredentialForm(credentialForm, { submitForReview: true })}
            disabled={!canVerify}
            title={verifyBlockers[0] || 'Submit credentials for admin verification'}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingAction === 'verify' ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {savingAction === 'verify' ? 'Verifying...' : 'Verify'}
          </button>
        )}
      </div>

      {credentialError && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {credentialError}
        </div>
      )}
      {credentialMessage && (
        <div className="success-message mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {credentialMessage}
        </div>
      )}
      {shouldShowVerify && verifyBlockers.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          Verify unlocks after: {verifyBlockers.slice(0, 3).join(' ')}{verifyBlockers.length > 3 ? ` +${verifyBlockers.length - 3} more.` : ''}
        </div>
      )}

      <div className="mb-6 flex gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-5 py-4 text-sm font-semibold leading-relaxed text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-200">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-300" />
        <div>
          <div className="mb-1 font-black text-cyan-950 dark:text-cyan-100">Approval requirement</div>
          <p>{approvalRequirementText}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardMetric
          detail={getCredentialStatusHint(resume, isLoading ? 'Loading profile' : 'Required for approval')}
          icon={FileText}
          label="Resume"
          value={resume ? getCredentialStatusLabel(resume.status) : 'Missing'}
          variant={resume?.status === 'approved' ? 'emerald' : resume ? 'amber' : 'slate'}
        />
        <DashboardMetric
          detail="Required for approval"
          icon={BadgeCheck}
          label="Certifications"
          value={certificationRequirements.length ? `${uploadedCertificationCount}/${certificationRequirements.length}` : 'None'}
          variant={certificationRequirements.length ? (uploadedCertificationCount === certificationRequirements.length ? 'emerald' : 'amber') : 'slate'}
        />
        <DashboardMetric
          detail="Optional supporting proof"
          icon={Upload}
          label="Other Docs"
          value={otherDocuments.length ? `${otherDocuments.length} uploaded` : 'Optional'}
          variant={otherDocuments.length ? 'cyan' : 'slate'}
        />
        {hasRequiredRegulatedInputs && (
          <DashboardMetric
            detail="Required for approval"
            icon={ShieldCheck}
            label="Regulatory"
            value={`${requiredRegulatedInputs.length - missingRequiredRegulatedInputs.length}/${requiredRegulatedInputs.length}`}
            variant={missingRequiredRegulatedInputs.length || invalidRegulatedInputs.length ? 'amber' : 'emerald'}
          />
        )}
        <DashboardMetric
          detail={rejectedUploadCount
            ? `${rejectedUploadCount} need replacement`
            : missingCertificationCount
              ? `${missingCertificationCount} required item${missingCertificationCount === 1 ? '' : 's'} missing`
              : pendingUploadCount
                ? `${pendingUploadCount} required item${pendingUploadCount === 1 ? '' : 's'} pending review`
                : savedUploadCount
                  ? 'Saved. Click Verify to submit for review'
                  : isFullyApproved
                    ? 'Verified. Request change for document updates'
                    : 'Ready to verify'}
          icon={ShieldCheck}
          label="Admin Review"
          value={`${approvedUploadCount} approved`}
          variant={rejectedUploadCount ? 'amber' : approvedUploadCount ? 'emerald' : 'slate'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section>
          <CredentialUploadRow
            busyUpload={busyUpload}
            canRemoveApprovedChange={resume?.changeRequestStatus === 'approved'}
            detail={getCredentialStatusHint(resume, isLoading ? 'Loading profile' : 'PDF, JPG, or PNG')}
            documentKey="resume"
            documentLabel="Resume"
            documentType="resume"
            isRequired
            onUpload={uploadCredentialFile}
            onRemove={removeRejectedDocument}
            onChangeExpiry={updateUploadExpiry}
            onChangeNoExpiryRequired={updateUploadNoExpiryRequired}
            onView={openUploadedDocument}
            onPreviewWarmup={preloadUploadedDocument}
            onRequestChange={setChangeRequestDocument}
            upload={resume}
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-950 dark:text-white">Professional Links</h4>
              <p className="text-xs font-semibold text-slate-400">LinkedIn, portfolio, and public profiles.</p>
            </div>
            <Link2 size={18} className="text-cyan-600" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {credentialForm.externalLinks.map((link) => (
              <label key={link.id} className="block text-xs font-black text-slate-500 dark:text-slate-400">
                {link.label}
                <div className="mt-2 flex rounded-xl border border-slate-200 bg-slate-50 focus-within:border-cyan-500 dark:border-slate-800 dark:bg-slate-950">
                  <input
                    value={link.url}
                    onChange={(event) => updateLink(link.id, event.target.value)}
                    onBlur={(event) => updateLink(link.id, event.target.value, {
                      save: event.relatedTarget?.dataset?.credentialAction !== 'verify',
                    })}
                    placeholder={link.placeholder}
                    className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-sm font-medium text-slate-900 outline-none dark:text-white"
                  />
                  {normalizeCredentialUrl(link.url) && (
                    <a href={normalizeCredentialUrl(link.url)} target="_blank" rel="noreferrer" className="flex items-center px-3 text-slate-400 transition-colors hover:text-cyan-600" title={`Open ${link.label}`}>
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-7 border-t border-slate-100 pt-6 dark:border-slate-800">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-950 dark:text-white">Professional Documents</h4>
            <p className="mt-1 text-xs font-semibold text-slate-400">Certifications are hard requirements. Other Documents are optional supporting proof.</p>
          </div>
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
            {[
              { id: 'certifications', icon: BadgeCheck, label: 'Certifications' },
              { id: 'other', icon: Plus, label: 'Other Documents' },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = documentTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDocumentTab(tab.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                    isActive
                      ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <TabIcon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {documentTab === 'certifications' ? (
          <section>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-950 dark:text-white">Certifications</h4>
                <p className="text-xs font-semibold text-slate-400">{certificationHelperText}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                <ShieldCheck size={13} />
                Required
              </span>
            </div>
            <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              Upload every item listed here. These are the hard credential requirements admin must approve before your profile can be visible to clients.
            </div>
            <div className="grid gap-3">
              {visibleCertificationRequirements.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Choose a mapped professional title to see the required certification documents.
                </div>
              )}
              {visibleCertificationRequirements.map((requirement) => (
                <CredentialUploadRow
                  key={requirement.key}
                  busyUpload={busyUpload}
                  canRemoveApprovedChange={requirement.upload?.changeRequestStatus === 'approved'}
                  detail={requirement.title}
                  documentKey={requirement.upload?.key || `certification:${requirement.label}`}
                  documentLabel={requirement.label}
                  documentType="certification"
                  isRequired
                  onUpload={uploadCredentialFile}
                  onRemove={removeRejectedDocument}
                  onChangeExpiry={updateUploadExpiry}
                  onChangeNoExpiryRequired={updateUploadNoExpiryRequired}
                  onView={openUploadedDocument}
                  onPreviewWarmup={preloadUploadedDocument}
                  onRequestChange={setChangeRequestDocument}
                  upload={requirement.upload}
                />
              ))}
            </div>
            {activeRegulatedInputs.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-950 dark:text-white">{hasRequiredRegulatedInputs ? 'Required Regulatory Inputs' : 'Regulatory Inputs'}</h4>
                    {hasRequiredRegulatedInputs && (
                      <p className="text-xs font-semibold text-slate-400">Required license identifiers must pass format checks before verification.</p>
                    )}
                  </div>
                  {hasRequiredRegulatedInputs && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                      <ShieldCheck size={13} />
                      Required
                    </span>
                  )}
                </div>
                {hasRequiredRegulatedInputs && (
                  <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                    Complete required regulatory inputs for selected titles. Optional inputs are checked only when filled.
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeRegulatedInputs.map((inputField) => {
                    const inputValue = (credentialForm.regulatedInputs || {})[inputField.id] || '';
                    const hasValue = Boolean(String(inputValue).trim());
                    const isValid = validateRegulatedInput(inputField, inputValue);

                    return (
                    <label key={inputField.id} className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {inputField.label} {inputField.required ? '*' : ''}
                      <input
                        type={inputField.type}
                        required={inputField.required}
                        value={inputValue}
                        onChange={(e) => handleRegulatedInputChange(inputField.id, e.target.value)}
                        onBlur={(e) => handleRegulatedInputChange(inputField.id, e.target.value, {
                          save: e.relatedTarget?.dataset?.credentialAction !== 'verify',
                        })}
                        className={`mt-2 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-medium outline-none dark:bg-slate-950 ${
                          hasValue && isValid
                            ? 'border-emerald-300 focus:border-emerald-500 dark:border-emerald-900/60'
                            : hasValue || inputField.required
                              ? 'border-amber-300 focus:border-amber-500 dark:border-amber-900/60'
                              : 'border-slate-200 focus:border-cyan-500 dark:border-slate-800'
                        }`}
                        placeholder={`e.g. for ${inputField.title}`}
                      />
                      <div className={`mt-1 text-xs font-semibold ${
                        hasValue && isValid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {hasValue && isValid ? 'Format looks right.' : inputField.hint || 'This field is required for verification.'}
                      </div>
                    </label>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-950 dark:text-white">Other Documents</h4>
                <p className="text-xs font-semibold text-slate-400">{otherDocumentHelperText}</p>
              </div>
              <button
                type="button"
                onClick={() => setOtherDocumentRows((current) => [...current, createOtherDocumentRow()])}
                disabled={!canAddOtherDocumentRow}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 transition-colors hover:border-cyan-200 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300"
              >
                <Plus size={14} />
                Add Document
              </button>
            </div>
            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              Optional uploads can strengthen the profile and give admin more proof, but they are not required for approval and do not duplicate certification requirements.
            </div>

            <div className="grid gap-3">
              {otherDocuments.map((document) => (
                <CredentialUploadRow
                  key={document.id || document.key || document.label}
                  busyUpload={busyUpload}
                  canRemoveApprovedChange={document.changeRequestStatus === 'approved'}
                  detail="Uploaded optional supporting document"
                  documentKey={document.key || `other:${document.label}`}
                  documentLabel={document.label || 'Other supporting document'}
                  documentType="other_document"
                  onUpload={uploadCredentialFile}
                  onRemove={removeRejectedDocument}
                  onChangeExpiry={updateUploadExpiry}
                  onChangeNoExpiryRequired={updateUploadNoExpiryRequired}
                  onView={openUploadedDocument}
                  onPreviewWarmup={preloadUploadedDocument}
                  onRequestChange={setChangeRequestDocument}
                  upload={document}
                />
              ))}

              {otherDocumentOptions.length === 0 && otherDocuments.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Choose a mapped professional title to see optional supporting document choices.
                </div>
              )}

              {otherDocumentOptions.length > 0 && otherDocumentRows.map((row) => {
                const rowOptions = getOtherDocumentOptionsForRow(row);
                const selectedOption = otherDocumentOptions.find((option) => option.label === row.label);

                return (
                  <div key={row.id} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                      <label className="block text-xs font-black text-slate-500 dark:text-slate-400">
                        Document type
                        <select
                          value={row.label}
                          onChange={(event) => updateOtherDocumentRow(row.id, event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="">Select supporting document</option>
                          {selectedOption && !rowOptions.some((option) => option.label === selectedOption.label) && (
                            <option value={selectedOption.label}>{selectedOption.label}</option>
                          )}
                          {rowOptions.map((option) => (
                            <option key={option.label} value={option.label}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition-colors ${
                        row.label
                          ? 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                          : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                      }`}>
                        {busyUpload === `other:${row.label}` ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                        Upload
                        <input
                          type="file"
                          disabled={!row.label}
                          accept={DOCUMENT_ACCEPTS.other_document}
                          className="hidden"
                          onChange={async (event) => {
                            await uploadOtherDocumentRow(row, event.target.files?.[0]);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeOtherDocumentRow(row.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-slate-400 transition-colors hover:text-red-600 dark:border-slate-800 dark:bg-slate-900"
                        title="Remove row"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {selectedOption && (
                      <div className="mt-3 text-xs font-semibold text-slate-400">
                        Supports: {selectedOption.titles.join(' / ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <Modal open={Boolean(changeRequestDocument)} title="Request Document Change/Removal" onClose={() => { setChangeRequestDocument(''); setChangeRequestReason(''); setChangeRequestCustomReason(''); }}>
        {changeRequestDocument && (
          <form onSubmit={submitChangeRequest} className="space-y-4">
            <p className="text-sm font-medium text-slate-500">
              Your document <strong className="text-slate-900 dark:text-white">{changeRequestDocument.documentLabel}</strong> is currently approved and locked. To replace or remove it, please provide a reason for the admin to review.
            </p>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Reason for change
              <select
                value={changeRequestReason}
                onChange={(e) => setChangeRequestReason(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="" disabled>Select a reason...</option>
                <option value="Document expired / needs renewal">Document expired / needs renewal</option>
                <option value="Incorrect document uploaded">Incorrect document uploaded</option>
                <option value="Details are outdated">Details are outdated</option>
                <option value="Other">Other</option>
              </select>
            </label>
            {changeRequestReason === 'Other' && (
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Please specify
                <textarea
                  value={changeRequestCustomReason}
                  onChange={(e) => setChangeRequestCustomReason(e.target.value)}
                  required
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none dark:border-slate-800 dark:bg-slate-900"
                />
              </label>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setChangeRequestDocument(''); setChangeRequestReason(''); setChangeRequestCustomReason(''); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={isSubmittingChange || !changeRequestReason || (changeRequestReason === 'Other' && !changeRequestCustomReason.trim())} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-cyan-700 disabled:opacity-70">
                {isSubmittingChange ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function AppTalentOpportunitiesView() {
  const { data: invites, error, isLoading } = useBackendResource(
    backendApi.talent.listOpportunities,
    EMPTY_LIST,
    {
      refreshInterval: 10000,
    }
  );
  const opportunities = asList(invites);
  const [localOpportunities, setLocalOpportunities] = useState(opportunities);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFormError, setCancelFormError] = useState('');

  useEffect(() => {
    setLocalOpportunities(asList(invites));
  }, [invites]);

  useEffect(() => {
    if (!actionMessage) return undefined;

    const timeoutId = window.setTimeout(() => setActionMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  const handleOpportunityStatus = async (invite, status) => {
    setActionError('');
    setActionMessage('');
    setBusyAction(`${status}:${invite.id}`);

    try {
      await backendApi.talent.updateOpportunity({ id: invite.id, status });
      setLocalOpportunities((current) => current.map((item) => (
        item.id === invite.id
          ? { ...item, interviewStatus: status === 'accepted' ? 'scheduled' : 'cancelled', status }
          : item
      )));
      setActionMessage(status === 'accepted' ? 'Invite accepted.' : 'Invite declined.');
    } catch (updateError) {
      setActionError(updateError.message || 'Unable to update this invite.');
    } finally {
      setBusyAction('');
    }
  };

  const handleRemoveDeclined = async (invite) => {
    setActionError('');
    setActionMessage('');
    setBusyAction(`remove:${invite.id}`);

    try {
      await backendApi.talent.removeOpportunity({ id: invite.id });
      setLocalOpportunities((current) => current.filter((item) => item.id !== invite.id));
      setActionMessage('Declined invite removed.');
    } catch (removeError) {
      setActionError(removeError.message || 'Unable to remove this invite.');
    } finally {
      setBusyAction('');
    }
  };

  const openCancelModal = (invite) => {
    setActionError('');
    setActionMessage('');
    setCancelFormError('');
    setCancelTarget(invite);
    setCancelReason('');
  };

  const submitCancelInterview = async (event) => {
    event.preventDefault();

    if (!cancelTarget) return;

    const reason = cancelReason.trim();

    if (!reason) {
      setCancelFormError('Cancellation reason is required.');
      return;
    }

    setActionError('');
    setActionMessage('');
    setCancelFormError('');
    setBusyAction(`cancel:${cancelTarget.id}`);

    try {
      await backendApi.talent.cancelInterview({
        opportunityId: cancelTarget.id,
        reason,
      });
      setLocalOpportunities((current) => current.map((item) => (
        item.id === cancelTarget.id
          ? { ...item, cancellationReason: reason, interviewStatus: 'cancelled', status: 'cancelled' }
          : item
      )));
      setCancelTarget(null);
      setActionMessage('Interview cancelled and the client was notified.');
    } catch (cancelError) {
      setCancelFormError(cancelError.message || 'Unable to cancel this interview.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="portal-fade-in max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Opportunities</h2>
        <p className="text-slate-600 dark:text-slate-400">Review invitations to interview and active client matches.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error.message}
        </div>
      )}
      {actionError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div className="success-message mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {actionMessage}
        </div>
      )}

      {localOpportunities.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={isLoading ? 'Loading opportunities' : 'No opportunities yet'}
          description="Interview invitations and active client matches will appear here once they are available."
        />
      ) : (
      <div className="space-y-6">
        {localOpportunities.map((invite, idx) => {
          const isCancelled = invite.status === 'cancelled' || invite.interviewStatus === 'cancelled';
          const isDeclined = invite.status === 'declined';
          const isAccepted = invite.status === 'accepted';
          const isPending = !isAccepted && !isDeclined && !isCancelled;
          const canCancel = invite.status === 'accepted' && ['requesting', 'requested', 'scheduled'].includes(invite.interviewStatus);
          const statusLabel = isCancelled ? 'Cancelled' : isAccepted ? 'Accepted' : isDeclined ? 'Declined' : '';

          return (
          <FadeIn key={invite.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col md:flex-row gap-6 justify-between">
            <div>
              <div className="inline-flex items-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md mb-4">
                {isCancelled ? 'Cancelled' : invite.status === 'accepted' ? 'Accepted' : invite.status === 'declined' ? 'Declined' : 'Interview Invite'}
              </div>
              <h3 className="font-bold text-xl text-slate-950 dark:text-white mb-1">{invite.role || invite.title || 'Opportunity pending'}</h3>
              <p className="text-sm font-semibold text-slate-500 flex items-center gap-2 mb-6">
                <Building size={16}/> {invite.company || invite.clientName || 'Client pending'}
              </p>
              <div className="flex gap-6 text-sm font-bold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2"><Clock3 size={16} className="text-slate-400"/> {invite.duration || invite.schedule || 'Schedule pending'}</div>
                <div className="flex items-center gap-2"><DollarSign size={16} className="text-slate-400"/> {formatMoneyAmount(invite.rate || invite.hourlyRate)}</div>
              </div>
              {isCancelled && invite.cancellationReason && (
                <p className="mt-5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  Cancelled: {invite.cancellationReason}
                </p>
              )}
            </div>
            
            <div className="md:border-l md:border-slate-100 dark:border-slate-800 md:pl-6 flex flex-col justify-center gap-3 md:w-48">
              <div className="text-xs text-slate-400 font-bold mb-2 text-center md:text-left">{invite.date || invite.receivedAt || 'Date pending'}</div>
              {isPending ? (
                <>
                  <button
                    onClick={() => handleOpportunityStatus(invite, 'accepted')}
                    disabled={busyAction === `accepted:${invite.id}`}
                    className="w-full bg-slate-950 text-white hover:bg-cyan-600 py-3 rounded-xl text-sm font-bold transition-colors shadow-md disabled:cursor-default disabled:opacity-70"
                  >
                    {busyAction === `accepted:${invite.id}` ? 'Accepting...' : 'Accept Invite'}
                  </button>
                  <button
                    onClick={() => handleOpportunityStatus(invite, 'declined')}
                    disabled={busyAction === `declined:${invite.id}`}
                    className="w-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-default"
                  >
                    {busyAction === `declined:${invite.id}` ? 'Declining...' : 'Decline'}
                  </button>
                </>
              ) : (
                <div className={`w-full rounded-xl border px-4 py-3 text-center text-sm font-black ${
                  isAccepted
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                }`}>
                  {statusLabel}
                </div>
              )}
              {(isDeclined || isCancelled) && (
                <button
                  onClick={() => handleRemoveDeclined(invite)}
                  disabled={busyAction === `remove:${invite.id}`}
                  className="w-full bg-white dark:bg-slate-900 text-red-600 border border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-default flex items-center justify-center gap-2"
                >
                  <Trash2 size={15} />
                  {busyAction === `remove:${invite.id}` ? 'Removing...' : 'Remove'}
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => openCancelModal(invite)}
                  disabled={busyAction === `cancel:${invite.id}`}
                  className="w-full bg-white dark:bg-slate-900 text-red-600 border border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-default"
                >
                  {busyAction === `cancel:${invite.id}` ? 'Cancelling...' : 'Cancel Interview'}
                </button>
              )}
            </div>
          </FadeIn>
          );
        })}
      </div>
      )}

      {cancelTarget && (
        <Modal open={Boolean(cancelTarget)} title="Cancel Interview" onClose={() => { setCancelFormError(''); setCancelTarget(null); }}>
          <form onSubmit={submitCancelInterview} className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              This will notify {cancelTarget.company || cancelTarget.clientName || 'the client'} and keep the reason visible on the cancelled request.
            </div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Cancellation reason
              <textarea
                value={cancelReason}
                onChange={(event) => { setCancelReason(event.target.value); setCancelFormError(''); }}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </label>
            {cancelFormError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                {cancelFormError}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setCancelFormError(''); setCancelTarget(null); }} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white">
                Keep Interview
              </button>
              <button type="submit" disabled={busyAction === `cancel:${cancelTarget.id}`} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-70">
                {busyAction === `cancel:${cancelTarget.id}` ? 'Cancelling...' : 'Cancel Interview'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AppTalentEarningsView() {
  const { data: earnings, isLoading } = useBackendResource(backendApi.talent.getEarnings, EMPTY_EARNINGS);
  const timesheets = asList(earnings.timesheets);
  const hasAvailableFunds = Number(earnings.availableToWithdraw || 0) > 0;

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Timesheets & Earnings</h2>
          <p className="text-slate-600 dark:text-slate-400">Track your logged hours and manage your payouts.</p>
        </div>
        <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:block">
          {hasAvailableFunds ? 'Payout request available soon' : 'Payouts appear after approval'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Available to Withdraw</div>
            <div className="text-4xl font-black text-slate-950 dark:text-white tracking-tight">{formatMoney(earnings.availableToWithdraw)}</div>
          </div>
        </FadeIn>
        <FadeIn delay={150}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pending (In Review)</div>
            <div className="text-4xl font-black text-slate-500 dark:text-slate-400 tracking-tight">{formatMoney(earnings.pendingReview)}</div>
          </div>
        </FadeIn>
        <FadeIn delay={200}>
          <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 blur-[30px] rounded-full"></div>
            <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 relative z-10">Total Earned (YTD)</div>
            <div className="text-4xl font-black text-white tracking-tight relative z-10">{formatMoney(earnings.totalEarnedYtd)}</div>
          </div>
        </FadeIn>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-950 dark:text-white text-lg">Recent Timesheets</h3>
        </div>
        {timesheets.length === 0 && (
          <div className="p-6 text-sm font-medium text-slate-500">{isLoading ? 'Loading timesheets...' : 'No timesheets loaded yet.'}</div>
        )}
        {timesheets.map((sheet, i) => (
          <div key={sheet.id || i} className={`flex items-center justify-between p-6 ${i !== timesheets.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">{sheet.period || 'Period pending'}</div>
              <div className="text-sm font-medium text-slate-500">{sheet.hours || '0:00'} logged</div>
            </div>
            <div className="text-right">
              <div className="font-black text-lg text-slate-950 dark:text-white">{formatMoney(sheet.amount)}</div>
              <div className={`text-xs font-bold uppercase tracking-wider mt-1 ${sheet.status === 'Paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                {sheet.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
