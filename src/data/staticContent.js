import { BadgeCheck, BarChart3, Layers3, User } from 'lucide-react';

export const SERVICE_CARDS = [
  {
    title: 'Dedicated Finance Talent',
    icon: User,
    desc: 'Hire embedded accountants, CPAs, and finance analysts who operate like an extension of your internal team.',
  },
  {
    title: 'Managed Accounting Pods',
    icon: Layers3,
    desc: 'Deploy role-based teams for month-end close, tax season, cleanup projects, or recurring finance operations.',
  },
  {
    title: 'Process Improvement',
    icon: BarChart3,
    desc: 'Standardize workflows, improve close speed, reduce errors, and create reporting that leaders actually use.',
  },
  {
    title: 'Compliance-Ready Execution',
    icon: BadgeCheck,
    desc: 'Get documentation-first support with quality controls, secure file handling, and review-ready outputs.',
  },
];

export const PROCESS_STEPS = [
  {
    title: 'Scope & workflow audit',
    text: 'Map deliverables, systems, quality standards, and overlap requirements before any placement begins.',
  },
  {
    title: 'Credential review',
    text: 'Verified profile records can surface experience, tools, certifications, availability, and status.',
  },
  {
    title: 'Pilot & onboarding',
    text: 'Support SOPs, access checklists, training windows, and measurable success criteria for each engagement.',
  },
  {
    title: 'QA & scale-up',
    text: 'Keep performance reviews, backup coverage, and process optimization visible as a team grows.',
  },
];

export const FAQ_ITEMS = [
  {
    q: 'What makes this different from generic staffing?',
    a: 'This model is specialized for accounting and finance. Matching can be based on workflows, tools, controls, industry context, and communication quality.',
  },
  {
    q: 'Can international talent work in our timezone?',
    a: 'Yes. Overlap hours and shift preferences can be captured during onboarding and used by the matching workflow.',
  },
  {
    q: 'How do you protect financial data?',
    a: 'Onboarding should use least-privilege access, documentation standards, secure file handling, and clear approval workflows.',
  },
  {
    q: 'Can we start with one person and scale later?',
    a: 'Yes. The platform can support one embedded professional first, then expand into AP/AR, reporting, tax, or audit support.',
  },
];

export const MATCHING_WORKFLOW = [
  { title: 'Role requirements', label: 'Captured' },
  { title: 'Credential review', label: 'Verified' },
  { title: 'Interview scheduling', label: 'Ready' },
];
