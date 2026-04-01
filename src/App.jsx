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
  DollarSign, CheckSquare, Settings, Bot, Send, Loader2
} from 'lucide-react';

// --- MOCK DATA ---
const REVIEWS = [
  { id: 1, title: "Exceptional Service", body: "Found an amazing CPA who completely streamlined our US tax prep. Highly recommended!", name: "Sarah J., Tech Startup", date: "Oct 2025", rating: 5 },
  { id: 2, title: "Game Changer", body: "Our remote bookkeeping team from Manila is faster and more accurate than our previous local hires.", name: "David M., Retail Agency", date: "Sep 2025", rating: 5 },
  { id: 3, title: "Reliable & Professional", body: "What stood out was structure: documentation, handoffs, overlap hours, and communication were all better than previous vendors.", name: "Elena R., E-commerce", date: "Aug 2025", rating: 5 },
  { id: 4, title: "Cost-Effective Scaling", body: "We cut month-end close from 12 days to 6 and finally got consistent reporting. Their outsourced accountants felt like our own team.", name: "Mark T., SaaS Founder", date: "Aug 2025", rating: 5 },
];

const TALENT_PROFILES = [
  { id: 1, name: "Natasha Romanoff, CPA", role: "Senior Tax Accountant", exp: "8 Years", tools: ["QuickBooks", "Xero", "TurboTax"], rate: "$15/hr", rating: 4.9, available: "Immediate", match: 98 },
  { id: 2, name: "Steve Rogers", role: "Full-Charge Bookkeeper", exp: "5 Years", tools: ["Xero", "Wave", "Excel"], rate: "$10/hr", rating: 4.8, available: "In 2 weeks", match: 94 },
  { id: 3, name: "Bruce Banner, CPA", role: "Financial Analyst", exp: "6 Years", tools: ["Excel", "PowerBI", "SAP"], rate: "$18/hr", rating: 5.0, available: "Immediate", match: 99 },
  { id: 4, name: "Peter Parker", role: "Payroll Specialist", exp: "4 Years", tools: ["Gusto", "QuickBooks", "ADP"], rate: "$9/hr", rating: 4.7, available: "Flexible", match: 88 },
  { id: 5, name: "Wanda Maximoff", role: "Accounts Payable Clerk", exp: "3 Years", tools: ["NetSuite", "Bill.com"], rate: "$8/hr", rating: 4.6, available: "Immediate", match: 91 },
  { id: 6, name: "Tony Stark, CPA", role: "Virtual CFO", exp: "12 Years", tools: ["Xero", "Fathom", "Advanced Modeling"], rate: "$35/hr", rating: 5.0, available: "In 1 week", match: 97 },
  { id: 7, name: "Stephen Strange, CPA", role: "Forensic Accountant", exp: "15 Years", tools: ["CaseWare", "Relativity", "Excel"], rate: "$45/hr", rating: 5.0, available: "In 1 month", match: 92 },
  { id: 8, name: "T'Challa", role: "Global Controller", exp: "10 Years", tools: ["Oracle SAP", "NetSuite", "BlackLine"], rate: "$50/hr", rating: 4.9, available: "In 2 weeks", match: 96 },
  { id: 9, name: "Carol Danvers, CPA", role: "Audit Manager", exp: "9 Years", tools: ["AuditBoard", "Workiva", "QuickBooks"], rate: "$30/hr", rating: 4.8, available: "Immediate", match: 91 },
  { id: 10, name: "Scott Lang", role: "Accounts Receivable", exp: "2 Years", tools: ["QuickBooks", "Stripe", "Excel"], rate: "$7/hr", rating: 4.5, available: "Immediate", match: 85 },
  { id: 11, name: "Clint Barton", role: "Tax Preparer", exp: "6 Years", tools: ["ProConnect", "Lacerte", "Drake"], rate: "$12/hr", rating: 4.7, available: "Flexible", match: 89 },
  { id: 12, name: "Sam Wilson", role: "FP&A Manager", exp: "7 Years", tools: ["Adaptive Insights", "Tableau", "Excel"], rate: "$25/hr", rating: 4.8, available: "In 1 week", match: 95 },
];

const AGENCIES = [
  { id: 101, name: "Precision Financials BPO", specialty: "Tax & Advisory Pods", size: "50-200 Staff", location: "Manila (BGC Hub)", rate: "Starts at $1,500/mo", rating: 4.9, certs: ["US GAAP", "SOC 2 Type II"] },
  { id: 102, name: "Quantum Accounting Group", specialty: "Full-Cycle Bookkeeping", size: "10-50 Staff", location: "Cebu City", rate: "Starts at $800/mo", rating: 4.8, certs: ["QuickBooks Certified", "Xero Gold"] },
  { id: 103, name: "Nexus Enterprise Solutions", specialty: "FP&A & Audit Support", size: "200+ Staff", location: "Makati CBD", rate: "Starts at $3,500/mo", rating: 5.0, certs: ["IFRS Compliant", "Big 4 Alumni"] },
];

const SERVICE_CARDS = [
  { title: "Dedicated Finance Talent", icon: User, desc: "Hire embedded accountants, CPAs, and finance analysts who operate like an extension of your internal team." },
  { title: "Managed Accounting Pods", icon: Layers3, desc: "Deploy role-based teams for month-end close, tax season, cleanup projects, or recurring finance operations." },
  { title: "Process Improvement", icon: BarChart3, desc: "Standardize workflows, improve close speed, reduce errors, and create reporting that leaders actually use." },
  { title: "Compliance-Ready Execution", icon: BadgeCheck, desc: "Get documentation-first support with quality controls, secure file handling, and review-ready outputs." },
];

const PROCESS_STEPS = [
  { title: "Scope & workflow audit", text: "We map deliverables, systems, quality standards, and overlap requirements before any placement happens." },
  { title: "Curated shortlist", text: "You review pre-vetted finance professionals matched by function, tools, seniority, and communication style." },
  { title: "Pilot & onboarding", text: "We launch with SOPs, access checklists, training windows, and success metrics tailored to your team." },
  { title: "QA & scale-up", text: "Performance reviews, backup coverage, and process optimization keep quality high as your needs grow." },
];

const FAQ_DATA = [
  { q: "What makes this different from generic staffing?", a: "This model is specialized for accounting and finance. Matching is based on workflows, tools, controls, industry context, and communication quality—not just availability." },
  { q: "Can international talent work in our timezone?", a: "Yes. We prioritize overlap hours and can structure shifts for US, UK, Australia, or hybrid global teams depending on the role and urgency." },
  { q: "How do you protect financial data?", a: "We design onboarding around least-privilege access, documentation standards, secure file handling, and clear approval workflows. Sensitive access can also be segmented by function." },
  { q: "Can we start with one person and scale later?", a: "Absolutely. Many clients start with one accountant or CPA, validate the workflow, then add roles for AP/AR, reporting, tax, or audit support." },
];

// --- UTILITY COMPONENTS ---

// Scroll Reveal Animation Component
function FadeIn({ children, delay = 0, direction = 'up', className = "" }) {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisible(true);
        if (domRef.current) observer.unobserve(domRef.current);
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    
    if (domRef.current) observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);

  const translateClass = direction === 'up' ? 'translate-y-12' : direction === 'left' ? '-translate-x-12' : direction === 'right' ? 'translate-x-12' : 'translate-y-0 scale-95';

  return (
    <div 
      ref={domRef} 
      className={`transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0 translate-x-0 scale-100' : `opacity-0 ${translateClass}`} ${className}`} 
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [authModal, setAuthModal] = useState({ isOpen: false, view: 'login' });

  const openAuth = (view = 'login') => setAuthModal({ isOpen: true, view });
  const closeAuth = () => setAuthModal({ isOpen: false, view: 'login' });

  const handleAuthSubmit = (e, role = 'client') => {
    e.preventDefault();
    if (role === 'professional') {
      setUser({ name: 'Peter Parker', role: 'professional', title: 'Payroll Specialist', location: 'Manila, PH', rating: 4.9 });
    } else {
      setUser({ name: 'Tony Stark', role: 'client', company: 'Stark Industries' });
    }
    closeAuth();
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 scroll-smooth selection:bg-indigo-500/30">
      
      {/* Global CSS Enhancements */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .bg-grid-pattern {
          background-image: linear-gradient(to right, #80808012 1px, transparent 1px), linear-gradient(to bottom, #80808012 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .ai-gradient-text {
          background: linear-gradient(135deg, #6366f1, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* Conditional Rendering: Entire UI changes if logged in */}
      {user ? (
        user.role === 'professional' ? (
          <ProfessionalPortal user={user} onLogout={() => setUser(null)} />
        ) : (
          <ClientPortal user={user} onLogout={() => setUser(null)} />
        )
      ) : (
        <PublicSite openAuth={openAuth} />
      )}

      {/* Auth Modal Overlay - Shared across both modes */}
      {authModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200/50">
            <div className="p-6 pb-0 flex justify-between items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-xl flex items-center justify-center mb-2 border border-indigo-100">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <button onClick={closeAuth} className="text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
               <h2 className="text-2xl font-bold text-slate-950 mb-2 tracking-tight">
                {authModal.view === 'login' ? 'Welcome Back' : authModal.view === 'register' ? 'Create an Account' : 'Apply as Talent'}
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {authModal.view === 'login' ? 'Enter your details to securely access your portal.' : 'Join the premium network of global finance professionals.'}
              </p>

              <form onSubmit={(e) => handleAuthSubmit(e, authModal.view === 'register_pro' ? 'professional' : 'client')} className="space-y-4">
                {authModal.view !== 'login' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input type="text" required className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 focus:bg-white" placeholder={authModal.view === 'register_pro' ? "Peter Parker" : "Tony Stark"} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Work Email</label>
                  <input type="email" required className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 focus:bg-white" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
                  <input type="password" required className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 focus:bg-white" placeholder="••••••••" />
                </div>
                
                <button type="submit" className="w-full bg-slate-950 hover:bg-indigo-600 text-white py-4 rounded-xl font-semibold transition-all mt-6 shadow-lg shadow-slate-900/10 text-sm">
                  {authModal.view === 'login' ? 'Sign In to Portal' : 'Continue to Dashboard'}
                </button>
              </form>
              
              <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
                {authModal.view === 'login' ? (
                  <p>Don't have an account? <button onClick={() => setAuthModal({ ...authModal, view: 'register' })} className="text-indigo-600 font-bold hover:underline transition-colors">Sign up</button></p>
                ) : (
                  <p>Already have an account? <button onClick={() => setAuthModal({ ...authModal, view: 'login' })} className="text-indigo-600 font-bold hover:underline transition-colors">Log in</button></p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 1. PUBLIC MARKETING SITE
// ==========================================
function PublicSite({ openAuth }) {
  const [activeTab, setActiveTab] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <nav className="bg-white/90 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-200/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center cursor-pointer gap-3" onClick={() => navigateTo('home')}>
              <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
                PM
              </div>
              <div>
                <div className="text-lg font-bold text-slate-950 tracking-tight leading-none mb-0.5">PM Finance</div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              {['home', 'talents', 'agency'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => navigateTo(tab)} 
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === tab ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'}`}
                >
                  {tab === 'home' ? 'Overview' : tab === 'talents' ? 'Directory' : 'Enterprise'}
                </button>
              ))}
              
              <div className="flex items-center space-x-4 pl-6 ml-2 border-l border-slate-200">
                <button onClick={() => openAuth('login')} className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Client Login</button>
                <button onClick={() => openAuth('register')} className="bg-slate-950 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                  Start Hiring
                </button>
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors">
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-xl absolute w-full z-50">
            <div className="px-4 pt-4 pb-6 space-y-2">
              <button onClick={() => navigateTo('home')} className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold ${activeTab === 'home' ? 'bg-slate-50 text-slate-950' : 'text-slate-700 hover:bg-slate-50'}`}>Overview</button>
              <button onClick={() => navigateTo('talents')} className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold ${activeTab === 'talents' ? 'bg-slate-50 text-slate-950' : 'text-slate-700 hover:bg-slate-50'}`}>Directory</button>
              <button onClick={() => navigateTo('agency')} className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold ${activeTab === 'agency' ? 'bg-slate-50 text-slate-950' : 'text-slate-700 hover:bg-slate-50'}`}>Enterprise Teams</button>
              <div className="mt-4 pt-4 border-t border-slate-100 grid gap-2">
                <button onClick={() => openAuth('login')} className="w-full bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-xl text-sm font-bold">Client Login</button>
                <button onClick={() => openAuth('register')} className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl text-sm font-bold">Start Hiring</button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="min-h-screen">
        {activeTab === 'home' && <HomeMarketingView navigateTo={navigateTo} openAuth={openAuth} />}
        {activeTab === 'talents' && <PreviewDirectoryView openAuth={openAuth} />}
        {activeTab === 'agency' && <AgencyMarketingView openAuth={openAuth} />}
      </main>

      <PublicFooter navigateTo={navigateTo} openAuth={openAuth} />
    </>
  );
}

function ROICalculator() {
  const [salary, setSalary] = useState(85000);
  const [benefits, setBenefits] = useState(22);
  const [vendorFee, setVendorFee] = useState(3600);
  const [needManager, setNeedManager] = useState(true);

  const data = useMemo(() => {
    const benefitCost = salary * (benefits / 100);
    const managerCost = needManager ? 12000 : 0;
    const inHouse = salary + benefitCost + managerCost;
    const outsourced = vendorFee * 12;
    const savings = Math.max(inHouse - outsourced, 0);
    const percent = Math.round((savings / Math.max(inHouse, 1)) * 100);
    return { inHouse, outsourced, savings, percent };
  }, [salary, benefits, vendorFee, needManager]);

  return (
    <section className="py-32 bg-slate-50 border-t border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <FadeIn>
            <div className="inline-flex mb-4 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm uppercase tracking-wider">
              Savings Calculator
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl mb-6">
              Estimate the cost difference
            </h2>
            <p className="text-slate-600 text-xl mb-12 leading-relaxed">
              See the business case in numbers you actually care about: total cost, overlap, and practical staffing flexibility without sacrificing quality.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950">2–4 wks</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Typical launch timeline</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950">30–45%</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Average cost savings</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950">5+ hrs</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Daily timezone overlap</div>
              </div>
              <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950">Role-based</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Flexible team design</div>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={200} direction="left">
          <div className="rounded-[32px] border border-white/60 bg-white p-8 md:p-10 shadow-2xl shadow-slate-200/50 backdrop-blur-xl">
            <div className="grid gap-8">
              {/* Sliders */}
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-700 mb-4">
                  <span>Annual local salary</span>
                  <span className="text-slate-950 text-xl">${salary.toLocaleString()}</span>
                </div>
                <input type="range" min="35000" max="160000" step="5000" value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-700 mb-4">
                  <span>Benefits and overhead (%)</span>
                  <span className="text-slate-950 text-xl">{benefits}%</span>
                </div>
                <input type="range" min="5" max="35" step="1" value={benefits} onChange={(e) => setBenefits(Number(e.target.value))} className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-700 mb-4">
                  <span>Monthly outsourced cost</span>
                  <span className="text-slate-950 text-xl">${vendorFee.toLocaleString()}</span>
                </div>
                <input type="range" min="1200" max="9000" step="100" value={vendorFee} onChange={(e) => setVendorFee(Number(e.target.value))} className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 transition-colors hover:bg-slate-100">
                <div>
                  <div className="font-bold text-slate-950 text-sm">Include manager onboarding cost</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">Useful if local hires need more oversight</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setNeedManager(!needManager)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${needManager ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-300 ease-in-out ${needManager ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Results */}
              <div className="grid gap-4 md:grid-cols-3 pt-6 border-t border-slate-100">
                <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">In-house Annual</div>
                  <div className="mt-2 text-2xl font-black text-slate-950">${Math.round(data.inHouse).toLocaleString()}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Outsourced Annual</div>
                  <div className="mt-2 text-2xl font-black text-slate-950">${Math.round(data.outsourced).toLocaleString()}</div>
                </div>
                <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-xl transform transition-transform hover:scale-105 hover:-translate-y-1 duration-300">
                  <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Estimated Savings</div>
                  <div className="mt-2 text-2xl font-black text-white">${Math.round(data.savings).toLocaleString()}</div>
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-5 border border-emerald-100 flex items-start gap-4">
                <TrendingDown className="h-6 w-6 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-emerald-800 text-sm">Estimated savings rate: {data.percent}%</div>
                  <p className="text-xs font-medium leading-relaxed text-emerald-700 mt-1.5">
                    Directional estimates based on typical US/UK staffing models versus our premium global talent pools.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="space-y-3">
      {FAQ_DATA.map((item, index) => (
        <div key={index} className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm transition-all hover:border-slate-300">
          <button 
            className="w-full flex justify-between items-center p-5 text-left focus:outline-none"
            onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
          >
            <span className="font-bold text-slate-900 pr-4">{item.q}</span>
            {openIndex === index ? (
              <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300" />
            )}
          </button>
          <div 
            className={`px-5 text-slate-600 text-sm font-medium leading-relaxed overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-40 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            {item.a}
          </div>
        </div>
      ))}
    </div>
  );
}

function HomeMarketingView({ navigateTo, openAuth }) {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 lg:pt-36 lg:pb-40 bg-slate-50 border-b border-slate-200/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-50"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[600px] opacity-40 rounded-full bg-gradient-to-tr from-indigo-200 via-cyan-100 to-transparent blur-3xl pointer-events-none -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <FadeIn delay={100}>
            <div className="inline-flex items-center mb-8 rounded-full border border-indigo-200 bg-white/60 backdrop-blur px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm">
              <Sparkles className="mr-2 h-4 w-4 text-indigo-500" /> Redefining Global Finance Outsourcing
            </div>
          </FadeIn>
          
          <FadeIn delay={200}>
            <h1 className="text-5xl md:text-7xl font-bold text-slate-950 tracking-tight leading-[1.05] mb-8 max-w-5xl">
              Elite financial talent, seamlessly integrated into your <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">operations.</span>
            </h1>
          </FadeIn>
          
          <FadeIn delay={300}>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-12 leading-relaxed">
              We connect scaling companies with top-tier, rigorously vetted CPAs and analysts from the Philippines. Scale your capacity without compromising on quality.
            </p>
          </FadeIn>

          <FadeIn delay={400} className="w-full max-w-2xl flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <button onClick={() => openAuth('register')} className="bg-slate-950 hover:bg-indigo-600 text-white px-10 py-4 rounded-full font-semibold text-lg transition-all shadow-xl shadow-indigo-900/10 flex items-center justify-center transform hover:-translate-y-1">
              Start Building Your Team
            </button>
            <button onClick={() => navigateTo('talents')} className="bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 text-slate-800 px-10 py-4 rounded-full font-semibold text-lg transition-all shadow-sm flex items-center justify-center transform hover:-translate-y-1">
              Browse Directory <ArrowRight size={20} className="ml-2 text-slate-400" />
            </button>
          </FadeIn>

          {/* Value Props Bar */}
          <FadeIn delay={600} className="w-full max-w-4xl mx-auto bg-white rounded-3xl p-6 border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-wrap justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><ShieldCheck size={20}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 text-sm">Top 1% Talent</p><p className="text-xs text-slate-500">Rigorously vetted</p></div>
            </div>
            <div className="hidden md:block w-px h-10 bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><Globe2 size={20}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 text-sm">US/UK GAAP</p><p className="text-xs text-slate-500">Fully compliant</p></div>
            </div>
            <div className="hidden md:block w-px h-10 bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600"><TrendingDown size={20}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 text-sm">40%+ Savings</p><p className="text-xs text-slate-500">Optimized ROI</p></div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Dynamic Scrolling Sections */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 mb-6">Designed for sophisticated financial workflows</h2>
              <p className="text-xl text-slate-600">Beyond basic bookkeeping. We provide strategic coverage for your most critical financial operations.</p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {SERVICE_CARDS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <FadeIn key={idx} delay={idx * 100} direction="up">
                  <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 md:p-10 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-2 transition-all duration-500 group">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-8 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-colors duration-500 shadow-sm">
                      <Icon className="w-8 h-8 text-slate-700 group-hover:text-white transition-colors duration-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-950 mb-4 tracking-tight">{item.title}</h3>
                    <p className="text-slate-600 text-lg leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <ROICalculator />

      {/* Reviews & FAQ Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16">
          <div>
            <FadeIn>
              <div className="inline-flex mb-4 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                Proof
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 mb-10">
                Trusted by scaling businesses
              </h2>
              
              <div className="space-y-6">
                {REVIEWS.slice(0, 2).map((review) => (
                  <div key={review.id} className="bg-slate-50 border border-slate-100 p-8 rounded-[32px] hover:shadow-lg transition-all duration-300">
                    <div className="flex text-amber-400 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={18} fill="currentColor" className={i >= review.rating ? "text-slate-200" : ""} />
                      ))}
                    </div>
                    <blockquote className="text-lg font-bold text-slate-900 leading-relaxed mb-6">
                      "{review.body}"
                    </blockquote>
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg mr-4 border border-indigo-200">
                        {review.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-950">{review.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{review.title}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
          
          <div>
            <FadeIn delay={200}>
              <div className="inline-flex mb-4 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-600 md:hidden uppercase tracking-wider">
                FAQ
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 mb-10 hidden md:block">
                Frequently asked questions
              </h2>
              <FAQAccordion />
              
              <div className="mt-12 bg-gradient-to-br from-indigo-50 to-cyan-50 border border-indigo-100 rounded-[32px] p-10 text-center shadow-sm">
                <h3 className="text-2xl font-bold text-slate-950 mb-4">Still have questions?</h3>
                <p className="text-slate-600 text-lg mb-8 max-w-sm mx-auto">Schedule a brief call to see how we can map a solution to your exact workflow.</p>
                <button onClick={() => openAuth('register')} className="bg-slate-950 text-white px-10 py-4 rounded-full text-base font-bold hover:bg-indigo-600 transition-transform transform hover:-translate-y-1 shadow-xl shadow-slate-900/10">
                  Talk to an Expert
                </button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="py-32 bg-slate-950 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeIn>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">Ready to scale your finance team?</h2>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">Join industry leaders who rely on PM Finance for seamless, secure, and highly skilled outsourcing.</p>
                <ul className="space-y-5 mb-10">
                  {["Rigorously tested accounting fundamentals", "Communication and culture-fit screening", "Bank-level data security protocols"].map((point, i) =>(
                    <li key={i} className="flex items-center text-slate-300 font-medium">
                      <CheckCircle className="w-6 h-6 text-cyan-400 mr-4 flex-shrink-0" /> {point}
                    </li>
                  ))}
                </ul>
                <button onClick={() => openAuth('register')} className="bg-white text-slate-950 px-8 py-4 rounded-full font-bold text-lg hover:bg-cyan-50 transition-all shadow-lg flex items-center">
                  Create Client Account <ArrowRight size={20} className="ml-2" />
                </button>
              </FadeIn>
            </div>
            <div className="relative">
               <FadeIn delay={200} direction="left">
                 <div className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] shadow-2xl">
                    <h3 className="text-2xl font-bold text-white mb-8 border-b border-slate-800 pb-4">Top Matches for "Tax Season"</h3>
                    <div className="space-y-6">
                      {TALENT_PROFILES.slice(0,3).map(profile => (
                        <div key={profile.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-slate-300">
                              <User size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-white">{profile.name}</div>
                              <div className="text-sm text-cyan-400">{profile.role}</div>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Match</div>
                             <div className="font-bold text-emerald-400">{profile.match}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               </FadeIn>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Blurred preview of the directory for unauthenticated users
function PreviewDirectoryView({ openAuth }) {
  return (
    <div className="pt-24 pb-32 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-950 mb-6">Global Talent Directory</h1>
            <p className="text-xl text-slate-600">Browse a snapshot of our highly vetted professional network.</p>
          </div>
        </FadeIn>

        <div className="relative">
          <FadeIn delay={200}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 blur-[5px] opacity-60 pointer-events-none select-none overflow-hidden h-[600px]">
              {TALENT_PROFILES.map((profile) => (
                <div key={profile.id} className="bg-white rounded-[24px] border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-slate-100 rounded-full"></div>
                    <div>
                      <div className="h-5 w-32 bg-slate-200 rounded mb-2"></div>
                      <div className="h-4 w-24 bg-slate-100 rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-3 mb-6">
                    <div className="h-4 w-full bg-slate-50 rounded"></div>
                    <div className="h-4 w-4/5 bg-slate-50 rounded"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-16 bg-slate-100 rounded-md"></div>
                    <div className="h-8 w-16 bg-slate-100 rounded-md"></div>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
          
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
            <FadeIn delay={400} className="bg-white/90 backdrop-blur-xl p-10 md:p-12 rounded-[32px] shadow-2xl border border-slate-200/50 max-w-xl mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-cyan-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-8 shadow-inner">
                <Lock size={32} />
              </div>
              <h3 className="text-3xl font-bold text-slate-950 mb-4 tracking-tight">Verified Client Access</h3>
              <p className="text-slate-600 text-lg mb-10 leading-relaxed">
                We fiercely protect our talent pool. Create a free enterprise account to view full resumes, unlock specific tooling filters, and interview candidates directly.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => openAuth('register')} className="bg-slate-950 hover:bg-indigo-600 text-white px-8 py-4 rounded-full font-bold transition-all shadow-xl shadow-slate-900/10">
                  Create Client Account
                </button>
                <button onClick={() => openAuth('login')} className="bg-white hover:bg-slate-50 text-slate-950 border-2 border-slate-200 px-8 py-4 rounded-full font-bold transition-all">
                  Log In
                </button>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgencyMarketingView({ openAuth }) {
  return (
    <div className="animate-in fade-in duration-700 bg-white">
      {/* Agency Header */}
      <div className="relative pt-24 pb-32 lg:pt-36 lg:pb-40 overflow-hidden bg-slate-950 text-white border-b border-slate-800">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-[0.05] bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            
            <div className="lg:w-3/5">
              <FadeIn delay={100}>
                <div className="inline-flex items-center bg-white/5 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-indigo-300 border border-white/10 mb-8 tracking-wider uppercase shadow-sm">
                  <Star className="w-4 h-4 text-amber-400 mr-2 fill-current" /> Premier Enterprise Partner
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
                  Precision Financials BPO
                </h1>
                <p className="text-slate-400 text-xl max-w-2xl mb-12 leading-relaxed">
                  Strategic financial guidance delivered by a dedicated pod of Philippine-based CPAs. We partner with US firms to handle busy-season compression and year-round close optimization.
                </p>

                <div className="flex flex-wrap gap-6 mb-12">
                  <div className="bg-white/5 backdrop-blur-md p-5 rounded-[24px] flex items-center border border-white/10 min-w-[200px]">
                    <MapPin className="text-cyan-400 w-8 h-8 mr-4" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Location</p>
                      <p className="font-bold text-white text-lg">Manila (BGC Hub)</p>
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md p-5 rounded-[24px] flex items-center border border-white/10 min-w-[200px]">
                    <Building className="text-cyan-400 w-8 h-8 mr-4" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Specialty</p>
                      <p className="font-bold text-white text-lg">Tax & Advisory</p>
                    </div>
                  </div>
                </div>

                <button onClick={() => openAuth('register')} className="bg-white text-slate-950 px-10 py-4 rounded-full font-bold text-lg hover:bg-indigo-50 transition-all shadow-xl shadow-white/10 flex items-center transform hover:-translate-y-1">
                  Contact Agency <ArrowRight size={20} className="ml-3 text-slate-400" />
                </button>
              </FadeIn>
            </div>

            <div className="lg:w-2/5 w-full">
              <FadeIn delay={300} direction="left">
                <div className="bg-slate-900/50 backdrop-blur-2xl p-10 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[50px] rounded-full"></div>
                  <h3 className="text-2xl font-bold mb-8 text-white relative z-10">Agency Capabilities</h3>
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-start">
                      <CheckCircle className="text-emerald-400 w-6 h-6 mr-4 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-300 text-base font-medium">100% CPA or equivalent qualified staff</p>
                    </div>
                    <div className="flex items-start">
                      <CheckCircle className="text-emerald-400 w-6 h-6 mr-4 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-300 text-base font-medium">US GAAP and IFRS compliant workflows</p>
                    </div>
                    <div className="flex items-start">
                      <CheckCircle className="text-emerald-400 w-6 h-6 mr-4 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-300 text-base font-medium">SOC 2 Type II Certified infrastructure</p>
                    </div>
                    <div className="flex items-start">
                      <CheckCircle className="text-emerald-400 w-6 h-6 mr-4 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-300 text-base font-medium">Dedicated account managers for client pods</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </div>

      {/* Engagement Models */}
      <div className="py-32 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeIn>
            <div className="text-center mb-20 max-w-3xl mx-auto">
              <div className="inline-flex mb-4 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider shadow-sm">
                Engagement Models
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-950 mb-6">Scale with structure</h2>
              <p className="text-slate-600 text-xl leading-relaxed">Choose the setup that fits your workload, rather than forcing your business into a rigid software subscription.</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
            {/* Model 1 */}
            <FadeIn delay={100} direction="up" className="h-full">
              <div className="bg-white rounded-[40px] shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col hover:shadow-2xl hover:border-indigo-200 hover:-translate-y-2 transition-all duration-500 p-10 h-full">
                <div className="mb-8">
                  <h3 className="text-3xl font-bold text-slate-950 mb-4">Dedicated Embedded Hire</h3>
                  <p className="text-lg text-slate-600 leading-relaxed mb-6">
                    Best for recurring workflows where you want one primary professional to own processes, reporting, and communication.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-950 tracking-tight">$1,500</span>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">/ mo</span>
                  </div>
                </div>
                <div className="flex-grow flex flex-col">
                  <ul className="space-y-5 mb-10 bg-slate-50 p-8 rounded-[24px] border border-slate-100 flex-grow">
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-base font-bold">Consistent ownership of recurring work</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-base font-bold">Direct communication via Slack/Teams</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-base font-bold">Billed at flat monthly rate</span>
                    </li>
                  </ul>
                  <button onClick={() => openAuth('register')} className="w-full bg-white border-2 border-slate-200 text-slate-950 hover:border-indigo-600 hover:text-indigo-600 hover:bg-indigo-50 py-4 rounded-full font-bold text-lg transition-all mt-auto">
                    Inquire Setup
                  </button>
                </div>
              </div>
            </FadeIn>

            {/* Model 2 */}
            <FadeIn delay={200} direction="up" className="h-full">
              <div className="bg-slate-950 rounded-[40px] shadow-2xl shadow-slate-900/30 border border-slate-800 overflow-hidden flex flex-col hover:shadow-indigo-900/20 hover:-translate-y-2 transition-all duration-500 relative p-10 h-full group">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-600/20 blur-[80px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-colors duration-700"></div>
                <div className="absolute top-8 right-8 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                  Most Popular
                </div>
                <div className="mb-8 pr-24 relative z-10">
                  <h3 className="text-3xl font-bold text-white mb-4">Managed Pod</h3>
                  <p className="text-lg text-slate-400 leading-relaxed mb-6">
                    Cross-functional teams managed by a senior CPA. Best for teams with multiple workflows needing backup coverage and QA.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tight">$3,600</span>
                    <span className="text-sm font-bold text-indigo-300 uppercase tracking-wider">/ mo</span>
                  </div>
                </div>
                <div className="flex-grow flex flex-col relative z-10">
                  <ul className="space-y-5 mb-10 bg-slate-900/50 p-8 rounded-[24px] border border-slate-800 backdrop-blur-md flex-grow">
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-cyan-400 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-200 text-base font-bold">Role-based accountability and QA</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-cyan-400 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-200 text-base font-bold">Built-in backup coverage (no downtime)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-cyan-400 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-200 text-base font-bold">Includes CPAs, Tax Prep, and Reviewers</span>
                    </li>
                  </ul>
                  <button onClick={() => openAuth('register')} className="w-full bg-white text-slate-950 hover:bg-indigo-50 py-4 rounded-full font-bold text-lg transition-all mt-auto shadow-xl shadow-white/10">
                    Draft a Pod Structure
                  </button>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  )
}

function PublicFooter({ navigateTo, openAuth }) {
  return (
    <footer className="bg-slate-950 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 border-b border-slate-800 pb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">PM</div>
              <div className="font-bold text-xl tracking-tight">PM Finance</div>
            </div>
            <p className="max-w-md text-slate-400 text-lg leading-relaxed">
              Elevating global finance outsourcing. Rigorously vetted CPAs and analysts from the Philippines, integrated seamlessly into your operations.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Platform</h4>
            <ul className="space-y-4 text-slate-400 font-medium">
              <li><button onClick={() => navigateTo('home')} className="hover:text-white transition-colors">Overview</button></li>
              <li><button onClick={() => navigateTo('talents')} className="hover:text-white transition-colors">Talent Directory</button></li>
              <li><button onClick={() => navigateTo('agency')} className="hover:text-white transition-colors">Enterprise Pods</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Connect</h4>
            <ul className="space-y-4 text-slate-400 font-medium">
              <li><button onClick={() => openAuth('register')} className="hover:text-white transition-colors">Book Discovery</button></li>
              <li><button onClick={() => openAuth('login')} className="hover:text-white transition-colors">Client Login</button></li>
              <li><button onClick={() => openAuth('register_pro')} className="hover:text-white transition-colors">Apply as Talent</button></li>
            </ul>
          </div>
        </div>
        <div className="text-slate-500 font-medium text-sm flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} PM Finance Global. All rights reserved.</p>
          <div className="flex space-x-8 mt-4 md:mt-0">
            <button className="hover:text-white transition-colors">Privacy</button>
            <button className="hover:text-white transition-colors">Terms</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ==========================================
// 2. CLIENT PORTAL (LOGGED IN EXPERIENCE)
// ==========================================
function ClientPortal({ user, onLogout }) {
  const [appView, setAppView] = useState('discover');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* App Header */}
      <header className="bg-slate-950 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* App Logo */}
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">
                PM
              </div>
              <span className="font-bold tracking-tight">Client Portal</span>
              
              {/* App Global Search */}
              <div className="hidden lg:flex items-center ml-8 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 focus-within:border-indigo-500 focus-within:bg-slate-800 transition-all w-96">
                <Search size={16} className="text-slate-400 mr-2" />
                <input type="text" placeholder="Search skills, profiles, or agencies..." className="bg-transparent outline-none text-sm text-white w-full placeholder-slate-500" />
              </div>
            </div>

            {/* App User Nav */}
            <div className="flex items-center gap-6">
              <button className="text-slate-400 hover:text-white relative transition-colors">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-white leading-tight">{user.name}</div>
                  <div className="text-xs text-slate-400 font-medium">{user.company}</div>
                </div>
                <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-full flex items-center justify-center font-bold text-white shadow-md cursor-pointer border-2 border-slate-800">
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
        <div className="bg-white border-b border-slate-200">
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
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${appView === tab.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                  {tab.label} {tab.count && <span className="ml-1.5 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{tab.count}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* App Workspace */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {appView === 'discover' && <AppDiscoverView />}
        {appView === 'agencies' && <AppAgenciesView />}
        {appView === 'shortlist' && <AppShortlistView />}
        {appView === 'interviews' && <AppInterviewsView />}
        {appView === 'billing' && <AppBillingView />}
      </div>

      {/* AI Matchmaker Feature */}
      <AITalentMatchmaker />
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
      <div className={`fixed bottom-8 right-8 w-[400px] h-[600px] max-h-[80vh] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        
        {/* Chat Header */}
        <div className="bg-slate-950 p-4 rounded-t-3xl flex justify-between items-center shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 blur-[30px] rounded-full pointer-events-none"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-cyan-400">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3' : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm'}`}>
                <p className="text-sm">{msg.text}</p>
                
                {/* AI Rendered Mini-Card Match */}
                {msg.matchData && (
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors group">
                    <div className="flex items-center gap-3 mb-3">
                       <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold shrink-0 group-hover:text-indigo-600 transition-colors">
                          {msg.type === 'agency' ? <Building size={16}/> : msg.matchData.name.charAt(0)}
                       </div>
                       <div>
                         <div className="font-bold text-slate-950 text-sm leading-tight">{msg.matchData.name}</div>
                         <div className="text-xs text-slate-500 font-medium">{msg.type === 'agency' ? msg.matchData.specialty : msg.matchData.role}</div>
                       </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Match!</div>
                      <div className="font-bold text-slate-950 text-sm">{msg.matchData.rate}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1">
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                 <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
               </div>
             </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <input 
              type="text" 
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Describe your needs..." 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button 
              type="submit" 
              disabled={!inputMsg.trim() || isTyping}
              className="w-12 h-12 bg-slate-950 text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

// Sub-views for Client Portal
function AppDiscoverView() {
  const [activeFilter, setActiveFilter] = useState('All');
  
  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start animate-in fade-in duration-500">
      
      {/* Sticky Advanced Filters Sidebar */}
      <div className="w-full lg:w-72 flex-shrink-0 sticky top-[150px]">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-950 flex items-center gap-2"><SlidersHorizontal size={18} className="text-indigo-600"/> Filters</h3>
            <button className="text-xs font-bold text-indigo-600 hover:underline">Reset</button>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Availability</h4>
              {['Immediate Start', 'Part-time OK', 'US Shift (EST)'].map((time, i) => (
                <label key={i} className="flex items-center space-x-3 mb-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${i === 0 ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400 bg-white'}`}>
                    {i === 0 && <CheckCircle size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-950 transition-colors">{time}</span>
                </label>
              ))}
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Primary Software</h4>
              {['QuickBooks Online', 'Xero', 'NetSuite', 'Oracle SAP'].map((software, i) => (
                <label key={i} className="flex items-center space-x-3 mb-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors border-slate-300 group-hover:border-indigo-400 bg-white`}></div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-950 transition-colors">{software}</span>
                </label>
              ))}
            </div>
            
            <div>
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Max Hourly Rate</h4>
              <input type="range" className="w-full accent-indigo-600" min="5" max="50" defaultValue="25" />
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
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="hidden sm:block text-sm font-bold text-slate-500">
            Showing {TALENT_PROFILES.length} profiles
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {TALENT_PROFILES.map((profile, idx) => (
            <FadeIn key={profile.id} delay={(idx % 6) * 50} direction="up" className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group flex flex-col h-full">
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 text-xl border border-slate-200">
                    {profile.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-950 group-hover:text-indigo-700 transition-colors leading-tight mb-1">{profile.name}</h3>
                    <p className="text-sm font-semibold text-slate-500">{profile.role}</p>
                  </div>
                </div>
                <button className="text-slate-300 hover:text-indigo-600 transition-colors p-1" title="Save to Shortlist">
                  <Bookmark fill="currentColor" className="w-6 h-6 opacity-40 hover:opacity-100" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6 flex-grow">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Experience</div>
                   <div className="font-bold text-sm text-slate-800 flex items-center"><Briefcase size={14} className="mr-1.5 text-slate-400"/> {profile.exp}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                   <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Availability</div>
                   <div className="font-bold text-sm text-slate-800 flex items-center"><Calendar size={14} className="mr-1.5 text-slate-400"/> {profile.available}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  {profile.tools.map(tool => (
                    <span key={tool} className="bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-auto">
                <div className="flex items-baseline">
                  <span className="text-2xl font-black text-slate-950 tracking-tight">{profile.rate}</span>
                  <span className="text-sm font-bold text-slate-400 ml-1">/hr</span>
                </div>
                <button className="bg-slate-950 text-white hover:bg-indigo-600 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center transform hover:-translate-y-0.5">
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
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 mb-2">Discover Enterprise Agencies</h2>
        <p className="text-slate-600">Browse fully-managed pods and BPO firms for large-scale financial operations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {AGENCIES.map((agency, idx) => (
          <FadeIn key={agency.id} delay={idx * 100} direction="up" className="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 flex flex-col h-full">
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-md border border-slate-800">
                <Building size={28} className="text-white" />
              </div>
              <div className="flex items-center bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">
                <Star size={12} className="mr-1 fill-current" /> {agency.rating}
              </div>
            </div>
            
            <h3 className="font-bold text-2xl text-slate-950 mb-2 leading-tight">{agency.name}</h3>
            <p className="text-sm font-bold text-indigo-600 mb-6">{agency.specialty}</p>

            <div className="space-y-4 mb-8 flex-grow">
              <div className="flex items-center text-sm font-medium text-slate-600">
                <MapPin size={16} className="mr-3 text-slate-400" /> {agency.location}
              </div>
              <div className="flex items-center text-sm font-medium text-slate-600">
                <User size={16} className="mr-3 text-slate-400" /> {agency.size}
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3">Certifications</div>
              <div className="flex flex-wrap gap-2">
                {agency.certs.map(cert => (
                  <span key={cert} className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Pricing</div>
                <div className="font-bold text-slate-950">{agency.rate}</div>
              </div>
              <button className="bg-white border-2 border-slate-200 hover:border-slate-950 text-slate-950 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
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
    <div className="animate-in fade-in duration-500 max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 mb-2">My Shortlist</h2>
        <p className="text-slate-600">Review and schedule interviews with your saved candidates.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {shortlisted.map((profile, idx) => (
          <FadeIn key={profile.id} delay={idx * 100} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col sm:flex-row gap-6 hover:shadow-lg transition-shadow">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-cyan-50 rounded-full flex items-center justify-center font-bold text-indigo-700 text-2xl border border-indigo-200">
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-950 leading-tight mb-1">{profile.name}</h3>
                  <p className="text-sm font-semibold text-indigo-600">{profile.role}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm font-medium text-slate-600">
                  <Briefcase size={16} className="mr-2 text-slate-400"/> {profile.exp} • Highly rated ({profile.rating})
                </div>
                <div className="flex items-center text-sm font-medium text-slate-600">
                  <Calendar size={16} className="mr-2 text-slate-400"/> Available: {profile.available}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                  {profile.tools.slice(0,3).map(tool => (
                    <span key={tool} className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md">
                      {tool}
                    </span>
                  ))}
              </div>
            </div>
            <div className="sm:border-l sm:border-slate-100 sm:pl-6 flex flex-col justify-between sm:w-48">
              <div className="text-right sm:text-left mb-4 sm:mb-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Hourly Rate</div>
                <div className="text-3xl font-black text-slate-950 tracking-tight">{profile.rate}</div>
              </div>
              <div className="space-y-2">
                <button className="w-full bg-slate-950 text-white hover:bg-indigo-600 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md">
                   Schedule
                </button>
                <button className="w-full bg-white text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 py-2.5 rounded-xl text-sm font-bold transition-colors">
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
    <div className="animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 mb-2">Interviews</h2>
          <p className="text-slate-600">Manage your upcoming candidate screenings.</p>
        </div>
        <button className="text-indigo-600 font-bold text-sm hover:underline flex items-center">
          Sync with Google Calendar
        </button>
      </div>

      <div className="space-y-4">
        {interviews.map((interview, idx) => (
          <FadeIn key={interview.id} delay={idx * 100} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm hover:border-indigo-300 transition-colors">
            <div className="flex items-center gap-6 w-full sm:w-auto">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Oct</span>
                <span className="text-xl font-black text-slate-900">{interview.date.split(' ')[2]}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-950 leading-tight mb-1">{interview.name}</h3>
                <p className="text-sm font-medium text-slate-500 mb-2">Interview for {interview.role}</p>
                <div className="flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md w-fit">
                  <Clock3 size={12} className="mr-1.5" /> {interview.time}
                </div>
              </div>
            </div>
            <div className="flex w-full sm:w-auto gap-3">
              <button className="flex-1 sm:flex-none bg-slate-950 text-white hover:bg-indigo-600 px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-md flex items-center justify-center">
                 Join Call <Video size={16} className="ml-2" />
              </button>
              <button className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 rounded-xl transition-colors">
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
    <div className="animate-in fade-in duration-500 max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 mb-2">Billing & Contracts</h2>
        <p className="text-slate-600">Manage your active pods, embedded hires, and payment methods.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Contracts */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-slate-900 text-lg">Active Contracts</h3>
          <FadeIn delay={100} className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
              <div>
                <div className="inline-flex items-center bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md mb-3">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span> Active
                </div>
                <h4 className="text-xl font-bold text-slate-950 mb-1">Managed Pod: Tax Season</h4>
                <p className="text-sm font-medium text-slate-500">Started on Jan 15, 2026</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-950">$3,600</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per Month</div>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Talent (3)</h5>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">NR</div>
                <div><p className="text-sm font-bold text-slate-900">Natasha Romanoff</p><p className="text-[10px] text-slate-500 uppercase tracking-wide">Senior Tax Accountant</p></div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">CB</div>
                <div><p className="text-sm font-bold text-slate-900">Clint Barton</p><p className="text-[10px] text-slate-500 uppercase tracking-wide">Tax Preparer</p></div>
              </div>
            </div>

            <div className="flex gap-4">
              <button className="bg-slate-950 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-600 transition-colors">View Contract</button>
              <button className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Request Change</button>
            </div>
          </FadeIn>
        </div>

        {/* Payment & Invoices */}
        <div className="space-y-8">
          <FadeIn delay={200}>
            <h3 className="font-bold text-slate-900 text-lg mb-6">Payment Method</h3>
            <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[30px] rounded-full"></div>
              <CreditCard className="text-indigo-400 w-8 h-8 mb-8" />
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
            <button className="w-full mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-800">Update payment method</button>
          </FadeIn>

          <FadeIn delay={300}>
            <h3 className="font-bold text-slate-900 text-lg mb-6">Recent Invoices</h3>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {[
                { id: "INV-2026-03", date: "Mar 1, 2026", amount: "$3,600.00" },
                { id: "INV-2026-02", date: "Feb 1, 2026", amount: "$3,600.00" },
                { id: "INV-2026-01", date: "Jan 15, 2026", amount: "$1,800.00" },
              ].map((inv, i) => (
                <div key={inv.id} className={`flex items-center justify-between p-4 ${i !== 2 ? 'border-b border-slate-100' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-50 p-2 rounded-lg"><Receipt size={16} className="text-slate-500"/></div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{inv.id}</div>
                      <div className="text-xs font-medium text-slate-500">{inv.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900">{inv.amount}</span>
                    <button className="text-slate-400 hover:text-indigo-600 transition-colors"><Download size={16}/></button>
                  </div>
                </div>
              ))}
              <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                <button className="text-xs font-bold text-slate-600 hover:text-slate-900 uppercase tracking-wider">View All History</button>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. PROFESSIONAL PORTAL (TALENT EXPERIENCE)
// ==========================================
function ProfessionalPortal({ user, onLogout }) {
  const [appView, setAppView] = useState('profile');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* App Header */}
      <header className="bg-slate-950 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* App Logo */}
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">
                PM
              </div>
              <span className="font-bold tracking-tight">Talent</span>
            </div>

            {/* App User Nav */}
            <div className="flex items-center gap-6">
              <button className="text-slate-400 hover:text-white relative transition-colors">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-white leading-tight">{user.name}</div>
                  <div className="text-xs text-slate-400 font-medium">{user.title}</div>
                </div>
                <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-indigo-400 rounded-full flex items-center justify-center font-bold text-white shadow-md cursor-pointer border-2 border-slate-800">
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
        <div className="bg-white border-b border-slate-200">
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
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${appView === tab.id ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
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
    <div className="flex flex-col lg:flex-row gap-8 items-start animate-in fade-in duration-500 max-w-6xl">
      {/* Left Column: Quick Profile Card */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-950 h-24"></div>
          <div className="p-6 relative">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-indigo-50 rounded-2xl border-4 border-white flex items-center justify-center font-bold text-cyan-700 text-3xl absolute -top-10 shadow-sm">
              {user.name.charAt(0)}
            </div>
            
            <div className="mt-12 mb-6">
              <h2 className="text-xl font-bold text-slate-950 leading-tight">{user.name}</h2>
              <p className="text-sm font-medium text-slate-500 mb-4">{user.title}</p>
              
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2 font-medium">
                <MapPin size={16} className="text-slate-400" /> {user.location}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium mb-6">
                <Star size={16} className="text-amber-500 fill-current" /> {user.rating} Average Rating
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Availability Status</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
                <select className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:border-cyan-500">
                  <option>Available Now</option>
                  <option>Available in 2 Weeks</option>
                  <option>Not Available</option>
                </select>
              </div>

              <button className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 py-2.5 rounded-xl text-sm font-bold transition-colors">
                 <Settings size={16} /> Account Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Detailed Profile Form/View */}
      <div className="flex-1 w-full space-y-6">
        <FadeIn>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-950">Professional Bio</h3>
              <button className="text-cyan-600 font-bold text-sm hover:underline">Edit</button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Highly detail-oriented Payroll Specialist with 4+ years of experience managing complex payroll cycles using Gusto and ADP for US-based clients. Adept at navigating multi-state compliance, tax withholdings, and benefits administration.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-950">Rates & Skills</h3>
              <button className="text-cyan-600 font-bold text-sm hover:underline">Edit</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Current Hourly Rate</div>
                <div className="text-3xl font-black text-slate-950 tracking-tight">$9.00 <span className="text-sm font-bold text-slate-400">/hr</span></div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Total Experience</div>
                <div className="text-lg font-bold text-slate-950">4 Years</div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Software Stack</div>
              <div className="flex flex-wrap gap-2">
                {['Gusto', 'ADP', 'QuickBooks Online', 'Excel', 'G-Suite'].map(tool => (
                  <span key={tool} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm px-3 py-1.5 rounded-lg font-bold">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-8 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-emerald-950 text-lg mb-1 flex items-center gap-2"><CheckSquare size={18} className="text-emerald-600"/> Profile Approved</h3>
              <p className="text-emerald-800 text-sm font-medium">Your profile has passed screening and is visible to Enterprise clients.</p>
            </div>
            <button className="bg-white text-emerald-700 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm border border-emerald-200 hover:bg-emerald-100 transition-colors">
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
    <div className="animate-in fade-in duration-500 max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-950 mb-2">Opportunities</h2>
        <p className="text-slate-600">Review invitations to interview and active client matches.</p>
      </div>

      <div className="space-y-6">
        {invites.map((invite, idx) => (
          <FadeIn key={invite.id} delay={idx * 100} className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row gap-6 justify-between">
            <div>
              <div className="inline-flex items-center bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md mb-4">
                Interview Invite
              </div>
              <h3 className="font-bold text-xl text-slate-950 mb-1">{invite.role}</h3>
              <p className="text-sm font-semibold text-slate-500 flex items-center gap-2 mb-6">
                <Building size={16}/> {invite.company}
              </p>
              <div className="flex gap-6 text-sm font-bold text-slate-700">
                <div className="flex items-center gap-2"><Clock3 size={16} className="text-slate-400"/> {invite.duration}</div>
                <div className="flex items-center gap-2"><DollarSign size={16} className="text-slate-400"/> {invite.rate}</div>
              </div>
            </div>
            
            <div className="md:border-l md:border-slate-100 md:pl-6 flex flex-col justify-center gap-3 md:w-48">
              <div className="text-xs text-slate-400 font-bold mb-2 text-center md:text-left">{invite.date}</div>
              <button className="w-full bg-slate-950 text-white hover:bg-cyan-600 py-3 rounded-xl text-sm font-bold transition-colors shadow-md">
                 Accept Invite
              </button>
              <button className="w-full bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 py-3 rounded-xl text-sm font-bold transition-colors">
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
    <div className="animate-in fade-in duration-500 max-w-6xl">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 mb-2">Timesheets & Earnings</h2>
          <p className="text-slate-600">Track your logged hours and manage your payouts.</p>
        </div>
        <button className="bg-slate-950 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-600 transition-colors shadow-md">
          Withdraw Funds
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <FadeIn delay={100}>
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Available to Withdraw</div>
            <div className="text-4xl font-black text-slate-950 tracking-tight">$720.00</div>
          </div>
        </FadeIn>
        <FadeIn delay={150}>
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pending (In Review)</div>
            <div className="text-4xl font-black text-slate-950 tracking-tight text-slate-400">$360.00</div>
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-950 text-lg">Recent Timesheets</h3>
          <button className="text-sm font-bold text-cyan-600 hover:underline">View All</button>
        </div>
        {[
          { period: "Oct 12 - Oct 18, 2025", hours: "40:00", amount: "$360.00", status: "Approved" },
          { period: "Oct 05 - Oct 11, 2025", hours: "40:00", amount: "$360.00", status: "Paid" },
          { period: "Sep 28 - Oct 04, 2025", hours: "38:30", amount: "$346.50", status: "Paid" },
        ].map((sheet, i) => (
          <div key={i} className={`flex items-center justify-between p-6 ${i !== 2 ? 'border-b border-slate-100' : ''}`}>
            <div>
              <div className="font-bold text-slate-900 mb-1">{sheet.period}</div>
              <div className="text-sm font-medium text-slate-500">{sheet.hours} logged</div>
            </div>
            <div className="text-right">
              <div className="font-black text-lg text-slate-950">{sheet.amount}</div>
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