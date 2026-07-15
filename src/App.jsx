import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { ShieldCheck, Loader2, Eye, EyeOff, MailCheck } from 'lucide-react';
import { Button } from './components/ui/Button';
import { FormField } from './components/ui/FormField';
import { Modal } from './components/ui/Modal';

const PublicSite = lazy(() => import('./pages/PublicPages').then(m => ({ default: m.PublicSite })));
const ClientPortal = lazy(() => import('./pages/ClientPages').then(m => ({ default: m.ClientPortal })));
const ProfessionalPortal = lazy(() => import('./pages/ProfessionalPages').then(m => ({ default: m.ProfessionalPortal })));
const AdminPortal = lazy(() => import('./pages/AdminPages').then(m => ({ default: m.AdminPortal })));

import { backendApi, clearAuthSession, isBackendConfigured, storeAuthSession } from './services/api';

const GOOGLE_OAUTH_POPUP_NAME = 'pb-google-signin';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const symbolPattern = /[^A-Za-z0-9]/;

const getPasswordRequirementError = (password) => {
  const value = String(password || '');

  if (value.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !symbolPattern.test(value)) {
    return 'Password must include lowercase, uppercase, a number, and a symbol.';
  }

  return '';
};

const formValue = (source, key) => (
  source instanceof FormData
    ? String(source.get(key) || '').trim()
    : String(source?.[key] || '').trim()
);

const validateAuthValues = (source, role = 'client', view = 'login') => {
  const errors = {};
  const email = formValue(source, 'pbWorkEmail') || formValue(source, 'email');
  const password = source instanceof FormData
    ? String(source.get('pbAuthPasscode') || source.get('password') || '')
    : String(source?.pbAuthPasscode || source?.password || '');

  if (!emailPattern.test(email)) {
    errors.pbWorkEmail = 'Enter a valid email address.';
  }

  if (!password) {
    errors.pbAuthPasscode = 'Password is required.';
  } else if (view !== 'login') {
    const passwordError = getPasswordRequirementError(password);

    if (passwordError) {
      errors.pbAuthPasscode = passwordError;
    }
  }

  if (view !== 'login') {
    const fullName = formValue(source, 'fullName');
    const company = formValue(source, 'company');
    const confirmPassword = source instanceof FormData
      ? String(source.get('pbAuthPasscodeConfirm') || '')
      : String(source?.pbAuthPasscodeConfirm || '');

    if (!fullName) {
      errors.fullName = 'Full name is required.';
    }

    if (role === 'client' && !company) {
      errors.company = 'Company is required.';
    }

    if (!confirmPassword) {
      errors.pbAuthPasscodeConfirm = 'Confirm your password.';
    } else if (password && password !== confirmPassword) {
      errors.pbAuthPasscodeConfirm = 'Passwords do not match.';
    }
  }

  return errors;
};

const validateGoogleStartValues = (source, view = 'login') => {
  const errors = {};

  if (view === 'register' && !formValue(source, 'googleCompany')) {
    errors.googleCompany = 'Company is required for Google sign-up.';
  }

  return errors;
};

const validateGoogleLinkValues = (source) => {
  const errors = {};
  const password = source instanceof FormData
    ? String(source.get('pbAuthPasscode') || '')
    : String(source?.pbAuthPasscode || '');

  if (!password) {
    errors.pbAuthPasscode = 'Enter the password for the existing email account.';
  }

  return errors;
};

const validatePasswordSetupValues = (source) => {
  const errors = {};
  const password = source instanceof FormData
    ? String(source.get('pbAuthPasscode') || '')
    : String(source?.pbAuthPasscode || '');
  const confirmPassword = source instanceof FormData
    ? String(source.get('pbAuthPasscodeConfirm') || '')
    : String(source?.pbAuthPasscodeConfirm || '');
  const passwordError = getPasswordRequirementError(password);

  if (passwordError) {
    errors.pbAuthPasscode = passwordError;
  }

  if (!confirmPassword) {
    errors.pbAuthPasscodeConfirm = 'Confirm your password.';
  } else if (password && password !== confirmPassword) {
    errors.pbAuthPasscodeConfirm = 'Passwords do not match.';
  }

  return errors;
};

const validateGoogleCompanyValues = (source) => {
  const errors = {};

  if (!formValue(source, 'company')) {
    errors.company = 'Company is required.';
  }

  return errors;
};

const hasErrors = (errors) => Object.keys(errors).length > 0;

const authNoticeMatches = (message, patterns) => {
  const normalized = String(message || '').toLowerCase();

  return patterns.some((pattern) => pattern.test(normalized));
};

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
      professionalPermissions: {
        canAccessDashboard: false,
        canAppearInTalentPool: false,
        canCommentOnJobPosts: false,
        canContactClientsFromJobs: false,
        canToggleProfileVisibility: false,
        canViewFullClientProfiles: false,
        label: 'Unverified',
        tier: 'unverified',
      },
      professionalTier: 'unverified',
      professional_tier: 'unverified',
      profileVisibility: 'hidden',
      profile_visibility: 'hidden',
      role: 'professional',
      title: 'Complete your profile',
      location: 'Add location',
      rating: null,
    };
  }

  return {
    clientTier: 'basic',
    client_tier: 'basic',
    company: company || 'Company profile pending',
    email,
    name,
    role: 'client',
  };
};

function AuthModalContent({
  view,
  authError,
  authNotice,
  authStep,
  fieldErrors,
  pendingAccountLink,
  isAuthLoading,
  handleAccountLinkOtpSubmit,
  handleAccountLinkSubmit,
  handleAuthSubmit,
  handleGoogleCompanySubmit,
  handleGoogleAuth,
  handleOtpSubmit,
  handlePasswordSetupGoogleConfirm,
  handlePasswordSetupSubmit,
  switchAuthView,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formDraft, setFormDraft] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  const isRegistering = view !== 'login';
  const isRegistrationOtp = isRegistering && authStep === 'verify';
  const isGoogleLinkPassword = authStep === 'google_link_password';
  const isGoogleLinkOtp = authStep === 'google_link_verify';
  const isPasswordSetup = authStep === 'password_setup';
  const isPasswordSetupOtp = authStep === 'password_setup_verify';
  const isPasswordSetupGoogle = authStep === 'password_setup_google';
  const isGoogleCompany = authStep === 'google_company';
  const isOtpStep = isRegistrationOtp || isGoogleLinkOtp || isPasswordSetupOtp;
  const role = view === 'register_pro' ? 'professional' : 'client';
  const draftErrors = isOtpStep
    ? {}
    : isGoogleLinkPassword
      ? validateGoogleLinkValues(formDraft)
      : isGoogleCompany
        ? validateGoogleCompanyValues(formDraft)
      : isPasswordSetup
        ? validatePasswordSetupValues(formDraft)
        : validateAuthValues(formDraft, role, view);
  const googleDraftErrors = validateGoogleStartValues(formDraft, view);
  const emailSubmitDisabled = isAuthLoading || hasErrors(draftErrors);
  const googleSubmitDisabled = isAuthLoading || hasErrors(googleDraftErrors);
  const googleLabel = view === 'login' ? 'Continue with Google' : 'Sign up with Google';
  const hasInteractedWithEmailForm = Object.keys(touchedFields).length > 0;
  const showFieldError = (field) => fieldErrors?.[field] || (hasInteractedWithEmailForm ? draftErrors[field] : '');
  const showGoogleFieldError = (field) => fieldErrors?.[field] || (touchedFields[field] ? googleDraftErrors[field] : '');
  const otpSubmitLabel = isGoogleLinkOtp
    ? 'Verify and Link Google'
    : isPasswordSetupOtp
      ? 'Verify and Add Password'
      : 'Verify and Create Account';
  const redundantNoticePatterns = [
    ...(isOtpStep ? [/code sent/, /verification code/, /enter.*code/] : []),
    ...(isGoogleLinkPassword ? [/already.*account/, /email\/password.*account/, /link.*google/] : []),
    ...(isGoogleCompany ? [/company.*required/, /company name/] : []),
    ...(isPasswordSetup ? [/registered with google/, /create.*password/, /email\/password login/] : []),
    ...(isPasswordSetupGoogle ? [/email verified/, /continue with google/, /adding email\/password/] : []),
  ];
  const visibleAuthNotice = authNotice
    && !authError
    && !authNoticeMatches(authNotice, redundantNoticePatterns);
  const handleFieldInput = (event) => {
    const { name, value } = event.target;

    if (!name) return;

    setFormDraft((current) => ({
      ...current,
      [name]: value,
    }));
    setTouchedFields((current) => ({
      ...current,
      [name]: true,
    }));
  };

  return (
    <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-stretch">

        {/* Left Side: Modern Brand Panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden rounded-card bg-pb-midnight p-8 text-white md:flex">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-action/20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-processing/20 blur-3xl"></div>

          <div className="relative z-10 flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <ShieldCheck className="h-5 w-5 text-processing" aria-hidden="true" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white/90">PB Finance</span>
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              {view === 'login' ? 'Welcome back to your portal.' : view === 'register' ? 'Elevate your financial operations.' : 'Join the elite talent network.'}
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-white/75">
              {view === 'login'
                ? 'Access your dashboard to manage opportunities, track earnings, and discover top financial talent.'
                : 'Connect with industry-leading professionals and streamline your financial operations with absolute security.'}
            </p>
          </div>

          <div className="relative z-10 text-xs font-medium text-white/60">
            Secure, encrypted, and trusted by leading firms.
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="relative w-full rounded-card border border-border-subtle bg-surface p-5 sm:p-7">
          <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center">

            {authError && (
              <div className="mb-6 rounded-control border border-danger-border bg-danger-surface px-5 py-4 text-sm font-semibold text-danger" role="alert">
                {authError}
              </div>
            )}

            {visibleAuthNotice && (
              <div className="mb-6 rounded-control border border-processing-border bg-processing-surface px-5 py-4 text-sm font-semibold text-processing" role="status" aria-live="polite">
                {visibleAuthNotice}
              </div>
            )}

            {isOtpStep ? (
              <form onSubmit={isRegistrationOtp ? handleOtpSubmit : handleAccountLinkOtpSubmit} className="space-y-5" autoComplete="one-time-code">
                <div className="rounded-control border border-processing-border bg-processing-surface p-4 text-processing" role="status" aria-live="polite">
                  <div className="mb-2 flex items-center gap-2 text-sm font-black">
                    <MailCheck size={18} aria-hidden="true" />
                    Code sent
                  </div>
                  <p className="text-xs font-semibold leading-relaxed">
                    The code expires in 10 minutes.
                  </p>
                </div>

                <FormField id="auth-otp" label="Verification Code" error={fieldErrors?.otp} required>
                  {({ className, describedBy, ...fieldProps }) => (
                    <input
                      {...fieldProps}
                      id="auth-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                      className={`${className} text-center text-2xl font-black tracking-[0.3em]`}
                      placeholder="000000"
                    />
                  )}
                </FormField>

                <Button type="submit" variant="primary" size="lg" disabled={isAuthLoading} className="mt-4 w-full">
                  {isAuthLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                  {isAuthLoading ? 'Please wait...' : otpSubmitLabel}
                </Button>

                <Button type="button" variant="ghost" size="md" onClick={() => switchAuthView(view)} className="w-full text-action">
                  {isRegistrationOtp ? 'Use a different email' : 'Cancel account linking'}
                </Button>
              </form>
            ) : isGoogleLinkPassword ? (
              <form onSubmit={handleAccountLinkSubmit} onInput={handleFieldInput} noValidate className="space-y-5" autoComplete="off">
                <FormField id="auth-existing-password" label="Existing Account Password" error={showFieldError('pbAuthPasscode')} required>
                  {({ className, describedBy, ...fieldProps }) => (
                    <div className="relative">
                      <input
                        {...fieldProps}
                        id="auth-existing-password"
                        name="pbAuthPasscode"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                        className={`${className} pr-12`}
                        placeholder="********"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 !p-2 text-text-muted"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                      </Button>
                    </div>
                  )}
                </FormField>

                <Button type="submit" variant="primary" size="lg" disabled={emailSubmitDisabled} className="mt-4 w-full">
                  {isAuthLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                  {isAuthLoading ? 'Please wait...' : 'Send Verification Code'}
                </Button>

                <Button type="button" variant="ghost" size="md" onClick={() => switchAuthView('login')} className="w-full text-action">
                  Cancel account linking
                </Button>
              </form>
            ) : isGoogleCompany ? (
              <form onSubmit={handleGoogleCompanySubmit} onInput={handleFieldInput} noValidate className="space-y-5" autoComplete="off">
                <FormField id="auth-google-company" label="Company" error={showFieldError('company')} required>
                  {({ className, describedBy, ...fieldProps }) => (
                    <input
                      {...fieldProps}
                      id="auth-google-company"
                      name="company"
                      type="text"
                      aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                      className={className}
                      placeholder="Company name"
                    />
                  )}
                </FormField>

                <Button type="submit" variant="primary" size="lg" disabled={emailSubmitDisabled} className="mt-4 w-full">
                  {isAuthLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                  {isAuthLoading ? 'Please wait...' : 'Continue'}
                </Button>

                <Button type="button" variant="ghost" size="md" onClick={() => switchAuthView('login')} className="w-full text-action">
                  Back to login
                </Button>
              </form>
            ) : isPasswordSetup ? (
              <form onSubmit={handlePasswordSetupSubmit} onInput={handleFieldInput} noValidate className="space-y-5" autoComplete="off">
                <FormField id="auth-setup-email" label="Email">
                  {({ className, describedBy, ...fieldProps }) => (
                    <input
                      {...fieldProps}
                      id="auth-setup-email"
                      name="email"
                      type="email"
                      readOnly
                      value={pendingAccountLink?.email || ''}
                      aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                      className={`${className} bg-surface-muted text-text-muted`}
                    />
                  )}
                </FormField>

                <FormField id="auth-new-password" label="New Password" error={showFieldError('pbAuthPasscode')} required>
                  {({ className, describedBy, ...fieldProps }) => (
                    <div className="relative">
                      <input
                        {...fieldProps}
                        id="auth-new-password"
                        name="pbAuthPasscode"
                        type={showPassword ? "text" : "password"}
                        minLength={8}
                        autoComplete="new-password"
                        aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                        className={`${className} pr-12`}
                        placeholder="********"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 !p-2 text-text-muted"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                      </Button>
                    </div>
                  )}
                </FormField>

                <FormField id="auth-confirm-password" label="Confirm Password" error={showFieldError('pbAuthPasscodeConfirm')} required>
                  {({ className, describedBy, ...fieldProps }) => (
                    <div className="relative">
                      <input
                        {...fieldProps}
                        id="auth-confirm-password"
                        name="pbAuthPasscodeConfirm"
                        type={showConfirmPassword ? "text" : "password"}
                        minLength={8}
                        autoComplete="new-password"
                        aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                        className={`${className} pr-12`}
                        placeholder="********"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 !p-2 text-text-muted"
                        aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                      >
                        {showConfirmPassword ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                      </Button>
                    </div>
                  )}
                </FormField>

                <Button type="submit" variant="primary" size="lg" disabled={emailSubmitDisabled} className="mt-4 w-full">
                  {isAuthLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                  {isAuthLoading ? 'Please wait...' : 'Send Verification Code'}
                </Button>

                <Button type="button" variant="ghost" size="md" onClick={() => switchAuthView('login')} className="w-full text-action">
                  Back to login
                </Button>
              </form>
            ) : isPasswordSetupGoogle ? (
              <div className="space-y-5">
                <Button type="button" variant="outline" size="lg" disabled={isAuthLoading} onClick={handlePasswordSetupGoogleConfirm} className="w-full gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface text-sm font-black text-text-primary" aria-hidden="true">G</span>
                  {isAuthLoading ? 'Please wait...' : 'Continue with Google'}
                </Button>

                <Button type="button" variant="ghost" size="md" onClick={() => switchAuthView('login')} className="w-full text-action">
                  Back to login
                </Button>
              </div>
            ) : (
              <>
                {view === 'register' && (
                  <div className="mb-4">
                    <FormField id="auth-google-start-company" label="Company for Google Sign-Up" error={showGoogleFieldError('googleCompany')} required>
                      {({ className, describedBy, ...fieldProps }) => (
                        <input
                          {...fieldProps}
                          id="auth-google-start-company"
                          name="googleCompany"
                          type="text"
                          onInput={handleFieldInput}
                          aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                          className={className}
                          placeholder="Company name"
                        />
                      )}
                    </FormField>
                  </div>
                )}

                <Button type="button" variant="outline" size="lg" disabled={googleSubmitDisabled} onClick={() => handleGoogleAuth(view, { company: formValue(formDraft, 'googleCompany') })} className="mb-5 w-full gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface text-sm font-black text-text-primary" aria-hidden="true">G</span>
                  {isAuthLoading ? 'Please wait...' : googleLabel}
                </Button>

                <div className="mb-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border-subtle"></div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-text-muted">Email</div>
                  <div className="h-px flex-1 bg-border-subtle"></div>
                </div>

                <form onSubmit={(e) => handleAuthSubmit(e, view === 'register_pro' ? 'professional' : 'client', view)} onInput={handleFieldInput} noValidate className="space-y-5" autoComplete="off" data-1p-ignore="true" data-form-type="other" data-lpignore="true">
                  {view !== 'login' && (
                    <FormField id="auth-full-name" label="Full Name" error={showFieldError('fullName')} required>
                      {({ className, describedBy, ...fieldProps }) => (
                        <input
                          {...fieldProps}
                          id="auth-full-name"
                          name="fullName"
                          type="text"
                          aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                          className={className}
                          placeholder="Your full name"
                        />
                      )}
                    </FormField>
                  )}
                  {view === 'register' && (
                    <FormField id="auth-company" label="Company" error={showFieldError('company')} required>
                      {({ className, describedBy, ...fieldProps }) => (
                        <input
                          {...fieldProps}
                          id="auth-company"
                          name="company"
                          type="text"
                          aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                          className={className}
                          placeholder="Company name"
                        />
                      )}
                    </FormField>
                  )}
                  <FormField id="auth-work-email" label="Email" error={showFieldError('pbWorkEmail')} required>
                    {({ className, describedBy, ...fieldProps }) => (
                      <input
                        {...fieldProps}
                        id="auth-work-email"
                        name="pbWorkEmail"
                        type="email"
                        autoComplete="off"
                        aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                        data-1p-ignore="true"
                        data-form-type="other"
                        data-lpignore="true"
                        className={className}
                        placeholder="email@example.com"
                      />
                    )}
                  </FormField>

                  <FormField id="auth-password" label="Password" error={showFieldError('pbAuthPasscode')} required>
                    {({ className, describedBy, ...fieldProps }) => (
                      <div className="relative">
                        <input
                          {...fieldProps}
                          id="auth-password"
                          name="pbAuthPasscode"
                          type={showPassword ? "text" : "password"}
                          minLength={8}
                          autoComplete="new-password"
                          aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                          data-1p-ignore="true"
                          data-form-type="other"
                          data-lpignore="true"
                          className={`${className} pr-12`}
                          placeholder="********"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 !p-2 text-text-muted"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                        </Button>
                      </div>
                    )}
                  </FormField>

                  {view !== 'login' && (
                    <FormField id="auth-password-confirm" label="Confirm Password" error={showFieldError('pbAuthPasscodeConfirm')} required>
                      {({ className, describedBy, ...fieldProps }) => (
                        <div className="relative">
                          <input
                            {...fieldProps}
                            id="auth-password-confirm"
                            name="pbAuthPasscodeConfirm"
                            type={showConfirmPassword ? "text" : "password"}
                            minLength={8}
                            autoComplete="new-password"
                            aria-describedby={fieldProps['aria-describedby'] ? describedBy : undefined}
                            data-1p-ignore="true"
                            data-form-type="other"
                            data-lpignore="true"
                            className={`${className} pr-12`}
                            placeholder="********"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 !p-2 text-text-muted"
                            aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                          >
                            {showConfirmPassword ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                          </Button>
                        </div>
                      )}
                    </FormField>
                  )}

                  <Button type="submit" variant="primary" size="lg" disabled={emailSubmitDisabled} className="mt-4 w-full">
                    {isAuthLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                    {isAuthLoading ? 'Please wait...' : view === 'login' ? 'Sign In to Portal' : 'Send Verification Code'}
                  </Button>
                </form>
              </>
            )}

            {!isGoogleLinkPassword && !isGoogleCompany && !isPasswordSetup && !isPasswordSetupGoogle && !isGoogleLinkOtp && !isPasswordSetupOtp && (
              <div className="mt-8 border-t border-border-subtle pt-6 text-center text-sm text-text-muted">
                {view === 'login' ? (
                  <p>
                    Don't have an account?{' '}
                    <Button type="button" variant="ghost" size="sm" onClick={() => switchAuthView('register')} className="!px-1 !py-0 text-action hover:underline">
                      Sign up as Client
                    </Button>{' '}
                    or{' '}
                    <Button type="button" variant="ghost" size="sm" onClick={() => switchAuthView('register_pro')} className="!px-1 !py-0 text-action hover:underline">
                      Apply as Talent
                    </Button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <Button type="button" variant="ghost" size="sm" onClick={() => switchAuthView('login')} className="!px-1 !py-0 text-action hover:underline">
                      Log in
                    </Button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

function AuthModal(props) {
  const {
    isOpen,
    view,
    closeAuth,
    authStep,
    pendingAccountLink,
    pendingRegistration,
  } = props;
  const isRegistering = view !== 'login';
  const isRegistrationOtp = isRegistering && authStep === 'verify';
  const isGoogleLinkPassword = authStep === 'google_link_password';
  const isGoogleLinkOtp = authStep === 'google_link_verify';
  const isPasswordSetup = authStep === 'password_setup';
  const isPasswordSetupOtp = authStep === 'password_setup_verify';
  const isPasswordSetupGoogle = authStep === 'password_setup_google';
  const isGoogleCompany = authStep === 'google_company';
  const isOtpStep = isRegistrationOtp || isGoogleLinkOtp || isPasswordSetupOtp;
  const otpEmail = pendingRegistration?.email || pendingAccountLink?.email || 'your email';
  const authTitle = isOtpStep
    ? 'Verify Your Email'
    : isGoogleLinkPassword
      ? 'Link Google Sign-In'
      : isGoogleCompany
        ? 'Company Required'
        : isPasswordSetup || isPasswordSetupGoogle
          ? 'Create Email Password'
          : view === 'login'
            ? 'Sign In'
            : view === 'register'
              ? 'Create Client Account'
              : 'Apply as Talent';
  const authDescription = isOtpStep
    ? `Enter the code sent to ${otpEmail}.`
    : isGoogleLinkPassword
      ? `An email/password account already exists for ${pendingAccountLink?.email || 'this email'}. Enter that account password first.`
      : isGoogleCompany
        ? 'Add your company name before continuing with this Google account.'
        : isPasswordSetupGoogle
          ? 'Email verified. Continue with Google to finish adding email/password login.'
          : isPasswordSetup
            ? `This email is registered with Google Sign-In. Create a password for ${pendingAccountLink?.email || 'this email'}.`
            : view === 'login'
              ? 'Enter your credentials to continue.'
              : 'Fill out the details below to get started.';

  return (
    <Modal
      open={isOpen}
      onClose={closeAuth}
      size="wide"
      title={authTitle}
      description={authDescription}
    >
      <AuthModalContent key={`${isOpen}-${view}-${authStep}`} {...props} />
    </Modal>
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
  const [authNotice, setAuthNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [authStep, setAuthStep] = useState('form');
  const [pendingAccountLink, setPendingAccountLink] = useState(null);
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const oauthPopupRef = useRef(null);
  const oauthCleanupRef = useRef(null);
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

  const resetAuthFlow = () => {
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});
    setAuthStep('form');
    setPendingAccountLink(null);
    setPendingRegistration(null);
  };

  const openAuth = (view = 'login') => {
    resetAuthFlow();
    setAuthModal({ isOpen: true, view });
  };
  const closeAuth = () => {
    oauthCleanupRef.current?.();
    oauthPopupRef.current?.close();
    oauthPopupRef.current = null;
    if (['google_to_password', 'google_company'].includes(pendingAccountLink?.mode)) {
      clearAuthSession();
    }
    setIsAuthLoading(false);
    resetAuthFlow();
    setAuthModal({ isOpen: false, view: 'login' });
  };

  const switchAuthView = (view = 'login') => {
    if (['google_to_password', 'google_company'].includes(pendingAccountLink?.mode)) {
      clearAuthSession();
    }
    resetAuthFlow();
    setAuthModal({ isOpen: true, view });
  };

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');

    if (!hash) return;

    const params = new URLSearchParams(hash);
    const errorDescription = params.get('error_description');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const isOAuthPopup = window.opener && window.name === GOOGLE_OAUTH_POPUP_NAME;
    const oauthPending = localStorage.getItem('pb_oauth_pending') === '1';
    const oauthRole = localStorage.getItem('pb_oauth_role') || '';
    const oauthCompany = localStorage.getItem('pb_oauth_company') || '';

    if (!errorDescription && !accessToken) return;

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);

    if (isOAuthPopup) {
      window.opener.postMessage({
        accessToken,
        errorDescription,
        refreshToken,
        type: 'pb-google-oauth',
      }, window.location.origin);
      window.close();
      return;
    }

    if (errorDescription) {
      localStorage.removeItem('pb_oauth_pending');
      localStorage.removeItem('pb_oauth_role');
      localStorage.removeItem('pb_oauth_company');
      setAuthError(errorDescription);
      setAuthModal({ isOpen: true, view: 'login' });
      return;
    }

    storeAuthSession({ token: accessToken, refreshToken });

    const profileRequest = oauthPending
      ? backendApi.auth.finalizeOAuth({ company: oauthCompany, role: oauthRole })
      : backendApi.auth.me();

    profileRequest
      .then((result) => {
        if (result?.requiresAccountLink) {
          setPendingAccountLink({
            company: oauthCompany,
            email: result.email,
            mode: 'google_to_password',
            role: oauthRole,
          });
          setAuthNotice('');
          setAuthStep('google_link_password');
          setAuthModal({ isOpen: true, view: 'login' });
          return;
        }

        if (result?.requiresCompany) {
          setPendingAccountLink({
            email: result.email,
            mode: 'google_company',
            role: 'client',
          });
          setAuthNotice('');
          setAuthStep('google_company');
          setAuthModal({ isOpen: true, view: 'login' });
          return;
        }

        if (!result?.user) {
          throw new Error('Missing confirmed user session.');
        }

        setUser(result.user);
        localStorage.setItem('pb_user', JSON.stringify(result.user));
        setAuthModal({ isOpen: false, view: 'login' });
      })
      .catch(() => {
        clearAuthSession();
        setAuthError(oauthPending ? 'Google Sign-In completed, but your profile could not be loaded.' : 'Email confirmed. Please log in with your email and password.');
        setAuthModal({ isOpen: true, view: 'login' });
      })
      .finally(() => {
        localStorage.removeItem('pb_oauth_pending');
        localStorage.removeItem('pb_oauth_role');
        localStorage.removeItem('pb_oauth_company');
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

  useEffect(() => () => {
    oauthCleanupRef.current?.();
    oauthPopupRef.current?.close();
  }, []);

  const handleAuthSubmit = async (e, role = 'client', view = 'login') => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});
    const formData = new FormData(e.currentTarget);
    const validationErrors = validateAuthValues(formData, role, view);

    if (hasErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsAuthLoading(true);

    let userData = createLocalSessionUser(formData, role);

    if (isBackendConfigured()) {
      const credentials = {
        email: String(formData.get('pbWorkEmail') || formData.get('email') || '').trim(),
        password: String(formData.get('pbAuthPasscode') || formData.get('password') || ''),
      };

      try {
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

        if (result?.requiresOtpVerification) {
          setPendingRegistration({
            email: result.email || payload.email,
            role,
            verificationToken: result.verificationToken,
          });
          setAuthNotice('');
          setAuthStep('verify');
          setIsAuthLoading(false);
          return;
        }

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
        if (error.body?.requiresPasswordSetup) {
          setPendingAccountLink({
            email: error.body.email || credentials.email,
            mode: 'password_setup',
          });
          setAuthNotice('');
          setAuthStep('password_setup');
          setAuthModal({ isOpen: true, view: 'login' });
          setIsAuthLoading(false);
          return;
        }

        setAuthError(error.message || 'Unable to authenticate. Please try again.');
        setFieldErrors({});
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

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const otp = String(formData.get('otp') || '').trim();

    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: 'Enter the 6-digit verification code.' });
      return;
    }

    setIsAuthLoading(true);

    if (!pendingRegistration?.verificationToken) {
      setAuthError('Verification session expired. Please request a new code.');
      setAuthStep('form');
      setIsAuthLoading(false);
      return;
    }

    try {
      const result = await backendApi.auth.verifyRegistration({
        otp,
        verificationToken: pendingRegistration.verificationToken,
      });

      if (result?.requiresEmailConfirmation) {
        setPendingRegistration(null);
        setAuthStep('form');
        setAuthModal({ isOpen: true, view: 'login' });
        setAuthNotice(result.message || 'Email verified. Please confirm your account before signing in.');
        setIsAuthLoading(false);
        return;
      }

      if (!result?.token) {
        throw new Error('Authentication did not return a session. Please try again.');
      }

      storeAuthSession(result);

      const userData = {
        ...(result?.user || {}),
        role: result?.user?.role || pendingRegistration.role || 'client',
      };

      setUser(userData);
      localStorage.setItem('pb_user', JSON.stringify(userData));
      closeAuth();
      window.scrollTo(0, 0);
    } catch (error) {
      setAuthError(error.message || 'Unable to verify your code.');
      setFieldErrors({});
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAccountLinkSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const validationErrors = validateGoogleLinkValues(formData);

    if (hasErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    if (!pendingAccountLink?.email || pendingAccountLink.mode !== 'google_to_password') {
      setAuthError('Google account linking expired. Please start Google Sign-In again.');
      setAuthStep('form');
      clearAuthSession();
      return;
    }

    setIsAuthLoading(true);

    try {
      const result = await backendApi.auth.requestGoogleLink({
        company: pendingAccountLink.company || '',
        password: String(formData.get('pbAuthPasscode') || ''),
        role: pendingAccountLink.role || '',
      });

      setPendingAccountLink((current) => ({
        ...(current || {}),
        verificationToken: result.verificationToken,
      }));
      setAuthNotice('');
      setAuthStep('google_link_verify');
    } catch (error) {
      setAuthError(error.message || 'Unable to start Google account linking.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePasswordSetupSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const validationErrors = validatePasswordSetupValues(formData);

    if (hasErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    if (!pendingAccountLink?.email || pendingAccountLink.mode !== 'password_setup') {
      setAuthError('Password setup expired. Please try logging in again.');
      setAuthStep('form');
      return;
    }

    setIsAuthLoading(true);

    try {
      const result = await backendApi.auth.requestPasswordSetup({
        email: pendingAccountLink.email,
        password: String(formData.get('pbAuthPasscode') || ''),
      });

      setPendingAccountLink((current) => ({
        ...(current || {}),
        verificationToken: result.verificationToken,
      }));
      setAuthNotice('');
      setAuthStep('password_setup_verify');
    } catch (error) {
      setAuthError(error.message || 'Unable to start password setup.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAccountLinkOtpSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const otp = String(formData.get('otp') || '').trim();

    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: 'Enter the 6-digit verification code.' });
      return;
    }

    if (!pendingAccountLink?.verificationToken) {
      setAuthError('Verification session expired. Please request a new code.');
      setAuthStep(pendingAccountLink?.mode === 'password_setup' ? 'password_setup' : 'google_link_password');
      return;
    }

    setIsAuthLoading(true);

    try {
      const result = pendingAccountLink.mode === 'password_setup'
        ? await backendApi.auth.verifyPasswordSetup({
          otp,
          verificationToken: pendingAccountLink.verificationToken,
        })
        : await backendApi.auth.verifyGoogleLink({
          otp,
          verificationToken: pendingAccountLink.verificationToken,
        });

      if (pendingAccountLink.mode === 'password_setup') {
        if (!result?.requiresGoogleConfirmation || !result?.passwordSetupToken) {
          throw new Error('Password setup verification did not return a Google confirmation step.');
        }

        setPendingAccountLink((current) => ({
          ...(current || {}),
          email: result.email || current?.email,
          passwordSetupToken: result.passwordSetupToken,
        }));
        setAuthNotice('');
        setAuthStep('password_setup_google');
        return;
      }

      if (!result?.user) {
        throw new Error('Account linking completed, but your profile could not be loaded.');
      }

      setUser(result.user);
      localStorage.setItem('pb_user', JSON.stringify(result.user));
      resetAuthFlow();
      setAuthModal({ isOpen: false, view: 'login' });
      window.scrollTo(0, 0);
    } catch (error) {
      setAuthError(error.message || 'Unable to verify your code.');
      setFieldErrors({});
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePasswordSetupGoogleConfirm = async () => {
    if (!pendingAccountLink?.passwordSetupToken) {
      setAuthError('Password setup expired. Please request a new code.');
      setAuthStep('password_setup');
      return;
    }

    const popupFeatures = [
      'popup=yes',
      'width=520',
      'height=680',
      `left=${Math.max(0, Math.round(window.screenX + ((window.outerWidth - 520) / 2)))}`,
      `top=${Math.max(0, Math.round(window.screenY + ((window.outerHeight - 680) / 2)))}`,
    ].join(',');

    setIsAuthLoading(true);
    setAuthError('');
    setFieldErrors({});

    oauthCleanupRef.current?.();

    const popup = window.open('', GOOGLE_OAUTH_POPUP_NAME, popupFeatures);

    if (!popup) {
      setAuthError('Popup was blocked. Allow popups for this site and try Google Sign-In again.');
      setIsAuthLoading(false);
      return;
    }

    oauthPopupRef.current = popup;

    try {
      popup.document.title = 'Google Sign-In';
      popup.document.body.innerHTML = '<p style="font-family: system-ui, sans-serif; padding: 24px;">Opening Google Sign-In...</p>';
    } catch {
      // The popup may already be navigating.
    }

    try {
      const result = await backendApi.auth.google({
        redirectTo: window.location.origin,
        role: '',
      });

      if (!result?.url) {
        throw new Error('Google Sign-In is not configured.');
      }

      if (popup.closed) {
        setAuthNotice('');
        setIsAuthLoading(false);
        oauthPopupRef.current = null;
        return;
      }

      let oauthCallbackHandled = false;
      let popupClosedInterval = null;
      let popupCloseTimeout = null;
      const cleanup = () => {
        window.removeEventListener('message', handleOAuthMessage);

        if (popupClosedInterval) {
          window.clearInterval(popupClosedInterval);
        }
        if (popupCloseTimeout) {
          window.clearTimeout(popupCloseTimeout);
        }

        oauthCleanupRef.current = null;
      };
      const finishWithError = (message) => {
        cleanup();
        oauthPopupRef.current = null;
        clearAuthSession();
        setAuthError(message);
        setIsAuthLoading(false);
      };
      const finishPasswordSetup = async ({ accessToken, refreshToken }) => {
        cleanup();
        oauthPopupRef.current = null;
        storeAuthSession({ token: accessToken, refreshToken });

        try {
          const completed = await backendApi.auth.completePasswordSetup({
            passwordSetupToken: pendingAccountLink.passwordSetupToken,
          });

          if (!completed?.token || !completed?.user) {
            throw new Error('Password setup completed, but no session was returned.');
          }

          storeAuthSession(completed);
          setUser(completed.user);
          localStorage.setItem('pb_user', JSON.stringify(completed.user));
          resetAuthFlow();
          setAuthModal({ isOpen: false, view: 'login' });
          window.scrollTo(0, 0);
        } catch (error) {
          clearAuthSession();
          setAuthError(error.message || 'Unable to finish password setup.');
        } finally {
          setIsAuthLoading(false);
        }
      };

      async function handleOAuthMessage(event) {
        if (event.origin !== window.location.origin || event.data?.type !== 'pb-google-oauth') {
          return;
        }

        oauthCallbackHandled = true;

        if (event.data.errorDescription) {
          finishWithError(event.data.errorDescription);
          return;
        }

        if (!event.data.accessToken) {
          finishWithError('Google Sign-In did not return a session.');
          return;
        }

        await finishPasswordSetup({
          accessToken: event.data.accessToken,
          refreshToken: event.data.refreshToken,
        });
      }

      window.addEventListener('message', handleOAuthMessage);
      oauthCleanupRef.current = cleanup;
      popupClosedInterval = window.setInterval(() => {
        if (!popup.closed || oauthCallbackHandled || popupCloseTimeout) return;

        popupCloseTimeout = window.setTimeout(() => {
          popupCloseTimeout = null;
          if (!popup.closed || oauthCallbackHandled) return;

          cleanup();
          oauthPopupRef.current = null;
          setAuthNotice('');
          setIsAuthLoading(false);
        }, 750);
      }, 500);

      popup.location.assign(result.url);
      popup.focus();
    } catch (error) {
      oauthCleanupRef.current?.();
      oauthPopupRef.current?.close();
      oauthPopupRef.current = null;
      setAuthError(error.message || 'Unable to start Google Sign-In.');
      setIsAuthLoading(false);
    }
  };

  const handleGoogleCompanySubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const validationErrors = validateGoogleCompanyValues(formData);

    if (hasErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsAuthLoading(true);

    try {
      const company = String(formData.get('company') || '').trim();
      const finalized = await backendApi.auth.finalizeOAuth({
        company,
        role: 'client',
      });

      if (finalized?.requiresCompany) {
        setFieldErrors({ company: 'Company is required.' });
        return;
      }

      if (!finalized?.user) {
        throw new Error('Missing confirmed user session.');
      }

      setUser(finalized.user);
      localStorage.setItem('pb_user', JSON.stringify(finalized.user));
      resetAuthFlow();
      setAuthModal({ isOpen: false, view: 'login' });
      window.scrollTo(0, 0);
    } catch (error) {
      setAuthError(error.message || 'Unable to save company.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleAuth = async (view = 'login', options = {}) => {
    const requestedRole = view === 'register_pro' ? 'professional' : view === 'register' ? 'client' : '';
    const company = String(options.company || '').trim();
    const googleValidationErrors = validateGoogleStartValues({ googleCompany: company }, view);
    const popupFeatures = [
      'popup=yes',
      'width=520',
      'height=680',
      `left=${Math.max(0, Math.round(window.screenX + ((window.outerWidth - 520) / 2)))}`,
      `top=${Math.max(0, Math.round(window.screenY + ((window.outerHeight - 680) / 2)))}`,
    ].join(',');

    setIsAuthLoading(true);
    setAuthError('');
    setAuthNotice('');
    setFieldErrors({});

    if (hasErrors(googleValidationErrors)) {
      setFieldErrors(googleValidationErrors);
      setIsAuthLoading(false);
      return;
    }

    oauthCleanupRef.current?.();

    const popup = window.open('', GOOGLE_OAUTH_POPUP_NAME, popupFeatures);

    if (!popup) {
      setAuthError('Popup was blocked. Allow popups for this site and try Google Sign-In again.');
      setIsAuthLoading(false);
      return;
    }

    oauthPopupRef.current = popup;

    try {
      popup.document.title = 'Google Sign-In';
      popup.document.body.innerHTML = '<p style="font-family: system-ui, sans-serif; padding: 24px;">Opening Google Sign-In...</p>';
    } catch {
      // The popup may already be navigating.
    }

    try {
      const result = await backendApi.auth.google({
        company,
        redirectTo: window.location.origin,
        role: requestedRole,
      });

      if (!result?.url) {
        throw new Error('Google Sign-In is not configured.');
      }

      localStorage.setItem('pb_oauth_pending', '1');
      localStorage.setItem('pb_oauth_role', requestedRole);
      localStorage.setItem('pb_oauth_company', company);

      if (popup.closed) {
        setAuthNotice('');
        setIsAuthLoading(false);
        oauthPopupRef.current = null;
        localStorage.removeItem('pb_oauth_pending');
        localStorage.removeItem('pb_oauth_role');
        localStorage.removeItem('pb_oauth_company');
        return;
      }

      let oauthCallbackHandled = false;
      let popupClosedInterval = null;
      let popupCloseTimeout = null;
      const cleanup = () => {
        window.removeEventListener('message', handleOAuthMessage);

        if (popupClosedInterval) {
          window.clearInterval(popupClosedInterval);
        }
        if (popupCloseTimeout) {
          window.clearTimeout(popupCloseTimeout);
        }

        oauthCleanupRef.current = null;
      };
      const finishWithError = (message) => {
        cleanup();
        oauthPopupRef.current = null;
        setAuthError(message);
        setIsAuthLoading(false);
      };
      const finishWithSession = async ({ accessToken, refreshToken }) => {
        cleanup();
        oauthPopupRef.current = null;
        storeAuthSession({ token: accessToken, refreshToken });

        try {
          const finalized = await backendApi.auth.finalizeOAuth({ company, role: requestedRole });

          if (finalized?.requiresAccountLink) {
            setPendingAccountLink({
              company,
              email: finalized.email,
              mode: 'google_to_password',
              role: requestedRole,
            });
            setAuthNotice('');
            setAuthStep('google_link_password');
            setAuthModal({ isOpen: true, view: 'login' });
            setIsAuthLoading(false);
            return;
          }

          if (finalized?.requiresCompany) {
            setPendingAccountLink({
              email: finalized.email,
              mode: 'google_company',
              role: 'client',
            });
            setAuthNotice('');
            setAuthStep('google_company');
            setAuthModal({ isOpen: true, view: 'login' });
            setIsAuthLoading(false);
            return;
          }

          if (!finalized?.user) {
            throw new Error('Missing confirmed user session.');
          }

          setUser(finalized.user);
          localStorage.setItem('pb_user', JSON.stringify(finalized.user));
          closeAuth();
          window.scrollTo(0, 0);
        } catch (error) {
          clearAuthSession();
          setAuthError(error.message || 'Google Sign-In completed, but your profile could not be loaded.');
        } finally {
          localStorage.removeItem('pb_oauth_pending');
          localStorage.removeItem('pb_oauth_role');
          localStorage.removeItem('pb_oauth_company');
          setIsAuthLoading(false);
        }
      };

      async function handleOAuthMessage(event) {
        if (event.origin !== window.location.origin || event.data?.type !== 'pb-google-oauth') {
          return;
        }

        oauthCallbackHandled = true;

        if (event.data.errorDescription) {
          finishWithError(event.data.errorDescription);
          return;
        }

        if (!event.data.accessToken) {
          finishWithError('Google Sign-In did not return a session.');
          return;
        }

        await finishWithSession({
          accessToken: event.data.accessToken,
          refreshToken: event.data.refreshToken,
        });
      }

      window.addEventListener('message', handleOAuthMessage);
      oauthCleanupRef.current = cleanup;
      popupClosedInterval = window.setInterval(() => {
        if (!popup.closed || oauthCallbackHandled || popupCloseTimeout) return;

        popupCloseTimeout = window.setTimeout(() => {
          popupCloseTimeout = null;
          if (!popup.closed || oauthCallbackHandled) return;

          cleanup();
          oauthPopupRef.current = null;
          setAuthNotice('');
          setIsAuthLoading(false);
          localStorage.removeItem('pb_oauth_pending');
          localStorage.removeItem('pb_oauth_role');
          localStorage.removeItem('pb_oauth_company');
        }, 750);
      }, 500);

      popup.location.assign(result.url);
      popup.focus();
    } catch (error) {
      oauthCleanupRef.current?.();
      oauthPopupRef.current?.close();
      oauthPopupRef.current = null;
      localStorage.removeItem('pb_oauth_pending');
      localStorage.removeItem('pb_oauth_role');
      localStorage.removeItem('pb_oauth_company');
      setAuthError(error.message || 'Unable to start Google Sign-In.');
      setIsAuthLoading(false);
    }
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
        authNotice={authNotice}
        authStep={authStep}
        fieldErrors={fieldErrors}
        pendingAccountLink={pendingAccountLink}
        pendingRegistration={pendingRegistration}
        isAuthLoading={isAuthLoading}
        handleAccountLinkOtpSubmit={handleAccountLinkOtpSubmit}
        handleAccountLinkSubmit={handleAccountLinkSubmit}
        handleAuthSubmit={handleAuthSubmit}
        handleGoogleCompanySubmit={handleGoogleCompanySubmit}
        handleGoogleAuth={handleGoogleAuth}
        handleOtpSubmit={handleOtpSubmit}
        handlePasswordSetupGoogleConfirm={handlePasswordSetupGoogleConfirm}
        handlePasswordSetupSubmit={handlePasswordSetupSubmit}
        switchAuthView={switchAuthView}
      />
    </div>
  );
}
