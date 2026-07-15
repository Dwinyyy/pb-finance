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
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { BrandMark } from '../components/ui/BrandMark';
import { Button } from '../components/ui/Button';
import { SurfaceCard } from '../components/ui/SurfaceCard';

const asList = (value) => (Array.isArray(value) ? value : []);

// ==========================================
// 1. PUBLIC MARKETING SITE
// ==========================================
export function PublicSite({ openAuth, isDarkMode, toggleDarkMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();
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
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const openMobileAuth = (view) => {
    setMobileMenuOpen(false);
    openAuth(view);
  };

  return (
    <>
      <Motion.nav
        aria-label="Primary navigation"
        initial={false}
        animate={prefersReducedMotion ? undefined : { y: isNavVisible ? 0 : '-100%' }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
        className="fixed top-0 z-50 w-full border-b border-border-subtle bg-surface/95 text-text-primary shadow-card backdrop-blur-xl transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 md:h-20 items-center">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="inline-flex min-h-11 items-center rounded-control text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
            >
              <BrandMark />
            </button>

            <div className="hidden items-center space-x-1 lg:flex">
              {navItems.map((tab) => (
                <button 
                  key={tab.id}
                  type="button"
                  onClick={() => navigateTo(tab.id)} 
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`min-h-11 rounded-control px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 ${activeTab === tab.id ? 'bg-action text-white' : 'text-text-muted hover:bg-surface-muted hover:text-text-primary'}`}
                >
                  {tab.label}
                </button>
              ))}
              
              <button type="button" onClick={toggleDarkMode} className="ml-2 inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-action focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25" aria-label="Toggle dark mode">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <div className="ml-2 flex items-center space-x-2 border-l border-border-subtle pl-4">
                <Button variant="ghost" size="sm" type="button" onClick={() => openAuth('login')} className="min-h-11">Client Login</Button>
                {activeTab !== 'home' && (
                  <Button variant="primary" size="sm" type="button" onClick={() => openAuth('register')} className="min-h-11">
                    Start Hiring
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <button type="button" onClick={toggleDarkMode} className="inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-action focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25" aria-label="Toggle dark mode">
                {isDarkMode ? <Sun size={21} /> : <Moon size={21} />}
              </button>
              <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="inline-flex size-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-muted hover:text-action focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25" aria-label="Toggle navigation menu" aria-expanded={mobileMenuOpen} aria-controls="public-mobile-navigation">
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="public-mobile-navigation" className="absolute z-50 w-full border-t border-border-subtle bg-surface shadow-card lg:hidden" role="navigation" aria-label="Mobile navigation">
            <div className="px-4 pt-4 pb-6 space-y-2">
              <div className="mb-3 flex items-center justify-between rounded-control bg-surface-muted px-3 py-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                <BrandMark compact label="PB Finance mobile menu" />
                Navigation
              </div>
              {navItems.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigateTo(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`block min-h-11 w-full rounded-control px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 ${activeTab === tab.id ? 'bg-action text-white' : 'text-text-muted hover:bg-surface-muted hover:text-text-primary'}`}
                >
                  {tab.id === 'agency' ? 'Enterprise Teams' : tab.label}
                </button>
              ))}
              <button type="button" onClick={toggleDarkMode} className="flex min-h-11 w-full items-center justify-between rounded-control px-4 py-3 text-sm font-semibold text-text-muted hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25">
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="mt-4 grid gap-2 border-t border-border-subtle pt-4">
                <Button variant="outline" size="md" type="button" onClick={() => openMobileAuth('login')} className="w-full">Client Login</Button>
                {activeTab !== 'home' && (
                  <Button variant="primary" size="md" type="button" onClick={() => openMobileAuth('register')} className="w-full">Start Hiring</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Motion.nav>

      <main className="min-h-screen bg-canvas pt-16 text-text-primary md:pt-20">
        <Routes>
          <Route path="/" element={<HomeMarketingView navigateTo={navigateTo} openAuth={openAuth} />} />
          <Route path="/talents" element={<PreviewDirectoryView navigateTo={navigateTo} openAuth={openAuth} />} />
          <Route path="/agency" element={<AgencyMarketingView openAuth={openAuth} />} />
          <Route path="/pricing" element={<PricingView openAuth={openAuth} />} />
          <Route path="*" element={
            <div className="flex min-h-[50vh] flex-col items-center justify-center bg-canvas px-4 pb-20 pt-32 text-center">
              <h1 className="mb-4 text-4xl font-bold text-text-primary">404 - Page Not Found</h1>
              <p className="mb-8 max-w-md text-text-muted">The page you are looking for doesn't exist or has been moved.</p>
              <Button variant="primary" size="lg" type="button" onClick={() => navigateTo('home')}>
                Return Home
              </Button>
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
    <section className="border-t border-border-subtle bg-surface-muted py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <FadeIn>
            <div className="mb-4 inline-flex rounded-full border border-border-subtle bg-surface px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-text-muted shadow-card">
              Savings Calculator
            </div>
            <h2 className="mb-6 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
              Estimate the cost difference
            </h2>
            <p className="mb-12 text-xl leading-relaxed text-text-muted">
              See the business case in numbers you actually care about: total cost, overlap, and practical staffing flexibility without sacrificing quality.
            </p>
            
            <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 sm:gap-6">
              <SurfaceCard as="div" className="p-6">
                <div className="text-3xl font-black text-text-primary">2-4 wks</div>
                <div className="mt-2 text-sm font-bold text-text-muted">Typical launch timeline</div>
              </SurfaceCard>
              <SurfaceCard as="div" className="p-6">
                <div className="text-3xl font-black text-verified">30-45%</div>
                <div className="mt-2 text-sm font-bold text-text-muted">Average cost savings</div>
              </SurfaceCard>
              <SurfaceCard as="div" className="p-6">
                <div className="text-3xl font-black text-text-primary">5+ hrs</div>
                <div className="mt-2 text-sm font-bold text-text-muted">Daily timezone overlap</div>
              </SurfaceCard>
              <SurfaceCard as="div" className="p-6">
                <div className="text-3xl font-black text-text-primary">Role-based</div>
                <div className="mt-2 text-sm font-bold text-text-muted">Flexible team design</div>
              </SurfaceCard>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={200} direction="left">
          <SurfaceCard as="div" tone="premium" className="p-6 sm:p-8 md:p-10">
            <div className="grid gap-8">
              {/* Sliders */}
              <div>
                <label htmlFor="roi-salary" className="mb-4 flex items-center justify-between text-sm font-bold text-text-primary">
                  <span>Annual local salary</span>
                  <span className="text-xl text-text-primary">${salary.toLocaleString()}</span>
                </label>
                <input id="roi-salary" type="range" min="35000" max="160000" step="5000" value={salary} aria-valuetext={`$${salary.toLocaleString()} annual local salary`} onChange={(e) => setSalary(Number(e.target.value))} className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-surface-muted accent-action focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25" />
              </div>
              <div>
                <label htmlFor="roi-benefits" className="mb-4 flex items-center justify-between text-sm font-bold text-text-primary">
                  <span>Benefits and overhead (%)</span>
                  <span className="text-xl text-text-primary">{benefits}%</span>
                </label>
                <input id="roi-benefits" type="range" min="5" max="35" step="1" value={benefits} aria-valuetext={`${benefits}% benefits and overhead`} onChange={(e) => setBenefits(Number(e.target.value))} className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-surface-muted accent-action focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25" />
              </div>
              <div>
                <label htmlFor="roi-vendor-fee" className="mb-4 flex items-center justify-between text-sm font-bold text-text-primary">
                  <span>Monthly outsourced cost</span>
                  <span className="text-xl text-text-primary">${vendorFee.toLocaleString()}</span>
                </label>
                <input id="roi-vendor-fee" type="range" min="1200" max="9000" step="100" value={vendorFee} aria-valuetext={`$${vendorFee.toLocaleString()} monthly outsourced cost`} onChange={(e) => setVendorFee(Number(e.target.value))} className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-surface-muted accent-action focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25" />
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between gap-4 rounded-card border border-border-subtle bg-surface-muted px-4 py-5 sm:px-6">
                <div>
                  <div className="text-sm font-bold text-text-primary">Include manager onboarding cost</div>
                  <div className="mt-1 text-xs font-medium text-text-muted">Useful if local hires need more oversight</div>
                </div>
                <button 
                  type="button" 
                  role="switch"
                  aria-checked={needManager}
                  aria-label="Include manager onboarding cost"
                  onClick={() => setNeedManager(!needManager)}
                  className={`relative inline-flex h-11 w-14 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 ${needManager ? 'bg-action' : 'bg-border-control'}`}
                >
                  <span className={`pointer-events-none inline-block size-6 rounded-full bg-white shadow-card transition-transform duration-300 ease-in-out motion-reduce:transition-none ${needManager ? 'motion-safe:translate-x-6 motion-reduce:ml-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Results */}
              <div className="grid gap-4 border-t border-border-subtle pt-6 md:grid-cols-3">
                <div className="rounded-card border border-border-subtle bg-surface-muted p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">In-house Annual</div>
                  <div className="mt-2 text-2xl font-black text-text-primary">${Math.round(data.inHouse).toLocaleString()}</div>
                </div>
                <div className="rounded-card border border-border-subtle bg-surface-muted p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Outsourced Annual</div>
                  <div className="mt-2 text-2xl font-black text-text-primary">${Math.round(data.outsourced).toLocaleString()}</div>
                </div>
                <div className="rounded-card border border-verified-border bg-verified-surface p-5 text-verified">
                  <div className="text-[10px] font-bold uppercase tracking-wider">Estimated Savings</div>
                  <div className="mt-2 text-2xl font-black">${Math.round(data.savings).toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-card border border-verified-border bg-verified-surface p-5">
                <TrendingDown className="mt-0.5 h-6 w-6 flex-shrink-0 text-verified" />
                <div>
                  <div className="text-sm font-bold text-verified">Estimated savings rate: {data.percent}%</div>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-verified">
                    Directional estimates based on typical US/UK staffing models versus our premium global talent pools.
                  </p>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </FadeIn>
      </div>
    </section>
  );
}

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const triggerId = `faq-trigger-${index}`;
        const panelId = `faq-panel-${index}`;

        return (
          <SurfaceCard as="div" key={index} className="overflow-hidden transition-colors hover:border-border-control">
            <button
              id={triggerId}
              type="button"
              className="flex min-h-11 w-full items-center justify-between p-5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-focus/25"
              onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
              aria-expanded={openIndex === index}
              aria-controls={panelId}
            >
              <span className="pr-4 font-bold text-text-primary">{item.q}</span>
              {openIndex === index ? (
                <ChevronUp className="h-5 w-5 flex-shrink-0 text-action transition-transform duration-300" />
              ) : (
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-text-muted transition-transform duration-300" />
              )}
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={openIndex !== index}
              className={`overflow-hidden px-5 text-sm font-medium leading-relaxed text-text-muted transition-all duration-300 ease-in-out motion-reduce:transition-none ${openIndex === index ? 'max-h-40 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
            >
              {item.a}
            </div>
          </SurfaceCard>
        );
      })}
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
    <div className="overflow-hidden bg-canvas text-text-primary">
      {/* Hero Section */}
      <section className="relative border-b border-border-subtle bg-canvas pb-12 pt-10 sm:pb-14 sm:pt-12 lg:pb-16 lg:pt-16">
        <div className="absolute inset-0 bg-grid-pattern opacity-50"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <FadeIn delay={100}>
            <div className="mb-5 inline-flex items-center rounded-full border border-premium-detail/35 bg-surface px-4 py-2 text-xs font-semibold text-premium-detail shadow-card backdrop-blur sm:text-sm">
              <Sparkles className="mr-2 h-4 w-4" /> Redefining Global Finance Outsourcing
            </div>
          </FadeIn>
          
          <FadeIn delay={200}>
            <h1 className="mb-5 max-w-5xl text-4xl font-bold leading-[1.04] tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
              Elite financial talent, seamlessly integrated into your <span className="bg-gradient-to-r from-action to-processing bg-clip-text text-transparent">operations.</span>
            </h1>
          </FadeIn>
          
          <FadeIn delay={300}>
            <p className="mx-auto mb-6 max-w-3xl text-base leading-relaxed text-text-muted sm:text-lg md:text-xl">
              We connect scaling companies with top-tier, rigorously vetted CPAs and analysts from the Philippines. Scale your capacity without compromising on quality.
            </p>
          </FadeIn>

          <FadeIn delay={400} className="w-full max-w-2xl flex justify-center mb-5">
            <Button variant="primary" size="lg" type="button" onClick={() => openAuth('register')} className="w-full sm:w-auto">
              Start Building Your Team
            </Button>
          </FadeIn>

        </div>
      </section>

      <section className="border-b border-border-subtle bg-surface">
        <div className="relative z-20 mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <FadeIn delay={100} className="-mt-7 flex w-full gap-3 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-3 sm:overflow-visible">
            {audiencePaths.map((path) => {
              const Icon = path.icon;

              return (
                <button
                  key={path.label}
                  type="button"
                  onClick={path.action}
                  className="flex min-h-11 min-w-[230px] flex-1 items-center justify-center gap-3 rounded-card border border-border-subtle bg-surface/90 px-4 py-3 text-center shadow-card transition-[border-color,background-color,box-shadow] hover:border-action/40 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-action text-white">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-text-primary">{path.label}</span>
                    <span className="block text-xs font-semibold leading-snug text-text-muted">{path.text}</span>
                  </span>
                </button>
              );
            })}
          </FadeIn>

          {/* Value Props Bar */}
          <FadeIn delay={200} className="mt-4 w-full">
            <SurfaceCard as="div" className="flex gap-3 overflow-x-auto p-3 scrollbar-hide md:grid md:grid-cols-3 md:divide-x md:divide-border-subtle md:overflow-visible md:p-4">
              <div className="flex min-w-[190px] items-center justify-center gap-3 py-2 md:px-4">
                <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-control bg-pb-midnight-soft text-pb-midnight"><ShieldCheck size={20}/></div>
                <div className="text-left"><p className="text-sm font-bold text-text-primary">Top 1% Talent</p><p className="text-xs font-medium text-text-muted">Rigorously vetted</p></div>
              </div>
              <div className="flex min-w-[190px] items-center justify-center gap-3 py-2 md:px-4">
                <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-control bg-pb-midnight-soft text-pb-midnight"><Globe2 size={20}/></div>
                <div className="text-left"><p className="text-sm font-bold text-text-primary">US/UK GAAP</p><p className="text-xs font-medium text-text-muted">Fully compliant</p></div>
              </div>
              <div className="flex min-w-[190px] items-center justify-center gap-3 py-2 md:px-4">
                <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-control bg-verified-surface text-verified"><TrendingDown size={20}/></div>
                <div className="text-left"><p className="text-sm font-bold text-verified">40%+ Savings</p><p className="text-xs font-medium text-text-muted">Optimized ROI</p></div>
              </div>
            </SurfaceCard>
          </FadeIn>
        </div>
      </section>

      {/* Dynamic Scrolling Sections */}
      <section className="bg-surface py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="mb-6 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">Designed for sophisticated financial workflows</h2>
              <p className="text-xl text-text-muted">Beyond basic bookkeeping. We provide strategic coverage for your most critical financial operations.</p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {SERVICE_CARDS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <FadeIn key={idx} delay={idx * 100} direction="up">
                  <SurfaceCard as="div" tone="muted" className="group p-8 transition-[border-color,background-color,box-shadow] duration-300 hover:border-action/30 hover:bg-surface hover:shadow-card md:p-10">
                    <div className="mb-8 flex size-16 items-center justify-center rounded-card border border-border-subtle bg-surface text-action shadow-card transition-colors duration-300 group-hover:border-action group-hover:bg-action group-hover:text-white">
                      <Icon className="h-8 w-8" />
                    </div>
                    <h3 className="mb-4 text-2xl font-bold tracking-tight text-text-primary">{item.title}</h3>
                    <p className="text-lg leading-relaxed text-text-muted">{item.desc}</p>
                  </SurfaceCard>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <ROICalculator />

      {/* Process & FAQ Section */}
      <section className="bg-surface py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16">
          <div>
            <FadeIn>
              <div className="mb-4 inline-flex rounded-full border border-border-subtle bg-surface-muted px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-action">
                Process
              </div>
              <h2 className="mb-10 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
                Built for structured onboarding
              </h2>
              
              <div className="space-y-4">
                {PROCESS_STEPS.map((step, index) => (
                  <SurfaceCard as="div" tone="muted" key={step.title} className="p-6 transition-colors hover:border-action/30">
                    <div className="flex gap-5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-control border border-border-subtle bg-surface text-sm font-black text-action">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="mb-2 text-lg font-bold text-text-primary">{step.title}</h3>
                        <p className="text-sm font-medium leading-relaxed text-text-muted">{step.text}</p>
                      </div>
                    </div>
                  </SurfaceCard>
                ))}
              </div>
            </FadeIn>
          </div>
          
          <div>
            <FadeIn delay={200}>
              <div className="mb-4 inline-flex rounded-full border border-border-subtle bg-surface-muted px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-action md:hidden">
                FAQ
              </div>
              <h2 className="mb-10 hidden text-3xl font-bold tracking-tight text-text-primary md:block md:text-5xl">
                Frequently asked questions
              </h2>
              <FAQAccordion />
              
              <SurfaceCard as="div" tone="trust" className="mt-12 p-8 text-center sm:p-10">
                <h3 className="mb-4 text-2xl font-bold text-text-primary">Still have questions?</h3>
                <p className="mx-auto mb-8 max-w-sm text-lg text-text-muted">Schedule a brief call to see how we can map a solution to your exact workflow.</p>
                <Button variant="primary" size="lg" type="button" onClick={() => navigateTo('pricing')}>
                  View Pricing
                </Button>
              </SurfaceCard>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-pb-midnight py-24 text-white sm:py-32">
        <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-action/20 blur-[120px]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeIn>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">Ready to scale your finance team?</h2>
                <p className="mb-10 text-xl leading-relaxed text-white/70">Join industry leaders who rely on PB Finance for seamless, secure, and highly skilled outsourcing.</p>
                <ul className="space-y-5 mb-10">
                  {["Rigorously tested accounting fundamentals", "Communication and culture-fit screening", "Bank-level data security protocols"].map((point, i) =>(
                    <li key={i} className="flex items-center font-medium text-white/80">
                      <span className="mr-4 flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-processing-surface text-processing"><CheckCircle className="h-5 w-5" /></span> {point}
                    </li>
                  ))}
                </ul>
                <Button variant="primary" size="lg" type="button" onClick={() => navigateTo('talents')}>
                  Preview Directory <ArrowRight size={20} className="ml-2" />
                </Button>
              </FadeIn>
            </div>
            <div className="relative">
               <FadeIn delay={200} direction="left">
                 <div className="rounded-card border border-white/10 bg-pb-midnight-strong p-5 shadow-modal sm:p-8">
                    <h3 className="mb-8 border-b border-white/10 pb-4 text-2xl font-bold text-white">Secure Matching Workflow</h3>
                    <div className="space-y-6">
                      {MATCHING_WORKFLOW.map((item) => (
                        <div key={item.title} className="flex flex-col gap-4 rounded-card border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex size-12 items-center justify-center rounded-full bg-processing-surface text-processing">
                              <User size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-white">{item.title}</div>
                              <div className="mt-1 inline-flex rounded-full bg-processing-surface px-2.5 py-1 text-xs font-bold text-processing">Structured and review-ready</div>
                            </div>
                          </div>
                          <div className="text-left min-[380px]:text-right">
                             <div className="mb-1 text-xs uppercase tracking-wider text-white/60">Status</div>
                             <div className="inline-flex rounded-full bg-verified-surface px-2.5 py-1 text-sm font-bold text-verified">{item.label}</div>
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
    <div className="min-h-screen bg-canvas">
      <section className="border-b border-border-subtle bg-surface pb-12 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <FadeIn>
              <div>
                <div className="mb-5 inline-flex rounded-full border border-info-border bg-info-surface px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-info">
                  Talent Directory Preview
                </div>
                <h1 className="mb-5 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
                  See the roles, rates, and readiness before you sign in.
                </h1>
                <p className="mb-8 max-w-2xl text-lg leading-relaxed text-text-muted">
                  Preview anonymized finance profiles with the same signals clients use to shortlist: role fit, tools, availability, overlap, and estimated rate.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="primary" size="lg" type="button" onClick={() => openAuth('register')} className="w-full sm:w-auto">
                    Unlock Full Directory
                  </Button>
                  <Button variant="outline" size="lg" type="button" onClick={() => openAuth('login')} className="w-full sm:w-auto">
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
                  <div key={label} className="rounded-card border border-border-subtle bg-surface-muted p-5">
                    <div className="text-2xl font-black tracking-tight text-text-primary">{value}</div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">{label}</div>
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
            <div className="rounded-card border border-border-subtle bg-surface p-4 shadow-card">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-h-12 flex-1 items-center rounded-control border border-border-control bg-surface-muted px-4">
                  <Search size={18} className="mr-3 text-text-muted" aria-hidden="true" />
                  <span className="text-sm font-semibold text-text-muted">Search by role, software, shift, or credential</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:pb-0">
                  {DIRECTORY_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      aria-pressed={activeFilter === filter}
                      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold ${
                        activeFilter === filter
                          ? 'border-action bg-action text-white'
                          : 'border-border-control bg-surface text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary'
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
              <FadeIn key={profile.code} delay={(index % 6) * 60} direction="up" hover={true} className="rounded-card border border-border-subtle bg-surface p-6 shadow-card transition-all hover:border-info-border hover:shadow-modal">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-control bg-processing-surface text-sm font-black text-processing">
                      {profile.code.split('-')[0]}
                    </div>
                    <div>
                      <h3 className="text-lg font-black leading-tight text-text-primary">{profile.title}</h3>
                      <p className="text-xs font-bold uppercase tracking-wider text-processing">{profile.code} verified preview</p>
                    </div>
                  </div>
                  <Lock size={18} className="text-pb-midnight dark:text-text-muted" aria-label="Profile details locked" />
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3">
                  <div className="rounded-control border border-border-subtle bg-surface-muted p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Rate</div>
                    <div className="mt-1 text-base font-black text-text-primary">{profile.rate}</div>
                  </div>
                  <div className="rounded-control border border-verified-border bg-verified-surface p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-verified">Availability</div>
                    <div className="mt-1 text-sm font-black text-verified">{profile.availability}</div>
                  </div>
                </div>

                <div className="space-y-3 text-sm font-semibold text-text-muted">
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={16} className="text-verified" aria-hidden="true" />
                    {profile.credentials}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 size={16} className="text-processing" aria-hidden="true" />
                    {profile.overlap}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {[...new Set([...asList(profile.skills), ...asList(profile.tools)])].map((tool) => (
                    <span key={tool} className="rounded-lg border border-border-subtle bg-surface-muted px-2.5 py-1 text-xs font-bold text-text-muted">
                      {tool}
                    </span>
                  ))}
                </div>

                <div className="mt-6 rounded-control border border-dashed border-border-control bg-pb-midnight-soft px-4 py-3 text-center text-sm font-bold text-pb-midnight dark:bg-surface-muted dark:text-text-primary">
                  Full resume unlocks after client signup
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        <section className="pb-24">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
            <FadeIn>
              <div className="h-full rounded-card border border-border-subtle bg-surface p-8 shadow-card">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-control bg-pb-midnight-soft text-pb-midnight dark:bg-surface-muted dark:text-text-primary">
                  <Lock size={24} />
                </div>
                <h2 className="mb-4 text-3xl font-bold tracking-tight text-text-primary">Verified client access protects the talent pool.</h2>
                <p className="mb-8 text-base font-medium leading-relaxed text-text-muted">
                  Public previews stay anonymized. Approved client accounts can view full profiles, save candidates, and request interviews from the portal.
                </p>
                <Button variant="outline" size="md" type="button" onClick={() => navigateTo('pricing')} className="w-full sm:w-auto">
                  View Pricing
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={150} direction="left">
              <div className="h-full rounded-card border border-white/10 bg-pb-midnight p-8 text-white shadow-modal">
                <h3 className="mb-6 text-xl font-black">What unlocks after signup</h3>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  {DIRECTORY_UNLOCKS.map((item, index) => (
                    <div key={item} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-processing-surface text-processing">
                        {index + 1}
                      </div>
                      <div className="text-sm font-bold leading-relaxed text-white/80">{item}</div>
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
    <div className="animate-in fade-in bg-canvas duration-700">
      {/* Agency Header */}
      <div className="relative overflow-hidden border-b border-white/10 bg-pb-midnight pb-32 pt-24 text-white lg:pb-40 lg:pt-36">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-30"></div>
        <div className="absolute inset-0 bg-pb-midnight/85"></div>
        <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[800px] rounded-full bg-action/20 blur-[120px]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            
            <div className="lg:w-3/5">
              <FadeIn delay={100}>
                <div className="mb-8 inline-flex items-center rounded-full border border-premium-detail/40 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-premium-detail shadow-card backdrop-blur-md">
                  <Star className="mr-2 h-4 w-4 fill-current" aria-hidden="true" /> Enterprise Finance Delivery
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
                  Managed finance pods
                </h1>
                <p className="mb-12 max-w-2xl text-xl leading-relaxed text-white/70">
                  Strategic finance support delivered by role-based teams with clear capabilities, availability, and engagement history.
                </p>

                <div className="flex flex-wrap gap-6 mb-12">
                  <div className="bg-white/5 backdrop-blur-md p-5 rounded-[24px] flex items-center border border-white/10 min-w-[200px]">
                    <MapPin className="mr-4 h-8 w-8 rounded-control bg-processing-surface p-1.5 text-processing" aria-hidden="true" />
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/60">Location</p>
                      <p className="font-bold text-white text-lg">Philippines Hubs</p>
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md p-5 rounded-[24px] flex items-center border border-white/10 min-w-[200px]">
                    <Building className="mr-4 h-8 w-8 rounded-control bg-processing-surface p-1.5 text-processing" aria-hidden="true" />
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/60">Specialty</p>
                      <p className="font-bold text-white text-lg">Tax, Close, Reporting</p>
                    </div>
                  </div>
                </div>

                <Button type="button" variant="primary" size="lg" onClick={() => openAuth('register')} className="rounded-full px-10 text-lg">
                  Contact Agency <ArrowRight size={20} className="ml-3" aria-hidden="true" />
                </Button>
              </FadeIn>
            </div>

            <div className="lg:w-2/5 w-full">
              <FadeIn delay={300} direction="left">
                <div className="relative overflow-hidden rounded-modal border border-white/10 bg-white/5 p-10 shadow-modal backdrop-blur-2xl">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-action/20 blur-[50px]"></div>
                  <h3 className="text-2xl font-bold mb-8 text-white relative z-10">Agency Capabilities</h3>
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-verified-surface p-0.5 text-verified" aria-hidden="true" />
                      <p className="text-base font-medium text-white/80">100% CPA or equivalent qualified staff</p>
                    </div>
                    <div className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-verified-surface p-0.5 text-verified" aria-hidden="true" />
                      <p className="text-base font-medium text-white/80">US GAAP and IFRS compliant workflows</p>
                    </div>
                    <div className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-verified-surface p-0.5 text-verified" aria-hidden="true" />
                      <p className="text-base font-medium text-white/80">SOC 2 Type II Certified infrastructure</p>
                    </div>
                    <div className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-verified-surface p-0.5 text-verified" aria-hidden="true" />
                      <p className="text-base font-medium text-white/80">Dedicated account managers for client pods</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </div>

      <section className="border-b border-border-subtle bg-surface py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <FadeIn>
              <div>
                <div className="mb-4 inline-flex rounded-full border border-processing-border bg-processing-surface px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-processing">
                  Pod Design Preview
                </div>
                <h2 className="mb-5 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
                  Pick the finance workload. We shape the team around it.
                </h2>
                <p className="mb-8 text-lg leading-relaxed text-text-muted">
                  Enterprise clients need more than resumes. They need coverage, ownership, QA, and a clean handoff from scope to recurring execution.
                </p>

                <div className="rounded-card border border-border-subtle bg-surface-muted p-5">
                  <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-text-muted">Setup Path</h3>
                  <div className="space-y-3">
                    {POD_SETUP_STEPS.map((step, index) => (
                      <div key={step} className="flex items-center gap-3 rounded-control bg-surface p-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-processing-surface text-xs font-black text-processing">
                          {index + 1}
                        </span>
                        <span className="text-sm font-bold text-text-primary">{step}</span>
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
                    <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-card transition-all hover:border-processing-border hover:shadow-modal">
                      <div className="flex gap-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-processing-surface text-processing">
                          <Icon size={24} />
                        </div>
                        <div>
                          <h3 className="mb-2 text-xl font-black text-text-primary">{item.title}</h3>
                          <p className="text-sm font-medium leading-relaxed text-text-muted">{item.text}</p>
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
      <div className="relative overflow-hidden bg-surface-muted py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeIn>
            <div className="text-center mb-20 max-w-3xl mx-auto">
              <div className="mb-4 inline-flex rounded-full border border-border-subtle bg-surface px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-text-muted shadow-card">
                Engagement Models
              </div>
              <h2 className="mb-6 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">Scale with structure</h2>
              <p className="text-xl leading-relaxed text-text-muted">Choose the setup that fits your workload, rather than forcing your business into a rigid software subscription.</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
            {/* Model 1 */}
            <FadeIn delay={100} direction="up" className="h-full">
              <div className="flex h-full flex-col overflow-hidden rounded-modal border border-border-subtle bg-surface p-10 shadow-card transition-all duration-500 motion-safe:hover:-translate-y-2 hover:border-info-border hover:shadow-modal">
                <div className="mb-8">
                  <h3 className="mb-4 text-3xl font-bold text-text-primary">Dedicated Embedded Hire</h3>
                  <p className="mb-6 text-lg leading-relaxed text-text-muted">
                    Best for recurring workflows where you want one primary professional to own processes, reporting, and communication.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight text-text-primary">$1,500</span>
                    <span className="text-sm font-bold uppercase tracking-wider text-text-muted">/ mo</span>
                  </div>
                </div>
                <div className="flex-grow flex flex-col">
                  <ul className="mb-10 flex-grow space-y-5 rounded-card border border-border-subtle bg-surface-muted p-8">
                    <li className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 text-verified" aria-hidden="true" />
                      <span className="text-base font-bold text-text-primary">Consistent ownership of recurring work</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 text-verified" aria-hidden="true" />
                      <span className="text-base font-bold text-text-primary">Direct communication via Slack/Teams</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 text-verified" aria-hidden="true" />
                      <span className="text-base font-bold text-text-primary">Billed at flat monthly rate</span>
                    </li>
                  </ul>
                  <div className="w-full rounded-control border border-border-subtle bg-surface-muted py-4 text-center text-sm font-black text-text-muted">
                    Embedded hire option
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Model 2 */}
            <FadeIn delay={200} direction="up" className="h-full">
              <div className="group relative flex h-full flex-col overflow-hidden rounded-modal border border-white/10 bg-pb-midnight p-10 shadow-modal transition-all duration-500 motion-safe:hover:-translate-y-2">
                <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-action/20 blur-[80px] transition-colors duration-700 group-hover:bg-processing/20"></div>
                <div className="relative z-10 mb-8">
                  <h3 className="text-3xl font-bold text-white mb-4">Managed Pod</h3>
                  <p className="mb-6 text-lg leading-relaxed text-white/70">
                    Cross-functional teams managed by a senior CPA. Best for teams with multiple workflows needing backup coverage and QA.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tight">$3,600</span>
                    <span className="text-sm font-bold uppercase tracking-wider text-processing">/ mo</span>
                  </div>
                </div>
                <div className="flex-grow flex flex-col relative z-10">
                  <ul className="mb-10 flex-grow space-y-5 rounded-card border border-white/10 bg-white/5 p-8 backdrop-blur-md">
                    <li className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-processing-surface p-0.5 text-processing" aria-hidden="true" />
                      <span className="text-base font-bold text-white/80">Role-based accountability and QA</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-processing-surface p-0.5 text-processing" aria-hidden="true" />
                      <span className="text-base font-bold text-white/80">Built-in backup coverage (no downtime)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="mr-4 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-processing-surface p-0.5 text-processing" aria-hidden="true" />
                      <span className="text-base font-bold text-white/80">Includes CPAs, Tax Prep, and Reviewers</span>
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
    <footer className="bg-pb-midnight pb-10 pt-20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 grid grid-cols-1 gap-12 border-b border-white/10 pb-16 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <BrandMark className="mb-6 [&>span:first-child]:bg-action [&>span:last-child]:text-white" />
            <p className="max-w-md text-lg leading-relaxed text-white/70">
              Elevating global finance outsourcing. Rigorously vetted CPAs and analysts from the Philippines, integrated seamlessly into your operations.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Platform</h4>
            <ul className="space-y-1 font-medium text-white/70">
              <li><button type="button" onClick={() => navigateTo('home')} className="inline-flex min-h-11 items-center rounded-control transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40">Overview</button></li>
              <li><button type="button" onClick={() => navigateTo('talents')} className="inline-flex min-h-11 items-center rounded-control transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40">Talent Directory</button></li>
              <li><button type="button" onClick={() => navigateTo('agency')} className="inline-flex min-h-11 items-center rounded-control transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40">Enterprise Pods</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Connect</h4>
            <ul className="space-y-1 font-medium text-white/70">
              <li><button type="button" onClick={() => openAuth('register')} className="inline-flex min-h-11 items-center rounded-control transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40">Book Discovery</button></li>
              <li><button type="button" onClick={() => openAuth('login')} className="inline-flex min-h-11 items-center rounded-control transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40">Client Login</button></li>
              <li><button type="button" onClick={() => openAuth('register_pro')} className="inline-flex min-h-11 items-center rounded-control transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40">Apply as Talent</button></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between text-sm font-medium text-white/50 md:flex-row">
          <p>&copy; {new Date().getFullYear()} PB Finance Global. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}



function PricingView({ openAuth }) {
  return (
    <div className="min-h-screen animate-in fade-in bg-canvas pb-28 pt-20 duration-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="mb-4 inline-flex rounded-full border border-info-border bg-info-surface px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-info">
              Pricing
            </div>
            <h1 className="mb-5 text-4xl font-bold tracking-tight text-text-primary md:text-5xl">Transparent access, custom delivery.</h1>
            <p className="text-lg text-text-muted">
              Start with the directory for individual hiring, or move into a managed pod when the workflow needs structure, coverage, and QA.
            </p>
          </div>
        </FadeIn>
        
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <FadeIn delay={100} direction="up" hover={true} className="h-full">
            <div className="flex h-full flex-col rounded-card border border-border-subtle bg-surface p-8 shadow-card transition-shadow hover:shadow-modal md:p-10">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h3 className="mb-2 text-2xl font-bold text-text-primary">Platform Access</h3>
                  <p className="text-text-muted">Best for hiring 1-2 remote professionals.</p>
                </div>
                <div className="rounded-control bg-info-surface p-3 text-info shadow-card">
                  <User size={22} aria-hidden="true" />
                </div>
              </div>
              <div className="mb-8 text-5xl font-black tracking-tight text-text-primary">Free<span className="text-lg font-bold tracking-normal text-text-muted"> forever</span></div>
              <ul className="space-y-4 mb-10 flex-grow">
                {['Browse full talent directory', 'Interview up to 3 candidates', 'Standard KYC compliance', 'Shortlist and interview tracking'].map((item) => (
                  <li key={item} className="flex items-center text-text-primary">
                    <CheckCircle className="mr-3 h-5 w-5 shrink-0 text-info" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
              <Button type="button" variant="primary" size="lg" onClick={() => openAuth('register')} className="w-full">Create Free Account</Button>
            </div>
          </FadeIn>

          <FadeIn delay={200} direction="up" hover={true} className="h-full">
            <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-white/10 bg-pb-midnight p-8 shadow-modal transition-colors hover:border-action md:p-10">
              <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-action/15 blur-[60px] transition-colors group-hover:bg-processing/20"></div>
              <div className="relative z-10 mb-8 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Enterprise Pods</h3>
                  <p className="text-white/70">Dedicated managed teams and SLAs.</p>
                </div>
                <div className="rounded-control bg-processing-surface p-3 text-processing">
                  <Layers3 size={22} aria-hidden="true" />
                </div>
              </div>
              <div className="text-5xl font-black text-white tracking-tight mb-8 relative z-10">Custom</div>
              <ul className="space-y-4 mb-10 flex-grow relative z-10">
                {['Dedicated account manager', 'Role-based pod design', 'Backup coverage and QA cadence', 'Priority placement within 72hrs'].map((item) => (
                  <li key={item} className="flex items-center text-white/80">
                    <CheckCircle className="mr-3 h-5 w-5 shrink-0 rounded-full bg-processing-surface p-0.5 text-processing" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
              <Button type="button" variant="primary" size="lg" onClick={() => openAuth('register')} className="relative z-10 w-full">Draft a Pod Structure</Button>
            </div>
          </FadeIn>
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          {PRICING_DECISION_GUIDE.map((guide, index) => (
            <FadeIn key={guide.title} delay={index * 100}>
              <div className="h-full rounded-card border border-border-subtle bg-surface p-7 shadow-card">
                <h2 className="mb-3 text-xl font-black text-text-primary">{guide.title}</h2>
                <p className="mb-6 text-sm font-medium leading-relaxed text-text-muted">{guide.text}</p>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {guide.points.map((point) => (
                    <div key={point} className="flex items-center gap-3 rounded-control border border-verified-border bg-verified-surface p-3 text-sm font-bold text-verified">
                      <CheckCircle size={16} className="shrink-0" aria-hidden="true" />
                      {point}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </section>

        <FadeIn delay={250}>
          <div className="mt-12 rounded-card border border-info-border bg-info-surface p-8 text-center">
            <h2 className="mb-3 text-2xl font-black text-text-primary">Not sure which path fits?</h2>
            <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-text-muted">
              Start free, describe the workload, and PB Finance can steer you toward individual profiles or a managed team structure.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
