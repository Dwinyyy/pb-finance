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
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { FAQ_ITEMS, MATCHING_WORKFLOW, PROCESS_STEPS, SERVICE_CARDS } from '../data/staticContent';
import { SKILLS_OPTIONS } from '../data/constants';
import FadeIn from '../components/FadeIn';
import { motion as Motion } from 'framer-motion';
import { Button } from '../components/ui/Button';

const asList = (value) => (Array.isArray(value) ? value : []);

// ==========================================
// 1. PUBLIC MARKETING SITE
// ==========================================
export function PublicSite({ openAuth, isDarkMode, toggleDarkMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 100 && currentScrollY > lastScrollY.current) {
         setIsNavVisible(false);
      } else {
         setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);



  const getActiveTab = () => {
    if (location.pathname === '/talents') return 'talents';
    if (location.pathname === '/agency') return 'agency';
    if (location.pathname === '/pricing') return 'pricing';
    return 'home';
  };
  const activeTab = getActiveTab();
  const navItems = [
    { id: 'home', label: 'Overview' },
    { id: 'talents', label: 'Directory' },
    { id: 'agency', label: 'Enterprise' },
    { id: 'pricing', label: 'Pricing' },
  ];

  const navigateTo = (tab) => {
    const path = tab === 'home' ? '/' : `/${tab}`;
    navigate(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMobileAuth = (view) => {
    setMobileMenuOpen(false);
    openAuth(view);
  };

  return (
    <>
      <Motion.nav initial={{y:0}} animate={{y: isNavVisible ? 0 : '-100%'}} transition={{duration: 0.3}} className="bg-white dark:bg-slate-900/90 backdrop-blur-xl fixed w-full top-0 z-50 border-b border-slate-200 dark:border-slate-800/80 transition-colors text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 md:h-20 items-center">
            <div className="flex items-center cursor-pointer gap-3" onClick={() => navigateTo('home')}>
              <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white font-bold text-base md:text-lg shadow-lg shadow-primary-500/20">
                PB
              </div>
              <div>
                <div className="text-lg font-bold text-slate-950 dark:text-white tracking-tight leading-none mb-0.5">PB Finance</div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => navigateTo(tab.id)} 
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === tab.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {tab.label}
                </button>
              ))}
              
              <button onClick={toggleDarkMode} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2" aria-label="Toggle dark mode">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <div className="flex items-center space-x-4 pl-4 ml-2 border-l border-slate-200 dark:border-slate-800">
                <button onClick={() => openAuth('login')} className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-colors">Client Login</button>
                {activeTab !== 'home' && (
                  <button onClick={() => openAuth('register')} className="bg-slate-950 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                    Start Hiring
                  </button>
                )}
              </div>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button onClick={toggleDarkMode} className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle dark mode">
                {isDarkMode ? <Sun size={21} /> : <Moon size={21} />}
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle navigation menu" aria-expanded={mobileMenuOpen}>
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl absolute w-full z-50">
            <div className="px-4 pt-4 pb-6 space-y-2">
              {navItems.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => navigateTo(tab.id)}
                  className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold ${activeTab === tab.id ? 'bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {tab.id === 'agency' ? 'Enterprise Teams' : tab.label}
                </button>
              ))}
              <button onClick={toggleDarkMode} className="flex w-full items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid gap-2">
                <button onClick={() => openMobileAuth('login')} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl text-sm font-bold">Client Login</button>
                {activeTab !== 'home' && (
                  <button onClick={() => openMobileAuth('register')} className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl text-sm font-bold">Start Hiring</button>
                )}
              </div>
            </div>
          </div>
        )}
      </Motion.nav>

      <main className="min-h-screen pt-16 md:pt-20">
        <Routes>
          <Route path="/" element={<HomeMarketingView navigateTo={navigateTo} openAuth={openAuth} />} />
          <Route path="/talents" element={<PreviewDirectoryView navigateTo={navigateTo} openAuth={openAuth} />} />
          <Route path="/agency" element={<AgencyMarketingView openAuth={openAuth} />} />
          <Route path="/pricing" element={<PricingView openAuth={openAuth} />} />
          <Route path="*" element={
            <div className="pt-32 pb-20 text-center flex flex-col items-center justify-center min-h-[50vh]">
              <h1 className="text-4xl font-bold text-slate-950 dark:text-white mb-4">404 - Page Not Found</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">The page you are looking for doesn't exist or has been moved.</p>
              <button onClick={() => navigateTo('home')} className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-full font-bold transition-colors">
                Return Home
              </button>
            </div>
          } />
        </Routes>
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
    <section className="py-32 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <FadeIn>
            <div className="inline-flex mb-4 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 shadow-sm uppercase tracking-wider">
              Savings Calculator
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl mb-6">
              Estimate the cost difference
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xl mb-12 leading-relaxed">
              See the business case in numbers you actually care about: total cost, overlap, and practical staffing flexibility without sacrificing quality.
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950 dark:text-white">2-4 wks</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Typical launch timeline</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950 dark:text-white">30-45%</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Average cost savings</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950 dark:text-white">5+ hrs</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Daily timezone overlap</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950 dark:text-white">Role-based</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Flexible team design</div>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={200} direction="left">
          <div className="rounded-[32px] border border-white/60 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 md:p-10 shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/50 backdrop-blur-xl">
            <div className="grid gap-8">
              {/* Sliders */}
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
                  <span>Annual local salary</span>
                  <span className="text-slate-950 dark:text-white text-xl">${salary.toLocaleString()}</span>
                </div>
                <input type="range" min="35000" max="160000" step="5000" value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
                  <span>Benefits and overhead (%)</span>
                  <span className="text-slate-950 dark:text-white text-xl">{benefits}%</span>
                </div>
                <input type="range" min="5" max="35" step="1" value={benefits} onChange={(e) => setBenefits(Number(e.target.value))} className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
                  <span>Monthly outsourced cost</span>
                  <span className="text-slate-950 dark:text-white text-xl">${vendorFee.toLocaleString()}</span>
                </div>
                <input type="range" min="1200" max="9000" step="100" value={vendorFee} onChange={(e) => setVendorFee(Number(e.target.value))} className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600" />
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 py-5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <div>
                  <div className="font-bold text-slate-950 dark:text-white text-sm">Include manager onboarding cost</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">Useful if local hires need more oversight</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setNeedManager(!needManager)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${needManager ? 'bg-primary-600' : 'bg-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white dark:bg-slate-900 shadow-sm ring-0 transition duration-300 ease-in-out ${needManager ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Results */}
              <div className="grid gap-4 md:grid-cols-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-5 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">In-house Annual</div>
                  <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">${Math.round(data.inHouse).toLocaleString()}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-5 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Outsourced Annual</div>
                  <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">${Math.round(data.outsourced).toLocaleString()}</div>
                </div>
                <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-xl transform transition-transform hover:scale-105 hover:-translate-y-1 duration-300">
                  <div className="text-[10px] text-primary-300 font-bold uppercase tracking-wider">Estimated Savings</div>
                  <div className="mt-2 text-2xl font-black text-white">${Math.round(data.savings).toLocaleString()}</div>
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-5 border border-emerald-100 flex items-start gap-4">
                <TrendingDown className="h-6 w-6 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-emerald-800 dark:text-emerald-400 text-sm">Estimated savings rate: {data.percent}%</div>
                  <p className="text-xs font-medium leading-relaxed text-emerald-700 dark:text-emerald-400 mt-1.5">
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
      {FAQ_ITEMS.map((item, index) => (
        <div key={index} className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all hover:border-slate-300">
          <button 
            className="w-full flex justify-between items-center p-5 text-left focus:outline-none"
            onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
          >
            <span className="font-bold text-slate-900 dark:text-slate-50 pr-4">{item.q}</span>
            {openIndex === index ? (
              <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300" />
            )}
          </button>
          <div 
            className={`px-5 text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-40 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            {item.a}
          </div>
        </div>
      ))}
    </div>
  );
}

const DIRECTORY_PREVIEW_PROFILES = [
  {
    code: 'CPA-214',
    title: 'Senior CPA',
    rate: '$24/hr',
    availability: 'Immediate Start',
    overlap: 'US EST overlap',
    credentials: 'CPA equivalent, 8 yrs',
    skills: ['Tax', 'Audit'],
    tools: ['QuickBooks', 'Xero', 'Tax'],
  },
  {
    code: 'CTL-089',
    title: 'Financial Controller',
    rate: '$38/hr',
    availability: '2 weeks',
    overlap: 'US/Pacific overlap',
    credentials: 'Month-end close lead',
    skills: ['Financial Reporting', 'Budgeting'],
    tools: ['NetSuite', 'Excel', 'Power BI'],
  },
  {
    code: 'FPA-441',
    title: 'FP&A Analyst',
    rate: '$28/hr',
    availability: 'Part-time OK',
    overlap: 'UK/Europe overlap',
    credentials: 'Forecasting, dashboards',
    skills: ['FP&A', 'Budgeting'],
    tools: ['Tableau', 'Excel', 'Oracle SAP'],
  },
  {
    code: 'TAX-117',
    title: 'Senior Tax Preparer',
    rate: '$22/hr',
    availability: '3-4 weeks',
    overlap: 'Tax season coverage',
    credentials: 'US tax workflow support',
    skills: ['Tax', 'Advisory'],
    tools: ['Tax', 'QuickBooks', 'Excel'],
  },
  {
    code: 'BKK-530',
    title: 'Full-charge Bookkeeper',
    rate: '$16/hr',
    availability: 'Immediate Start',
    overlap: 'Daily close window',
    credentials: 'AP, AR, reconciliations',
    skills: ['Bookkeeping', 'Payroll'],
    tools: ['Xero', 'Payroll', 'QuickBooks'],
  },
  {
    code: 'NSC-302',
    title: 'NetSuite Consultant',
    rate: '$42/hr',
    availability: '1-2 weeks',
    overlap: 'Project-based',
    credentials: 'ERP cleanup and reporting',
    skills: ['Financial Reporting', 'Advisory'],
    tools: ['NetSuite', 'Reporting', 'Excel'],
  },
];

const DIRECTORY_FILTERS = ['All', ...SKILLS_OPTIONS];
const directoryProfileMatchesFilter = (profile, activeFilter) => {
  if (activeFilter === 'All') return true;

  const normalizedFilter = activeFilter.toLowerCase();
  const searchableValues = [
    profile.title,
    profile.credentials,
    ...asList(profile.skills),
    ...asList(profile.tools),
  ];

  return searchableValues.some((value) => String(value || '').toLowerCase().includes(normalizedFilter));
};

const DIRECTORY_UNLOCKS = [
  'Full verified resumes and work history',
  'Tool-specific filters and hourly rate ranges',
  'Shortlist, interview requests, and status tracking',
];

const POD_USE_CASES = [
  {
    icon: Calculator,
    title: 'Month-end close pod',
    text: 'Close calendar, reconciliations, flux analysis, reporting packs, and review-ready documentation.',
  },
  {
    icon: Receipt,
    title: 'Tax season capacity',
    text: 'Preparer and reviewer coverage for seasonal volume, document follow-up, and deadline management.',
  },
  {
    icon: BarChart3,
    title: 'FP&A and reporting desk',
    text: 'Forecast refreshes, board metrics, KPI dashboards, variance analysis, and management reporting.',
  },
];

const POD_SETUP_STEPS = [
  'Map workflows and systems',
  'Assign primary owner and backup',
  'Launch pilot with QA checkpoints',
  'Scale coverage by role',
];

const PRICING_DECISION_GUIDE = [
  {
    title: 'Start with Platform Access',
    text: 'Best when you want to evaluate individual professionals and run a focused interview process.',
    points: ['Browse vetted profiles', 'Shortlist candidates', 'Request interviews'],
  },
  {
    title: 'Move to Enterprise Pods',
    text: 'Best when the work spans multiple roles, requires backup coverage, or needs ongoing QA.',
    points: ['Role-based team design', 'Managed onboarding', 'Accountability and review cadence'],
  },
];

function HomeMarketingView({ navigateTo, openAuth }) {
  const audiencePaths = [
    {
      icon: Briefcase,
      label: 'Hire Talent',
      text: 'Browse vetted CPAs and analysts',
      action: () => navigateTo('talents'),
    },
    {
      icon: Layers3,
      label: 'Build a Pod',
      text: 'See managed finance teams',
      action: () => navigateTo('agency'),
    },
    {
      icon: User,
      label: 'Apply as Talent',
      text: 'Join the PB network',
      action: () => openAuth('register_pro'),
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-10 pb-12 sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-16 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-50"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <FadeIn delay={100}>
            <div className="inline-flex items-center mb-5 rounded-full border border-primary-200 bg-white dark:bg-slate-900/60 backdrop-blur px-4 py-2 text-xs sm:text-sm font-semibold text-primary-800 dark:text-primary-300 shadow-sm">
              <Sparkles className="mr-2 h-4 w-4 text-primary-500" /> Redefining Global Finance Outsourcing
            </div>
          </FadeIn>
          
          <FadeIn delay={200}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-950 dark:text-white tracking-tight leading-[1.04] mb-5 max-w-5xl">
              Elite financial talent, seamlessly integrated into your <span className="bg-gradient-to-r from-primary-600 to-cyan-500 bg-clip-text text-transparent">operations.</span>
            </h1>
          </FadeIn>
          
          <FadeIn delay={300}>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-6 leading-relaxed">
              We connect scaling companies with top-tier, rigorously vetted CPAs and analysts from the Philippines. Scale your capacity without compromising on quality.
            </p>
          </FadeIn>

          <FadeIn delay={400} className="w-full max-w-2xl flex justify-center mb-5">
            <Button variant="primary" size="lg" onClick={() => openAuth('register')} className="w-full sm:w-auto shadow-xl shadow-primary-900/10">
              Start Building Your Team
            </Button>
          </FadeIn>

        </div>
      </section>

      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="relative z-20 mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <FadeIn delay={100} className="-mt-7 flex w-full gap-3 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-3 sm:overflow-visible">
            {audiencePaths.map((path) => {
              const Icon = path.icon;

              return (
                <button
                  key={path.label}
                  onClick={path.action}
                  className="flex min-w-[230px] flex-1 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-center shadow-sm transition-all hover:border-primary-200 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:bg-slate-900"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-primary-600">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-slate-950 dark:text-white">{path.label}</span>
                    <span className="block text-xs font-semibold leading-snug text-slate-500 dark:text-slate-400">{path.text}</span>
                  </span>
                </button>
              );
            })}
          </FadeIn>

          {/* Value Props Bar */}
          <FadeIn delay={200} hover={true} className="mt-4 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-3 md:p-4 border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40 flex gap-3 overflow-x-auto scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible md:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="flex min-w-[190px] items-center justify-center gap-3 py-2 md:px-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0"><ShieldCheck size={20}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 dark:text-white text-sm">Top 1% Talent</p><p className="text-xs font-medium text-slate-500">Rigorously vetted</p></div>
            </div>
            <div className="flex min-w-[190px] items-center justify-center gap-3 py-2 md:px-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0"><Globe2 size={20}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 dark:text-white text-sm">US/UK GAAP</p><p className="text-xs font-medium text-slate-500">Fully compliant</p></div>
            </div>
            <div className="flex min-w-[190px] items-center justify-center gap-3 py-2 md:px-4">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 flex-shrink-0"><TrendingDown size={20}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 dark:text-white text-sm">40%+ Savings</p><p className="text-xs font-medium text-slate-500">Optimized ROI</p></div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Dynamic Scrolling Sections */}
      <section className="py-24 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-6">Designed for sophisticated financial workflows</h2>
              <p className="text-xl text-slate-600 dark:text-slate-400">Beyond basic bookkeeping. We provide strategic coverage for your most critical financial operations.</p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {SERVICE_CARDS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <FadeIn key={idx} delay={idx * 100} direction="up">
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 md:p-10 hover:bg-white dark:hover:bg-slate-900 hover:shadow-2xl hover:shadow-primary-500/5 hover:-translate-y-2 transition-all duration-500 group">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-8 group-hover:bg-primary-600 group-hover:border-primary-600 transition-colors duration-500 shadow-sm">
                      <Icon className="w-8 h-8 text-slate-700 dark:text-slate-300 group-hover:text-white transition-colors duration-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-950 dark:text-white mb-4 tracking-tight">{item.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <ROICalculator />

      {/* Process & FAQ Section */}
      <section className="py-32 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16">
          <div>
            <FadeIn>
              <div className="inline-flex mb-4 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Process
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-10">
                Built for structured onboarding
              </h2>
              
              <div className="space-y-4">
                {PROCESS_STEPS.map((step, index) => (
                  <div key={step.title} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-6 rounded-[24px] hover:shadow-lg transition-all duration-300">
                    <div className="flex gap-5">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-sm font-black text-primary-700 dark:text-primary-300 shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-2">{step.title}</h3>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{step.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
          
          <div>
            <FadeIn delay={200}>
              <div className="inline-flex mb-4 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 md:hidden uppercase tracking-wider">
                FAQ
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-10 hidden md:block">
                Frequently asked questions
              </h2>
              <FAQAccordion />
              
              <div className="mt-12 bg-gradient-to-br from-primary-50 to-cyan-50 dark:from-slate-800 dark:to-slate-800 border border-primary-100 dark:border-slate-700 rounded-[32px] p-10 text-center shadow-sm">
                <h3 className="text-2xl font-bold text-slate-950 dark:text-white mb-4">Still have questions?</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg mb-8 max-w-sm mx-auto">Schedule a brief call to see how we can map a solution to your exact workflow.</p>
                <button onClick={() => navigateTo('pricing')} className="bg-slate-950 text-white px-10 py-4 rounded-full text-base font-bold hover:bg-primary-600 transition-transform transform hover:-translate-y-1 shadow-xl shadow-slate-900/10">
                  View Pricing
                </button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="py-32 bg-slate-950 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeIn>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">Ready to scale your finance team?</h2>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">Join industry leaders who rely on PB Finance for seamless, secure, and highly skilled outsourcing.</p>
                <ul className="space-y-5 mb-10">
                  {["Rigorously tested accounting fundamentals", "Communication and culture-fit screening", "Bank-level data security protocols"].map((point, i) =>(
                    <li key={i} className="flex items-center text-slate-300 font-medium">
                      <CheckCircle className="w-6 h-6 text-cyan-400 mr-4 flex-shrink-0" /> {point}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigateTo('talents')} className="bg-white text-slate-950 px-8 py-4 rounded-full font-bold text-lg hover:bg-cyan-50 transition-all shadow-lg flex items-center">
                  Preview Directory <ArrowRight size={20} className="ml-2" />
                </button>
              </FadeIn>
            </div>
            <div className="relative">
               <FadeIn delay={200} direction="left">
                 <div className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] shadow-2xl">
                    <h3 className="text-2xl font-bold text-white mb-8 border-b border-slate-800 pb-4">Secure Matching Workflow</h3>
                    <div className="space-y-6">
                      {MATCHING_WORKFLOW.map((item) => (
                        <div key={item.title} className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-slate-300">
                              <User size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-white">{item.title}</div>
                              <div className="text-sm text-cyan-400">Structured and review-ready</div>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Status</div>
                             <div className="font-bold text-emerald-400">{item.label}</div>
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

// Public preview of the directory for unauthenticated users
function PreviewDirectoryView({ navigateTo, openAuth }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const filteredPreviewProfiles = useMemo(
    () => DIRECTORY_PREVIEW_PROFILES.filter((profile) => directoryProfileMatchesFilter(profile, activeFilter)),
    [activeFilter]
  );

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <section className="pt-16 pb-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <FadeIn>
              <div>
                <div className="inline-flex mb-5 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 dark:border-primary-900/50 dark:bg-primary-950/30 dark:text-primary-300">
                  Talent Directory Preview
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-5">
                  See the roles, rates, and readiness before you sign in.
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed mb-8">
                  Preview anonymized finance profiles with the same signals clients use to shortlist: role fit, tools, availability, overlap, and estimated rate.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="primary" size="lg" onClick={() => openAuth('register')} className="w-full sm:w-auto">
                    Unlock Full Directory
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => openAuth('login')} className="w-full sm:w-auto bg-white dark:bg-slate-800">
                    Client Login
                  </Button>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={150} direction="left">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['120+', 'Finance professionals'],
                  ['5+ hrs', 'Timezone overlap'],
                  ['24-72h', 'Shortlist turnaround'],
                  ['Role-fit', 'Credential screening'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="py-10">
          <FadeIn>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-h-12 flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-800 dark:bg-slate-950">
                  <Search size={18} className="mr-3 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-500">Search by role, software, shift, or credential</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:pb-0">
                  {DIRECTORY_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold ${
                        activeFilter === filter
                          ? 'border-slate-950 bg-slate-950 text-white dark:border-primary-500 dark:bg-primary-600'
                          : 'border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {filteredPreviewProfiles.map((profile, index) => (
              <FadeIn key={profile.code} delay={(index % 6) * 60} direction="up" hover={true} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white dark:bg-primary-600">
                      {profile.code.split('-')[0]}
                    </div>
                    <div>
                      <h3 className="text-lg font-black leading-tight text-slate-950 dark:text-white">{profile.title}</h3>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{profile.code} verified preview</p>
                    </div>
                  </div>
                  <Lock size={18} className="text-slate-300 dark:text-slate-600" />
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rate</div>
                    <div className="mt-1 text-base font-black text-slate-950 dark:text-white">{profile.rate}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Availability</div>
                    <div className="mt-1 text-sm font-black text-slate-950 dark:text-white">{profile.availability}</div>
                  </div>
                </div>

                <div className="space-y-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={16} className="text-emerald-500" />
                    {profile.credentials}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 size={16} className="text-primary-500" />
                    {profile.overlap}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {[...new Set([...asList(profile.skills), ...asList(profile.tools)])].map((tool) => (
                    <span key={tool} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      {tool}
                    </span>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Full resume unlocks after client signup
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        <section className="pb-24">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
            <FadeIn>
              <div className="h-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                  <Lock size={24} />
                </div>
                <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Verified client access protects the talent pool.</h2>
                <p className="mb-8 text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                  Public previews stay anonymized. Approved client accounts can view full profiles, save candidates, and request interviews from the portal.
                </p>
                <Button variant="outline" size="md" onClick={() => navigateTo('pricing')} className="w-full sm:w-auto bg-white dark:bg-slate-800">
                  View Pricing
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={150} direction="left">
              <div className="h-full rounded-3xl border border-slate-200 bg-slate-950 p-8 text-white shadow-xl dark:border-slate-800">
                <h3 className="mb-6 text-xl font-black">What unlocks after signup</h3>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  {DIRECTORY_UNLOCKS.map((item, index) => (
                    <div key={item} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                        {index + 1}
                      </div>
                      <div className="text-sm font-bold leading-relaxed text-slate-200">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      </div>
    </div>
  );
}

function AgencyMarketingView({ openAuth }) {
  return (
    <div className="animate-in fade-in duration-700 bg-white dark:bg-slate-900">
      {/* Agency Header */}
      <div className="relative pt-24 pb-32 lg:pt-36 lg:pb-40 overflow-hidden bg-slate-950 text-white border-b border-slate-800">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-[0.05] bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary-600/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            
            <div className="lg:w-3/5">
              <FadeIn delay={100}>
                <div className="inline-flex items-center bg-white/5 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-primary-300 border border-white/10 mb-8 tracking-wider uppercase shadow-sm">
                  <Star className="w-4 h-4 text-amber-400 mr-2 fill-current" /> Enterprise Finance Delivery
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
                  Managed finance pods
                </h1>
                <p className="text-slate-400 text-xl max-w-2xl mb-12 leading-relaxed">
                  Strategic finance support delivered by role-based teams with clear capabilities, availability, and engagement history.
                </p>

                <div className="flex flex-wrap gap-6 mb-12">
                  <div className="bg-white/5 backdrop-blur-md p-5 rounded-[24px] flex items-center border border-white/10 min-w-[200px]">
                    <MapPin className="text-cyan-400 w-8 h-8 mr-4" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Location</p>
                      <p className="font-bold text-white text-lg">Philippines Hubs</p>
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md p-5 rounded-[24px] flex items-center border border-white/10 min-w-[200px]">
                    <Building className="text-cyan-400 w-8 h-8 mr-4" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Specialty</p>
                      <p className="font-bold text-white text-lg">Tax, Close, Reporting</p>
                    </div>
                  </div>
                </div>

                <button onClick={() => openAuth('register')} className="bg-white text-slate-950 px-10 py-4 rounded-full font-bold text-lg hover:bg-primary-50 transition-all shadow-xl shadow-white/10 flex items-center transform hover:-translate-y-1">
                  Contact Agency <ArrowRight size={20} className="ml-3 text-slate-400" />
                </button>
              </FadeIn>
            </div>

            <div className="lg:w-2/5 w-full">
              <FadeIn delay={300} direction="left">
                <div className="bg-slate-900/50 backdrop-blur-2xl p-10 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 blur-[50px] rounded-full"></div>
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

      <section className="py-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <FadeIn>
              <div>
                <div className="inline-flex mb-4 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Pod Design Preview
                </div>
                <h2 className="mb-5 text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">
                  Pick the finance workload. We shape the team around it.
                </h2>
                <p className="mb-8 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                  Enterprise clients need more than resumes. They need coverage, ownership, QA, and a clean handoff from scope to recurring execution.
                </p>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-500">Setup Path</h3>
                  <div className="space-y-3">
                    {POD_SETUP_STEPS.map((step, index) => (
                      <div key={step} className="flex items-center gap-3 rounded-2xl bg-white p-3 dark:bg-slate-900">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white dark:bg-primary-600">
                          {index + 1}
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>

            <div className="grid gap-5">
              {POD_USE_CASES.map((item, index) => {
                const Icon = item.icon;

                return (
                  <FadeIn key={item.title} delay={index * 90} direction="left">
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex gap-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                          <Icon size={24} />
                        </div>
                        <div>
                          <h3 className="mb-2 text-xl font-black text-slate-950 dark:text-white">{item.title}</h3>
                          <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{item.text}</p>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Engagement Models */}
      <div className="py-32 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeIn>
            <div className="text-center mb-20 max-w-3xl mx-auto">
              <div className="inline-flex mb-4 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shadow-sm">
                Engagement Models
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-6">Scale with structure</h2>
              <p className="text-slate-600 dark:text-slate-400 text-xl leading-relaxed">Choose the setup that fits your workload, rather than forcing your business into a rigid software subscription.</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
            {/* Model 1 */}
            <FadeIn delay={100} direction="up" className="h-full">
              <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-lg shadow-slate-200/50 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col hover:shadow-2xl hover:border-primary-200 hover:-translate-y-2 transition-all duration-500 p-10 h-full">
                <div className="mb-8">
                  <h3 className="text-3xl font-bold text-slate-950 dark:text-white mb-4">Dedicated Embedded Hire</h3>
                  <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                    Best for recurring workflows where you want one primary professional to own processes, reporting, and communication.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-950 dark:text-white tracking-tight">$1,500</span>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">/ mo</span>
                  </div>
                </div>
                <div className="flex-grow flex flex-col">
                  <ul className="space-y-5 mb-10 bg-slate-50 dark:bg-slate-950 p-8 rounded-[24px] border border-slate-100 dark:border-slate-800 flex-grow">
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300 text-base font-bold">Consistent ownership of recurring work</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300 text-base font-bold">Direct communication via Slack/Teams</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mr-4 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300 text-base font-bold">Billed at flat monthly rate</span>
                    </li>
                  </ul>
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 text-center text-sm font-black text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    Embedded hire option
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Model 2 */}
            <FadeIn delay={200} direction="up" className="h-full">
              <div className="bg-slate-950 rounded-[40px] shadow-2xl shadow-slate-900/30 border border-slate-800 overflow-hidden flex flex-col hover:shadow-primary-900/20 hover:-translate-y-2 transition-all duration-500 relative p-10 h-full group">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary-600/20 blur-[80px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-colors duration-700"></div>
                <div className="absolute top-8 right-8 bg-gradient-to-r from-primary-500 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                  Most Popular
                </div>
                <div className="mb-8 pr-24 relative z-10">
                  <h3 className="text-3xl font-bold text-white mb-4">Managed Pod</h3>
                  <p className="text-lg text-slate-400 leading-relaxed mb-6">
                    Cross-functional teams managed by a senior CPA. Best for teams with multiple workflows needing backup coverage and QA.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tight">$3,600</span>
                    <span className="text-sm font-bold text-primary-300 uppercase tracking-wider">/ mo</span>
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
                  <div className="w-full rounded-2xl border border-white/10 bg-white/10 py-4 text-center text-sm font-black text-white">
                    Managed pod option
                  </div>
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
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">PB</div>
              <div className="font-bold text-xl tracking-tight">PB Finance</div>
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
          <p>&copy; {new Date().getFullYear()} PB Finance Global. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}



function PricingView({ openAuth }) {
  return (
    <div className="animate-in fade-in duration-700 bg-white dark:bg-slate-900 pt-20 pb-28 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="mb-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              Pricing
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl mb-5">Transparent access, custom delivery.</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Start with the directory for individual hiring, or move into a managed pod when the workflow needs structure, coverage, and QA.
            </p>
          </div>
        </FadeIn>
        
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <FadeIn delay={100} direction="up" hover={true} className="h-full">
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-10 flex flex-col h-full hover:shadow-xl transition-shadow">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Platform Access</h3>
                  <p className="text-slate-500 dark:text-slate-400">Best for hiring 1-2 remote professionals.</p>
                </div>
                <div className="rounded-2xl bg-white p-3 text-primary-600 shadow-sm dark:bg-slate-900">
                  <User size={22} />
                </div>
              </div>
              <div className="text-5xl font-black text-slate-950 dark:text-white tracking-tight mb-8">Free<span className="text-lg font-bold text-slate-500 tracking-normal"> forever</span></div>
              <ul className="space-y-4 mb-10 flex-grow">
                {['Browse full talent directory', 'Interview up to 3 candidates', 'Standard KYC compliance', 'Shortlist and interview tracking'].map((item) => (
                  <li key={item} className="flex items-center text-slate-700 dark:text-slate-300">
                    <CheckCircle className="text-primary-500 w-5 h-5 mr-3 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => openAuth('register')} className="w-full bg-slate-950 text-white rounded-2xl py-4 font-bold hover:bg-primary-600 transition-colors">Create Free Account</button>
            </div>
          </FadeIn>

          <FadeIn delay={200} direction="up" hover={true} className="h-full">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 md:p-10 flex flex-col h-full shadow-2xl relative overflow-hidden group hover:border-primary-500 transition-colors">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/15 blur-[60px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-colors"></div>
              <div className="relative z-10 mb-8 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Enterprise Pods</h3>
                  <p className="text-slate-400">Dedicated managed teams and SLAs.</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-cyan-300">
                  <Layers3 size={22} />
                </div>
              </div>
              <div className="text-5xl font-black text-white tracking-tight mb-8 relative z-10">Custom</div>
              <ul className="space-y-4 mb-10 flex-grow relative z-10">
                {['Dedicated account manager', 'Role-based pod design', 'Backup coverage and QA cadence', 'Priority placement within 72hrs'].map((item) => (
                  <li key={item} className="flex items-center text-slate-300">
                    <CheckCircle className="text-cyan-400 w-5 h-5 mr-3 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => openAuth('register')} className="w-full bg-white text-slate-950 rounded-2xl py-4 font-bold hover:bg-slate-100 transition-colors relative z-10">Draft a Pod Structure</button>
            </div>
          </FadeIn>
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          {PRICING_DECISION_GUIDE.map((guide, index) => (
            <FadeIn key={guide.title} delay={index * 100}>
              <div className="h-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-3 text-xl font-black text-slate-950 dark:text-white">{guide.title}</h2>
                <p className="mb-6 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{guide.text}</p>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {guide.points.map((point) => (
                    <div key={point} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                      {point}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </section>

        <FadeIn delay={250}>
          <div className="mt-12 rounded-3xl border border-primary-100 bg-primary-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950">
            <h2 className="mb-3 text-2xl font-black text-slate-950 dark:text-white">Not sure which path fits?</h2>
            <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
              Start free, describe the workload, and PB Finance can steer you toward individual profiles or a managed team structure.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
