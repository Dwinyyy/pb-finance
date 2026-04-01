import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Building, Star, Filter, 
  CheckCircle, ArrowRight, User, Briefcase, 
  Menu, X, Calculator, PieChart, ShieldCheck, 
  Mail, Lock, LogOut, Sparkles, Layers3, 
  BarChart3, BadgeCheck, Clock3, Handshake, 
  Globe2, TrendingDown, ChevronDown, ChevronUp,
  Bookmark, MessageSquare, Bell, SlidersHorizontal,
  ChevronRight, FileText, Calendar, Video, Download, CreditCard, Receipt,
  DollarSign, CheckSquare, Settings, Bot, Send, Loader2, Sun, Moon
} from 'lucide-react';
import { REVIEWS, TALENT_PROFILES, AGENCIES, SERVICE_CARDS, PROCESS_STEPS, FAQ_DATA } from '../data/mockData';
import FadeIn from '../components/FadeIn';

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
              <button className="text-slate-400 hover:text-white relative transition-colors">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-white leading-tight">{user.name}</div>
                  <div className="text-xs text-slate-400 font-medium">{user.title}</div>
                </div>
                <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-primary-400 rounded-full flex items-center justify-center font-bold text-white shadow-md cursor-pointer border-2 border-slate-800">
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
            <div className="flex space-x-8 pt-4">
              {[
                { id: 'profile', label: 'My Profile' },
                { id: 'opportunities', label: 'Opportunities', count: 2 },
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
  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start portal-fade-in max-w-6xl">
      {/* Left Column: Quick Profile Card */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-950 h-24"></div>
          <div className="p-6 relative">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-primary-50 rounded-2xl border-4 border-white flex items-center justify-center font-bold text-cyan-700 text-3xl absolute -top-10 shadow-sm">
              {user.name.charAt(0)}
            </div>
            
            <div className="mt-12 mb-6">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white leading-tight">{user.name}</h2>
              <p className="text-sm font-medium text-slate-500 mb-4">{user.title}</p>
              
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">
                <MapPin size={16} className="text-slate-400" /> {user.location}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-medium mb-6">
                <Star size={16} className="text-amber-500 fill-current" /> {user.rating} Average Rating
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Availability Status</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
                <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:border-cyan-500">
                  <option>Available Now</option>
                  <option>Available in 2 Weeks</option>
                  <option>Not Available</option>
                </select>
              </div>

              <button className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-900 dark:text-slate-50 py-2.5 rounded-xl text-sm font-bold transition-colors">
                 <Settings size={16} /> Account Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Detailed Profile Form/View */}
      <div className="flex-1 w-full space-y-6">
        <FadeIn>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">Professional Bio</h3>
              <button className="text-cyan-600 font-bold text-sm hover:underline">Edit</button>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Highly detail-oriented Payroll Specialist with 4+ years of experience managing complex payroll cycles using Gusto and ADP for US-based clients. Adept at navigating multi-state compliance, tax withholdings, and benefits administration.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">Rates & Skills</h3>
              <button className="text-cyan-600 font-bold text-sm hover:underline">Edit</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Current Hourly Rate</div>
                <div className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">$9.00 <span className="text-sm font-bold text-slate-400">/hr</span></div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Total Experience</div>
                <div className="text-lg font-bold text-slate-950 dark:text-white">4 Years</div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Software Stack</div>
              <div className="flex flex-wrap gap-2">
                {['Gusto', 'ADP', 'QuickBooks Online', 'Excel', 'G-Suite'].map(tool => (
                  <span key={tool} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5 rounded-lg font-bold">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-800 border border-emerald-100 dark:border-slate-700 rounded-3xl p-8 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-emerald-950 dark:text-emerald-300 text-lg mb-1 flex items-center gap-2"><CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400"/> Profile Approved</h3>
              <p className="text-emerald-800 dark:text-emerald-400 text-sm font-medium">Your profile has passed screening and is visible to Enterprise clients.</p>
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
  const invites = [
    { id: 1, company: "Stark Industries", role: "Payroll Specialist - Embedded Hire", duration: "Full-Time Ongoing", rate: "$9.00/hr", date: "Received 2 hours ago" },
    { id: 2, company: "Wayne Enterprises", role: "Managed Pod: Month-End Close", duration: "Part-Time (20hrs/wk)", rate: "$9.00/hr", date: "Received yesterday" }
  ];

  return (
    <div className="portal-fade-in max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Opportunities</h2>
        <p className="text-slate-600 dark:text-slate-400">Review invitations to interview and active client matches.</p>
      </div>

      <div className="space-y-6">
        {invites.map((invite, idx) => (
          <FadeIn key={invite.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col md:flex-row gap-6 justify-between">
            <div>
              <div className="inline-flex items-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md mb-4">
                Interview Invite
              </div>
              <h3 className="font-bold text-xl text-slate-950 dark:text-white mb-1">{invite.role}</h3>
              <p className="text-sm font-semibold text-slate-500 flex items-center gap-2 mb-6">
                <Building size={16}/> {invite.company}
              </p>
              <div className="flex gap-6 text-sm font-bold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2"><Clock3 size={16} className="text-slate-400"/> {invite.duration}</div>
                <div className="flex items-center gap-2"><DollarSign size={16} className="text-slate-400"/> {invite.rate}</div>
              </div>
            </div>
            
            <div className="md:border-l md:border-slate-100 dark:border-slate-800 md:pl-6 flex flex-col justify-center gap-3 md:w-48">
              <div className="text-xs text-slate-400 font-bold mb-2 text-center md:text-left">{invite.date}</div>
              <button className="w-full bg-slate-950 text-white hover:bg-cyan-600 py-3 rounded-xl text-sm font-bold transition-colors shadow-md">
                 Accept Invite
              </button>
              <button className="w-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 py-3 rounded-xl text-sm font-bold transition-colors">
                 Decline
              </button>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

function AppTalentEarningsView() {
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
            <div className="text-4xl font-black text-slate-950 dark:text-white tracking-tight">$720.00</div>
          </div>
        </FadeIn>
        <FadeIn delay={150}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pending (In Review)</div>
            <div className="text-4xl font-black text-slate-500 dark:text-slate-400 tracking-tight">$360.00</div>
          </div>
        </FadeIn>
        <FadeIn delay={200}>
          <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 blur-[30px] rounded-full"></div>
            <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 relative z-10">Total Earned (YTD)</div>
            <div className="text-4xl font-black text-white tracking-tight relative z-10">$12,450.00</div>
          </div>
        </FadeIn>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-950 dark:text-white text-lg">Recent Timesheets</h3>
          <button className="text-sm font-bold text-cyan-600 hover:underline">View All</button>
        </div>
        {[
          { period: "Oct 12 - Oct 18, 2025", hours: "40:00", amount: "$360.00", status: "Approved" },
          { period: "Oct 05 - Oct 11, 2025", hours: "40:00", amount: "$360.00", status: "Paid" },
          { period: "Sep 28 - Oct 04, 2025", hours: "38:30", amount: "$346.50", status: "Paid" },
        ].map((sheet, i) => (
          <div key={i} className={`flex items-center justify-between p-6 ${i !== 2 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-50 mb-1">{sheet.period}</div>
              <div className="text-sm font-medium text-slate-500">{sheet.hours} logged</div>
            </div>
            <div className="text-right">
              <div className="font-black text-lg text-slate-950 dark:text-white">{sheet.amount}</div>
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