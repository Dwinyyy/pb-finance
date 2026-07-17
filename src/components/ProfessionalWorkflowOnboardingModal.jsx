import { BadgeCheck, BriefcaseBusiness, CircleUserRound, FileBadge2, Landmark, ScanFace } from 'lucide-react';

import { PortalGuideModal } from './PortalGuideModal.jsx';

const PROFESSIONAL_WORKFLOW_STEPS = [
  {
    id: 'complete-profile',
    icon: CircleUserRound,
    title: 'Complete profile',
    build: ({ isVerified }) => ({
      available: true,
      destination: { tab: 'profile' },
      statusLabel: isVerified ? 'Complete' : 'Start here',
      description: isVerified
        ? 'Keep your approved experience, availability, skills, and work preferences current. Material identity updates remain protected until PB Finance approves them.'
        : 'Add your professional details, experience, skills, work preferences, and profile photo so PB Finance and future clients have a complete review source.',
    }),
  },
  {
    id: 'identity-verification',
    icon: ScanFace,
    title: 'Identity verification',
    build: ({ isVerified }) => ({
      available: true,
      destination: { tab: 'profile', section: 'identity' },
      statusLabel: isVerified ? 'Approved' : 'Required',
      description: isVerified
        ? 'Your identity evidence is approved. Use the protected change-request flow if an approved ID needs replacement or removal.'
        : 'Upload the required valid-ID views and liveness selfie. PB Finance checks these before professional dashboard access can be approved.',
    }),
  },
  {
    id: 'credentials',
    icon: FileBadge2,
    title: 'Credentials',
    build: ({ isVerified }) => ({
      available: true,
      destination: { tab: 'profile', section: 'credentials' },
      statusLabel: isVerified ? 'Approved' : 'Required',
      description: isVerified
        ? 'Review your approved resume and title-specific credentials, and request admin permission before replacing protected documents.'
        : 'Add a resume and every certification required by your selected titles, then submit the complete evidence set for admin review.',
    }),
  },
  {
    id: 'admin-review',
    icon: BadgeCheck,
    title: 'Admin review',
    build: ({ isVerified }) => ({
      available: true,
      destination: { tab: 'profile' },
      statusLabel: isVerified ? 'Verified' : 'PB Finance review',
      description: isVerified
        ? 'PB Finance has approved the active professional identity and required evidence. Later protected changes remain pending until separately approved.'
        : 'After you submit, PB Finance reviews the profile, identity, resume, and required credentials. The active dashboard stays locked until approval.',
    }),
  },
  {
    id: 'opportunities',
    icon: BriefcaseBusiness,
    title: 'Opportunities',
    build: ({ canAccessDashboard }) => ({
      available: Boolean(canAccessDashboard),
      destination: { tab: 'opportunities' },
      statusLabel: canAccessDashboard ? 'Available' : 'Approval required',
      description: canAccessDashboard
        ? 'Review matched client opportunities, respond to requests, and keep each engagement decision visible in the portal.'
        : 'Opportunities unlock after PB Finance approves your professional profile, identity, resume, and required credentials.',
    }),
  },
  {
    id: 'earnings',
    icon: Landmark,
    title: 'Timesheets and earnings',
    build: ({ canAccessDashboard }) => ({
      available: Boolean(canAccessDashboard),
      destination: { tab: 'earnings' },
      statusLabel: canAccessDashboard ? 'Available' : 'Approval required',
      description: canAccessDashboard
        ? 'Track submitted time, review pending earnings, and follow withdrawal availability once client work begins.'
        : 'Timesheets and earnings unlock with professional dashboard access and become useful after an approved client engagement starts.',
    }),
  },
];

export function ProfessionalWorkflowOnboardingModal({
  professionalPermissions = {},
  user,
  open,
  onClose,
  onNavigate,
}) {
  const canAccessDashboard = Boolean(professionalPermissions.canAccessDashboard);
  const tier = professionalPermissions.tier || user?.professionalTier || user?.professional_tier;
  const context = {
    canAccessDashboard,
    isVerified: tier === 'verified' && canAccessDashboard,
  };
  const steps = PROFESSIONAL_WORKFLOW_STEPS.map(({ build, ...definition }) => ({
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
      eyebrow={`Professional guide${user?.name ? ` for ${user.name}` : ''}`}
      title="Your PB Finance professional workflow"
      description="Complete the required review stages first, then use the guide to reopen any available professional workspace as your account progresses."
      steps={actionableSteps}
    />
  );
}
