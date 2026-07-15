import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/components/ui/Modal.jsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const professional = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
const onboardingUrl = new URL('../src/components/ClientWorkflowOnboardingModal.jsx', import.meta.url);
const onboarding = existsSync(onboardingUrl) ? readFileSync(onboardingUrl, 'utf8') : '';

test('modal provides portal animation and dialog mechanics', () => {
  for (const pattern of [/createPortal/, /AnimatePresence/, /useReducedMotion/, /role="dialog"/, /aria-modal="true"/, /Escape/, /document\.body\.style\.overflow/, /previouslyFocused/, /focusable/]) {
    assert.match(modal, pattern);
  }
});

test('client and professional pages no longer own portal modal implementations', () => {
  assert.doesNotMatch(client, /function PortalModal/);
  assert.doesNotMatch(professional, /function PortalModal/);
  assert.doesNotMatch(client, /createPortal/);
  assert.doesNotMatch(professional, /createPortal/);
  assert.match(client, /from '..\/components\/ui\/Modal'/);
  assert.match(professional, /from '..\/components\/ui\/Modal'/);
  assert.equal(existsSync(onboardingUrl), true);
  assert.match(client, /from '..\/components\/ClientWorkflowOnboardingModal'/);
  assert.match(onboarding, /export function ClientWorkflowOnboardingModal/);
  assert.match(onboarding, /const CLIENT_WORKFLOW_STEPS/);
  assert.match(onboarding, /createPortal/);
  assert.match(onboarding, /max-w-5xl/);
});

test('profile settings resets transient upload state across close and reopen', () => {
  assert.match(professional, /const uploadGenerationRef = useRef\(0\)/);
  assert.match(professional, /useEffect\(\(\) => \{\s*if \(open\) return;[\s\S]*uploadGenerationRef\.current \+= 1;[\s\S]*setPhotoError\(''\);[\s\S]*setIsPhotoUploading\(false\);[\s\S]*\}, \[open\]\);/);
  assert.match(professional, /const uploadGeneration = \+\+uploadGenerationRef\.current/);
  assert.match(professional, /uploadGenerationRef\.current === uploadGeneration/);
});
