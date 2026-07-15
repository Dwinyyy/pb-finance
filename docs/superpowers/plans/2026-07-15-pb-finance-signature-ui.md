# PB Finance Signature UI System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the canonical PB Finance signature design system and apply it to the public landing pages, client tier and verification surfaces, and professional onboarding/profile surfaces without changing business behavior.

**Architecture:** Define stable PB color primitives and theme-switching semantic aliases in `src/index.css`, then consume those aliases through small shared React primitives. Migrate the public, client, professional, and public-auth surfaces incrementally while keeping all permission, upload, verification, routing, and API state in their current owners. Source-contract and pure-function tests provide fast TDD coverage; browser checks provide interaction and visual coverage because the repository has no DOM test runner.

**Tech Stack:** React 19.2, React DOM portals, Tailwind CSS 4.2 CSS-first theme tokens, Framer Motion 12.38, Lucide React, Vite 8, Node `--test`, ESLint 9.

## Global Constraints

- Do not add a component framework, test framework, Storybook, token build package, or runtime dependency.
- Canonical signature anchors are PB Midnight `#0B1F3A`, PB Cobalt `#2563EB`, PB Emerald `#047857`, PB Signal Cyan `#0E7490`, PB Champagne `#A67C38`, PB Pearl `#F7F9FC`, and PB Ink `#0A1628`.
- Functional colors remain separate: Attention Amber `#B45309` and Danger Crimson `#B42318`.
- The exact Cobalt/legacy `primary-*` ramp is 50 `#EFF6FF`, 100 `#DBEAFE`, 200 `#BFDBFE`, 300 `#93C5FD`, 400 `#60A5FA`, 500 `#3B82F6`, 600 `#2563EB`, 700 `#1D4ED8`, 800 `#1E40AF`, 900 `#1E3A8A`, 950 `#172554`.
- PB Midnight and PB Cobalt dominate; Champagne is scarce; Emerald means verified/positive growth; Signal means technology/processing; Amber means attention; Crimson means failure/destructive action.
- Use semantic aliases or shared primitives in migrated JSX. Do not place raw signature hex values in React components and do not globally redefine Tailwind stock color namespaces.
- Preserve `/`, `/talents`, `/agency`, `/pricing`, CTA destinations, pricing logic, auth behavior, client Basic/Verified/VIP permissions, professional Unverified/Basic/Verified permissions, verification requirements, document locking, and all backend calls.
- Preserve the exact accepted client business-document choices—US EIN Letter (CP575), State Business Registration, and EU VAT Certificate—and the protected read-only `verifiedBusinessName`.
- Keep every professional PRC, BOA, tax, identity, liveness, resume, and mapped certification input distinct; do not introduce OR logic.
- Controls are at least 44px, keyboard focus is visible, status is not color-only, and motion respects reduced-motion preferences.
- Use `@theme inline` for semantic Tailwind colors that reference light/dark CSS variables.
- Every task ends with its focused test, and the final task must pass `npm test`, `npm run lint`, and `npm run build` plus browser verification.

Use this migration map in every target surface, choosing `canvas` versus `surface-muted` from layout meaning rather than mechanical search/replace:

| Existing intent | Canonical replacement |
| --- | --- |
| white/slate card pair | `bg-surface text-text-primary border-border-subtle` |
| slate page pair | `bg-canvas text-text-primary` |
| inset/filter region | `bg-surface-muted` |
| slate secondary copy | `text-text-muted` |
| primary action/selection | `bg-action`, `text-action`, or Cobalt primitive for deliberate brand emphasis |
| emerald status | `verified` foreground/surface/border triplet |
| cyan processing/tech | `processing` foreground/surface/border triplet |
| amber attention | `warning` foreground/surface/border triplet |
| red failure/destructive | `danger` foreground/surface/border triplet |
| slate-950 brand block | `bg-pb-midnight` only when the section is intentionally trust-led |

---

### Task 1: Canonical tokens, brand governance, and browser chrome

**Files:**
- Create: `tests/design-system-contract.test.js`
- Create: `docs/design-system/pb-signature-colors.md`
- Modify: `src/index.css`
- Modify: `AGENTS.md`
- Modify: `index.html`
- Modify: `public/favicon.svg`
- Delete: `src/App.css`

**Interfaces:**
- Produces: Tailwind utilities including `bg-canvas`, `bg-surface`, `bg-surface-muted`, `text-text-primary`, `text-text-muted`, `border-border-subtle`, `border-border-control`, `bg-action`, `text-verified`, `bg-verified-surface`, `text-processing`, `bg-warning-surface`, and `bg-danger-surface`.
- Produces: Exact compatibility utilities `primary-50` through `primary-950` mapped to PB Cobalt.
- Consumes: Nothing; this is the foundation for every later task.

- [ ] **Step 1: Write the failing design-system contract test**

```js
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
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node --test tests/design-system-contract.test.js`

Expected: FAIL because the guide and semantic tokens do not exist, the HTML title is still `pb-finance`, the favicon is Vite purple, and `src/App.css` still exists.

- [ ] **Step 3: Implement the canonical token layers**

Add primitive tokens to the existing `@theme` block while preserving the font and existing utilities:

```css
@theme {
  --font-sans: "Outfit", ui-sans-serif, system-ui, sans-serif;
  --color-pb-midnight: #0B1F3A;
  --color-pb-midnight-soft: #E8EEF5;
  --color-pb-midnight-strong: #071426;
  --color-pb-cobalt-50: #EFF6FF;
  --color-pb-cobalt-100: #DBEAFE;
  --color-pb-cobalt-200: #BFDBFE;
  --color-pb-cobalt-300: #93C5FD;
  --color-pb-cobalt-400: #60A5FA;
  --color-pb-cobalt-500: #3B82F6;
  --color-pb-cobalt-600: #2563EB;
  --color-pb-cobalt-700: #1D4ED8;
  --color-pb-cobalt-800: #1E40AF;
  --color-pb-cobalt-900: #1E3A8A;
  --color-pb-cobalt-950: #172554;
  --color-primary-50: #EFF6FF;
  --color-primary-100: #DBEAFE;
  --color-primary-200: #BFDBFE;
  --color-primary-300: #93C5FD;
  --color-primary-400: #60A5FA;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  --color-primary-800: #1E40AF;
  --color-primary-900: #1E3A8A;
  --color-primary-950: #172554;
  --color-pb-emerald: #047857;
  --color-pb-signal: #0E7490;
  --color-pb-champagne: #A67C38;
  --color-pb-pearl: #F7F9FC;
  --color-pb-ink: #0A1628;
  --color-attention: #B45309;
  --color-danger: #B42318;
  --radius-control: 0.875rem;
  --radius-card: 1.25rem;
  --radius-modal: 1.5rem;
  --shadow-card: 0 12px 32px -22px rgb(11 31 58 / 0.34);
  --shadow-modal: 0 28px 80px -24px rgb(5 11 20 / 0.55);
  --ease-pb-fluid: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Add light/dark runtime variables and inline semantic mappings:

```css
:root {
  --pb-canvas: #F7F9FC;
  --pb-surface: #FFFFFF;
  --pb-surface-muted: #EEF3F8;
  --pb-text-primary: #0A1628;
  --pb-text-muted: #526175;
  --pb-border-subtle: #D9E2EC;
  --pb-border-control: #7C8FA5;
  --pb-action: #2563EB;
  --pb-focus: #2563EB;
  --pb-info: #1D4ED8;
  --pb-info-surface: #EFF6FF;
  --pb-info-border: #93C5FD;
  --pb-verified: #047857;
  --pb-verified-surface: #D1FAE5;
  --pb-verified-border: #6EE7B7;
  --pb-processing: #0E7490;
  --pb-processing-surface: #CFFAFE;
  --pb-processing-border: #67E8F9;
  --pb-warning: #92400E;
  --pb-warning-surface: #FEF3C7;
  --pb-warning-border: #F59E0B;
  --pb-danger: #912018;
  --pb-danger-surface: #FEE4E2;
  --pb-danger-border: #F97066;
  --pb-premium-detail: #A67C38;
}

.dark {
  --pb-canvas: #07111F;
  --pb-surface: #0D1B2A;
  --pb-surface-muted: #13263A;
  --pb-text-primary: #F8FAFC;
  --pb-text-muted: #A8B4C4;
  --pb-border-subtle: #21364D;
  --pb-border-control: #526B86;
  --pb-action: #2563EB;
  --pb-focus: #60A5FA;
  --pb-info: #93C5FD;
  --pb-info-surface: #10284F;
  --pb-info-border: #2563EB;
  --pb-verified: #34D399;
  --pb-verified-surface: #0B2B22;
  --pb-verified-border: #047857;
  --pb-processing: #22D3EE;
  --pb-processing-surface: #082A33;
  --pb-processing-border: #0E7490;
  --pb-warning: #FCD34D;
  --pb-warning-surface: #2B1D08;
  --pb-warning-border: #B45309;
  --pb-danger: #FDA29B;
  --pb-danger-surface: #2A1214;
  --pb-danger-border: #B42318;
  --pb-premium-detail: #D9BC78;
}

@theme inline {
  --color-canvas: var(--pb-canvas);
  --color-surface: var(--pb-surface);
  --color-surface-muted: var(--pb-surface-muted);
  --color-text-primary: var(--pb-text-primary);
  --color-text-muted: var(--pb-text-muted);
  --color-border-subtle: var(--pb-border-subtle);
  --color-border-control: var(--pb-border-control);
  --color-action: var(--pb-action);
  --color-focus: var(--pb-focus);
  --color-info: var(--pb-info);
  --color-info-surface: var(--pb-info-surface);
  --color-info-border: var(--pb-info-border);
  --color-verified: var(--pb-verified);
  --color-verified-surface: var(--pb-verified-surface);
  --color-verified-border: var(--pb-verified-border);
  --color-processing: var(--pb-processing);
  --color-processing-surface: var(--pb-processing-surface);
  --color-processing-border: var(--pb-processing-border);
  --color-warning: var(--pb-warning);
  --color-warning-surface: var(--pb-warning-surface);
  --color-warning-border: var(--pb-warning-border);
  --color-danger: var(--pb-danger);
  --color-danger-surface: var(--pb-danger-surface);
  --color-danger-border: var(--pb-danger-border);
  --color-premium-detail: var(--pb-premium-detail);
}
```

- [ ] **Step 4: Add durable brand guidance and browser identity**

Create `docs/design-system/pb-signature-colors.md` with the exact primitive, semantic, feedback, contrast, and prohibited-use tables from the approved spec, headed by:

```md
# PB Finance Signature Colors

This is the canonical color contract for PB Finance UI and UX work. New components use semantic utilities first; direct signature primitives are reserved for the brand compositions documented below.

## Selection rule

1. Choose the component intent: surface, content, action, information, verified, processing, warning, danger, or premium detail.
2. Use the matching semantic token or shared primitive.
3. Never use Emerald for incomplete work, Champagne for warnings, Signal for approval, or Amber for success.
4. Update this guide, `src/index.css`, contrast tests, and affected UI tests together when the palette changes.
```

Append this repository rule to `AGENTS.md`:

```md
## PB Finance Signature Design System

For all future UI and UX work, use the canonical tokens and usage rules in `docs/design-system/pb-signature-colors.md`. Do not introduce raw brand hex values or page-owned status colors when a semantic token or shared UI primitive exists.
```

Change the document title to `<title>PB Finance</title>`, replace the Vite favicon with an accessible SVG containing `<title>PB Finance</title>` and a Midnight rounded square with a Cobalt/Champagne `PB` monogram, and delete the confirmed-unimported `src/App.css`.

- [ ] **Step 5: Run the contract test and commit**

Run: `node --test tests/design-system-contract.test.js`

Expected: PASS with 2 tests.

```bash
git add AGENTS.md docs/design-system/pb-signature-colors.md index.html public/favicon.svg src/index.css tests/design-system-contract.test.js
git add -u src/App.css
git commit -m "feat: establish PB Finance signature tokens"
```

---

### Task 2: Shared brand and presentation primitives

**Files:**
- Create: `src/components/ui/BrandMark.jsx`
- Create: `src/components/ui/FormField.jsx`
- Create: `src/components/ui/SegmentedControl.jsx`
- Create: `src/components/ui/StatusBadge.jsx`
- Create: `src/components/ui/SurfaceCard.jsx`
- Create: `src/components/ui/Toggle.jsx`
- Create: `src/components/ui/statusTone.js`
- Create: `tests/ui-primitives.test.js`
- Modify: `src/components/ui/Button.jsx`

**Interfaces:**
- Produces: `BrandMark({ compact, label, className })`.
- Produces: `FormField({ children, error, hint, id, label, required })` and `formControlClassName`.
- Produces: `SegmentedControl({ ariaLabel, disabled, onChange, options, value })`, where each option is `{ label, value, icon? }`.
- Produces: `StatusBadge({ label, status, tone })`, with `toneForStatus(status)` and `toneForTier(tier)` from `statusTone.js`.
- Produces: `SurfaceCard({ as, children, className, tone })`.
- Produces: `Toggle({ checked, disabled, isBusy, label, onChange })` using switch semantics.
- Consumes: Task 1 semantic utilities.

- [ ] **Step 1: Write the failing primitive contract and tone tests**

```js
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
```

- [ ] **Step 2: Run the primitive tests and verify they fail**

Run: `node --test tests/ui-primitives.test.js`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement the pure status mapping**

```js
const STATUS_TONES = Object.freeze({
  approved: 'verified',
  complete: 'verified',
  completed: 'verified',
  active: 'verified',
  pending: 'warning',
  pending_review: 'warning',
  requesting: 'warning',
  rejected: 'danger',
  expired: 'danger',
  error: 'danger',
  uploading: 'processing',
  processing: 'processing',
  draft: 'neutral',
});

export const toneForStatus = (status) => STATUS_TONES[String(status || '').toLowerCase()] || 'neutral';

export const toneForTier = (tier) => ({
  verified: 'verified',
  vip: 'premium',
}[String(tier || '').toLowerCase()] || 'neutral');
```

- [ ] **Step 4: Implement the shared primitives**

Use these stable class contracts:

```jsx
export const formControlClassName = 'min-h-11 w-full rounded-control border border-border-control bg-surface px-4 py-3 text-sm font-medium text-text-primary outline-none transition-[border-color,box-shadow,background-color] placeholder:text-text-muted/70 focus-visible:border-focus focus-visible:ring-4 focus-visible:ring-focus/15 aria-invalid:border-danger aria-invalid:ring-danger/10 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted';

export function FormField({ children, error = '', hint = '', id, label, required = false }) {
  const descriptionId = `${id}-description`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text-primary">
        {label}{required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
      </label>
      {children({ className: formControlClassName, describedBy: descriptionId })}
      {(error || hint) && <p id={descriptionId} className={`text-xs font-medium ${error ? 'text-danger' : 'text-text-muted'}`} role={error ? 'alert' : undefined}>{error || hint}</p>}
    </div>
  );
}
```

Use this exact status/presentation contract:

```jsx
const TONE_CLASSES = {
  neutral: 'border-border-subtle bg-surface-muted text-text-muted',
  info: 'border-info-border bg-info-surface text-info',
  verified: 'border-verified-border bg-verified-surface text-verified',
  processing: 'border-processing-border bg-processing-surface text-processing',
  warning: 'border-warning-border bg-warning-surface text-warning',
  danger: 'border-danger-border bg-danger-surface text-danger',
  premium: 'border-premium-detail/50 bg-pb-midnight text-white',
};

export function StatusBadge({ label, status = '', tone = '' }) {
  const resolvedTone = tone || toneForStatus(status);
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${TONE_CLASSES[resolvedTone] || TONE_CLASSES.neutral}`}>{label || String(status).replaceAll('_', ' ')}</span>;
}

export function SurfaceCard({ as: Component = 'section', children, className = '', tone = 'default' }) {
  const tones = {
    default: 'border-border-subtle bg-surface',
    muted: 'border-border-subtle bg-surface-muted',
    trust: 'border-pb-midnight/20 bg-pb-midnight-soft',
    premium: 'border-premium-detail/35 bg-surface',
  };
  return <Component className={`rounded-card border shadow-card ${tones[tone]} ${className}`}>{children}</Component>;
}

export function BrandMark({ className = '', compact = false, label = 'PB Finance' }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label={label}>
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-control bg-pb-midnight text-sm font-black text-white ring-1 ring-premium-detail/35">PB</span>
      {!compact && <span className="text-lg font-bold tracking-tight text-text-primary">PB Finance</span>}
    </span>
  );
}
```

`SegmentedControl` renders native buttons with `role="radio"`, `aria-checked`, roving `tabIndex`, arrow-key navigation across `options`, and a visible selected shape using `bg-action text-white`; disabled options do not fire `onChange`. Refactor `Button` to semantic tokens, `focus-visible`, `motion-reduce:transform-none`, a one-pixel hover lift, and `active:translate-y-px` while preserving its current props and Framer Motion loading behavior.

Implement `Toggle` as a native button with `role="switch"`, `aria-checked={checked}`, an explicit adjacent label, disabled/busy handling, a semantic Cobalt checked track, neutral unchecked track, visible focus, and a translating thumb whose transform is removed under reduced motion.

- [ ] **Step 5: Run the primitive tests and commit**

Run: `node --test tests/ui-primitives.test.js tests/design-system-contract.test.js`

Expected: PASS.

```bash
git add src/components/ui tests/ui-primitives.test.js
git commit -m "feat: add signature UI primitives"
```

---

### Task 3: Accessible animated modal foundation

**Files:**
- Create: `src/components/ui/Modal.jsx`
- Create: `tests/modal-ui.test.js`
- Modify: `src/pages/ClientPages.jsx`
- Modify: `src/pages/ProfessionalPages.jsx`

**Interfaces:**
- Produces: `Modal({ children, description, footer, initialFocusRef, onClose, open, size, title })`.
- Consumes: Task 1 tokens and Task 2 `Button`.
- Preserves: Every existing modal form, submit handler, and payload.

- [ ] **Step 1: Write the failing modal contract test**

```js
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
```

- [ ] **Step 2: Run the modal test and verify it fails**

Run: `node --test tests/modal-ui.test.js`

Expected: FAIL because `Modal.jsx` does not exist and both pages own `PortalModal`.

- [ ] **Step 3: Implement modal focus, scroll, and motion behavior**

Implement `Modal.jsx` with `createPortal`, `AnimatePresence`, `Motion.div`, and `useReducedMotion`. On open, save `document.activeElement`, set `document.body.style.overflow = 'hidden'`, focus `initialFocusRef.current` or the first focusable control, contain Tab/Shift+Tab within the panel, and close on Escape. Cleanup restores the previous body overflow and focus. The overlay closes only when `event.target === event.currentTarget`; clicks inside never close it.

Use this focus/cleanup core:

```jsx
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

useEffect(() => {
  if (!open) return undefined;
  const previouslyFocused = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const focusable = () => [...(panelRef.current?.querySelectorAll(FOCUSABLE) || [])];
  window.requestAnimationFrame(() => (initialFocusRef?.current || focusable()[0] || panelRef.current)?.focus());

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = previousOverflow;
    previouslyFocused?.focus?.();
  };
}, [initialFocusRef, onClose, open]);
```

Use this motion contract:

```jsx
const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const panelMotion = prefersReducedMotion
  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
  : { initial: { opacity: 0, y: 18, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.99 } };
```

The panel uses semantic canvas/surface/border tokens, a sticky header, optional sticky footer, `max-h-[calc(100dvh-2rem)]`, and mobile bottom alignment with desktop centering.

- [ ] **Step 4: Replace duplicated client/professional portal implementations**

Remove `createPortal` imports and local `PortalModal` functions. Import `Modal` and convert each call to pass `open`, `onClose`, `title`, and `size`; keep existing form children and callbacks unchanged. For Profile Settings and both identity/credential change-request dialogs, keep the modal mounted with a boolean `open` prop so exit motion can complete.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/modal-ui.test.js tests/client-verification-ui.test.js tests/professional-onboarding-ui.test.js`

Expected: PASS.

```bash
git add src/components/ui/Modal.jsx src/pages/ClientPages.jsx src/pages/ProfessionalPages.jsx tests/modal-ui.test.js
git commit -m "feat: add accessible animated modals"
```

---

### Task 4: Accessible drop zone and Client Verification redesign

**Files:**
- Create: `src/components/ui/FileDropzone.jsx`
- Create: `src/components/ui/fileDropzoneState.js`
- Create: `tests/file-dropzone-ui.test.js`
- Modify: `src/components/ClientVerificationDashboard.jsx`
- Modify: `tests/client-verification-ui.test.js`

**Interfaces:**
- Produces: `FileDropzone({ accept, capture, disabled, error, fileMeta, fileName, helpText, id, isBusy, isLocked, label, onFile, onOpen, onRequestChange, status })`.
- Produces: `toneForDropzoneState({ disabled, error, hasFile, isDragging, isLocked, isUploading, status })`.
- Consumes: `SurfaceCard`, `StatusBadge`, `Button`, and Task 1 semantic tokens.

- [ ] **Step 1: Write failing drop-zone state and source tests**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toneForDropzoneState } from '../src/components/ui/fileDropzoneState.js';

const source = readFileSync(new URL('../src/components/ui/FileDropzone.jsx', import.meta.url), 'utf8');

test('drop-zone state priorities are deterministic', () => {
  assert.equal(toneForDropzoneState({ error: 'Bad file' }), 'danger');
  assert.equal(toneForDropzoneState({ isLocked: true }), 'trust');
  assert.equal(toneForDropzoneState({ isUploading: true }), 'processing');
  assert.equal(toneForDropzoneState({ isDragging: true }), 'processing');
  assert.equal(toneForDropzoneState({ hasFile: true, status: 'approved' }), 'verified');
  assert.equal(toneForDropzoneState({ disabled: true }), 'disabled');
  assert.equal(toneForDropzoneState({}), 'neutral');
});

test('drop zone supports input, keyboard, and drag paths', () => {
  assert.match(source, /type="file"/);
  assert.match(source, /onDrop/);
  assert.match(source, /onDragEnter/);
  assert.match(source, /onDragLeave/);
  assert.match(source, /onFile\(file\)/);
  assert.match(source, /aria-describedby/);
  assert.match(source, /Uploading securely/);
});
```

- [ ] **Step 2: Run the drop-zone tests and verify they fail**

Run: `node --test tests/file-dropzone-ui.test.js`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the shared drop zone**

Implement drag-depth tracking so nested drag events do not flicker. Both `<input onChange>` and `onDrop` call the same `selectFile(file)` function, which returns early when disabled/locked/busy and otherwise calls `onFile(file)`. Keep the input keyboard-accessible through a labelled control. Render filename, metadata, status badge, Open, and Request Change actions from props. Use neutral rest, processing drag/upload, verified uploaded, trust locked, warning pending-change, and danger error/rejected classes. Do not display numeric progress.

Use this deterministic state and event core:

```js
export const toneForDropzoneState = ({ disabled, error, hasFile, isDragging, isLocked, isUploading, status } = {}) => {
  if (error || status === 'rejected') return 'danger';
  if (isLocked) return 'trust';
  if (isUploading || isDragging) return 'processing';
  if (status === 'pending_change') return 'warning';
  if (hasFile || status === 'approved') return 'verified';
  if (disabled) return 'disabled';
  return 'neutral';
};
```

```jsx
const selectFile = (file) => {
  if (!file || disabled || isLocked || isBusy) return;
  onFile(file);
};

const handleDrop = (event) => {
  event.preventDefault();
  dragDepth.current = 0;
  setIsDragging(false);
  selectFile(event.dataTransfer.files?.[0]);
};

<input
  id={id}
  type="file"
  className="sr-only"
  accept={accept}
  capture={capture}
  disabled={disabled || isLocked || isBusy}
  aria-describedby={`${id}-description`}
  onChange={(event) => {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  }}
/>
```

- [ ] **Step 4: Refactor Client Verification around the drop zone**

Change `handleUpload(kind, event)` to `handleUpload(kind, file)` and preserve the current 3 MB check, data-URL conversion, API payload, feedback, and mutation. Replace each `EvidenceCard` file input/label with `FileDropzone`; preserve liveness `capture="user"`, business-document select locking, Open behavior, rejection reasons, and the exact four requirement labels. Recompose the page with semantic header/status/progress cards and a responsive two-column grid. Keep submit disabled from `verification.canSubmit`, busy state, pending review, and approval.

Extend `tests/client-verification-ui.test.js` with:

```js
assert.match(clientDashboard, /FileDropzone/);
assert.match(clientDashboard, /handleUpload\(config\.kind, file\)/);
assert.match(clientDashboard, /role="status"|aria-live="polite"/);
assert.match(clientDashboard, /verifiedBusinessName/);
```

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/file-dropzone-ui.test.js tests/client-verification-ui.test.js tests/client-verification.test.js tests/client-verification-api.test.js`

Expected: PASS.

```bash
git add src/components/ui/FileDropzone.jsx src/components/ui/fileDropzoneState.js src/components/ClientVerificationDashboard.jsx tests/file-dropzone-ui.test.js tests/client-verification-ui.test.js
git commit -m "feat: polish client verification uploads"
```

---

### Task 5: Public shell and Home landing page

**Files:**
- Create: `tests/public-design-system-ui.test.js`
- Modify: `src/pages/PublicPages.jsx`

**Interfaces:**
- Consumes: `BrandMark`, `Button`, `SurfaceCard`, semantic utilities.
- Preserves: `PublicSite`, `HomeMarketingView`, `ROICalculator`, `FAQAccordion`, route IDs, navigation callbacks, and CTA callbacks.
- Produces: Signature public navigation/footer and Home route.

- [ ] **Step 1: Write the failing public shell/Home contract**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicPage = readFileSync(new URL('../src/pages/PublicPages.jsx', import.meta.url), 'utf8');

test('public shell and Home use the signature system', () => {
  assert.match(publicPage, /<BrandMark/);
  assert.match(publicPage, /bg-canvas/);
  assert.match(publicPage, /bg-pb-midnight/);
  assert.match(publicPage, /text-text-primary/);
  assert.match(publicPage, /text-premium-detail/);
  assert.match(publicPage, /text-verified/);
  assert.match(publicPage, /text-processing/);
  assert.doesNotMatch(publicPage, /violet-/);
});

test('public route and CTA behavior remains intact', () => {
  for (const route of ['home', 'talents', 'agency', 'pricing']) assert.match(publicPage, new RegExp(`id: '${route}'`));
  assert.match(publicPage, /openAuth\('register'\)/);
  assert.match(publicPage, /openAuth\('register_pro'\)/);
  assert.match(publicPage, /navigateTo\('talents'\)/);
});
```

- [ ] **Step 2: Run the public test and verify it fails**

Run: `node --test tests/public-design-system-ui.test.js`

Expected: FAIL because `PublicPages.jsx` still owns duplicated PB marks, uses stock Slate/Violet decisions, and lacks semantic utilities.

- [ ] **Step 3: Migrate the shared public shell**

Import `BrandMark`, use it in the fixed navigation, mobile menu, and footer, and preserve the current scroll-hide and menu scroll-lock effects. Use Pearl/semantic surfaces for navigation, Midnight for footer/brand anchors, Cobalt for selected route and CTAs, `border-control` for focus-visible structure, and 44px targets. Preserve all route IDs and button handlers.

- [ ] **Step 4: Recompose Home with one dominant feeling per section**

Keep all existing sections and copy. Apply:

- Hero: `bg-canvas`, Midnight/Ink heading, Cobalt CTA, one Cobalt-to-Signal text emphasis, Champagne eyebrow detail.
- Audience paths: semantic surfaces and Cobalt actions.
- Credibility strip: Midnight for vetting/compliance, Emerald only for savings/outcomes; remove Violet.
- Services/process/FAQ: Pearl/white semantic surfaces and restrained Cobalt interaction.
- ROI: neutral inputs/Cobalt controls; Emerald savings result.
- Secure matching/final CTA: Midnight background, Signal technical metadata, Emerald completed status, Cobalt action.

Do not change array contents, calculator state, FAQ state, route navigation, or auth callbacks.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/public-design-system-ui.test.js tests/ui-primitives.test.js`

Expected: PASS.

```bash
git add src/pages/PublicPages.jsx tests/public-design-system-ui.test.js
git commit -m "feat: apply signature design to public home"
```

---

### Task 6: Directory, Enterprise, Pricing, and public auth entry

**Files:**
- Modify: `src/pages/PublicPages.jsx`
- Modify: `src/App.jsx`
- Modify: `tests/public-design-system-ui.test.js`

**Interfaces:**
- Consumes: Tasks 1–3 primitives and semantic tokens.
- Preserves: Public route composition, directory filtering/locked preview, remote enterprise image, pricing values, CTA destinations, and auth handlers.
- Produces: Signature `/talents`, `/agency`, `/pricing`, 404, and public auth overlay.

- [ ] **Step 1: Extend the public test with route-specific and migration guards**

```js
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('secondary public routes and auth entry use semantic colors', () => {
  for (const component of ['PreviewDirectoryView', 'AgencyMarketingView', 'PricingView']) assert.match(publicPage, new RegExp(`function ${component}`));
  assert.match(publicPage, /bg-verified-surface/);
  assert.match(publicPage, /bg-processing-surface/);
  assert.match(publicPage, /bg-pb-midnight/);
  assert.match(app, /bg-surface/);
  assert.match(app, /border-border-control/);
  assert.match(app, /text-danger/);
  assert.doesNotMatch(publicPage, /(?:bg|text|border|from|via|to)-(?:slate|gray|zinc|violet|blue|cyan|emerald)-/);
});
```

- [ ] **Step 2: Run the route-specific test and verify it fails**

Run: `node --test tests/public-design-system-ui.test.js`

Expected: FAIL because the secondary routes and auth overlay still use page-owned stock colors.

- [ ] **Step 3: Migrate Directory, Enterprise, Pricing, and 404**

Use trust semantics for privacy/locks, `verified` only for actual verified evidence/positive availability, `processing` for technical metadata, and Cobalt for filters/selected/action states in Directory. Use a tokenized Midnight overlay, scarce Champagne eyebrow/edge, Emerald substantiated capability points, and Signal pod/process cues in Enterprise. Use Pearl/Ink comparison, Midnight enterprise distinction, Cobalt actions, and no unsupported “best tier” color claim in Pricing. Preserve existing responsive horizontal scrolling, filters, remote image URL, values, and callbacks. Apply the same canvas/typography/action tokens to 404.

- [ ] **Step 4: Tokenize the public auth overlay without changing auth**

In `App.jsx`, preserve every view, field name, validation function, OAuth action, submit handler, and navigation branch. Replace overlay/card/form/button/error styles with the shared semantic modal, field, Button, and feedback classes where they fit. Keep password visibility and Google buttons accessible. Do not change authentication state or API calls.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/public-design-system-ui.test.js tests/design-system-contract.test.js`

Expected: PASS.

```bash
git add src/pages/PublicPages.jsx src/App.jsx tests/public-design-system-ui.test.js
git commit -m "feat: finish signature public experience"
```

---

### Task 7: Client shell and tier presentation

**Files:**
- Modify: `src/pages/ClientPages.jsx`
- Modify: `tests/client-verification-ui.test.js`

**Interfaces:**
- Consumes: `BrandMark`, `StatusBadge`, `SurfaceCard`, `Button`, semantic tokens.
- Preserves: `CLIENT_TIER_PERMISSIONS`, available-tab permission checks, onboarding guide, notification indicators, matchmaker access, and all view callbacks.
- Produces: Consistent Basic, Verified, and VIP presentation.

- [ ] **Step 1: Add failing client shell/tier assertions**

```js
assert.match(clientPage, /<BrandMark/);
assert.match(clientPage, /<StatusBadge/);
assert.match(clientPage, /toneForTier/);
assert.match(clientPage, /vip:[\s\S]*label: 'VIP'/);
assert.match(clientPage, /bg-canvas/);
assert.match(clientPage, /text-premium-detail/);
```

- [ ] **Step 2: Run the client UI test and verify it fails**

Run: `node --test tests/client-verification-ui.test.js`

Expected: FAIL because the client shell does not use the shared brand/tier primitives.

- [ ] **Step 3: Restyle the client shell and tier surfaces**

Use `BrandMark` in the header, semantic canvas/surfaces/borders in the workspace and sub-navigation, visible focus/active states, consistent gutters, and a `StatusBadge` beside the account identity. Basic remains neutral, Verified uses Emerald/Midnight, and existing VIP uses Midnight with a scarce Champagne detail. Preserve tab filtering and permissions exactly. Restyle the professional-preview, interview, and cancellation modal content through shared primitives without changing behavior.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test tests/client-verification-ui.test.js tests/client-verification.test.js tests/api-scrubbing.test.js`

Expected: PASS.

```bash
git add src/pages/ClientPages.jsx tests/client-verification-ui.test.js
git commit -m "feat: polish client tiers and dashboard shell"
```

---

### Task 8: Professional dashboard, tier preview, and Profile Settings

**Files:**
- Modify: `src/pages/ProfessionalPages.jsx`
- Modify: `tests/professional-onboarding-ui.test.js`

**Interfaces:**
- Consumes: `BrandMark`, `Button`, `FormField`, `Modal`, `SegmentedControl`, `StatusBadge`, `SurfaceCard`, `Toggle`, `toneForTier`.
- Preserves: `getProfessionalPortalPermissions`, profile visibility, profile-save payload, preview API, Basic/Verified audience previews, and all profile fields.
- Produces: Polished professional shell, dashboard header, tier preview, profile cards, and Profile Settings modal.

- [ ] **Step 1: Add failing professional dashboard/profile assertions**

```js
assert.match(professionalPage, /<BrandMark/);
assert.match(professionalPage, /<SegmentedControl/);
assert.match(professionalPage, /Basic Client/);
assert.match(professionalPage, /Verified Client/);
assert.match(professionalPage, /<Modal[\s\S]*Profile Settings/);
assert.match(professionalPage, /proper attire/i);
assert.match(professionalPage, /bg-canvas/);
```

- [ ] **Step 2: Run the professional UI test and verify it fails**

Run: `node --test tests/professional-onboarding-ui.test.js`

Expected: FAIL because the professional page still owns bespoke tier buttons/profile modal styling.

- [ ] **Step 3: Recompose the professional shell and dashboard**

Use `BrandMark`, semantic canvas/surfaces/gutters, `StatusBadge` for backend-provided Unverified/Basic/Verified state, and shared buttons. Preserve dashboard locking and visibility permissions. Replace the profile-visibility button with `Toggle`; changing it calls the existing `toggleProfileVisibility` and respects `isVisibilitySaving`. Replace the two “View Profile As” buttons with `SegmentedControl`; selecting Basic or Verified calls the existing `openProfilePreview(tier)` and never changes account state.

- [ ] **Step 4: Redesign Profile Settings through shared fields/modal**

Keep the current form state and `buildProfileSavePayload`. Use a two-column photo/form layout at desktop and one column on mobile. Preserve every field and the proper-attire/pose guidance. Use `FormField`/shared control classes, grouped headings, `aria-live` save feedback, and a sticky Cancel/Save footer. Do not turn the editor into an accordion.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/professional-onboarding-ui.test.js tests/professional-onboarding.test.js`

Expected: PASS.

```bash
git add src/pages/ProfessionalPages.jsx tests/professional-onboarding-ui.test.js
git commit -m "feat: polish professional profile experience"
```

---

### Task 9: Professional identity, credentials, and change requests

**Files:**
- Modify: `src/pages/ProfessionalPages.jsx`
- Modify: `tests/professional-onboarding-ui.test.js`
- Modify: `tests/file-dropzone-ui.test.js`

**Interfaces:**
- Consumes: `FileDropzone`, `FormField`, `Modal`, `StatusBadge`, `SurfaceCard`.
- Preserves: `validateCredentialFile`, 3 MB limit, separate document keys, expiry/no-expiry handling, approved locking, preview warmup, remove rules, change-request payloads, verification blockers, and backend methods.
- Produces: Unified identity and credential upload visuals plus shared change/removal modal treatment.

- [ ] **Step 1: Add failing professional document assertions**

```js
for (const label of ['Valid ID front', 'Valid ID back', 'Liveness selfie', 'PRC', 'BOA', 'Tax']) {
  assert.match(professionalPage, new RegExp(label, 'i'));
}
assert.match(professionalPage, /<FileDropzone/);
assert.match(professionalPage, /Request Identity Document Change\/Removal/);
assert.match(professionalPage, /Request Document Change\/Removal/);
assert.match(professionalPage, /expiryDate/);
assert.match(professionalPage, /No expiration date/);
```

- [ ] **Step 2: Run professional/drop-zone tests and verify they fail**

Run: `node --test tests/professional-onboarding-ui.test.js tests/file-dropzone-ui.test.js`

Expected: FAIL because professional upload rows do not use `FileDropzone`.

- [ ] **Step 3: Integrate FileDropzone without collapsing document rules**

Refactor `CredentialUploadRow` and the identity evidence cards to use `FileDropzone`. Pass the existing `accept`, busy, locked, rejected, filename, size, preview, and request-change state. Keep expiry/no-expiry controls adjacent to their specific uploaded file. Keep PRC, BOA, tax, mapped certifications, resume, and Other Documents as separate rows. Preserve optional/required labels and verification blockers.

- [ ] **Step 4: Unify identity and credential change-request modals**

Use shared `Modal`, `FormField`, semantic warning feedback, and sticky actions for both request flows. Preserve the existing dropdown values, custom-reason behavior, pending-request prevention, handler payloads, and admin-review copy. Midnight communicates document protection, Amber communicates consequential review, Cobalt submits, and Crimson appears only for errors.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/professional-onboarding-ui.test.js tests/professional-onboarding.test.js tests/file-dropzone-ui.test.js tests/professional-notifications.test.js`

Expected: PASS.

```bash
git add src/pages/ProfessionalPages.jsx tests/professional-onboarding-ui.test.js tests/file-dropzone-ui.test.js
git commit -m "feat: polish professional verification documents"
```

---

### Task 10: Cross-surface cleanup and automated verification

**Files:**
- Modify: `src/components/DocumentPreviewModal.jsx`
- Modify: `tests/design-system-contract.test.js`
- Modify: `tests/public-design-system-ui.test.js`
- Modify: `tests/client-verification-ui.test.js`
- Modify: `tests/professional-onboarding-ui.test.js`

**Interfaces:**
- Consumes: All previous tasks.
- Produces: No new product interface; this task closes migration gaps and verifies the complete story.

- [ ] **Step 1: Add final migration and protected-behavior assertions**

```js
test('target React files do not contain raw signature hex values', () => {
  for (const source of [publicPage, clientPage, clientDashboard, professionalPage]) {
    assert.doesNotMatch(source, /#(?:0B1F3A|2563EB|047857|0E7490|A67C38|F7F9FC|0A1628|B45309|B42318)/i);
  }
});
```

Keep the existing assertions for all four client verification requirements, the three business-document choices, exact legal-name copy, professional distinct documents, expiration, change requests, and tier permission guards.

- [ ] **Step 2: Run the complete automated suite and fix only migration regressions**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

Run: `npm run build`

Expected: Vite production build completes successfully.

Restyle `DocumentPreviewModal.jsx` with semantic surface, border, loading, and danger tokens while preserving its read-only protections, PDF/image fallback, overlay interaction prevention, and preview cache behavior. Fix any remaining unused imports or invalid Tailwind class composition surfaced by lint/build.

- [ ] **Step 3: Start the development server for browser verification**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL and the app loads without a console error.

- [ ] **Step 4: Verify public routes in the browser**

At 320x800, 768x1024, and 1440x1000, verify `/`, `/talents`, `/agency`, and `/pricing` in light and dark mode. Check navigation/mobile menu, footer, CTA destinations, ROI, FAQ, directory filters, enterprise image contrast, pricing cards, auth entry, keyboard focus, 200% zoom, and reduced motion. Expected: no horizontal overflow except intentional filter/card scrollers, no clipped controls, no rainbow sections, and correct semantic color meanings.

- [ ] **Step 5: Verify client and professional flows in the browser**

Verify Basic, Verified, and VIP client tier presentation; Client Verification empty/uploading/rejected/pending/approved states; protected `verifiedBusinessName`; professional locked dashboard and approved dashboard; Basic/Verified profile previews; Profile Settings; identity/credential uploads; expiration controls; and both change-request modals. Expected: behavior matches existing permissions/APIs, drop and click uploads share validation, modal focus is trapped/restored, Escape/backdrop work, and reduced motion removes transforms.

- [ ] **Step 6: Run final checks and commit**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

Run: `npm run build`

Expected: Vite production build completes successfully.

```bash
git add src/components/DocumentPreviewModal.jsx tests
git commit -m "test: verify signature UI across core surfaces"
```
