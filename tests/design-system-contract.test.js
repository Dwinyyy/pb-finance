import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const favicon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../docs/design-system/pb-signature-colors.md', import.meta.url), 'utf8');

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
