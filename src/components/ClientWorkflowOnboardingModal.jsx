import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion } from 'framer-motion';
import { ArrowRight, Bookmark, Calendar, CheckCircle, FileText, Search, Sparkles, X } from 'lucide-react';

const CLIENT_WORKFLOW_STEPS = [
  {
    id: 'discover',
    icon: Search,
    label: 'Discover',
    text: 'Filter available talent',
    detail: 'Find vetted accountants and finance specialists with clear filters for role, skills, software, rate, and availability.',
  },
  {
    id: 'shortlist',
    icon: Bookmark,
    label: 'Shortlist',
    text: 'Compare the best fits',
    detail: 'Save the best matches in one place so choosing who to interview feels focused, not scattered.',
  },
  {
    id: 'interviews',
    icon: Calendar,
    label: 'Interview',
    text: 'Confirm fit and timing',
    detail: 'Request a preferred time and keep the scheduling flow organized without long back-and-forth.',
  },
  {
    id: 'billing',
    icon: FileText,
    label: 'Contract',
    text: 'Track terms and invoices',
    detail: 'Move approved hires into terms and billing with the next steps laid out clearly.',
  },
];

export function ClientWorkflowOnboardingModal({ user, onClose, onStart }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[220] overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-md sm:py-10">
      <div className="flex min-h-full items-center justify-center">
        <Motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-workflow-title"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-5 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-7">
            <div>
              <div className="mb-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <Sparkles size={13} className="mr-1.5 text-primary-500" />
                Client guide{user?.name ? ` for ${user.name}` : ''}
              </div>
              <h2 id="client-workflow-title" className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                Getting the right accountant should feel simple.
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                PB Finance turns hiring into a clean guided flow: discover vetted talent, shortlist the strongest matches, interview, then move into contract without messy handoffs.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close onboarding"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-5 py-6 sm:px-7">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {CLIENT_WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.id}
                    className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg hover:shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-primary-900/60 dark:hover:shadow-slate-950/40"
                  >
                    {index < CLIENT_WORKFLOW_STEPS.length - 1 && (
                      <div className="absolute -right-3 top-10 hidden h-px w-3 bg-slate-200 dark:bg-slate-800 xl:block" />
                    )}
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-primary-600">
                        <Icon size={20} />
                      </div>
                      <span className="text-xs font-black text-slate-300 dark:text-slate-700">0{index + 1}</span>
                    </div>
                    <h3 className="text-base font-black text-slate-950 dark:text-white">{step.label}</h3>
                    <div className="mt-1 text-sm font-bold text-primary-600 dark:text-primary-300">{step.text}</div>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{step.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle size={17} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-950 dark:text-white">You are always in control.</div>
                  <div className="mt-0.5 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                    Move at your pace while the portal keeps each step clear, organized, and easy to finish.
                  </div>
                </div>
              </div>
              <button
                onClick={onStart}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-500"
              >
                Start discovering <ArrowRight size={16} className="ml-2" />
              </button>
            </div>
          </div>
        </Motion.div>
      </div>
    </div>,
    document.body
  );
}
