import React, { useEffect, useState, lazy, Suspense } from 'react';
import { ShieldCheck, X, Loader2, Eye, EyeOff } from 'lucide-react';

const PublicSite = lazy(() => import('./pages/PublicPages').then(m => ({ default: m.PublicSite })));
const ClientPortal = lazy(() => import('./pages/ClientPages').then(m => ({ default: m.ClientPortal })));
const ProfessionalPortal = lazy(() => import('./pages/ProfessionalPages').then(m => ({ default: m.ProfessionalPortal })));
const AdminPortal = lazy(() => import('./pages/AdminPages').then(m => ({ default: m.AdminPortal })));

import { backendApi, clearAuthSession, isBackendConfigured, storeAuthSession } from './services/api';

const getDisplayNameFromEmail = (email) => {
  if (!email) return 'PB Finance User';
  return email.split('@')[0].replace(/[._-]+/g, ' ') || 'PB Finance User';
};

const createLocalSessionUser = (formData, role) => {
  const email = String(formData.get('pbWorkEmail') || formData.get('email') || '').trim();
  const fullName = String(formData.get('fullName') || '').trim();
  const company = String(formData.get('company') || '').trim();
  const name = fullName || getDisplayNameFromEmail(email);

  if (role === 'professional') {
    return {
      email,
      name,
      role: 'professional',
      title: 'Complete your profile',
      location: 'Add location',
      rating: null,
    };
  }

  return {
    company: company || 'Company profile pending',
    email,
    name,
    role: 'client',
  };
};

function AuthModal({ isOpen, view, closeAuth, authError, isAuthLoading, handleAuthSubmit, setAuthModal }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuth();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row">

        {/* Left Side: Modern Brand Panel */}
        <div className="hidden md:flex flex-col justify-between w-2/5 p-10 bg-gradient-to-br from-slate-900 to-primary-950 relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform -translate-x-1/2 translate-y-1/2"></div>

          <div className="relative z-10 flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-5 h-5 text-cyan-300" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white/90">PB Finance</span>
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              {view === 'login' ? 'Welcome back to your portal.' : view === 'register' ? 'Elevate your financial operations.' : 'Join the elite talent network.'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              {view === 'login'
                ? 'Access your dashboard to manage opportunities, track earnings, and discover top financial talent.'
                : 'Connect with industry-leading professionals and streamline your financial operations with absolute security.'}
            </p>
          </div>

          <div className="relative z-10 text-xs font-medium text-slate-400">
            Secure, encrypted, and trusted by leading firms.
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-3/5 p-8 sm:p-10 lg:p-12 overflow-y-auto max-h-[90vh] bg-white dark:bg-slate-900 relative">
          <button onClick={closeAuth} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 bg-slate-50 dark:bg-slate-800 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X size={20} />
          </button>

          <div className="max-w-sm mx-auto py-8 flex flex-col justify-center min-h-full">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight mb-2">
                {view === 'login' ? 'Sign In' : view === 'register' ? 'Create Client Account' : 'Apply as Talent'}
              </h2>
              <p className="text-slate-500 text-sm">
                {view === 'login' ? 'Enter your credentials to continue.' : 'Fill out the details below to get started.'}
              </p>
            </div>

            {authError && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                {authError}
              </div>
            )}

            <form onSubmit={(e) => handleAuthSubmit(e, view === 'register_pro' ? 'professional' : 'client', view)} className="space-y-5" autoComplete="off" data-1p-ignore="true" data-form-type="other" data-lpignore="true">
              {view !== 'login' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Full Name</label>
                  <input name="fullName" type="text" required className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium" placeholder="Your full name" />
                </div>
              )}
              {view === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Company</label>
                  <input name="company" type="text" required className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium" placeholder="Company name" />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Work Email</label>
                <input name="pbWorkEmail" type="email" required autoComplete="off" data-1p-ignore="true" data-form-type="other" data-lpignore="true" className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium" placeholder="email@example.com" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <input name="pbAuthPasscode" type={showPassword ? "text" : "password"} minLength={8} required autoComplete="new-password" data-1p-ignore="true" data-form-type="other" data-lpignore="true" className="w-full px-5 py-3.5 pr-12 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium" placeholder="********" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              {view !== 'login' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Confirm Password</label>
                  <div className="relative">
                    <input name="pbAuthPasscodeConfirm" type={showConfirmPassword ? "text" : "password"} minLength={8} required autoComplete="new-password" data-1p-ignore="true" data-form-type="other" data-lpignore="true" className="w-full px-5 py-3.5 pr-12 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium" placeholder="********" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={isAuthLoading} className="w-full bg-slate-950 hover:bg-primary-600 text-white py-4 rounded-2xl font-bold transition-all mt-4 shadow-lg shadow-slate-900/10 text-sm disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center group">
                {isAuthLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                {isAuthLoading ? 'Please wait...' : view === 'login' ? 'Sign In to Portal' : 'Continue to Dashboard'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-600 dark:text-slate-400">
              {view === 'login' ? (
                <p>Don't have an account? <button onClick={() => setAuthModal({ isOpen: true, view: 'register' })} className="text-primary-600 font-bold hover:text-primary-700 hover:underline transition-colors">Sign up as Client</button> or <button onClick={() => setAuthModal({ isOpen: true, view: 'register_pro' })} className="text-primary-600 font-bold hover:text-primary-700 hover:underline transition-colors">Apply as Talent</button></p>
              ) : (
                <p>Already have an account? <button onClick={() => setAuthModal({ isOpen: true, view: 'login' })} className="text-primary-600 font-bold hover:text-primary-700 hover:underline transition-colors">Log in</button></p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pb_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [authModal, setAuthModal] = useState({ isOpen: false, view: 'login' });
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      if (saved === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return saved === 'dark';
    }
    return document.documentElement.classList.contains('dark');
  });
  const currentUserId = user?.id;

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const openAuth = (view = 'login') => {
    setAuthError('');
    setAuthModal({ isOpen: true, view });
  };
  const closeAuth = () => setAuthModal({ isOpen: false, view: 'login' });

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');

    if (!hash) return;

    const params = new URLSearchParams(hash);
    const errorDescription = params.get('error_description');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!errorDescription && !accessToken) return;

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);

    if (errorDescription) {
      setAuthError(errorDescription);
      setAuthModal({ isOpen: true, view: 'login' });
      return;
    }

    storeAuthSession({ token: accessToken, refreshToken });

    backendApi.auth.me()
      .then((result) => {
        if (!result?.user) {
          throw new Error('Missing confirmed user session.');
        }

        setUser(result.user);
        localStorage.setItem('pb_user', JSON.stringify(result.user));
        setAuthModal({ isOpen: false, view: 'login' });
      })
      .catch(() => {
        clearAuthSession();
        setAuthError('Email confirmed. Please log in with your email and password.');
        setAuthModal({ isOpen: true, view: 'login' });
      });
  }, []);

  useEffect(() => {
    if (!currentUserId || !isBackendConfigured()) {
      return undefined;
    }

    let isMounted = true;

    backendApi.auth.me()
      .then((result) => {
        if (!isMounted || !result?.user) return;

        setUser((currentUser) => {
          const nextUser = {
            ...(currentUser || {}),
            ...result.user,
          };

          localStorage.setItem('pb_user', JSON.stringify(nextUser));
          return nextUser;
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    const handleAuthUpdate = () => {
      if (!localStorage.getItem('pb_auth_token')) {
        setUser(null);
        localStorage.removeItem('pb_user');
      }
    };
    window.addEventListener('pb-auth-updated', handleAuthUpdate);
    return () => window.removeEventListener('pb-auth-updated', handleAuthUpdate);
  }, []);

  const handleAuthSubmit = async (e, role = 'client', view = 'login') => {
    e.preventDefault();
    setIsAuthLoading(true);
    const formData = new FormData(e.currentTarget);

    if (view !== 'login') {
      const password = String(formData.get('pbAuthPasscode') || formData.get('password') || '');
      const confirmPassword = String(formData.get('pbAuthPasscodeConfirm') || '');
      if (password !== confirmPassword) {
        setAuthError('Passwords do not match.');
        setIsAuthLoading(false);
        return;
      }
    }

    let userData = createLocalSessionUser(formData, role);

    if (isBackendConfigured()) {
      try {
        const credentials = {
          email: String(formData.get('pbWorkEmail') || formData.get('email') || '').trim(),
          password: String(formData.get('pbAuthPasscode') || formData.get('password') || ''),
        };
        const payload = {
          ...credentials,
          company: String(formData.get('company') || '').trim(),
          fullName: String(formData.get('fullName') || '').trim(),
          redirectTo: window.location.origin,
          role,
        };
        const result = view === 'login'
          ? await backendApi.auth.login(credentials)
          : await backendApi.auth.register(payload);

        if (result?.requiresEmailConfirmation) {
          setAuthError(result.message || 'Check your email to confirm your account before signing in.');
          setIsAuthLoading(false);
          return;
        }

        if (!result?.token) {
          throw new Error('Authentication did not return a session. Please try again.');
        }

        storeAuthSession(result);

        userData = {
          ...userData,
          ...(result?.user || {}),
          role: result?.user?.role || role,
        };
      } catch (error) {
        setAuthError(error.message || 'Unable to authenticate. Please try again.');
        setIsAuthLoading(false);
        return;
      }
    }

    setUser(userData);
    localStorage.setItem('pb_user', JSON.stringify(userData));
    closeAuth();
    setIsAuthLoading(false);
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    if (isBackendConfigured()) {
      backendApi.auth.logout().catch(() => {});
    }

    setUser(null);
    localStorage.removeItem('pb_user');
    clearAuthSession();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 scroll-smooth selection:bg-primary-500/30">

      {/* Conditional Rendering: Entire UI changes if logged in */}
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary-500" size={32} /></div>}>
        {user ? (
          user.role === 'admin' ? (
            <AdminPortal user={user} onLogout={handleLogout} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
          ) : user.role === 'professional' ? (
            <ProfessionalPortal user={user} onLogout={handleLogout} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
          ) : (
            <ClientPortal user={user} onLogout={handleLogout} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
          )
        ) : (
          <PublicSite openAuth={openAuth} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        )}
      </Suspense>

      <AuthModal
        isOpen={authModal.isOpen}
        view={authModal.view}
        closeAuth={closeAuth}
        authError={authError}
        isAuthLoading={isAuthLoading}
        handleAuthSubmit={handleAuthSubmit}
        setAuthModal={setAuthModal}
      />
    </div>
  );
}
