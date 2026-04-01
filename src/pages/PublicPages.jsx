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
import { REVIEWS, TALENT_PROFILES, AGENCIES, SERVICE_CARDS, PROCESS_STEPS, FAQ_DATA } from '../data/mockData';
import FadeIn from '../components/FadeIn';
import { motion } from 'framer-motion';

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



  const getActiveTab = () => {
    if (location.pathname === '/talents') return 'talents';
    if (location.pathname === '/agency') return 'agency';
    if (location.pathname === '/pricing') return 'pricing';
    return 'home';
  };
  const activeTab = getActiveTab();

  const navigateTo = (tab) => {
    const path = tab === 'home' ? '/' : `/${tab}`;
    navigate(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <motion.nav initial={{y:0}} animate={{y: isNavVisible ? 0 : '-100%'}} transition={{duration: 0.3}} className="bg-white dark:bg-slate-900/90 backdrop-blur-xl fixed w-full top-0 z-50 border-b border-slate-200 dark:border-slate-800/80 transition-colors text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center cursor-pointer gap-3" onClick={() => navigateTo('home')}>
              <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">
                PB
              </div>
              <div>
                <div className="text-lg font-bold text-slate-950 dark:text-white tracking-tight leading-none mb-0.5">PB Finance</div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              {['home', 'talents', 'agency', 'pricing'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => navigateTo(tab)} 
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === tab ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {tab === 'home' ? 'Overview' : tab === 'talents' ? 'Directory' : tab === 'pricing' ? 'Pricing' : 'Enterprise'}
                </button>
              ))}
              
              <button onClick={toggleDarkMode} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <div className="flex items-center space-x-4 pl-4 ml-2 border-l border-slate-200 dark:border-slate-800">
                <button onClick={() => openAuth('login')} className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-colors">Client Login</button>
                <button onClick={() => openAuth('register')} className="bg-slate-950 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                  Start Hiring
                </button>
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-xl absolute w-full z-50">
            <div className="px-4 pt-4 pb-6 space-y-2">
              <button onClick={() => navigateTo('home')} className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold ${activeTab === 'home' ? 'bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Overview</button>
              <button onClick={() => navigateTo('talents')} className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold ${activeTab === 'talents' ? 'bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Directory</button>
              <button onClick={() => navigateTo('agency')} className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold ${activeTab === 'agency' ? 'bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Enterprise Teams</button>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid gap-2">
                <button onClick={() => openAuth('login')} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl text-sm font-bold">Client Login</button>
                <button onClick={() => openAuth('register')} className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl text-sm font-bold">Start Hiring</button>
              </div>
            </div>
          </div>
        )}
      </motion.nav>

      <main className="min-h-screen pt-20">
        <Routes>
          <Route path="/" element={<HomeMarketingView navigateTo={navigateTo} openAuth={openAuth} />} />
          <Route path="/talents" element={<PreviewDirectoryView openAuth={openAuth} />} />
          <Route path="/agency" element={<AgencyMarketingView openAuth={openAuth} />} />
          <Route path="/pricing" element={<PricingView openAuth={openAuth} />} />
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
                <div className="text-3xl font-black text-slate-950 dark:text-white">2–4 wks</div>
                <div className="mt-2 text-sm text-slate-500 font-bold">Typical launch timeline</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl font-black text-slate-950 dark:text-white">30–45%</div>
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
      {FAQ_DATA.map((item, index) => (
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

function HomeMarketingView({ navigateTo, openAuth }) {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 lg:pt-36 lg:pb-40 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-50"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[600px] opacity-40 rounded-full bg-gradient-to-tr from-primary-200 via-cyan-100 to-transparent blur-3xl pointer-events-none -z-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <FadeIn delay={100}>
            <div className="inline-flex items-center mb-8 rounded-full border border-primary-200 bg-white dark:bg-slate-900/60 backdrop-blur px-4 py-2 text-sm font-semibold text-primary-800 dark:text-primary-300 shadow-sm">
              <Sparkles className="mr-2 h-4 w-4 text-primary-500" /> Redefining Global Finance Outsourcing
            </div>
          </FadeIn>
          
          <FadeIn delay={200}>
            <h1 className="text-5xl md:text-7xl font-bold text-slate-950 dark:text-white tracking-tight leading-[1.05] mb-8 max-w-5xl">
              Elite financial talent, seamlessly integrated into your <span className="bg-gradient-to-r from-primary-600 to-cyan-500 bg-clip-text text-transparent">operations.</span>
            </h1>
          </FadeIn>
          
          <FadeIn delay={300}>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              We connect scaling companies with top-tier, rigorously vetted CPAs and analysts from the Philippines. Scale your capacity without compromising on quality.
            </p>
          </FadeIn>

          <FadeIn delay={400} hover={true} className="w-full max-w-2xl flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <button onClick={() => openAuth('register')} className="bg-slate-950 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-500 text-white px-10 py-4 rounded-full font-semibold text-lg transition-all shadow-xl shadow-primary-900/10 flex items-center justify-center transform hover:-translate-y-1">
              Start Building Your Team
            </button>
            <button onClick={() => navigateTo('talents')} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-800 dark:text-slate-200 px-10 py-4 rounded-full font-semibold text-lg transition-all shadow-sm flex items-center justify-center transform hover:-translate-y-1">
              Browse Directory <ArrowRight size={20} className="ml-2 text-slate-400" />
            </button>
          </FadeIn>

          {/* Value Props Bar */}
          <FadeIn delay={600} hover={true} className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="flex items-center justify-center gap-4 py-4 md:py-2 md:px-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 flex-shrink-0"><ShieldCheck size={24}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 dark:text-white text-base">Top 1% Talent</p><p className="text-sm font-medium text-slate-500">Rigorously vetted</p></div>
            </div>
            <div className="flex items-center justify-center gap-4 py-6 md:py-2 md:px-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0"><Globe2 size={24}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 dark:text-white text-base">US/UK GAAP</p><p className="text-sm font-medium text-slate-500">Fully compliant</p></div>
            </div>
            <div className="flex items-center justify-center gap-4 py-4 md:py-2 md:px-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 flex-shrink-0"><TrendingDown size={24}/></div>
              <div className="text-left"><p className="font-bold text-slate-950 dark:text-white text-base">40%+ Savings</p><p className="text-sm font-medium text-slate-500">Optimized ROI</p></div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Dynamic Scrolling Sections */}
      <section className="py-32 bg-white dark:bg-slate-900">
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

      {/* Reviews & FAQ Section */}
      <section className="py-32 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16">
          <div>
            <FadeIn>
              <div className="inline-flex mb-4 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Proof
              </div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-10">
                Trusted by scaling businesses
              </h2>
              
              <div className="space-y-6">
                {REVIEWS.slice(0, 2).map((review) => (
                  <div key={review.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-8 rounded-[32px] hover:shadow-lg transition-all duration-300">
                    <div className="flex text-amber-400 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={18} fill="currentColor" className={i >= review.rating ? "text-slate-200" : ""} />
                      ))}
                    </div>
                    <blockquote className="text-lg font-bold text-slate-900 dark:text-slate-50 leading-relaxed mb-6">
                      "{review.body}"
                    </blockquote>
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg mr-4 border border-primary-200">
                        {review.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">{review.name}</p>
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
                <button onClick={() => openAuth('register')} className="bg-slate-950 text-white px-10 py-4 rounded-full text-base font-bold hover:bg-primary-600 transition-transform transform hover:-translate-y-1 shadow-xl shadow-slate-900/10">
                  Talk to an Expert
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
    <div className="pt-24 pb-32 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-6">Global Talent Directory</h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">Browse a snapshot of our highly vetted professional network.</p>
          </div>
        </FadeIn>

        <div className="relative">
          <FadeIn delay={200}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 blur-[5px] opacity-60 pointer-events-none select-none overflow-hidden h-[600px]">
              {TALENT_PROFILES.map((profile) => (
                <div key={profile.id} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                    <div>
                      <div className="h-5 w-32 bg-slate-200 rounded mb-2"></div>
                      <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-3 mb-6">
                    <div className="h-4 w-full bg-slate-50 dark:bg-slate-950 rounded"></div>
                    <div className="h-4 w-4/5 bg-slate-50 dark:bg-slate-950 rounded"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-16 bg-slate-100 dark:bg-slate-800 rounded-md"></div>
                    <div className="h-8 w-16 bg-slate-100 dark:bg-slate-800 rounded-md"></div>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
          
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
            <FadeIn delay={400} hover={true} className="bg-white dark:bg-slate-900/90 backdrop-blur-xl p-10 md:p-12 rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800/50 max-w-xl mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-cyan-50 rounded-2xl flex items-center justify-center text-primary-600 mx-auto mb-8 shadow-inner">
                <Lock size={32} />
              </div>
              <h3 className="text-3xl font-bold text-slate-950 dark:text-white mb-4 tracking-tight">Verified Client Access</h3>
              <p className="text-slate-600 dark:text-slate-400 text-lg mb-10 leading-relaxed">
                We fiercely protect our talent pool. Create a free enterprise account to view full resumes, unlock specific tooling filters, and interview candidates directly.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => openAuth('register')} className="bg-slate-950 hover:bg-primary-600 text-white px-8 py-4 rounded-full font-bold transition-all shadow-xl shadow-slate-900/10">
                  Create Client Account
                </button>
                <button onClick={() => openAuth('login')} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-950 dark:text-white border-2 border-slate-200 dark:border-slate-700 px-8 py-4 rounded-full font-bold transition-all">
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
                  <button onClick={() => openAuth('register')} className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white hover:border-primary-600 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 py-4 rounded-full font-bold text-lg transition-all mt-auto">
                    Inquire Setup
                  </button>
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
                  <button onClick={() => openAuth('register')} className="w-full bg-white text-slate-950 hover:bg-primary-50 py-4 rounded-full font-bold text-lg transition-all mt-auto shadow-xl shadow-white/10">
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
          <div className="flex space-x-8 mt-4 md:mt-0">
            <button className="hover:text-white transition-colors">Privacy</button>
            <button className="hover:text-white transition-colors">Terms</button>
          </div>
        </div>
      </div>
    </footer>
  );
}



function PricingView({ openAuth }) {
  return (
    <div className="animate-in fade-in duration-700 bg-white dark:bg-slate-900 pt-32 pb-40 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn hover={true}>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-6">Transparent Platform Fees</h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">Simple, predictable models to augment your finance team.</p>
          </div>
        </FadeIn>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <FadeIn delay={100} direction="up" hover={true} className="h-full">
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[32px] p-10 flex flex-col h-full hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Platform Access</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8">Best for hiring 1-2 remote professionals.</p>
              <div className="text-5xl font-black text-slate-950 dark:text-white tracking-tight mb-8">Free<span className="text-lg font-bold text-slate-500 tracking-normal"> forever</span></div>
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-center text-slate-700 dark:text-slate-300"><CheckCircle className="text-primary-500 w-5 h-5 mr-3"/> Browse full talent directory</li>
                <li className="flex items-center text-slate-700 dark:text-slate-300"><CheckCircle className="text-primary-500 w-5 h-5 mr-3"/> Interview up to 3 candidates</li>
                <li className="flex items-center text-slate-700 dark:text-slate-300"><CheckCircle className="text-primary-500 w-5 h-5 mr-3"/> Standard KYC compliance</li>
              </ul>
              <button onClick={() => openAuth('register')} className="w-full bg-slate-950 text-white rounded-full py-4 font-bold hover:bg-primary-600 transition-colors">Create Free Account</button>
            </div>
          </FadeIn>

          <FadeIn delay={200} direction="up" hover={true} className="h-full">
            <div className="bg-slate-950 border border-slate-800 rounded-[32px] p-10 flex flex-col h-full shadow-2xl relative overflow-hidden group hover:border-primary-500 transition-colors">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/20 blur-[60px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-colors"></div>
              <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Enterprise Pods</h3>
              <p className="text-slate-400 mb-8 relative z-10">Dedicated managed teams and SLAs.</p>
              <div className="text-5xl font-black text-white tracking-tight mb-8 relative z-10">Custom</div>
              <ul className="space-y-4 mb-10 flex-grow relative z-10">
                <li className="flex items-center text-slate-300"><CheckCircle className="text-cyan-400 w-5 h-5 mr-3"/> Dedicated US-based Account Manager</li>
                <li className="flex items-center text-slate-300"><CheckCircle className="text-cyan-400 w-5 h-5 mr-3"/> Custom SOC2 secure enclaves</li>
                <li className="flex items-center text-slate-300"><CheckCircle className="text-cyan-400 w-5 h-5 mr-3"/> Priority placement within 72hrs</li>
              </ul>
              <button onClick={() => openAuth('register')} className="w-full bg-white text-slate-950 rounded-full py-4 font-bold hover:bg-slate-100 transition-colors relative z-10">Contact Sales</button>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
