import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const favicon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../docs/design-system/pb-signature-colors.md', import.meta.url), 'utf8');
const publicPage = readFileSync(new URL('../src/pages/PublicPages.jsx', import.meta.url), 'utf8');
const clientPage = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const clientDashboard = readFileSync(new URL('../src/components/ClientVerificationDashboard.jsx', import.meta.url), 'utf8');
const professionalPage = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
const documentPreview = readFileSync(new URL('../src/components/DocumentPreviewModal.jsx', import.meta.url), 'utf8');
const dashboardAccountMenu = readFileSync(new URL('../src/components/DashboardAccountMenu.jsx', import.meta.url), 'utf8');
const notificationPanel = readFileSync(new URL('../src/components/NotificationPanel.jsx', import.meta.url), 'utf8');
const fadeIn = readFileSync(new URL('../src/components/FadeIn.jsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('signature primitives and semantic aliases are canonical', () => {
  for (const [token, value] of Object.entries({
    'pb-midnight': '#0B1F3A',
    'pb-cobalt-600': '#2563EB',
    'pb-emerald': '#047857',
    'pb-signal': '#0E7490',
    'pb-champagne': '#A67C38',
    'pb-pearl': '#F7F9FC',
    'pb-ink': '#0A1628',
    attention: '#B45309',
    danger: '#B42318',
  })) {
    assert.match(css, new RegExp(`--color-${token}:\\s*${value}`, 'i'));
  }

  for (const token of ['canvas', 'surface', 'surface-muted', 'text-primary', 'text-muted', 'border-subtle', 'border-control', 'action', 'focus', 'info', 'verified', 'processing', 'warning', 'danger']) {
    assert.match(css, new RegExp(`--color-${token}`));
  }

  assert.match(css, /@theme inline/);
  assert.match(css, /--color-primary-950:\s*#172554/i);
});

test('brand governance and browser chrome use PB Finance identity', () => {
  assert.match(guide, /PB Midnight[\s\S]*#0B1F3A/);
  assert.match(guide, /future UI[\s\S]*semantic/i);
  assert.match(agents, /PB Finance Signature Design System/);
  assert.match(html, /<title>PB Finance<\/title>/);
  assert.doesNotMatch(favicon, /#863bff|#7e14ff/i);
  assert.match(favicon, /PB Finance/i);
  assert.equal(existsSync(new URL('../src/App.css', import.meta.url)), false);
});

test('target React files do not contain raw signature hex values', () => {
  for (const [label, source] of [
    ['public pages', publicPage],
    ['client pages', clientPage],
    ['client verification dashboard', clientDashboard],
    ['professional pages', professionalPage],
    ['dashboard account menu', dashboardAccountMenu],
    ['notification panel', notificationPanel],
  ]) {
    assert.doesNotMatch(
      source,
      /#(?:0B1F3A|2563EB|047857|0E7490|A67C38|F7F9FC|0A1628|B45309|B42318)\b/i,
      `${label} must consume governed signature tokens`,
    );
  }
});

test('shared account and notification surfaces use semantic design tokens', () => {
  for (const [label, source] of [
    ['dashboard account menu', dashboardAccountMenu],
    ['notification panel', notificationPanel],
  ]) {
    for (const semanticClass of [
      'bg-surface',
      'text-text-primary',
      'text-text-muted',
      'border-border-subtle',
    ]) {
      assert.match(source, new RegExp(semanticClass), `${label} must use ${semanticClass}`);
    }

    assert.doesNotMatch(
      source,
      /(?:bg|text|border|ring)-(?:slate|gray|zinc|red|blue|cyan|emerald|amber|violet|primary)-/,
      `${label} must use semantic color utilities`,
    );
  }

  for (const semanticClass of ['bg-action', 'border-focus', 'ring-focus', 'text-danger', 'bg-danger-surface']) {
    assert.match(dashboardAccountMenu, new RegExp(semanticClass));
  }
});

test('document preview uses semantic presentation without weakening read-only fallbacks', () => {
  for (const semanticClass of [
    'bg-surface',
    'bg-surface-muted',
    'border-border-subtle',
    'text-text-primary',
    'text-text-muted',
    'bg-processing-surface',
    'border-processing-border',
    'text-processing',
    'bg-danger-surface',
    'border-danger-border',
    'text-danger',
  ]) {
    assert.match(documentPreview, new RegExp(semanticClass));
  }

  assert.doesNotMatch(
    documentPreview,
    /(?:bg|text|border)-(?:slate|gray|zinc|red|blue|cyan|emerald|amber|violet|primary)-/,
  );

  for (const protection of [
    /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/,
    /onCopy=\{preventPreviewInteraction\}/,
    /onCut=\{preventPreviewInteraction\}/,
    /onDragStart=\{preventPreviewInteraction\}/,
    /onPaste=\{preventPreviewInteraction\}/,
    /addEventListener\('selectstart', preventPreviewInteraction\)/,
    /removeEventListener\('selectstart', preventPreviewInteraction\)/,
    /document-preview-locked/,
  ]) {
    assert.match(documentPreview, protection);
  }
  assert.doesNotMatch(documentPreview, /onSelectStart=/);

  for (const fallback of [
    /previewDocument\.previewUrl/,
    /previewDocument\.urlPromise/,
    /previewDocument\.blobPromise/,
    /previewDocument\.blobLoader/,
    /retryImageWithBlob/,
    /retryPdfWithBlob/,
    /previewDocument\.cacheKey/,
  ]) {
    assert.match(documentPreview, fallback);
  }

  assert.match(documentPreview, /from '.\/ui\/Modal'/);
  assert.doesNotMatch(documentPreview, /createPortal/);
});

test('global and reveal motion honor the reduced-motion preference', () => {
  assert.match(main, /import \{ MotionConfig \} from 'framer-motion'/);
  assert.match(main, /<MotionConfig reducedMotion="user">[\s\S]*<BrowserRouter>/);
  assert.match(fadeIn, /useReducedMotion/);
  assert.match(fadeIn, /prefersReducedMotion/);
  assert.match(fadeIn, /whileHover=\{hover && !prefersReducedMotion/);
  assert.match(fadeIn, /prefersReducedMotion \? \{ opacity: 0 \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /scroll-behavior:\s*auto\s*!important/);
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /transition-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /\.verified-document-watermark\s*\{[\s\S]*animation:\s*none\s*!important/);
});
