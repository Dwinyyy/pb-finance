import { Bookmark, CalendarCheck2, FileText, Search, UserRoundCheck } from 'lucide-react';

import { PortalGuideModal } from './PortalGuideModal.jsx';

const CLIENT_WORKFLOW_STEPS = [
  {
    id: 'profile-verification',
    icon: UserRoundCheck,
    title: 'Profile and verification',
    build: ({ isBasicClient }) => ({
      available: true,
      destination: { tab: 'profile', section: isBasicClient ? 'verification' : 'account' },
      statusLabel: isBasicClient ? 'Start here' : 'Available',
      description: isBasicClient
        ? 'Complete your profile and submit identity and regulated business evidence. PB Finance admin approval unlocks interviews, contracts, and expanded portal access.'
        : 'Review your active account details and verification record. Your approved business identity remains separate from editable display information.',
    }),
  },
  {
    id: 'discover',
    icon: Search,
    title: 'Discover talent',
    build: () => ({
      available: true,
      destination: { tab: 'discover' },
      statusLabel: 'Available',
      description: 'Search vetted finance professionals by role, skills, software, availability, and rate so the first comparison starts with relevant candidates.',
    }),
  },
  {
    id: 'shortlist',
    icon: Bookmark,
    title: 'Shortlist',
    build: ({ shortlistLimit }) => ({
      available: true,
      destination: { tab: 'shortlist' },
      statusLabel: shortlistLimit == null ? 'Unlimited' : `${shortlistLimit} places`,
      description: shortlistLimit == null
        ? 'Save and compare as many promising professionals as needed before moving the best fits into interviews.'
        : `Save up to ${shortlistLimit} professionals in one comparison list. Remove a saved profile whenever you want to make room for another candidate.`,
    }),
  },
  {
    id: 'interview',
    icon: CalendarCheck2,
    title: 'Interview',
    build: ({ canScheduleInterviews }) => ({
      available: Boolean(canScheduleInterviews),
      destination: { tab: 'interviews' },
      statusLabel: canScheduleInterviews ? 'Available' : 'Verification required',
      description: canScheduleInterviews
        ? 'Request interview times from shortlisted professionals and track confirmations, changes, and cancellations in one place.'
        : 'Interview scheduling unlocks after PB Finance verifies the client account. Finish the Profile and verification step to gain access.',
    }),
  },
  {
    id: 'billing',
    icon: FileText,
    title: 'Contracts and billing',
    build: ({ canViewFullDocuments }) => ({
      available: Boolean(canViewFullDocuments),
      destination: { tab: 'billing' },
      statusLabel: canViewFullDocuments ? 'Available' : 'Verification required',
      description: canViewFullDocuments
        ? 'Review contracts, invoices, and payment methods after a hiring decision, with every financial handoff kept inside the portal.'
        : 'Contracts and billing unlock after PB Finance verifies the client account, keeping protected documents limited to approved clients.',
    }),
  },
];

export function ClientWorkflowOnboardingModal({
  clientPermissions = {},
  user,
  open,
  onClose,
  onNavigate,
}) {
  const tier = String(
    clientPermissions.tier || user?.clientTier || user?.client_tier || 'basic'
  ).toLowerCase();
  const isBasicClient = tier === 'basic';
  const context = {
    canScheduleInterviews: Boolean(clientPermissions.canScheduleInterviews),
    canViewFullDocuments: Boolean(clientPermissions.canViewFullDocuments),
    isBasicClient,
    shortlistLimit: Object.hasOwn(clientPermissions, 'shortlistLimit')
      ? clientPermissions.shortlistLimit
      : 5,
  };
  const steps = CLIENT_WORKFLOW_STEPS.map(({ build, ...definition }) => ({
    ...definition,
    ...build(context),
  }));
  const handleStepNavigate = (step) => {
    if (!step.available || !step.destination) return;
    if (typeof onNavigate !== 'function') return;
    onNavigate?.(step.destination);
    onClose?.();
  };
  const actionableSteps = steps.map((step) => ({
    ...step,
    onSelect: step.available ? () => handleStepNavigate(step) : undefined,
  }));

  return (
    <PortalGuideModal
      open={open}
      onClose={onClose}
      eyebrow={`Client guide${user?.name ? ` for ${user.name}` : ''}`}
      title="Your PB Finance client workflow"
      description="Follow the stages in order or open any available destination. Locked stages stay visible so you always know what verification unlocks next."
      steps={actionableSteps}
    />
  );
}
