import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, MapPin, Building, Star, Filter, 
  CheckCircle, ArrowRight, User, Briefcase, 
  Menu, X, Calculator, PieChart, ShieldCheck, 
  Mail, Lock, LogOut, Sparkles, Layers3, 
  BarChart3, BadgeCheck, Clock3, Handshake, 
  Globe2, TrendingDown, ChevronDown, ChevronUp,
  Bookmark, MessageSquare, SlidersHorizontal,
  ChevronLeft, ChevronRight, FileText, Calendar, Video, Download, CreditCard, Receipt,
  DollarSign, CheckSquare, Settings, Bot, Send, Loader2, Sun, Moon
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { NotificationBell } from '../components/NotificationBell';
import { EmptyState } from '../components/EmptyState';
import { motion as Motion } from 'framer-motion';
import { useBackendResource } from '../hooks/useBackendResource';
import { backendApi, isBackendConfigured } from '../services/api';

const EMPTY_LIST = Object.freeze([]);
const EMPTY_BILLING = Object.freeze({
  contracts: EMPTY_LIST,
  invoices: EMPTY_LIST,
  paymentMethods: EMPTY_LIST,
});
const SUCCESS_MESSAGE_TIMEOUT_MS = 2500;

const asList = (value) => (Array.isArray(value) ? value : []);
const formatMoney = (value) => (typeof value === 'number' ? `$${value.toLocaleString()}` : value || 'Pending');
const interviewStatusLabel = (status) => String(status === 'requested' ? 'requesting' : status || 'scheduled').replace(/_/g, ' ');
const interviewStatusStyles = {
  accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  contacted: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  declined: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  invited: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  requested: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  requesting: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  saved: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  scheduled: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
};
const padTimePart = (value) => String(value).padStart(2, '0');
const formatLocalDate = (date) => `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;
const formatLocalTime = (date) => `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
const isScheduleDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isScheduleTime = (value) => /^\d{2}:\d{2}$/.test(value);
const getScheduleDefault = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return {
    date: formatLocalDate(date),
    time: formatLocalTime(date),
  };
};
const combineScheduleDateTime = ({ date, time }) => {
  if (!isScheduleDate(date) || !isScheduleTime(time)) return '';

  const parsed = new Date(`${date}T${time}:00`);

  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString();
};



function PortalModal({ children, onClose, size = 'default', title }) {
  const widthClass = size === 'wide' ? 'max-w-2xl' : 'max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/65 px-4 py-6 backdrop-blur-sm sm:py-10">
      <div className="flex min-h-full items-start justify-center">
        <div className={`w-full ${widthClass} rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900`}>
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

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const scheduleTimeOptions = Array.from({ length: 23 }, (_, index) => {
  const hour = 8 + Math.floor(index / 2);
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${padTimePart(hour)}:${minutes}`;
});

function InterviewDateTimePicker({ value, onChange }) {
  const parsedDate = isScheduleDate(value.date) ? new Date(`${value.date}T00:00:00`) : new Date();
  const [viewDate, setViewDate] = useState(() => new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));

  const monthLabel = useMemo(
    () => viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [viewDate]
  );
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const blanks = Array.from({ length: firstDay.getDay() }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
    return [...blanks, ...days];
  }, [viewDate]);

  const updateDate = (date) => {
    onChange({ ...value, date });

    if (isScheduleDate(date)) {
      const nextDate = new Date(`${date}T00:00:00`);
      setViewDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  };

  const selectDay = (day) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    updateDate(formatLocalDate(selected));
  };

  const shiftMonth = (amount) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white" title="Previous month">
            <ChevronLeft size={17} />
          </button>
          <div className="text-sm font-black text-slate-950 dark:text-white">{monthLabel}</div>
          <button type="button" onClick={() => shiftMonth(1)} className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white" title="Next month">
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((day) => (
            <div key={day} className="py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{day}</div>
          ))}
          {calendarDays.map((day, index) => {
            const dayDate = day ? formatLocalDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day)) : '';
            const isSelected = dayDate && dayDate === value.date;

            return day ? (
              <button
                key={dayDate}
                type="button"
                onClick={() => selectDay(day)}
                className={`aspect-square rounded-xl text-sm font-bold transition-colors ${
                  isSelected
                    ? 'bg-slate-950 text-white shadow-md dark:bg-primary-500'
                    : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
                }`}
              >
                {day}
              </button>
            ) : (
              <div key={`blank-${index}`} />
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
          Time
          <select
            value={scheduleTimeOptions.includes(value.time) ? value.time : ''}
            onChange={(event) => onChange({ ...value, time: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            <option value="" disabled>Choose a time</option>
            {scheduleTimeOptions.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Date
            <input
              value={value.date}
              onChange={(event) => updateDate(event.target.value)}
              placeholder="YYYY-MM-DD"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            Time
            <input
              value={value.time}
              onChange={(event) => onChange({ ...value, time: event.target.value })}
              placeholder="HH:MM"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-primary-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. CLIENT PORTAL (LOGGED IN EXPERIENCE)
// ==========================================
export function ClientPortal({ user, onLogout, isDarkMode, toggleDarkMode }) {
  const [appView, setAppView] = useState('discover');
  const [matchmakerVisible, setMatchmakerVisible] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans relative">
      {/* App Header */}
      <header className="bg-slate-950 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* App Logo */}
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">
                PB
              </div>
              <span className="font-bold tracking-tight">Client Portal</span>
              
              {/* App Global Search */}
              <div className="hidden lg:flex items-center ml-8 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 focus-within:border-primary-500 focus-within:bg-slate-800 transition-all w-96">
                <Search size={16} className="text-slate-400 mr-2" />
                <input type="text" placeholder="Search skills, profiles, or agencies..." className="bg-transparent outline-none text-sm text-white w-full placeholder-slate-500" />
              </div>
            </div>

            {/* App User Nav */}
            <div className="flex items-center gap-6">
              <button onClick={() => setMatchmakerVisible(!matchmakerVisible)} className={`relative transition-colors ${matchmakerVisible ? 'text-primary-400' : 'text-slate-400 hover:text-white'}`} title="Toggle AI Matchmaker">
                <Bot size={20} />
              </button>
              <button onClick={toggleDarkMode} className="text-slate-400 hover:text-white transition-colors" title="Toggle Dark Mode">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <NotificationBell unreadClassName="bg-primary-500" userId={user.id} />
              
              <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-white leading-tight">{user.name}</div>
                  <div className="text-xs text-slate-400 font-medium">{user.company}</div>
                </div>
                <div className="w-9 h-9 bg-gradient-to-tr from-primary-500 to-cyan-400 rounded-full flex items-center justify-center font-bold text-white shadow-md cursor-pointer border-2 border-slate-800">
                  {user.name.charAt(0)}
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
            <div className="flex space-x-8 pt-4 overflow-x-auto scrollbar-hide">
              {[
                { id: 'discover', label: 'Discover Talent' },
                { id: 'agencies', label: 'Discover Agencies' },
                { id: 'shortlist', label: 'My Shortlist' },
                { id: 'interviews', label: 'Interviews' },
                { id: 'billing', label: 'Billing & Contracts' },
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setAppView(tab.id)}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${appView === tab.id ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:border-slate-300'}`}
                >
                  {tab.label} {tab.count && <span className="ml-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-0.5 px-2 rounded-full text-xs">{tab.count}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* App Workspace */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative scroll-smooth">
        {appView === 'discover' && <AppDiscoverView user={user} />}
        {appView === 'agencies' && <AppAgenciesView />}
        {appView === 'shortlist' && <AppShortlistView user={user} />}
        {appView === 'interviews' && <AppInterviewsView user={user} />}
        {appView === 'billing' && <AppBillingView />}
      </div>

      {/* AI Matchmaker Feature */}
      {matchmakerVisible && <AITalentMatchmaker />}
    </div>
  );
}

// --- AI MATCHMAKER COMPONENT ---
function AITalentMatchmaker() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: "Hi there! I'm your AI Matchmaker. Describe the problem you're trying to solve (e.g., 'I need help with tax season', 'Looking for an FP&A agency') and I'll find the perfect fit." }
  ]);
  
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userMsg = inputMsg.trim();
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMsg }]);
    setInputMsg('');
    setIsTyping(true);

    if (!isBackendConfigured()) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: 'Request captured. Matching suggestions will appear here once recommendations are available.',
      }]);
      setIsTyping(false);
      return;
    }

    try {
      const result = await backendApi.matchmaker.suggestMatches({ message: userMsg });
      const matchData = result?.match || result?.matches?.[0] || null;

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: result?.message || result?.text || 'Matching suggestions are ready.',
        type: result?.type || matchData?.type || 'talent',
        matchData,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: error.message || 'Unable to load matching suggestions right now.',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 w-16 h-16 bg-slate-950 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <Sparkles size={24} className="text-cyan-400" />
      </button>

      {/* AI Chat Window */}
      <Motion.div drag dragMomentum={false} className={`fixed bottom-8 right-8 w-[400px] h-[600px] max-h-[80vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        
        {/* Chat Header */}
        <div className="bg-slate-950 p-4 rounded-t-3xl flex justify-between items-center shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/30 blur-[30px] rounded-full pointer-events-none"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-primary-600/20 border border-primary-500/30 rounded-xl flex items-center justify-center text-cyan-400">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white leading-none">AI Matchmaker</h3>
              <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold mt-1">Beta</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors relative z-10">
            <X size={20} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${msg.sender === 'user' ? 'bg-primary-600 text-white rounded-2xl rounded-tr-sm px-4 py-3' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm'}`}>
                <p className="text-sm">{msg.text}</p>
                
                {/* AI Rendered Mini-Card Match */}
                {msg.matchData && (
                  <div className="mt-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm cursor-pointer hover:border-primary-300 transition-colors group">
                    <div className="flex items-center gap-3 mb-3">
                       <div className="w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold shrink-0 group-hover:text-primary-600 transition-colors">
                          {msg.type === 'agency' ? <Building size={16}/> : (msg.matchData.name || msg.matchData.fullName || '?').charAt(0)}
                       </div>
                       <div>
                         <div className="font-bold text-slate-950 dark:text-white text-sm leading-tight">{msg.matchData.name || msg.matchData.fullName || 'Recommended match'}</div>
                         <div className="text-xs text-slate-500 font-medium">{msg.type === 'agency' ? msg.matchData.specialty : (msg.matchData.role || msg.matchData.title || 'Role pending')}</div>
                       </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Match!</div>
                      <div className="font-bold text-slate-950 dark:text-white text-sm">{formatMoney(msg.matchData.rate || msg.matchData.hourlyRate)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1">
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
               </div>
             </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Chat Input */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <input 
              type="text" 
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Describe your needs..." 
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
            <button 
              type="submit" 
              disabled={!inputMsg.trim() || isTyping}
              className="w-12 h-12 bg-slate-950 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </Motion.div>
    </>
  );
}

// Sub-views for Client Portal
function AppDiscoverView({ user }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedAvailabilities, setSelectedAvailabilities] = useState(new Set());
  const [selectedSoftware, setSelectedSoftware] = useState(new Set());
  const [maxRate, setMaxRate] = useState(50);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [busyProfileId, setBusyProfileId] = useState('');
  const [actionError, setActionError] = useState('');
  const { data: profiles, error, isConfigured, isLoading } = useBackendResource(
    backendApi.talent.listProfiles,
    EMPTY_LIST,
    {
      realtime: [
        { table: 'professional_profiles' },
      ],
      refreshInterval: 30000,
    }
  );
  const { data: shortlistSnapshot } = useBackendResource(
    backendApi.client.listShortlist,
    EMPTY_LIST,
    {
      realtime: [
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'shortlists' } : null,
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'opportunities' } : null,
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'interviews' } : null,
      ],
      refreshInterval: 15000,
    }
  );

  useEffect(() => {
    setSavedIds(new Set(asList(shortlistSnapshot).map((profile) => profile.id)));
  }, [shortlistSnapshot]);
  
  const filteredProfiles = useMemo(() => {
    const profileList = asList(profiles);
    
    return profileList.filter((profile) => {
      // 1. Role / Tab filter
      if (activeFilter !== 'All') {
        const role = profile.role || profile.title || '';
        const tools = asList(profile.tools || profile.skills);
        const matchesTab = role.includes(activeFilter) || tools.some((tool) => String(tool).includes(activeFilter));
        if (!matchesTab) return false;
      }
      
      // 2. Max Rate filter
      const rate = profile.rate || profile.hourlyRate || 0;
      if (rate > maxRate && maxRate < 50) return false;
      
      // 3. Availability filter
      if (selectedAvailabilities.size > 0) {
        const avail = profile.available || profile.availability || '';
        if (!selectedAvailabilities.has(avail)) return false;
      }

      // 4. Software filter
      if (selectedSoftware.size > 0) {
        const tools = asList(profile.tools || profile.skills);
        const hasMatchingTool = tools.some(tool => selectedSoftware.has(tool));
        if (!hasMatchingTool) return false;
      }

      return true;
    });
  }, [activeFilter, profiles, selectedAvailabilities, selectedSoftware, maxRate]);

  const handleSaveProfile = async (profile) => {
    if (!profile?.id || savedIds.has(profile.id)) return;

    setActionError('');
    setBusyProfileId(profile.id);

    try {
      await backendApi.client.saveShortlist({ professionalId: profile.id });
      setSavedIds((current) => new Set([...current, profile.id]));
    } catch (saveError) {
      setActionError(saveError.message || 'Unable to save this profile.');
    } finally {
      setBusyProfileId('');
    }
  };
  
  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start portal-fade-in">
      
      {/* Sticky Advanced Filters Sidebar */}
      <div className="w-full lg:w-72 flex-shrink-0 sticky top-[150px]">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-950 dark:text-white flex items-center gap-2"><SlidersHorizontal size={18} className="text-primary-600"/> Filters</h3>
            <button 
              onClick={() => {
                setSelectedAvailabilities(new Set());
                setSelectedSoftware(new Set());
                setMaxRate(50);
              }}
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              Reset
            </button>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Availability</h4>
              {['Immediate Start', 'Part-time OK', 'US Shift (EST)'].map((time) => {
                const isSelected = selectedAvailabilities.has(time);
                return (
                <label key={time} className="flex items-center space-x-3 mb-3 cursor-pointer group">
                  <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                    const newSet = new Set(selectedAvailabilities);
                    if (e.target.checked) newSet.add(time);
                    else newSet.delete(time);
                    setSelectedAvailabilities(newSet);
                  }} />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300 group-hover:border-primary-400 bg-white dark:bg-slate-900'}`}>
                    {isSelected && <CheckCircle size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:text-white transition-colors">{time}</span>
                </label>
              )})}
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Primary Software</h4>
              {['QuickBooks Online', 'Xero', 'NetSuite', 'Oracle SAP'].map((software) => {
                const isSelected = selectedSoftware.has(software);
                return (
                <label key={software} className="flex items-center space-x-3 mb-3 cursor-pointer group">
                  <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                    const newSet = new Set(selectedSoftware);
                    if (e.target.checked) newSet.add(software);
                    else newSet.delete(software);
                    setSelectedSoftware(newSet);
                  }} />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300 group-hover:border-primary-400 bg-white dark:bg-slate-900'}`}>
                    {isSelected && <CheckCircle size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:text-white transition-colors">{software}</span>
                </label>
              )})}
            </div>
            
            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Max Hourly Rate: ${maxRate}{maxRate >= 50 ? '+' : ''}</h4>
              <input type="range" className="w-full accent-primary-600" min="5" max="50" value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} />
              <div className="flex justify-between text-xs font-bold text-slate-500 mt-2">
                <span>$5</span>
                <span>$25/hr</span>
                <span>$50+</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 w-full">
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2 overflow-x-auto scrollbar-hide pb-2">
            {['All', 'Tax', 'Audit', 'FP&A', 'Bookkeeping'].map(filter => (
              <button 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                  activeFilter === filter 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="hidden sm:block text-sm font-bold text-slate-500">
            {isLoading ? 'Loading profiles' : `Showing ${filteredProfiles.length} profiles`}
          </div>
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

        {filteredProfiles.length === 0 ? (
          <EmptyState
            icon={User}
            title={isConfigured ? 'No talent profiles yet' : 'Talent directory is empty'}
            description="Approved profiles will appear here once they are available."
          />
        ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredProfiles.map((profile, idx) => (
            <FadeIn key={profile.id || `profile-${idx}`} delay={(idx % 6) * 50} direction="up" hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl hover:border-primary-200 transition-all duration-300 group flex flex-col h-full">
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-xl border border-slate-200 dark:border-slate-800">
                    {(profile.name || profile.fullName || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-950 dark:text-white group-hover:text-primary-700 transition-colors leading-tight mb-1">{profile.name || profile.fullName || 'Unnamed profile'}</h3>
                    <p className="text-sm font-semibold text-slate-500">{profile.role || profile.title || 'Role pending'}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveProfile(profile)}
                  disabled={busyProfileId === profile.id || savedIds.has(profile.id)}
                  className={`${savedIds.has(profile.id) ? 'text-primary-600' : 'text-slate-300 hover:text-primary-600'} transition-colors p-1 disabled:cursor-default`}
                  title={savedIds.has(profile.id) ? 'Saved to Shortlist' : 'Save to Shortlist'}
                >
                  <Bookmark fill={savedIds.has(profile.id) ? 'currentColor' : 'none'} className="w-6 h-6 opacity-80 hover:opacity-100" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6 flex-grow">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Experience</div>
                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center"><Briefcase size={14} className="mr-1.5 text-slate-400"/> {profile.exp || profile.experience || 'Pending'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Availability</div>
                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400"/> {profile.available || profile.availability || 'Pending'}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  {asList(profile.tools || profile.skills).map(tool => (
                    <span key={tool} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-800 mt-auto">
                <div className="flex items-baseline">
                  <span className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">{formatMoney(profile.rate || profile.hourlyRate)}</span>
                </div>
                <button
                  onClick={() => handleSaveProfile(profile)}
                  disabled={busyProfileId === profile.id || savedIds.has(profile.id)}
                  className="bg-slate-950 text-white hover:bg-primary-600 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-default disabled:transform-none"
                >
                  {busyProfileId === profile.id ? (
                    <>
                      Saving <Loader2 size={16} className="ml-2 animate-spin" />
                    </>
                  ) : savedIds.has(profile.id) ? (
                    <>
                      Saved <CheckCircle size={16} className="ml-2" />
                    </>
                  ) : (
                    <>
                      Save <Bookmark size={16} className="ml-2" />
                    </>
                  )}
                </button>
              </div>
            </FadeIn>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

function AppAgenciesView() {
  const { data: agencies, error, isConfigured, isLoading } = useBackendResource(
    backendApi.client.listAgencies,
    EMPTY_LIST,
    {
      realtime: [
        { table: 'agencies' },
      ],
    }
  );
  const agencyList = asList(agencies);

  return (
    <div className="portal-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Discover Enterprise Agencies</h2>
        <p className="text-slate-600 dark:text-slate-400">Browse fully-managed pods and BPO firms for large-scale financial operations.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error.message}
        </div>
      )}

      {agencyList.length === 0 ? (
        <EmptyState
          icon={Building}
          title={isLoading ? 'Loading agencies' : isConfigured ? 'No agencies yet' : 'Agency directory is empty'}
          description="Approved agency records will appear here once they are available."
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {agencyList.map((agency, idx) => (
          <FadeIn key={agency.id || `agency-${idx}`} delay={idx * 100} direction="up" hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 hover:shadow-xl hover:border-primary-200 transition-all duration-300 flex flex-col h-full">
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-md border border-slate-800">
                <Building size={28} className="text-white" />
              </div>
              <div className="flex items-center bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">
                <Star size={12} className="mr-1 fill-current" /> {agency.rating || 'New'}
              </div>
            </div>
            
            <h3 className="font-bold text-2xl text-slate-950 dark:text-white mb-2 leading-tight">{agency.name || 'Unnamed agency'}</h3>
            <p className="text-sm font-bold text-primary-600 mb-6">{agency.specialty || 'Specialty pending'}</p>

            <div className="space-y-4 mb-8 flex-grow">
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                <MapPin size={16} className="mr-3 text-slate-400" /> {agency.location || 'Location pending'}
              </div>
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                <User size={16} className="mr-3 text-slate-400" /> {agency.size || 'Team size pending'}
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3">Certifications</div>
              <div className="flex flex-wrap gap-2">
                {asList(agency.certs || agency.certifications).map(cert => (
                  <span key={cert} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Pricing</div>
                <div className="font-bold text-slate-950 dark:text-white">{formatMoney(agency.rate || agency.monthlyRate)}</div>
              </div>
              <button onClick={() => alert('View Firm feature coming soon!')} className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-950 text-slate-950 dark:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
                View Firm
              </button>
            </div>
          </FadeIn>
        ))}
      </div>
      )}
    </div>
  );
}

function AppShortlistView({ user }) {
  const {
    data: shortlisted,
    error,
    isConfigured,
    isLoading,
    refetch,
  } = useBackendResource(backendApi.client.listShortlist, EMPTY_LIST, {
    realtime: [
      user?.id ? { filter: `client_id=eq.${user.id}`, table: 'shortlists' } : null,
      user?.id ? { filter: `client_id=eq.${user.id}`, table: 'opportunities' } : null,
      user?.id ? { filter: `client_id=eq.${user.id}`, table: 'interviews' } : null,
      { table: 'professional_profiles' },
    ],
    refreshInterval: 10000,
  });
  const shortlist = asList(shortlisted);
  const [localShortlist, setLocalShortlist] = useState(shortlist);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(getScheduleDefault);
  const [scheduleFormError, setScheduleFormError] = useState('');

  useEffect(() => {
    setLocalShortlist(asList(shortlisted));
  }, [shortlisted]);

  useEffect(() => {
    if (!actionMessage) return undefined;

    const timeoutId = window.setTimeout(() => setActionMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  const handleRemove = async (profile) => {
    setActionError('');
    setActionMessage('');
    setBusyAction(`remove:${profile.id}`);

    try {
      await backendApi.client.removeShortlist({ professionalId: profile.id });
      setLocalShortlist((current) => current.filter((item) => item.id !== profile.id));
      setActionMessage(`${profile.name || profile.fullName || 'Profile'} removed from shortlist.`);
    } catch (removeError) {
      setActionError(removeError.message || 'Unable to remove this profile.');
    } finally {
      setBusyAction('');
    }
  };

  const openScheduleModal = (profile) => {
    setActionError('');
    setActionMessage('');
    setScheduleFormError('');
    setScheduleTarget(profile);
    setScheduleForm(getScheduleDefault());
  };

  const closeScheduleModal = () => {
    if (busyAction) return;
    setScheduleFormError('');
    setScheduleTarget(null);
  };

  const submitSchedule = async (event) => {
    event.preventDefault();

    if (!scheduleTarget) return;

    const scheduledFor = combineScheduleDateTime(scheduleForm);

    if (!scheduledFor) {
      setScheduleFormError('Use a valid date and time, like 2026-05-24 and 09:00.');
      return;
    }

    setActionError('');
    setActionMessage('');
    setScheduleFormError('');
    setBusyAction(`schedule:${scheduleTarget.id}`);

    try {
      await backendApi.client.requestInterview({
        hourlyRate: scheduleTarget.rate || scheduleTarget.hourlyRate,
        professionalId: scheduleTarget.id,
        scheduledFor,
        title: scheduleTarget.role || scheduleTarget.title || 'Finance interview',
      });
      await refetch();
      setScheduleTarget(null);
      setActionMessage(`Interview request sent to ${scheduleTarget.name || scheduleTarget.fullName || 'the candidate'}.`);
    } catch (scheduleError) {
      setScheduleFormError(scheduleError.message || 'Unable to request this interview.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">My Shortlist</h2>
        <p className="text-slate-600 dark:text-slate-400">Review and schedule interviews with your saved candidates.</p>
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

      {localShortlist.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={isLoading ? 'Loading shortlist' : isConfigured ? 'No saved candidates yet' : 'Shortlist is empty'}
          description="Saved profiles will appear here when clients add them to a shortlist."
        />
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {localShortlist.map((profile, idx) => {
          const hasActiveOpportunity = ['accepted', 'active', 'invited'].includes(profile.opportunityStatus);
          const currentStatus = hasActiveOpportunity
            ? (['requesting', 'requested', 'scheduled'].includes(profile.interviewStatus) ? profile.interviewStatus : profile.opportunityStatus)
            : profile.interviewStatus || profile.opportunityStatus || profile.shortlistStatus;
          const hasActiveRequest = ['invited', 'accepted', 'active', 'requesting', 'requested', 'scheduled'].includes(currentStatus);

          return (
          <FadeIn key={profile.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-6 hover:shadow-lg transition-shadow">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-cyan-50 rounded-full flex items-center justify-center font-bold text-primary-700 text-2xl border border-primary-200">
                  {(profile.name || profile.fullName || '?').charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-950 dark:text-white leading-tight mb-1">{profile.name || profile.fullName || 'Unnamed profile'}</h3>
                  <p className="text-sm font-semibold text-primary-600">{profile.role || profile.title || 'Role pending'}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  <Briefcase size={16} className="mr-2 text-slate-400"/> {profile.exp || profile.experience || 'Experience pending'}
                </div>
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  <Calendar size={16} className="mr-2 text-slate-400"/> Available: {profile.available || profile.availability || 'Pending'}
                </div>
                {currentStatus && (
                  <div className={`inline-flex rounded-md px-2 py-1 text-xs font-bold capitalize ${interviewStatusStyles[currentStatus] || interviewStatusStyles.saved}`}>
                    {interviewStatusLabel(currentStatus)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                  {asList(profile.tools || profile.skills).slice(0,3).map(tool => (
                    <span key={tool} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md">
                      {tool}
                    </span>
                  ))}
              </div>
            </div>
            <div className="sm:border-l sm:border-slate-100 dark:border-slate-800 sm:pl-6 flex flex-col justify-between sm:w-48">
              <div className="text-right sm:text-left mb-4 sm:mb-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Hourly Rate</div>
                <div className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">{formatMoney(profile.rate || profile.hourlyRate)}</div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => openScheduleModal(profile)}
                  disabled={busyAction === `schedule:${profile.id}` || hasActiveRequest}
                  className="w-full bg-slate-950 text-white hover:bg-primary-600 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md disabled:opacity-70 disabled:cursor-default"
                >
                  {busyAction === `schedule:${profile.id}` ? 'Sending...' : hasActiveRequest ? 'Requested' : 'Schedule'}
                </button>
                <button
                  onClick={() => handleRemove(profile)}
                  disabled={busyAction === `remove:${profile.id}`}
                  className="w-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-red-600 border border-slate-200 dark:border-slate-800 hover:border-red-200 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-default"
                >
                  {busyAction === `remove:${profile.id}` ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </FadeIn>
          );
        })}
      </div>
      )}

      {scheduleTarget && (
        <PortalModal title="Request Interview" onClose={closeScheduleModal} size="wide">
          <form onSubmit={submitSchedule} className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">Preferred date and time</div>
              <InterviewDateTimePicker value={scheduleForm} onChange={(nextSchedule) => { setScheduleForm(nextSchedule); setScheduleFormError(''); }} />
              <p className="mt-2 text-xs font-medium text-slate-500">Pick a date from the calendar, choose a time, or type both fields manually.</p>
            </div>
            {scheduleFormError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                {scheduleFormError}
              </div>
            )}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              {scheduleTarget.name || scheduleTarget.fullName || 'Candidate'} will receive this as a request first. It becomes scheduled after they accept.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeScheduleModal} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={busyAction === `schedule:${scheduleTarget.id}`} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:opacity-70">
                {busyAction === `schedule:${scheduleTarget.id}` ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        </PortalModal>
      )}
    </div>
  );
}

function AppInterviewsView({ user }) {
  const { data: interviews, error, isConfigured, isLoading, refetch } = useBackendResource(
    backendApi.client.listInterviews,
    EMPTY_LIST,
    {
      realtime: [
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'interviews' } : null,
        user?.id ? { filter: `client_id=eq.${user.id}`, table: 'opportunities' } : null,
      ],
      refreshInterval: 10000,
    }
  );
  const interviewList = asList(interviews);
  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionMenuId, setActionMenuId] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFormError, setCancelFormError] = useState('');

  useEffect(() => {
    if (!actionMessage) return undefined;

    const timeoutId = window.setTimeout(() => setActionMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  const openCancelModal = (interview) => {
    setActionError('');
    setActionMessage('');
    setActionMenuId('');
    setCancelFormError('');
    setCancelTarget(interview);
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
      await backendApi.client.cancelInterview({ id: cancelTarget.id, reason });
      await refetch();
      setCancelTarget(null);
      setActionMessage('Interview cancelled and the professional was notified.');
    } catch (cancelError) {
      setCancelFormError(cancelError.message || 'Unable to cancel this interview.');
    } finally {
      setBusyAction('');
    }
  };

  const handleRemoveCancelled = async (interview) => {
    setActionError('');
    setActionMessage('');
    setActionMenuId('');
    setBusyAction(`remove:${interview.id}`);

    try {
      await backendApi.client.removeInterview({ id: interview.id });
      await refetch();
      setActionMessage('Cancelled interview removed.');
    } catch (removeError) {
      setActionError(removeError.message || 'Unable to remove this interview.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="portal-fade-in max-w-4xl">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Interviews</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage your upcoming candidate screenings.</p>
        </div>
        <button className="text-primary-600 font-bold text-sm hover:underline flex items-center">
          Sync with Google Calendar
        </button>
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

      {interviewList.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={isLoading ? 'Loading interviews' : isConfigured ? 'No interviews scheduled' : 'Interview schedule is empty'}
          description="Upcoming screenings will appear here once they are scheduled."
        />
      ) : (
      <div className="space-y-4">
        {interviewList.map((interview, idx) => (
          <FadeIn key={interview.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm hover:border-primary-300 transition-colors">
            <div className="flex items-center gap-6 w-full sm:w-auto">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase">{interview.month || 'TBD'}</span>
                <span className="text-xl font-black text-slate-900 dark:text-slate-50">{interview.day || '--'}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-950 dark:text-white leading-tight mb-1">{interview.name || interview.candidateName || 'Candidate pending'}</h3>
                <p className="text-sm font-medium text-slate-500 mb-2">Interview for {interview.role || interview.title || 'Role pending'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-md w-fit">
                    <Clock3 size={12} className="mr-1.5" /> {interview.time || interview.scheduledFor || 'Time pending'}
                  </div>
                  <div className={`rounded-md px-2 py-1 text-xs font-bold capitalize ${interviewStatusStyles[interview.status] || interviewStatusStyles.scheduled}`}>
                    {interviewStatusLabel(interview.status)}
                  </div>
                </div>
                {interview.status === 'cancelled' && interview.cancellationReason && (
                  <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                    Cancelled: {interview.cancellationReason}
                  </p>
                )}
              </div>
            </div>
            <div className="flex w-full sm:w-auto gap-3">
              {interview.status === 'cancelled' ? (
                <button disabled className="flex flex-1 cursor-default items-center justify-center rounded-xl bg-red-50 px-6 py-3 text-sm font-bold text-red-600 sm:flex-none dark:bg-red-950/20 dark:text-red-300">
                  Cancelled
                </button>
              ) : interview.meetingUrl ? (
                <a href={interview.meetingUrl} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-600 sm:flex-none">
                  Join Call <Video size={16} className="ml-2" />
                </a>
              ) : (
                <button disabled className="flex flex-1 cursor-default items-center justify-center rounded-xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-500 sm:flex-none dark:bg-slate-800 dark:text-slate-400">
                  No link yet <Video size={16} className="ml-2" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setActionMenuId((current) => (current === interview.id ? '' : interview.id))}
                  disabled={busyAction === `cancel:${interview.id}` || busyAction === `remove:${interview.id}`}
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-50 hover:border-slate-300 rounded-xl transition-colors disabled:cursor-default disabled:opacity-50"
                  title="Interview actions"
                >
                  <SlidersHorizontal size={18} />
                </button>
                {actionMenuId === interview.id && (
                  <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    {interview.status === 'cancelled' ? (
                      <button
                        onClick={() => handleRemoveCancelled(interview)}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Delete cancelled
                      </button>
                    ) : (
                      <button
                        onClick={() => openCancelModal(interview)}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Cancel interview
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
      )}

      {cancelTarget && (
        <PortalModal title="Cancel Interview" onClose={() => { setCancelFormError(''); setCancelTarget(null); }}>
          <form onSubmit={submitCancelInterview} className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              This will notify {cancelTarget.name || cancelTarget.candidateName || 'the professional'} and keep the reason visible on the cancelled interview.
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

function AppBillingView() {
  const { data: billing, error, isConfigured, isLoading } = useBackendResource(backendApi.client.getBilling, EMPTY_BILLING);
  const contracts = asList(billing.contracts);
  const invoices = asList(billing.invoices);
  const paymentMethods = asList(billing.paymentMethods);
  const primaryContract = contracts[0] || {};
  const primaryPaymentMethod = paymentMethods[0] || {};

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Billing & Contracts</h2>
        <p className="text-slate-600 dark:text-slate-400">Manage your active pods, embedded hires, and payment methods.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Contracts */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg">Active Contracts</h3>
          <FadeIn delay={100} hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-6">
              <div>
                <div className="inline-flex items-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md mb-3">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span> {primaryContract.status || (isLoading ? 'Loading' : 'Pending')}
                </div>
                <h4 className="text-xl font-bold text-slate-950 dark:text-white mb-1">{primaryContract.name || primaryContract.title || (isConfigured ? 'No active contract yet' : 'Contracts will appear here')}</h4>
                <p className="text-sm font-medium text-slate-500">{primaryContract.startDate || 'Start date pending'}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-950 dark:text-white">{formatMoney(primaryContract.amount || primaryContract.monthlyAmount)}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{primaryContract.billingInterval || 'Billing'}</div>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Talent</h5>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">--</div>
                <div><p className="text-sm font-bold text-slate-900 dark:text-slate-50">No assignments loaded</p><p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Contract talent will appear after assignment</p></div>
              </div>
            </div>

            <div className="flex gap-4">
              <button className="bg-slate-950 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-primary-600 transition-colors">View Contract</button>
              <button className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Request Change</button>
            </div>
          </FadeIn>
        </div>

        {/* Payment & Invoices */}
        <div className="space-y-8">
          <FadeIn delay={200}>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg mb-6">Payment Method</h3>
            <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 blur-[30px] rounded-full"></div>
              <CreditCard className="text-primary-400 w-8 h-8 mb-8" />
              <div className="font-mono text-lg tracking-widest mb-2">{primaryPaymentMethod.last4 ? `Card ending ${primaryPaymentMethod.last4}` : 'No payment method on file'}</div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cardholder</div>
                  <div className="text-sm font-bold">{primaryPaymentMethod.holderName || 'Billing profile pending'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Expires</div>
                  <div className="text-sm font-bold">{primaryPaymentMethod.expires || 'Pending'}</div>
                </div>
              </div>
            </div>
            <button className="w-full mt-4 text-sm font-bold text-primary-600 hover:text-primary-800">Update payment method</button>
          </FadeIn>

          <FadeIn delay={300}>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg mb-6">Recent Invoices</h3>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {invoices.length === 0 && (
                <div className="p-6 text-sm font-medium text-slate-500">No invoices loaded yet.</div>
              )}
              {invoices.map((inv, i) => (
                <div key={inv.id || i} className={`flex items-center justify-between p-4 ${i !== invoices.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg"><Receipt size={16} className="text-slate-500"/></div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-50">{inv.number || inv.id || 'Invoice'}</div>
                      <div className="text-xs font-medium text-slate-500">{inv.date || 'Date pending'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900 dark:text-slate-50">{formatMoney(inv.amount)}</span>
                    <button className="text-slate-400 hover:text-primary-600 transition-colors"><Download size={16}/></button>
                  </div>
                </div>
              ))}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 text-center border-t border-slate-100 dark:border-slate-800">
                <button className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50 uppercase tracking-wider">View All History</button>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
