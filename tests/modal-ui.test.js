import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/components/ui/Modal.jsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const professional = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
const documentPreview = readFileSync(new URL('../src/components/DocumentPreviewModal.jsx', import.meta.url), 'utf8');
const onboardingUrl = new URL('../src/components/ClientWorkflowOnboardingModal.jsx', import.meta.url);
const onboarding = existsSync(onboardingUrl) ? readFileSync(onboardingUrl, 'utf8') : '';

test('modal provides portal animation and dialog mechanics', () => {
  for (const pattern of [/createPortal/, /AnimatePresence/, /useReducedMotion/, /role="dialog"/, /aria-modal="true"/, /Escape/, /document\.body\.style\.overflow/, /previouslyFocused/, /focusable/]) {
    assert.match(modal, pattern);
  }

  assert.match(modal, /bg-pb-midnight\/75/);
  assert.doesNotMatch(modal, /bg-text-primary\/\d+/);
  assert.match(modal, /onboarding: 'max-w-5xl'/);
  assert.match(modal, /preview: 'max-w-6xl'/);
  assert.match(modal, /bodyClassName/);
  assert.match(modal, /panelClassName/);
  assert.match(modal, /className="shrink-0 size-11 !p-0"/);
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
  assert.match(onboarding, /import \{ Modal \} from '.\/ui\/Modal'/);
  assert.match(onboarding, /import \{ Button \} from '.\/ui\/Button'/);
  assert.match(onboarding, /import \{ Eyebrow \} from '.\/ui\/Eyebrow'/);
  assert.match(onboarding, /import \{ SurfaceCard \} from '.\/ui\/SurfaceCard'/);
  assert.match(onboarding, /ClientWorkflowOnboardingModal\(\{ user, open, onClose, onStart \}\)/);
  assert.match(onboarding, /<Modal[\s\S]*open=\{open\}[\s\S]*size="onboarding"/);
  assert.doesNotMatch(onboarding, /createPortal|useEffect|role="dialog"|aria-modal="true"/);
  assert.doesNotMatch(onboarding, /(?:bg|text|border)-(?:slate|gray|zinc|red|blue|cyan|emerald|amber|violet|primary)-/);
  assert.match(client, /<ClientWorkflowOnboardingModal[\s\S]*open=\{showWorkflowOnboarding\}/);
  assert.doesNotMatch(client, /\{showWorkflowOnboarding && \(\s*<ClientWorkflowOnboardingModal/);
});

test('document preview delegates dialog mechanics while retaining protected fallback behavior', () => {
  assert.match(documentPreview, /import \{ Modal \} from '.\/ui\/Modal'/);
  assert.match(documentPreview, /<Modal[\s\S]*open[\s\S]*size="preview"[\s\S]*panelClassName=/);
  assert.match(documentPreview, /bodyClassName=/);
  assert.doesNotMatch(documentPreview, /createPortal|role="dialog"|aria-modal="true"/);

  for (const protection of [
    /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/,
    /onCopy=\{preventPreviewInteraction\}/,
    /onCut=\{preventPreviewInteraction\}/,
    /onDragStart=\{preventPreviewInteraction\}/,
    /onPaste=\{preventPreviewInteraction\}/,
    /addEventListener\('selectstart', preventPreviewInteraction\)/,
    /removeEventListener\('selectstart', preventPreviewInteraction\)/,
    /document-preview-locked/,
  ]) assert.match(documentPreview, protection);
  assert.doesNotMatch(documentPreview, /onSelectStart=/);

  for (const fallback of [
    /previewDocument\.previewUrl/,
    /previewDocument\.urlPromise/,
    /previewDocument\.blobPromise/,
    /previewDocument\.blobLoader/,
    /retryImageWithBlob/,
    /retryPdfWithBlob/,
    /previewDocument\.cacheKey/,
    /canvas\.className = 'mx-auto rounded-lg bg-white/,
  ]) assert.match(documentPreview, fallback);
});

test('professional document preview suspends its parent audience dialog', () => {
  assert.match(professional, /open=\{Boolean\(tier\) && !previewDocument\}/);
});

test('profile settings resets transient upload state across close and reopen', () => {
  assert.match(professional, /const uploadGenerationRef = useRef\(0\)/);
  assert.match(professional, /useEffect\(\(\) => \{\s*if \(open\) return;[\s\S]*uploadGenerationRef\.current \+= 1;[\s\S]*setPhotoError\(''\);[\s\S]*setIsPhotoUploading\(false\);[\s\S]*\}, \[open\]\);/);
  assert.match(professional, /const uploadGeneration = \+\+uploadGenerationRef\.current/);
  assert.match(professional, /uploadGenerationRef\.current === uploadGeneration/);
});
