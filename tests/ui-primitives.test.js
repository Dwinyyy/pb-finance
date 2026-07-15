import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toneForStatus, toneForTier } from '../src/components/ui/statusTone.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('status and tier tones preserve semantic meaning', () => {
  assert.equal(toneForStatus('approved'), 'verified');
  assert.equal(toneForStatus('pending_review'), 'warning');
  assert.equal(toneForStatus('rejected'), 'danger');
  assert.equal(toneForStatus('uploading'), 'processing');
  assert.equal(toneForTier('basic'), 'neutral');
  assert.equal(toneForTier('verified'), 'verified');
  assert.equal(toneForTier('vip'), 'premium');
  assert.equal(toneForTier('unknown'), 'neutral');
});

test('shared primitives expose accessible semantic interfaces', () => {
  assert.match(read('../src/components/ui/BrandMark.jsx'), /aria-label/);
  assert.match(read('../src/components/ui/FormField.jsx'), /aria-describedby/);
  assert.match(read('../src/components/ui/SegmentedControl.jsx'), /role="radiogroup"/);
  assert.match(read('../src/components/ui/SegmentedControl.jsx'), /aria-checked/);
  assert.match(read('../src/components/ui/StatusBadge.jsx'), /toneForStatus/);
  assert.match(read('../src/components/ui/SurfaceCard.jsx'), /bg-surface/);
  assert.match(read('../src/components/ui/Toggle.jsx'), /role="switch"/);
  assert.match(read('../src/components/ui/Toggle.jsx'), /aria-checked/);
  assert.match(read('../src/components/ui/Button.jsx'), /active:translate-y-px/);
  assert.match(read('../src/components/ui/Button.jsx'), /focus-visible:ring-focus/);
});
