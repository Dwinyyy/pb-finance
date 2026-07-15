import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile } from 'tailwindcss';
import { createServer } from 'vite';
import { toneForStatus, toneForTier } from '../src/components/ui/statusTone.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const loadInteractionState = async () => {
  try {
    return await import('../src/components/ui/interactionState.js');
  } catch (error) {
    assert.fail(`interactionState.js is required for testable control behavior: ${error.code || error.message}`);
  }
};

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

test('Button removes hover and tap transforms when reduced motion is requested', () => {
  const button = read('../src/components/ui/Button.jsx');

  assert.match(button, /import \{ motion as Motion, useReducedMotion \} from 'framer-motion';/);
  assert.match(button, /const shouldReduceMotion = useReducedMotion\(\);/);
  assert.match(button, /const isMotionDisabled = shouldReduceMotion \|\| disabled \|\| isLoading;/);
  assert.match(button, /whileHover=\{isMotionDisabled \? undefined : \{ y: -1 \}\}/);
  assert.match(button, /whileTap=\{isMotionDisabled \? undefined : \{ y: 1, scale: 0\.98 \}\}/);
});

test('Tailwind translation motion is opt-in through motion-safe', async () => {
  const button = read('../src/components/ui/Button.jsx');
  const toggle = read('../src/components/ui/Toggle.jsx');

  assert.match(button, /motion-safe:hover:-translate-y-px/);
  assert.match(button, /motion-safe:active:translate-y-px/);
  assert.doesNotMatch(button, /(?:^|[\s"])hover:-translate-y-px(?=[\s"])/m);
  assert.doesNotMatch(button, /(?:^|[\s"])active:translate-y-px(?=[\s"])/m);
  assert.match(toggle, /\$\{checked \? 'motion-safe:translate-x-5 motion-reduce:left-5' : ''\}/);
  assert.doesNotMatch(toggle, /\$\{checked \? 'translate-x-5/);

  const tailwind = await compile('@theme { --spacing: 0.25rem; } @tailwind utilities;');
  const generatedCss = tailwind.build([
    'translate-x-5',
    'transform-none',
    'motion-safe:translate-x-5',
    'motion-reduce:left-5',
  ]);

  assert.match(generatedCss, /\.translate-x-5\s*\{[\s\S]*?translate:/);
  assert.match(generatedCss, /\.transform-none\s*\{\s*transform: none;/);
  assert.match(generatedCss, /\.motion-safe\\:translate-x-5\s*\{\s*@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(generatedCss, /\.motion-reduce\\:left-5\s*\{\s*@media \(prefers-reduced-motion: reduce\)/);
});

test('segmented navigation helper wraps arrow movement', async () => {
  const { nextSegmentedIndex } = await loadInteractionState();
  const cases = [
    { name: 'right advances', currentIndex: 0, key: 'ArrowRight', optionCount: 3, expected: 1 },
    { name: 'down advances', currentIndex: 1, key: 'ArrowDown', optionCount: 3, expected: 2 },
    { name: 'right wraps', currentIndex: 2, key: 'ArrowRight', optionCount: 3, expected: 0 },
    { name: 'left wraps', currentIndex: 0, key: 'ArrowLeft', optionCount: 3, expected: 2 },
    { name: 'up retreats', currentIndex: 1, key: 'ArrowUp', optionCount: 3, expected: 0 },
    { name: 'unhandled key is ignored', currentIndex: 1, key: 'Enter', optionCount: 3, expected: null },
    { name: 'empty options are ignored', currentIndex: 0, key: 'ArrowRight', optionCount: 0, expected: null },
  ];

  for (const { name, expected, ...input } of cases) {
    assert.equal(nextSegmentedIndex(input), expected, name);
  }
});

test('activation helper suppresses disabled and busy controls', async () => {
  const { canActivateControl } = await loadInteractionState();

  assert.equal(canActivateControl({}), true);
  assert.equal(canActivateControl({ disabled: true }), false);
  assert.equal(canActivateControl({ isBusy: true }), false);
  assert.equal(canActivateControl({ disabled: true, isBusy: true }), false);
});

test('SegmentedControl and Toggle consume the tested interaction helpers', () => {
  const segmented = read('../src/components/ui/SegmentedControl.jsx');
  const toggle = read('../src/components/ui/Toggle.jsx');

  assert.match(segmented, /import \{ canActivateControl, nextSegmentedIndex \} from '\.\/interactionState\.js';/);
  assert.match(segmented, /nextSegmentedIndex\(\{/);
  assert.match(segmented, /canActivateControl\(\{ disabled \}\)/);
  assert.match(toggle, /import \{ canActivateControl \} from '\.\/interactionState\.js';/);
  assert.match(toggle, /canActivateControl\(\{ disabled, isBusy \}\)/);
});

test('shared controls server-render their accessible state', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const [formFieldModule, toggleModule, segmentedModule, buttonModule] = await Promise.all([
      vite.ssrLoadModule('/src/components/ui/FormField.jsx'),
      vite.ssrLoadModule('/src/components/ui/Toggle.jsx'),
      vite.ssrLoadModule('/src/components/ui/SegmentedControl.jsx'),
      vite.ssrLoadModule('/src/components/ui/Button.jsx'),
    ]);

    const formField = renderToStaticMarkup(createElement(formFieldModule.FormField, {
      id: 'email',
      label: 'Email',
      error: 'Email is required',
      required: true,
      children: ({ describedBy, ...controlProps }) => createElement('input', {
        ...controlProps,
        id: 'email',
        'data-description-id': describedBy,
      }),
    }));
    assert.match(formField, /<label[^>]*for="email"/);
    assert.match(formField, /aria-describedby="email-description"/);
    assert.match(formField, /aria-invalid="true"/);
    assert.match(formField, /data-description-id="email-description"/);
    assert.match(formField, /role="alert"/);
    assert.match(formField, /required=""/);

    const toggle = renderToStaticMarkup(createElement(toggleModule.Toggle, {
      checked: true,
      label: 'Payment alerts',
      onChange: () => {},
    }));
    assert.match(toggle, /role="switch"/);
    assert.match(toggle, /aria-checked="true"/);
    const labelId = toggle.match(/aria-labelledby="([^"]+)"/)?.[1];
    assert.ok(labelId);
    assert.ok(toggle.includes(`id="${labelId}"`));

    const busyToggle = renderToStaticMarkup(createElement(toggleModule.Toggle, {
      checked: false,
      isBusy: true,
      label: 'Payment alerts',
      onChange: () => {},
    }));
    assert.match(busyToggle, /aria-busy="true"/);
    assert.match(busyToggle, /disabled=""/);

    const options = [
      { label: 'Monthly', value: 'monthly' },
      { label: 'Yearly', value: 'yearly' },
    ];
    const segmented = renderToStaticMarkup(createElement(segmentedModule.SegmentedControl, {
      ariaLabel: 'Billing period',
      onChange: () => {},
      options,
      value: 'monthly',
    }));
    assert.match(segmented, /role="radiogroup"/);
    assert.match(segmented, /aria-label="Billing period"/);
    assert.equal([...segmented.matchAll(/role="radio"/g)].length, 2);
    assert.match(segmented, /aria-checked="true"/);
    assert.match(segmented, /aria-checked="false"/);
    assert.match(segmented, /tabindex="0"/);
    assert.match(segmented, /tabindex="-1"/);

    const disabledSegmented = renderToStaticMarkup(createElement(segmentedModule.SegmentedControl, {
      ariaLabel: 'Billing period',
      disabled: true,
      onChange: () => {},
      options,
      value: 'monthly',
    }));
    assert.match(disabledSegmented, /aria-disabled="true"/);
    assert.equal([...disabledSegmented.matchAll(/disabled=""/g)].length, 2);

    const loadingButton = renderToStaticMarkup(createElement(buttonModule.Button, {
      isLoading: true,
      children: 'Save changes',
    }));
    assert.match(loadingButton, /<button/);
    assert.match(loadingButton, /aria-busy="true"/);
    assert.match(loadingButton, /disabled=""/);
    assert.match(loadingButton, />Save changes<\/button>/);
  } finally {
    await vite.close();
  }
});
