import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  Search, MapPin, Building, Star, Filter, 
  CheckCircle, ArrowRight, User, Briefcase, 
  Menu, X, Calculator, PieChart, ShieldCheck, 
  Mail, Lock, LogOut, Sparkles, Layers3, 
  BarChart3, BadgeCheck, Clock3, Handshake, 
  Globe2, TrendingDown, ChevronDown, ChevronUp,
  Bookmark, MessageSquare, SlidersHorizontal,
  ChevronRight, FileText, Calendar, Video, Download, CreditCard, Receipt,
  DollarSign, CheckSquare, Settings, Bot, Send, Loader2, Sun, Moon, Trash2,
  Upload, Link2, ExternalLink
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { NotificationBell } from '../components/NotificationBell';
import { EmptyState } from '../components/EmptyState';
import { useBackendResource } from '../hooks/useBackendResource';
import { useNotifications } from '../hooks/useNotifications';
import { backendApi } from '../services/api';
import { countUnreadNotificationsByTab, getUnreadNotificationsForTab } from '../utils/notificationRouting';

const EMPTY_LIST = Object.freeze([]);
const EMPTY_PROFILE = Object.freeze({});
const EMPTY_EARNINGS = Object.freeze({
  availableToWithdraw: 0,
  pendingReview: 0,
  timesheets: EMPTY_LIST,
  totalEarnedYtd: 0,
});
const SUCCESS_MESSAGE_TIMEOUT_MS = 2500;
const PROFESSIONAL_TABS = ['profile', 'credentials', 'opportunities', 'earnings'];
const PROFESSIONAL_NOTIFICATION_TAB_FALLBACKS = {
  document_status_updated: 'credentials',
  interview_cancelled: 'opportunities',
  interview_requested: 'opportunities',
  profile_status_updated: 'profile',
  resume_status_updated: 'credentials',
};
const MAX_CREDENTIAL_UPLOAD_BYTES = 3 * 1024 * 1024;
const EMPTY_CREDENTIAL_FORM = Object.freeze({
  certifications: EMPTY_LIST,
  externalLinks: EMPTY_LIST,
  resume: null,
  supportingDocuments: EMPTY_LIST,
});

const asList = (value) => (Array.isArray(value) ? value : []);
const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString()}` : value || 'Pending');
const formatMoneyAmount = (value) => formatMoney(value).replace(/^\$/, '');
const listToText = (value) => asList(value).join(', ');
const textToList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const placeholderTitles = new Set(['Complete your profile', 'Finance Professional']);
const cleanProfileTitle = (value) => {
  const title = String(value || '').trim();

  return title && !placeholderTitles.has(title) ? title : '';
};
import {
  AVAILABILITY_OPTIONS,
  CERTIFICATION_OPTIONS,
  EXTERNAL_LINK_OPTIONS,
  PROFESSIONAL_TITLE_DOCUMENT_OPTIONS,
  PROFESSIONAL_TITLE_OPTIONS,
  SKILLS_OPTIONS,
  SOFTWARE_OPTIONS,
} from '../data/constants';

const getProfileReadiness = (profile, titles) => {
  const profileSkills = asList(profile.skills);
  const profileTools = asList(profile.tools);
  const checks = [
    { label: 'Identity', done: Boolean(profile.name || profile.fullName) },
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
const getExternalLinks = (profile) => asList(profile?.externalLinks || getWorkPreferences(profile).externalLinks);
const getSupportingDocuments = (profile) => asList(profile?.supportingDocuments || getWorkPreferences(profile).supportingDocuments);
const formatFileSize = (value) => {
  const size = Number(value || 0);

  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
const getUploadDate = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};
const normalizeLinkFields = (links = []) => {
  const linkMap = new Map(asList(links).map((link) => [link.id, link]));

  return EXTERNAL_LINK_OPTIONS.map((option) => ({
    ...option,
    url: linkMap.get(option.id)?.url || '',
  }));
};
const normalizeCredentialUrl = (value) => {
  const url = String(value || '').trim();

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
  if (name.endsWith('.doc')) return 'application/msword';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';

  return 'application/octet-stream';
};
const buildCredentialRequirements = (titles, uploadedDocuments = []) => {
  const uploadedMap = new Map(asList(uploadedDocuments).map((document) => [document.key || document.label, document]));
  const requirements = cleanProfileTitles(titles).flatMap((title) => (
    asList(PROFESSIONAL_TITLE_DOCUMENT_OPTIONS[title]).map((label) => ({
      key: `${title}:${label}`,
      label,
      title,
    }))
  ));
  const defaultRequirements = requirements.length
    ? requirements
    : [
      { key: 'general:professional-resume', label: 'Professional resume', title: 'General profile' },
      { key: 'general:identity-or-license', label: 'Identity or license verification', title: 'General profile' },
    ];

  return defaultRequirements.map((requirement) => ({
    ...requirement,
    upload: uploadedMap.get(requirement.key) || uploadedMap.get(requirement.label) || null,
  }));
};
const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Unable to read this file.'));
  reader.readAsDataURL(file);
});
const buildProfileSavePayload = (profile, overrides = {}) => {
  const workPreferences = {
    ...getWorkPreferences(profile),
    ...(overrides.workPreferences || {}),
  };

  return {
    availability: profile.availability || profile.available || 'Immediate Start',
    bio: profile.bio || '',
    certifications: asList(overrides.certifications ?? profile.certifications),
    fullName: profile.name || profile.fullName || '',
    hourlyRate: profile.rate || profile.hourlyRate || null,
    location: profile.location || '',
    skills: asList(profile.skills),
    titles: cleanProfileTitles(profile.titles, cleanProfileTitles(profile.title || profile.role)),
    tools: asList(profile.tools),
    workPreferences,
    yearsExperience: profile.yearsExperience || null,
  };
};



function PortalModal({ children, onClose, title }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/65 px-4 py-6 backdrop-blur-sm sm:py-10">
      <div className="flex min-h-full items-start justify-center">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">{title}</h3>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

function MultiSelectPicker({ value, onChange, optionsList, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedItems = cleanProfileTitles(value);
  const selectedSet = new Set(selectedItems);
  const options = [...new Set([...selectedItems, ...optionsList])];
  const toggleItem = (item) => {
    const nextItems = selectedSet.has(item)
      ? selectedItems.filter((i) => i !== item)
      : [...selectedItems, item];

    onChange(nextItems);
  };

  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 outline-none transition-colors hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
      >
        <span>{selectedItems.length ? `${selectedItems.length} selected` : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {selectedItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleItem(item)}
              className="rounded-lg border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300"
            >
              {item} <span className="ml-1 text-cyan-500">x</span>
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="absolute left-0 right-0 top-14 z-30 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {options.map((item) => {
            const isSelected = selectedSet.has(item);

            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleItem(item)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                  isSelected
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <span>{item}</span>
                <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${isSelected ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                  {isSelected ? <CheckCircle size={11} /> : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. PROFESSIONAL PORTAL (TALENT EXPERIENCE)
// ==========================================
export function ProfessionalPortal({ user, onLogout, isDarkMode, toggleDarkMode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'profile';
  const appView = PROFESSIONAL_TABS.includes(requestedTab) ? requestedTab : 'profile';
  const setAppView = (tab) => setSearchParams({ tab });
  const notificationState = useNotifications(user?.id);
  const { markRead, notifications } = notificationState;
  const tabUnreadCounts = countUnreadNotificationsByTab(
    notifications,
    PROFESSIONAL_TABS,
    PROFESSIONAL_NOTIFICATION_TAB_FALLBACKS
  );

  useEffect(() => {
    const activeTabNotifications = getUnreadNotificationsForTab(
      notifications,
      appView,
      PROFESSIONAL_TABS,
      PROFESSIONAL_NOTIFICATION_TAB_FALLBACKS
    );

    activeTabNotifications.forEach((notification) => {
      markRead(notification);
    });
  }, [appView, markRead, notifications]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* App Header */}
      <header className="bg-slate-950 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* App Logo */}
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">
                PB
              </div>
              <span className="font-bold tracking-tight">Talent</span>
            </div>

            {/* App User Nav */}
            <div className="flex items-center gap-6">
              <button onClick={toggleDarkMode} className="text-slate-400 hover:text-white transition-colors" title="Toggle Dark Mode">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <NotificationBell notificationState={notificationState} unreadClassName="bg-emerald-500" userId={user.id} />
              
              <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-white leading-tight">{user.name || 'Profile pending'}</div>
                  <div className="text-xs text-slate-400 font-medium">{cleanProfileTitle(user.title) || 'Complete your profile'}</div>
                </div>
                <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-primary-400 rounded-full flex items-center justify-center font-bold text-white shadow-md cursor-pointer border-2 border-slate-800">
                  {(user.name || '?').charAt(0)}
                </div>
                <button onClick={onLogout} className="ml-2 text-slate-500 hover:text-red-400 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* App Sub-Navigation */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 pt-4">
              {[
                { id: 'profile', label: 'My Profile' },
                { id: 'credentials', label: 'Credentials & Links' },
                { id: 'opportunities', label: 'Opportunities' },
                { id: 'earnings', label: 'Timesheets & Earnings' },
              ].map(tab => {
                const unreadCount = tabUnreadCounts[tab.id] || 0;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setAppView(tab.id)}
                    className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${appView === tab.id ? 'border-cyan-600 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:border-slate-300'}`}
                  >
                    {tab.label}
                    {unreadCount > 0 && (
                      <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-black leading-none text-white shadow-sm shadow-emerald-500/20">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* App Workspace */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {appView === 'profile' && <AppTalentProfileView user={user} />}
        {appView === 'credentials' && <AppTalentCredentialsView user={user} />}
        {appView === 'opportunities' && <AppTalentOpportunitiesView user={user} />}
        {appView === 'earnings' && <AppTalentEarningsView />}
      </div>
    </div>
  );
}

function AppTalentProfileView({ user }) {
  const { data: profile } = useBackendResource(
    backendApi.talent.getMyProfile,
    EMPTY_PROFILE,
    {
      realtime: [
        user?.id ? { filter: `user_id=eq.${user.id}`, table: 'professional_profiles' } : null,
      ],
      refreshInterval: 15000,
    }
  );
  const [savedProfile, setSavedProfile] = useState(EMPTY_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileForm, setProfileForm] = useState({});

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
  const readiness = getProfileReadiness(displayProfile, profileTitles);
  const profileStatus = displayProfile.reviewStatus || displayProfile.status || 'Complete onboarding to publish your profile.';
  const isProfileApproved = String(profileStatus).toLowerCase() === 'approved';

  const buildProfileForm = (overrides = {}) => ({
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

    try {
      const updated = await backendApi.talent.updateMyProfile({
        ...profileForm,
        certifications: textToList(profileForm.certifications),
        hourlyRate: profileForm.hourlyRate === '' ? null : Number(profileForm.hourlyRate),
        skills: textToList(profileForm.skills),
        titles: cleanProfileTitles(profileForm.titles),
        tools: textToList(profileForm.tools),
        yearsExperience: profileForm.yearsExperience === '' ? null : Number(profileForm.yearsExperience),
      });
      setSavedProfile(updated);
      setIsEditing(false);
      setProfileMessage(updated.status === 'approved'
        ? 'Profile saved.'
        : 'Profile saved and marked pending review.');
    } catch (saveError) {
      setProfileError(saveError.message || 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start portal-fade-in max-w-6xl">
      {/* Left Column: Quick Profile Card */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-950 h-24"></div>
          <div className="p-6 relative">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-primary-50 rounded-2xl border-4 border-white flex items-center justify-center font-bold text-cyan-700 text-3xl absolute -top-10 shadow-sm">
              {(displayProfile.name || '?').charAt(0)}
            </div>
            
            <div className="mt-12 mb-6">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white leading-tight">{displayProfile.name || 'Profile pending'}</h2>
              <p className="text-sm font-medium text-slate-500 mb-4">{profileTitleText || 'Add your professional title'}</p>
              
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">
                <MapPin size={16} className="text-slate-400" /> {displayProfile.location || 'Add location'}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-medium mb-6">
                <Star size={16} className="text-amber-500 fill-current" /> {displayProfile.rating ? `${displayProfile.rating} Average Rating` : 'No ratings yet'}
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Availability Status</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
                <select
                  className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold border-none outline-none appearance-none pr-8 cursor-pointer relative"
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
              </div>

              <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Profile readiness</span>
                  <span className="text-sm font-black text-slate-950 dark:text-white">{readiness.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${readiness.percent}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {readiness.checks.map((item) => (
                    <span
                      key={item.label}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                        item.done
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                          : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                      }`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              {isEditing && editingSection === 'profile' ? (
                <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Full name
                    <input value={profileForm.fullName || ''} onChange={(event) => handleProfileChange('fullName', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Professional titles
                    <MultiSelectPicker value={profileForm.titles || []} onChange={(titles) => handleProfileChange('titles', titles)} optionsList={PROFESSIONAL_TITLE_OPTIONS} placeholder="Select professional titles" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Location
                    <input value={profileForm.location || ''} onChange={(event) => handleProfileChange('location', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Availability
                    <select value={profileForm.availability || 'Immediate Start'} onChange={(event) => handleProfileChange('availability', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500">
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="submit" disabled={isSaving} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-70">
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setIsEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => openEditor('profile')} className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-900 dark:text-slate-50 py-2.5 rounded-xl text-sm font-bold transition-colors">
                   <Settings size={16} /> Profile Settings
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Detailed Profile Form/View */}
      <div className="flex-1 w-full space-y-6">
        {profileError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {profileError}
          </div>
        )}
        {profileMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
            {profileMessage}
          </div>
        )}

        <FadeIn>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">Professional Bio</h3>
              <button onClick={() => openEditor('bio')} className="text-cyan-600 font-bold text-sm hover:underline">Edit</button>
            </div>
            {isEditing && editingSection === 'bio' ? (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  Bio
                  <textarea value={profileForm.bio || ''} onChange={(event) => handleProfileChange('bio', event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={isSaving} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-70">
                    {isSaving ? 'Saving...' : 'Save Bio'}
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white">
                    Cancel
                  </button>
                </div>
              </form>
            ) : displayProfile.bio ? (
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{displayProfile.bio}</p>
            ) : (
              <EmptyState
                icon={FileText}
                title="No bio yet"
                description="Your professional summary will appear here once your profile is completed."
              />
            )}
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">Rates & Skills</h3>
              <button onClick={() => openEditor('rates')} className="text-cyan-600 font-bold text-sm hover:underline">Edit</button>
            </div>

            {isEditing && editingSection === 'rates' ? (
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Hourly rate
                    <input type="number" min="0" step="1" value={profileForm.hourlyRate || ''} onChange={(event) => handleProfileChange('hourlyRate', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Years experience
                    <input type="number" min="0" step="1" value={profileForm.yearsExperience || ''} onChange={(event) => handleProfileChange('yearsExperience', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Tools / Software
                    <MultiSelectPicker value={profileForm.tools || []} onChange={(val) => handleProfileChange('tools', val)} optionsList={SOFTWARE_OPTIONS} placeholder="Select software" />
                  </label>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Skills
                    <MultiSelectPicker value={profileForm.skills || []} onChange={(val) => handleProfileChange('skills', val)} optionsList={SKILLS_OPTIONS} placeholder="Select skills" />
                  </label>
                </div>

                <div className="flex gap-2">
                  <button type="submit" disabled={isSaving} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-70">
                    {isSaving ? 'Saving...' : 'Save Rates'}
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Current Hourly Rate</div>
                <div className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">{formatMoney(displayProfile.rate || displayProfile.hourlyRate)} <span className="text-sm font-bold text-slate-400">/hr</span></div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Total Experience</div>
                <div className="text-lg font-bold text-slate-950 dark:text-white">{displayProfile.experience || displayProfile.exp || 'Pending'}</div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Skills & Software</div>
              <div className="flex flex-wrap gap-2">
                {skills.length === 0 && (
                  <span className="text-sm font-medium text-slate-500">No skills or tools added yet.</span>
                )}
                {skills.map(tool => (
                  <span key={tool} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5 rounded-lg font-bold">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            </>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-800 border border-emerald-100 dark:border-slate-700 rounded-3xl p-8 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-emerald-950 dark:text-emerald-300 text-lg mb-1 flex items-center gap-2"><CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400"/> Profile Status</h3>
              <p className="text-emerald-800 dark:text-emerald-400 text-sm font-medium">{profileStatus}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-emerald-300">
              {isProfileApproved ? 'Visible to clients' : 'Pending review'}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function AppTalentCredentialsView({ user }) {
  const { data: profile, isLoading } = useBackendResource(
    backendApi.talent.getMyProfile,
    EMPTY_PROFILE,
    {
      realtime: [
        user?.id ? { filter: `user_id=eq.${user.id}`, table: 'professional_profiles' } : null,
      ],
      refreshInterval: 15000,
    }
  );
  const [savedProfile, setSavedProfile] = useState(EMPTY_PROFILE);
  const [credentialForm, setCredentialForm] = useState(EMPTY_CREDENTIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [busyUpload, setBusyUpload] = useState('');
  const [credentialError, setCredentialError] = useState('');
  const [credentialMessage, setCredentialMessage] = useState('');

  useEffect(() => {
    const nextProfile = profile || EMPTY_PROFILE;

    setSavedProfile(nextProfile);
    setCredentialForm({
      certifications: asList(nextProfile.certifications),
      externalLinks: normalizeLinkFields(getExternalLinks(nextProfile)),
      resume: getProfileResume(nextProfile),
      supportingDocuments: getSupportingDocuments(nextProfile),
    });
  }, [profile]);

  useEffect(() => {
    if (!credentialMessage) return undefined;

    const timeoutId = window.setTimeout(() => setCredentialMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [credentialMessage]);

  const displayProfile = {
    ...user,
    ...savedProfile,
  };
  const profileTitles = cleanProfileTitles(displayProfile.titles, cleanProfileTitles(displayProfile.title || displayProfile.role));
  const requirements = buildCredentialRequirements(profileTitles, credentialForm.supportingDocuments);
  const resume = credentialForm.resume;

  const updateCredentialForm = (field, value) => {
    setCredentialForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateLink = (linkId, url) => {
    updateCredentialForm('externalLinks', credentialForm.externalLinks.map((link) => (
      link.id === linkId ? { ...link, url } : link
    )));
  };

  const saveCredentialForm = async (nextForm = credentialForm) => {
    setIsSaving(true);
    setCredentialError('');
    setCredentialMessage('');

    const externalLinks = asList(nextForm.externalLinks)
      .map((link) => ({
        id: link.id,
        label: link.label,
        url: normalizeCredentialUrl(link.url),
      }))
      .filter((link) => link.url);
    const workPreferences = {
      ...getWorkPreferences(displayProfile),
      externalLinks,
      resume: nextForm.resume || null,
      supportingDocuments: asList(nextForm.supportingDocuments),
    };

    try {
      const updated = await backendApi.talent.updateMyProfile(buildProfileSavePayload(displayProfile, {
        certifications: nextForm.certifications,
        workPreferences,
      }));
      setSavedProfile(updated);
      setCredentialForm({
        certifications: asList(updated.certifications),
        externalLinks: normalizeLinkFields(getExternalLinks(updated)),
        resume: getProfileResume(updated),
        supportingDocuments: getSupportingDocuments(updated),
      });
      setCredentialMessage(updated.status === 'approved'
        ? 'Credentials saved.'
        : 'Credentials saved and marked pending review.');
    } catch (saveError) {
      setCredentialError(saveError.message || 'Unable to save credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadCredentialFile = async ({ documentKey, documentType, file, label }) => {
    if (!file) return;

    if (file.size > MAX_CREDENTIAL_UPLOAD_BYTES) {
      setCredentialError('Upload must be 3 MB or smaller.');
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
      const nextForm = documentType === 'resume'
        ? { ...credentialForm, resume: upload }
        : {
          ...credentialForm,
          supportingDocuments: [
            ...credentialForm.supportingDocuments.filter((document) => document.key !== documentKey),
            upload,
          ],
        };

      setCredentialForm(nextForm);
      await saveCredentialForm(nextForm);
    } catch (uploadError) {
      setCredentialError(uploadError.message || 'Unable to upload this file.');
    } finally {
      setBusyUpload('');
    }
  };

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mb-2 text-2xl font-bold text-slate-950 dark:text-white">Credentials & Links</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage your resume, professional links, certifications, and title-specific documents.</p>
        </div>
        <button
          onClick={() => saveCredentialForm()}
          disabled={isSaving || Boolean(busyUpload)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-cyan-600 disabled:cursor-default disabled:opacity-70"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          {isSaving ? 'Saving...' : 'Save Credentials'}
        </button>
      </div>

      {credentialError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {credentialError}
        </div>
      )}
      {credentialMessage && (
        <div className="success-message mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {credentialMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <FadeIn>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Resume</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{resume ? 'Pending admin review' : isLoading ? 'Loading profile' : 'Required for profile review'}</p>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${
                resume
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
              }`}>
                {resume?.status ? String(resume.status).replace(/_/g, ' ') : 'Missing'}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm dark:bg-slate-900">
                  <FileText size={22} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-950 dark:text-white">{resume?.fileName || 'Resume not uploaded'}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">
                    {[formatFileSize(resume?.fileSize), getUploadDate(resume?.uploadedAt)].filter(Boolean).join(' · ') || 'PDF or Word document'}
                  </div>
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {busyUpload === 'resume' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {resume ? 'Replace Resume' : 'Upload Resume'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(event) => {
                    uploadCredentialFile({
                      documentKey: 'resume',
                      documentType: 'resume',
                      file: event.target.files?.[0],
                      label: 'Professional resume',
                    });
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Professional Links</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">LinkedIn, portfolio, and public professional profiles.</p>
              </div>
              <Link2 size={20} className="text-cyan-600" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {credentialForm.externalLinks.map((link) => (
                <label key={link.id} className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                  {link.label}
                  <div className="mt-2 flex rounded-xl border border-slate-200 bg-slate-50 focus-within:border-cyan-500 dark:border-slate-800 dark:bg-slate-950">
                    <input
                      value={link.url}
                      onChange={(event) => updateLink(link.id, event.target.value)}
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
          </div>
        </FadeIn>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <FadeIn delay={150}>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Certifications</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Selected credentials appear separately from rates and skills.</p>
              </div>
              <BadgeCheck size={21} className="text-cyan-600" />
            </div>
            <MultiSelectPicker
              value={credentialForm.certifications}
              onChange={(certifications) => updateCredentialForm('certifications', certifications)}
              optionsList={CERTIFICATION_OPTIONS}
              placeholder="Select certifications"
            />
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Title Documents</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{profileTitles.length ? formatProfileTitles(profileTitles) : 'General profile review'}</p>
              </div>
              <ShieldCheck size={21} className="text-cyan-600" />
            </div>
            <div className="grid gap-3">
              {requirements.map((requirement) => {
                const upload = requirement.upload;

                return (
                  <div key={requirement.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-950 dark:text-white">{requirement.label}</div>
                        <div className="mt-1 text-xs font-bold text-slate-400">{upload ? `${upload.fileName} ${formatFileSize(upload.fileSize) ? `· ${formatFileSize(upload.fileSize)}` : ''}` : requirement.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {upload && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black capitalize text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                            {String(upload.status || 'pending_review').replace(/_/g, ' ')}
                          </span>
                        )}
                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                          {busyUpload === requirement.key ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {upload ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                            className="hidden"
                            onChange={(event) => {
                              uploadCredentialFile({
                                documentKey: requirement.key,
                                documentType: 'supporting_document',
                                file: event.target.files?.[0],
                                label: requirement.label,
                              });
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function AppTalentOpportunitiesView({ user }) {
  const { data: invites, error, isLoading } = useBackendResource(
    backendApi.talent.listOpportunities,
    EMPTY_LIST,
    {
      realtime: [
        user?.id ? { filter: `professional_id=eq.${user.id}`, table: 'opportunities' } : null,
        user?.id ? { filter: `professional_id=eq.${user.id}`, table: 'interviews' } : null,
      ],
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
        <PortalModal title="Cancel Interview" onClose={() => { setCancelFormError(''); setCancelTarget(null); }}>
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
        </PortalModal>
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
