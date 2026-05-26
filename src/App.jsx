import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

import { PublicSite } from './pages/PublicPages';
import { ClientPortal } from './pages/ClientPages';
import { ProfessionalPortal } from './pages/ProfessionalPages';
import { AdminPortal } from './pages/AdminPages';
import { backendApi, clearAuthSession, isBackendConfigured, storeAuthSession } from './services/api';

const getDisplayNameFromEmail = (email) => {
  if (!email) return 'PB Finance User';
  return email.split('@')[0].replace(/[._-]+/g, ' ') || 'PB Finance User';
};

const createLocalSessionUser = (formData, role) => {
  const email = String(formData.get('email') || '').trim();
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
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDarkMode(!isDarkMode);
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

  const handleAuthSubmit = async (e, role = 'client', view = 'login') => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let userData = createLocalSessionUser(formData, role);

    if (isBackendConfigured()) {
      try {
        const credentials = {
          email: String(formData.get('email') || '').trim(),
          password: String(formData.get('password') || ''),
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
        return;
      }
    }

    setUser(userData);
    localStorage.setItem('pb_user', JSON.stringify(userData));
    closeAuth();
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

      {/* Auth Modal Overlay - Shared across both modes */}
      {authModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800/50">
            <div className="p-6 pb-0 flex justify-between items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-50 to-cyan-50 rounded-xl flex items-center justify-center mb-2 border border-primary-100">
                <ShieldCheck className="w-6 h-6 text-primary-600" />
              </div>
              <button onClick={closeAuth} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 bg-slate-50 dark:bg-slate-800 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
               <h2 className="text-2xl font-bold text-slate-950 dark:text-white mb-2 tracking-tight">
                {authModal.view === 'login' ? 'Welcome Back' : authModal.view === 'register' ? 'Create an Account' : 'Apply as Talent'}
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {authModal.view === 'login' ? 'Enter your details to securely access your portal.' : 'Join the premium network of global finance professionals.'}
              </p>

              {authError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {authError}
                </div>
              )}

              <form onSubmit={(e) => handleAuthSubmit(e, authModal.view === 'register_pro' ? 'professional' : 'client', authModal.view)} className="space-y-4">
                {authModal.view !== 'login' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input name="fullName" type="text" required className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="Your full name" />
                  </div>
                )}
                {authModal.view === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Company</label>
                    <input name="company" type="text" required className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="Company name" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Work Email</label>
                  <input name="email" type="email" required className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                  <input name="password" type="password" required className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="********" />
                </div>
                
                <button type="submit" className="w-full bg-slate-950 hover:bg-primary-600 text-white py-4 rounded-xl font-semibold transition-all mt-6 shadow-lg shadow-slate-900/10 text-sm">
                  {authModal.view === 'login' ? 'Sign In to Portal' : 'Continue to Dashboard'}
                </button>
              </form>
              
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-600 dark:text-slate-400">
                {authModal.view === 'login' ? (
                  <p>Don't have an account? <button onClick={() => setAuthModal({ ...authModal, view: 'register' })} className="text-primary-600 font-bold hover:underline transition-colors">Sign up</button></p>
                ) : (
                  <p>Already have an account? <button onClick={() => setAuthModal({ ...authModal, view: 'login' })} className="text-primary-600 font-bold hover:underline transition-colors">Log in</button></p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
