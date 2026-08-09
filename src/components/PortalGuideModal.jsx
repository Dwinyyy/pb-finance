import { ArrowRight, LockKeyhole } from 'lucide-react';

import { Button } from './ui/Button.jsx';
import { Eyebrow } from './ui/Eyebrow.jsx';
import { Modal } from './ui/Modal.jsx';
import { StatusBadge } from './ui/StatusBadge.jsx';
import { SurfaceCard } from './ui/SurfaceCard.jsx';

const statusToneForStep = (step) => {
  if (!step.available) return 'warning';
  if (/complete|approved|verified/i.test(step.statusLabel || '')) return 'verified';
  return 'info';
};

export function PortalGuideModal({
  description,
  eyebrow,
  open,
  onClose,
  steps = [],
  title,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="onboarding"
      title={title}
      description={description}
      footer={(
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close guide
          </Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <Eyebrow className="text-xs font-bold uppercase tracking-wider text-info">
          {eyebrow}
        </Eyebrow>

        <ol className="grid gap-4 lg:grid-cols-2" aria-label={`${title} steps`}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const canNavigate = Boolean(step.available && step.destination && step.onSelect);

            return (
              <li key={step.id} className="min-w-0">
                <SurfaceCard as="article" className="flex h-full min-w-0 flex-col p-5 shadow-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`grid size-11 shrink-0 place-items-center rounded-control ${step.available ? 'bg-action text-white' : 'bg-warning-surface text-warning'}`}>
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-muted" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <StatusBadge label={step.statusLabel} tone={statusToneForStep(step)} />
                    </div>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-text-primary">{step.title}</h3>
                  <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-text-muted">
                    {step.description}
                  </p>

                  {canNavigate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-5 self-start"
                      aria-label={`Open ${step.title}`}
                      onClick={step.onSelect}
                    >
                      Open step
                      <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <div className="mt-5 flex items-center gap-2 text-xs font-bold text-warning">
                      <LockKeyhole className="size-4" aria-hidden="true" />
                      {step.unavailableText || 'Available after the requirement above is complete'}
                    </div>
                  )}
                </SurfaceCard>
              </li>
            );
          })}
        </ol>
      </div>
    </Modal>
  );
}
