import React, { useEffect, useState } from 'react';
import { 
  Search, MapPin, Building, Star, Filter, 
  CheckCircle, ArrowRight, User, Briefcase, 
  Menu, X, Calculator, PieChart, ShieldCheck, 
  Mail, Lock, LogOut, Sparkles, Layers3, 
  BarChart3, BadgeCheck, Clock3, Handshake, 
  Globe2, TrendingDown, ChevronDown, ChevronUp,
  Bookmark, MessageSquare, SlidersHorizontal,
  ChevronRight, FileText, Calendar, Video, Download, CreditCard, Receipt,
  DollarSign, CheckSquare, Settings, Bot, Send, Loader2, Sun, Moon, Trash2
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { NotificationBell } from '../components/NotificationBell';
import { useBackendResource } from '../hooks/useBackendResource';
import { backendApi } from '../services/api';

const EMPTY_LIST = Object.freeze([]);
const EMPTY_PROFILE = Object.freeze({});
const EMPTY_EARNINGS = Object.freeze({
  availableToWithdraw: 0,
  pendingReview: 0,
  timesheets: EMPTY_LIST,
  totalEarnedYtd: 0,
});

const asList = (value) => (Array.isArray(value) ? value : []);
const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString()}` : value || 'Pending');
const listToText = (value) => asList(value).join(', ');
const textToList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const availabilityToValue = (value) => {
  const label = String(value || '').toLowerCase();
  if (label.includes('2') || label.includes('soon')) return 'available_soon';
  if (label.includes('not')) return 'not_available';
  return 'available_now';
};

function EmptyState({ icon, title, description }) {
  const emptyIcon = icon || FileText;

  return (
    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-5 text-slate-500">
        {React.createElement(emptyIcon, { size: 24 })}
      </div>
      <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-2">{title}</h3>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{description}</p>
    </div>
  );
}

function PortalModal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
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
  );
}

// ==========================================
// 3. PROFESSIONAL PORTAL (TALENT EXPERIENCE)
// ==========================================
export function ProfessionalPortal({ user, onLogout, isDarkMode, toggleDarkMode }) {
  const [appView, setAppView] = useState('profile');

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
              <NotificationBell unreadClassName="bg-emerald-500" />
              
              <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-white leading-tight">{user.name || 'Profile pending'}</div>
                  <div className="text-xs text-slate-400 font-medium">{user.title || 'Complete your profile'}</div>
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
                { id: 'opportunities', label: 'Opportunities' },
                { id: 'earnings', label: 'Timesheets & Earnings' },
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setAppView(tab.id)}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${appView === tab.id ? 'border-cyan-600 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:border-slate-300'}`}
                >
                  {tab.label} {tab.count && <span className="ml-1.5 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">{tab.count}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* App Workspace */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {appView === 'profile' && <AppTalentProfileView user={user} />}
        {appView === 'opportunities' && <AppTalentOpportunitiesView />}
        {appView === 'earnings' && <AppTalentEarningsView />}
      </div>
    </div>
  );
}

function AppTalentProfileView({ user }) {
  const { data: profile } = useBackendResource(
    backendApi.talent.getMyProfile,
    EMPTY_PROFILE,
    { refreshInterval: 15000 }
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
  const skills = asList(displayProfile.tools || displayProfile.skills);

  const buildProfileForm = (overrides = {}) => ({
    availability: availabilityToValue(displayProfile.availability || displayProfile.available),
    bio: displayProfile.bio || '',
    certifications: listToText(displayProfile.certifications),
    fullName: displayProfile.name || displayProfile.fullName || '',
    hourlyRate: displayProfile.rate || displayProfile.hourlyRate || '',
    location: displayProfile.location || '',
    skills: listToText(displayProfile.skills),
    title: displayProfile.title || displayProfile.role || '',
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
              <p className="text-sm font-medium text-slate-500 mb-4">{displayProfile.title || displayProfile.role || 'Add your professional title'}</p>
              
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
                  value={availabilityToValue(displayProfile.availability || displayProfile.available)}
                  onChange={(event) => {
                    openEditor('profile', { availability: event.target.value });
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                >
                  <option value="available_now">Available Now</option>
                  <option value="available_soon">Available in 2 Weeks</option>
                  <option value="not_available">Not Available</option>
                </select>
              </div>

              {isEditing && editingSection === 'profile' ? (
                <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Full name
                    <input value={profileForm.fullName || ''} onChange={(event) => handleProfileChange('fullName', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Professional title
                    <input value={profileForm.title || ''} onChange={(event) => handleProfileChange('title', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Location
                    <input value={profileForm.location || ''} onChange={(event) => handleProfileChange('location', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Availability
                    <select value={profileForm.availability || 'available_now'} onChange={(event) => handleProfileChange('availability', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500">
                      <option value="available_now">Available Now</option>
                      <option value="available_soon">Available in 2 Weeks</option>
                      <option value="not_available">Not Available</option>
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

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Tools
                    <input value={profileForm.tools || ''} onChange={(event) => handleProfileChange('tools', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Skills
                    <input value={profileForm.skills || ''} onChange={(event) => handleProfileChange('skills', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
                  </label>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Certifications
                    <input value={profileForm.certifications || ''} onChange={(event) => handleProfileChange('certifications', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-medium outline-none focus:border-cyan-500" />
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
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Software Stack</div>
              <div className="flex flex-wrap gap-2">
                {skills.length === 0 && (
                  <span className="text-sm font-medium text-slate-500">No tools added yet.</span>
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
              <p className="text-emerald-800 dark:text-emerald-400 text-sm font-medium">{displayProfile.reviewStatus || displayProfile.status || 'Complete onboarding to publish your profile.'}</p>
            </div>
            <button className="bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm border border-emerald-200 dark:border-slate-600 hover:bg-emerald-100 dark:hover:bg-slate-600 transition-colors">
              View Public Profile
            </button>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function AppTalentOpportunitiesView() {
  const { data: invites, error, isLoading } = useBackendResource(
    backendApi.talent.listOpportunities,
    EMPTY_LIST,
    { refreshInterval: 10000 }
  );
  const opportunities = asList(invites);
  const [localOpportunities, setLocalOpportunities] = useState(opportunities);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    setLocalOpportunities(asList(invites));
  }, [invites]);

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
    setCancelTarget(invite);
    setCancelReason('');
  };

  const submitCancelInterview = async (event) => {
    event.preventDefault();

    if (!cancelTarget) return;

    const reason = cancelReason.trim();

    if (!reason) {
      setActionError('Cancellation reason is required.');
      return;
    }

    setActionError('');
    setActionMessage('');
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
      setActionError(cancelError.message || 'Unable to cancel this interview.');
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
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
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
          const isAnswered = ['accepted', 'declined', 'cancelled'].includes(invite.status) || isCancelled;
          const canCancel = invite.status === 'accepted' && ['requesting', 'requested', 'scheduled'].includes(invite.interviewStatus);

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
                <div className="flex items-center gap-2"><DollarSign size={16} className="text-slate-400"/> {formatMoney(invite.rate || invite.hourlyRate)}</div>
              </div>
              {isCancelled && invite.cancellationReason && (
                <p className="mt-5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  Cancelled: {invite.cancellationReason}
                </p>
              )}
            </div>
            
            <div className="md:border-l md:border-slate-100 dark:border-slate-800 md:pl-6 flex flex-col justify-center gap-3 md:w-48">
              <div className="text-xs text-slate-400 font-bold mb-2 text-center md:text-left">{invite.date || invite.receivedAt || 'Date pending'}</div>
              <button
                onClick={() => handleOpportunityStatus(invite, 'accepted')}
                disabled={isAnswered || busyAction === `accepted:${invite.id}`}
                className="w-full bg-slate-950 text-white hover:bg-cyan-600 py-3 rounded-xl text-sm font-bold transition-colors shadow-md disabled:opacity-70 disabled:cursor-default"
              >
                {busyAction === `accepted:${invite.id}` ? 'Accepting...' : invite.status === 'accepted' ? 'Accepted' : 'Accept Invite'}
              </button>
              <button
                onClick={() => handleOpportunityStatus(invite, 'declined')}
                disabled={isAnswered || busyAction === `declined:${invite.id}`}
                className="w-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-default"
              >
                {busyAction === `declined:${invite.id}` ? 'Declining...' : invite.status === 'declined' ? 'Declined' : 'Decline'}
              </button>
              {['declined', 'cancelled'].includes(invite.status) && (
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
        <PortalModal title="Cancel Interview" onClose={() => setCancelTarget(null)}>
          <form onSubmit={submitCancelInterview} className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              This will notify {cancelTarget.company || cancelTarget.clientName || 'the client'} and keep the reason visible on the cancelled request.
            </div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Cancellation reason
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setCancelTarget(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white">
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

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Timesheets & Earnings</h2>
          <p className="text-slate-600 dark:text-slate-400">Track your logged hours and manage your payouts.</p>
        </div>
        <button className="bg-slate-950 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-600 transition-colors shadow-md">
          Withdraw Funds
        </button>
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
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-950 dark:text-white text-lg">Recent Timesheets</h3>
          <button className="text-sm font-bold text-cyan-600 hover:underline">View All</button>
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
