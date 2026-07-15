import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/components/ui/Modal.jsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/pages/ClientPages.jsx', import.meta.url), 'utf8');
const professional = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');

test('modal provides portal animation and dialog mechanics', () => {
  for (const pattern of [/createPortal/, /AnimatePresence/, /useReducedMotion/, /role="dialog"/, /aria-modal="true"/, /Escape/, /document\.body\.style\.overflow/, /previouslyFocused/, /focusable/]) {
    assert.match(modal, pattern);
  }
});

test('client and professional pages no longer own portal modal implementations', () => {
  assert.doesNotMatch(client, /function PortalModal/);
  assert.doesNotMatch(professional, /function PortalModal/);
  assert.match(client, /from '..\/components\/ui\/Modal'/);
  assert.match(professional, /from '..\/components\/ui\/Modal'/);
});
