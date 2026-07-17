import { FileCheck2, UserRoundCog } from 'lucide-react';

import { useBackendResource } from '../hooks/useBackendResource.js';
import { backendApi } from '../services/api.js';
import { ClientNameChangeReview } from './ClientNameChangeReview.jsx';
import { ClientVerificationReview } from './ClientVerificationReview.jsx';
import { Button } from './ui/Button.jsx';
import { Eyebrow } from './ui/Eyebrow.jsx';
import { StatusBadge } from './ui/StatusBadge.jsx';

const EMPTY_NAME_CHANGE_DATA = Object.freeze({
  pendingCount: 0,
  requests: Object.freeze([]),
});
const WORKSPACE_OPTIONS = Object.freeze([
  { icon: FileCheck2, label: 'Verification Cases', value: 'cases' },
  { icon: UserRoundCog, label: 'Name Changes', value: 'name-changes' },
]);

export function ClientVerificationWorkspace({ section = 'cases', onSectionChange }) {
  const nameChangeResource = useBackendResource(
    backendApi.admin.listClientNameChanges,
    EMPTY_NAME_CHANGE_DATA
  );
  const pendingCount = Number(nameChangeResource.data?.pendingCount) || 0;

  return (
    <div className="portal-fade-in">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow className="mb-2 text-xs font-bold uppercase tracking-wider text-action">
            PB Finance admins only
          </Eyebrow>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Client Verification</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-text-muted">
            Review client evidence and protected full-name requests from one workspace.
          </p>
        </div>

        <nav aria-label="Client verification workspace" className="flex flex-wrap gap-2">
          {WORKSPACE_OPTIONS.map((option) => {
            const Icon = option.icon;

            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={section === option.value ? 'primary' : 'secondary'}
                aria-current={section === option.value ? 'page' : undefined}
                onClick={() => onSectionChange?.(option.value)}
              >
                <Icon className="mr-2 size-4" aria-hidden="true" />
                {option.label}
                {option.value === 'name-changes' && (
                  <StatusBadge
                    label={`${pendingCount} pending`}
                    tone={pendingCount > 0 ? 'warning' : 'neutral'}
                  />
                )}
              </Button>
            );
          })}
        </nav>
      </div>

      {section === 'name-changes' ? (
        <ClientNameChangeReview nameChangeResource={nameChangeResource} />
      ) : (
        <ClientVerificationReview showHeading={false} />
      )}
    </div>
  );
}
