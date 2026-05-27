import React, { useEffect, useState } from 'react';
import {
  Building,
  CheckCircle,
  Clock3,
  EyeOff,
  Loader2,
  LogOut,
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
import { backendApi } from '../services/api';

const EMPTY_LIST = Object.freeze([]);
const STATUS_OPTIONS = ['pending_review', 'approved', 'hidden', 'rejected'];

const asList = (value) => (Array.isArray(value) ? value : []);
const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString()}` : value || 'Pending');
const toTextList = (value) => asList(value).join(', ');
const statusLabel = (status) => String(status || 'draft').replace(/_/g, ' ');

const statusStyles = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  hidden: 'border-slate-300 bg-slate-100 text-slate-700',
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[status] || statusStyles.draft}`}>
      {statusLabel(status)}
    </span>
  );
}

function AdminHeader({ user, activeTab, setActiveTab, onLogout, isDarkMode, toggleDarkMode }) {
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
          <NotificationBell unreadClassName="bg-cyan-500" userId={user.id} />
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
            { icon: Users, id: 'talent', label: 'Talent Review' },
            { icon: Building, id: 'agencies', label: 'Agencies' },
          ].map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
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

  useEffect(() => {
    setTalent(asList(data));
  }, [data]);

  const updateTalentStatus = async (profile, status) => {
    setBusyId(`${profile.id}:${status}`);
    setActionError('');

    try {
      const updated = await backendApi.admin.updateTalentStatus({
        professionalId: profile.id,
        status,
      });

      setTalent((current) => current.map((item) => (
        item.id === profile.id ? { ...item, ...updated } : item
      )));
    } catch (updateError) {
      setActionError(updateError.message || 'Unable to update talent status.');
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

      {(error || actionError) && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError || error.message}
        </div>
      )}

      {talent.length === 0 ? (
        <EmptyPanel icon={Users} title={isLoading ? 'Loading talent' : 'No talent profiles yet'} description="Submitted professional profiles will appear here after talent completes onboarding." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {talent.map((profile, index) => (
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

              <p className="mb-5 line-clamp-3 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                {profile.bio || 'No bio submitted yet.'}
              </p>

              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Experience</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{profile.experience || profile.exp || 'Pending'}</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Availability</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{profile.availability || profile.available || 'Pending'}</div>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {asList(profile.tools || profile.skills).slice(0, 8).map((tool) => (
                  <span key={tool} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    {tool}
                  </span>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                <button onClick={() => updateTalentStatus(profile, 'approved')} disabled={busyId === `${profile.id}:approved`} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-70">
                  {busyId === `${profile.id}:approved` ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Approve
                </button>
                <button onClick={() => updateTalentStatus(profile, 'pending_review')} disabled={busyId === `${profile.id}:pending_review`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-amber-300 hover:text-amber-700 dark:border-slate-800 dark:text-slate-300">
                  <Clock3 size={15} />
                  Pending
                </button>
                <button onClick={() => updateTalentStatus(profile, 'hidden')} disabled={busyId === `${profile.id}:hidden`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-400 dark:border-slate-800 dark:text-slate-300">
                  <EyeOff size={15} />
                  Hide
                </button>
                <button onClick={() => updateTalentStatus(profile, 'rejected')} disabled={busyId === `${profile.id}:rejected`} className="flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50">
                  <XCircle size={15} />
                  Reject
                </button>
              </div>
            </FadeIn>
          ))}
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
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Agencies</h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Create managed firms and control which agency records are visible in the client portal.</p>
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

              <div className="grid gap-2 sm:grid-cols-3">
                <button onClick={() => updateAgencyStatus(agency, 'approved')} disabled={busyAction === `${agency.id}:approved`} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-70">
                  <CheckCircle size={15} />
                  Approve
                </button>
                <button onClick={() => updateAgencyStatus(agency, 'pending_review')} disabled={busyAction === `${agency.id}:pending_review`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-amber-300 hover:text-amber-700 dark:border-slate-800 dark:text-slate-300">
                  <Clock3 size={15} />
                  Pending
                </button>
                <button onClick={() => updateAgencyStatus(agency, 'hidden')} disabled={busyAction === `${agency.id}:hidden`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-400 dark:border-slate-800 dark:text-slate-300">
                  <EyeOff size={15} />
                  Hide
                </button>
              </div>
              <div className="mt-4 text-xs font-medium text-slate-400">Tools: {toTextList(agency.tools) || 'None yet'}</div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminPortal({ user, onLogout, isDarkMode, toggleDarkMode }) {
  const [activeTab, setActiveTab] = useState('talent');

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
        {activeTab === 'talent' && <TalentReview />}
        {activeTab === 'agencies' && <AgenciesAdmin />}
      </main>
    </div>
  );
}
