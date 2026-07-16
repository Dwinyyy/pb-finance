import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const eyebrow = read('../src/components/ui/Eyebrow.jsx');
const publicPage = read('../src/pages/PublicPages.jsx');
const clientGuide = read('../src/components/ClientWorkflowOnboardingModal.jsx');
const clientVerification = read('../src/components/ClientVerificationDashboard.jsx');
const professionalPage = read('../src/pages/ProfessionalPages.jsx');
const adminReview = read('../src/components/ClientVerificationReview.jsx');

const decorativeClassPattern = /(?:rounded|border|bg-|shadow|backdrop|\bpx-|\bpy-|\bp-\d)/;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tagFor = (source, copy) => {
  const content = '(?:(?!</Eyebrow>)[\\s\\S])';
  const tag = source.match(new RegExp(`<Eyebrow\\b[^>]*>${content}*?${escapeRegExp(copy)}${content}*?</Eyebrow>`))?.[0] || '';
  assert.ok(tag, `copy is not inside Eyebrow: ${copy}`);
  return tag;
};

test('Eyebrow is a style-free semantic text primitive', () => {
  assert.match(eyebrow, /export function Eyebrow\(\{ as = 'p', children, className = '' \}\)/);
  assert.match(eyebrow, /const Component = as/);
  assert.match(eyebrow, /<Component className=\{className\}>\{children\}<\/Component>/);
  assert.doesNotMatch(eyebrow, decorativeClassPattern);
});

test('all audited decorative labels use plain Eyebrow text without icons or pill decoration', () => {
  const labels = [
    [publicPage, 'Savings Calculator', 'mb-4 text-xs font-bold uppercase tracking-wider text-text-muted'],
    [publicPage, 'Redefining Global Finance Outsourcing', 'mb-5 text-xs font-semibold text-premium-detail sm:text-sm'],
    [publicPage, 'Process', 'mb-4 text-xs font-bold uppercase tracking-wider text-action'],
    [publicPage, 'FAQ', 'mb-4 text-xs font-bold uppercase tracking-wider text-action md:hidden'],
    [publicPage, 'Talent Directory Preview', 'mb-5 text-xs font-bold uppercase tracking-wider text-info'],
    [publicPage, 'Enterprise Finance Delivery', 'mb-8 text-xs font-bold uppercase tracking-wider text-premium-detail'],
    [publicPage, 'Pod Design Preview', 'mb-4 text-xs font-bold uppercase tracking-wider text-processing'],
    [publicPage, 'Engagement Models', 'mb-4 text-xs font-bold uppercase tracking-wider text-text-muted'],
    [publicPage, 'Pricing', 'mb-4 text-xs font-bold uppercase tracking-wider text-info'],
    [clientVerification, 'Client trust center', 'mb-3 text-xs font-bold text-info'],
    [professionalPage, 'Professional onboarding', 'mb-2 text-[10px] font-black uppercase tracking-wider text-processing'],
    [professionalPage, 'Verification', 'mb-2 text-[10px] font-black uppercase tracking-wider text-processing'],
    [adminReview, 'PB Finance admins only', 'mb-2 text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300'],
  ];

  for (const [source, copy, className] of labels) {
    const tag = tagFor(source, copy);
    assert.match(tag, new RegExp(`className="${escapeRegExp(className)}"`), `${copy} typography or color changed`);
    assert.doesNotMatch(tag, decorativeClassPattern, `${copy} still has pill decoration`);
    assert.doesNotMatch(tag, /<(?:Sparkles|Star|IdCard|ShieldCheck)\b/, `${copy} still has a decorative icon`);
  }

  const guideStart = clientGuide.indexOf('<Eyebrow');
  const guideEnd = clientGuide.indexOf('</Eyebrow>', guideStart);
  const guide = clientGuide.slice(guideStart, guideEnd + '</Eyebrow>'.length);
  assert.match(guide, /Client guide/);
  assert.match(guide, /user\?\.name/);
  assert.match(guide, /className="text-xs font-bold text-info"/);
  assert.doesNotMatch(guide, decorativeClassPattern);
  assert.doesNotMatch(guide, /Sparkles|StatusBadge/);
});

test('semantic client verification status remains a StatusBadge', () => {
  assert.match(clientVerification, /<StatusBadge label=\{String\(verification\.status/);
});
