import { ArrowRight, Bookmark, Calendar, CheckCircle, FileText, Search } from 'lucide-react';

import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Eyebrow } from './ui/Eyebrow';
import { SurfaceCard } from './ui/SurfaceCard';

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

export function ClientWorkflowOnboardingModal({ user, open, onClose, onStart }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="onboarding"
      title="Getting the right accountant should feel simple."
      description="PB Finance turns hiring into a clean guided flow: discover vetted talent, shortlist the strongest matches, interview, then move into contract without messy handoffs."
      footer={(
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-control bg-verified-surface text-verified">
              <CheckCircle size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-black text-text-primary">You are always in control.</div>
              <div className="mt-0.5 text-sm font-medium leading-relaxed text-text-muted">
                Move at your pace while the portal keeps each step clear, organized, and easy to finish.
              </div>
            </div>
          </div>
          <Button type="button" onClick={onStart} className="shrink-0">
            Start discovering <ArrowRight size={16} className="ml-2" aria-hidden="true" />
          </Button>
        </div>
      )}
    >
      <div className="space-y-6">
        <Eyebrow className="text-xs font-bold text-info">
          {`Client guide${user?.name ? ` for ${user.name}` : ''}`}
        </Eyebrow>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {CLIENT_WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;

            return (
              <SurfaceCard key={step.id} as="article" className="relative p-4 shadow-none">
                {index < CLIENT_WORKFLOW_STEPS.length - 1 && (
                  <div className="absolute -right-3 top-10 hidden h-px w-3 bg-border-subtle xl:block" aria-hidden="true" />
                )}
                <div className="mb-5 flex items-center justify-between">
                  <div className="grid size-11 place-items-center rounded-control bg-pb-midnight text-white shadow-card">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-black text-text-muted/50">0{index + 1}</span>
                </div>
                <h3 className="text-base font-black text-text-primary">{step.label}</h3>
                <div className="mt-1 text-sm font-bold text-action">{step.text}</div>
                <p className="mt-4 text-sm font-medium leading-relaxed text-text-muted">{step.detail}</p>
              </SurfaceCard>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
