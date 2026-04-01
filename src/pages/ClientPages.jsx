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
import { motion } from 'framer-motion';

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
              <button className="text-slate-400 hover:text-white relative transition-colors">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-primary-500 rounded-full"></span>
              </button>
              
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
                { id: 'shortlist', label: 'My Shortlist', count: 3 },
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
        {appView === 'discover' && <AppDiscoverView />}
        {appView === 'agencies' && <AppAgenciesView />}
        {appView === 'shortlist' && <AppShortlistView />}
        {appView === 'interviews' && <AppInterviewsView />}
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

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userMsg = inputMsg.trim();
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMsg }]);
    setInputMsg('');
    setIsTyping(true);

    // Simulate AI processing
    setTimeout(() => {
      let responseText = "Based on your needs, I've found a great match for you.";
      let matchType = null;
      let matchData = null;

      const lowerMsg = userMsg.toLowerCase();

      if (lowerMsg.includes('tax')) {
        matchType = 'talent';
        matchData = TALENT_PROFILES.find(p => p.name === 'Natasha Romanoff, CPA');
      } else if (lowerMsg.includes('bookkeep') || lowerMsg.includes('reconciliation')) {
        matchType = 'talent';
        matchData = TALENT_PROFILES.find(p => p.name === 'Steve Rogers');
      } else if (lowerMsg.includes('agency') || lowerMsg.includes('team') || lowerMsg.includes('pod')) {
        matchType = 'agency';
        matchData = AGENCIES.find(a => a.name === 'Precision Financials BPO');
        responseText = "If you're looking for a structured team approach, this agency pod is a perfect fit.";
      } else {
        matchType = 'talent';
        matchData = TALENT_PROFILES.find(p => p.name === 'Bruce Banner, CPA');
      }

      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        sender: 'ai', 
        text: responseText,
        type: matchType,
        matchData: matchData
      }]);
      setIsTyping(false);
    }, 1500);
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
      <motion.div drag dragMomentum={false} className={`fixed bottom-8 right-8 w-[400px] h-[600px] max-h-[80vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        
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
                          {msg.type === 'agency' ? <Building size={16}/> : msg.matchData.name.charAt(0)}
                       </div>
                       <div>
                         <div className="font-bold text-slate-950 dark:text-white text-sm leading-tight">{msg.matchData.name}</div>
                         <div className="text-xs text-slate-500 font-medium">{msg.type === 'agency' ? msg.matchData.specialty : msg.matchData.role}</div>
                       </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Match!</div>
                      <div className="font-bold text-slate-950 dark:text-white text-sm">{msg.matchData.rate}</div>
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
      </motion.div>
    </>
  );
}

// Sub-views for Client Portal
function AppDiscoverView() {
  const [activeFilter, setActiveFilter] = useState('All');
  
  const filteredProfiles = useMemo(() => {
    if (activeFilter === 'All') return TALENT_PROFILES;
    return TALENT_PROFILES.filter(p => 
      p.role.includes(activeFilter) || 
      p.tools.some(t => t.includes(activeFilter))
    );
  }, [activeFilter]);
  
  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start portal-fade-in">
      
      {/* Sticky Advanced Filters Sidebar */}
      <div className="w-full lg:w-72 flex-shrink-0 sticky top-[150px]">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-950 dark:text-white flex items-center gap-2"><SlidersHorizontal size={18} className="text-primary-600"/> Filters</h3>
            <button className="text-xs font-bold text-primary-600 hover:underline">Reset</button>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Availability</h4>
              {['Immediate Start', 'Part-time OK', 'US Shift (EST)'].map((time, i) => (
                <label key={i} className="flex items-center space-x-3 mb-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${i === 0 ? 'bg-primary-600 border-primary-600' : 'border-slate-300 group-hover:border-primary-400 bg-white dark:bg-slate-900'}`}>
                    {i === 0 && <CheckCircle size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:text-white transition-colors">{time}</span>
                </label>
              ))}
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Primary Software</h4>
              {['QuickBooks Online', 'Xero', 'NetSuite', 'Oracle SAP'].map((software, i) => (
                <label key={i} className="flex items-center space-x-3 mb-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors border-slate-300 group-hover:border-primary-400 bg-white dark:bg-slate-900`}></div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:text-white transition-colors">{software}</span>
                </label>
              ))}
            </div>
            
            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Max Hourly Rate</h4>
              <input type="range" className="w-full accent-primary-600" min="5" max="50" defaultValue="25" />
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
            Showing {filteredProfiles.length} profiles
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredProfiles.map((profile, idx) => (
            <FadeIn key={profile.id} delay={(idx % 6) * 50} direction="up" hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-xl hover:border-primary-200 transition-all duration-300 group flex flex-col h-full">
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-xl border border-slate-200 dark:border-slate-800">
                    {profile.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-950 dark:text-white group-hover:text-primary-700 transition-colors leading-tight mb-1">{profile.name}</h3>
                    <p className="text-sm font-semibold text-slate-500">{profile.role}</p>
                  </div>
                </div>
                <button className="text-slate-300 hover:text-primary-600 transition-colors p-1" title="Save to Shortlist">
                  <Bookmark fill="currentColor" className="w-6 h-6 opacity-40 hover:opacity-100" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6 flex-grow">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Experience</div>
                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center"><Briefcase size={14} className="mr-1.5 text-slate-400"/> {profile.exp}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Availability</div>
                   <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400"/> {profile.available}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  {profile.tools.map(tool => (
                    <span key={tool} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-800 mt-auto">
                <div className="flex items-baseline">
                  <span className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">{profile.rate}</span>
                </div>
                <button className="bg-slate-950 text-white hover:bg-primary-600 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center transform hover:-translate-y-0.5">
                   Message <MessageSquare size={16} className="ml-2" />
                </button>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppAgenciesView() {
  return (
    <div className="portal-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Discover Enterprise Agencies</h2>
        <p className="text-slate-600 dark:text-slate-400">Browse fully-managed pods and BPO firms for large-scale financial operations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {AGENCIES.map((agency, idx) => (
          <FadeIn key={agency.id} delay={idx * 100} direction="up" hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 hover:shadow-xl hover:border-primary-200 transition-all duration-300 flex flex-col h-full">
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-md border border-slate-800">
                <Building size={28} className="text-white" />
              </div>
              <div className="flex items-center bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">
                <Star size={12} className="mr-1 fill-current" /> {agency.rating}
              </div>
            </div>
            
            <h3 className="font-bold text-2xl text-slate-950 dark:text-white mb-2 leading-tight">{agency.name}</h3>
            <p className="text-sm font-bold text-primary-600 mb-6">{agency.specialty}</p>

            <div className="space-y-4 mb-8 flex-grow">
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                <MapPin size={16} className="mr-3 text-slate-400" /> {agency.location}
              </div>
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                <User size={16} className="mr-3 text-slate-400" /> {agency.size}
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3">Certifications</div>
              <div className="flex flex-wrap gap-2">
                {agency.certs.map(cert => (
                  <span key={cert} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Pricing</div>
                <div className="font-bold text-slate-950 dark:text-white">{agency.rate}</div>
              </div>
              <button className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-950 text-slate-950 dark:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
                View Firm
              </button>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

function AppShortlistView() {
  const shortlisted = TALENT_PROFILES.filter(p => [1, 3, 6].includes(p.id));

  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">My Shortlist</h2>
        <p className="text-slate-600 dark:text-slate-400">Review and schedule interviews with your saved candidates.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {shortlisted.map((profile, idx) => (
          <FadeIn key={profile.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row gap-6 hover:shadow-lg transition-shadow">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-cyan-50 rounded-full flex items-center justify-center font-bold text-primary-700 text-2xl border border-primary-200">
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-950 dark:text-white leading-tight mb-1">{profile.name}</h3>
                  <p className="text-sm font-semibold text-primary-600">{profile.role}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  <Briefcase size={16} className="mr-2 text-slate-400"/> {profile.exp} • Highly rated ({profile.rating})
                </div>
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  <Calendar size={16} className="mr-2 text-slate-400"/> Available: {profile.available}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                  {profile.tools.slice(0,3).map(tool => (
                    <span key={tool} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md">
                      {tool}
                    </span>
                  ))}
              </div>
            </div>
            <div className="sm:border-l sm:border-slate-100 dark:border-slate-800 sm:pl-6 flex flex-col justify-between sm:w-48">
              <div className="text-right sm:text-left mb-4 sm:mb-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Hourly Rate</div>
                <div className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">{profile.rate}</div>
              </div>
              <div className="space-y-2">
                <button className="w-full bg-slate-950 text-white hover:bg-primary-600 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md">
                   Schedule
                </button>
                <button className="w-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-red-600 border border-slate-200 dark:border-slate-800 hover:border-red-200 py-2.5 rounded-xl text-sm font-bold transition-colors">
                   Remove
                </button>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

function AppInterviewsView() {
  const interviews = [
    { id: 1, name: "Natasha Romanoff, CPA", role: "Senior Tax Accountant", date: "Tomorrow, Oct 24", time: "10:00 AM EST", status: "Upcoming" },
    { id: 2, name: "Bruce Banner, CPA", role: "Financial Analyst", date: "Friday, Oct 26", time: "2:30 PM EST", status: "Upcoming" }
  ];

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

      <div className="space-y-4">
        {interviews.map((interview, idx) => (
          <FadeIn key={interview.id} delay={idx * 100} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm hover:border-primary-300 transition-colors">
            <div className="flex items-center gap-6 w-full sm:w-auto">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Oct</span>
                <span className="text-xl font-black text-slate-900 dark:text-slate-50">{interview.date.split(' ')[2]}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-950 dark:text-white leading-tight mb-1">{interview.name}</h3>
                <p className="text-sm font-medium text-slate-500 mb-2">Interview for {interview.role}</p>
                <div className="flex items-center text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-md w-fit">
                  <Clock3 size={12} className="mr-1.5" /> {interview.time}
                </div>
              </div>
            </div>
            <div className="flex w-full sm:w-auto gap-3">
              <button className="flex-1 sm:flex-none bg-slate-950 text-white hover:bg-primary-600 px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-md flex items-center justify-center">
                 Join Call <Video size={16} className="ml-2" />
              </button>
              <button className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-50 hover:border-slate-300 rounded-xl transition-colors">
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

function AppBillingView() {
  return (
    <div className="portal-fade-in max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Billing & Contracts</h2>
        <p className="text-slate-600 dark:text-slate-400">Manage your active pods, embedded hires, and payment methods.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Contracts */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg">Active Contracts</h3>
          <FadeIn delay={100} hover={true} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-6">
              <div>
                <div className="inline-flex items-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md mb-3">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span> Active
                </div>
                <h4 className="text-xl font-bold text-slate-950 dark:text-white mb-1">Managed Pod: Tax Season</h4>
                <p className="text-sm font-medium text-slate-500">Started on Jan 15, 2026</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-950 dark:text-white">$3,600</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per Month</div>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Talent (3)</h5>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">NR</div>
                <div><p className="text-sm font-bold text-slate-900 dark:text-slate-50">Natasha Romanoff</p><p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Senior Tax Accountant</p></div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">CB</div>
                <div><p className="text-sm font-bold text-slate-900 dark:text-slate-50">Clint Barton</p><p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tax Preparer</p></div>
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
              <div className="font-mono text-lg tracking-widest mb-2">•••• •••• •••• 1234</div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cardholder</div>
                  <div className="text-sm font-bold">Stark Industries</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Expires</div>
                  <div className="text-sm font-bold">12/28</div>
                </div>
              </div>
            </div>
            <button className="w-full mt-4 text-sm font-bold text-primary-600 hover:text-primary-800">Update payment method</button>
          </FadeIn>

          <FadeIn delay={300}>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 text-lg mb-6">Recent Invoices</h3>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {[
                { id: "INV-2026-03", date: "Mar 1, 2026", amount: "$3,600.00" },
                { id: "INV-2026-02", date: "Feb 1, 2026", amount: "$3,600.00" },
                { id: "INV-2026-01", date: "Jan 15, 2026", amount: "$1,800.00" },
              ].map((inv, i) => (
                <div key={inv.id} className={`flex items-center justify-between p-4 ${i !== 2 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg"><Receipt size={16} className="text-slate-500"/></div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-50">{inv.id}</div>
                      <div className="text-xs font-medium text-slate-500">{inv.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900 dark:text-slate-50">{inv.amount}</span>
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

