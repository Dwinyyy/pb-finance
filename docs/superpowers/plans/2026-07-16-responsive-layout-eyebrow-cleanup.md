# Responsive Layout Integrity and Plain Eyebrow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task by task, and use `superpowers:test-driven-development` for every production-code change.

**Goal:** Remove the confirmed client/professional layout intersections and small-screen clipping while converting all 14 decorative section labels to unboxed, icon-free text without changing semantic status badges.

**Architecture:** Introduce a deliberately style-free `Eyebrow` primitive, migrate only the audited decorative labels, and retain local typography/color classes at each call site. Restore normal document flow by making `FileDropzone` intrinsically sized and aligning mixed-content upload grid items to the start. Add narrowly scoped viewport constraints to the Matchmaker panel, Admin header, and public mobile navigation.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4, Lucide React, Node `node:test`, Vite SSR, agent-browser.

## Global constraints

- Preserve all existing copy, routes, callbacks, API payloads, permissions, upload validation, document locking, status values, and `verifiedBusinessName` behavior.
- Do not change the shared `StatusBadge` component or the presentation of genuine statuses such as Ready, Required, Verified, Basic, pending review, approval, and rejection.
- Do not add an icon API, border, background, radius, padding, shadow, or default typography to `Eyebrow`.
- Do not add Playwright/Cypress/jsdom merely for this patch. Source-contract tests establish the class/markup contract; agent-browser verifies actual geometry.
- Run each test in its RED state before writing the corresponding implementation, then rerun it GREEN.

---

### Task 1: Add a plain-text Eyebrow primitive and migrate the 14 decorative labels

**Files:**

- Create: `src/components/ui/Eyebrow.jsx`
- Create: `tests/eyebrow-ui.test.js`
- Modify: `src/pages/PublicPages.jsx`
- Modify: `src/components/ClientWorkflowOnboardingModal.jsx`
- Modify: `src/components/ClientVerificationDashboard.jsx`
- Modify: `src/pages/ProfessionalPages.jsx`
- Modify: `src/components/ClientVerificationReview.jsx`

**Step 1: Write the failing eyebrow contract test**

Create `tests/eyebrow-ui.test.js` with source-level checks that are strict enough to distinguish decorative text from a pill but do not affect real status badges:

```js
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
```

**Step 2: Run the new test and confirm RED**

Run:

```powershell
node --test tests/eyebrow-ui.test.js
```

Expected: FAIL because `Eyebrow.jsx` does not exist yet. If the import read throws, that is the intended first RED state.

**Step 3: Implement the style-free primitive**

Create `src/components/ui/Eyebrow.jsx` exactly as:

```jsx
export function Eyebrow({ as = 'p', children, className = '' }) {
  const Component = as;
  return <Component className={className}>{children}</Component>;
}
```

**Step 4: Migrate the public decorative labels**

In `src/pages/PublicPages.jsx`:

- Import `Eyebrow` from `../components/ui/Eyebrow`.
- Remove `Sparkles` and `Star` from the Lucide import only after confirming neither is used elsewhere.
- Replace only the nine audited decorative wrappers with the following exact `Eyebrow` class contracts:

```jsx
<Eyebrow className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted">Savings Calculator</Eyebrow>
<Eyebrow className="mb-5 text-xs font-semibold text-premium-detail sm:text-sm">Redefining Global Finance Outsourcing</Eyebrow>
<Eyebrow className="mb-4 text-xs font-bold uppercase tracking-wider text-action">Process</Eyebrow>
<Eyebrow className="mb-4 text-xs font-bold uppercase tracking-wider text-action md:hidden">FAQ</Eyebrow>
<Eyebrow className="mb-5 text-xs font-bold uppercase tracking-wider text-info">Talent Directory Preview</Eyebrow>
<Eyebrow className="mb-8 text-xs font-bold uppercase tracking-wider text-premium-detail">Enterprise Finance Delivery</Eyebrow>
<Eyebrow className="mb-4 text-xs font-bold uppercase tracking-wider text-processing">Pod Design Preview</Eyebrow>
<Eyebrow className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted">Engagement Models</Eyebrow>
<Eyebrow className="mb-4 text-xs font-bold uppercase tracking-wider text-info">Pricing</Eyebrow>
```

Keep each label in the same section container and preserve the surrounding section alignment classes.

**Step 5: Migrate client, professional, and admin decorative labels**

In `src/components/ClientWorkflowOnboardingModal.jsx`:

- Import `Eyebrow`.
- Remove the decorative `Sparkles` import and the now-unused `StatusBadge` import.
- Replace the icon-plus-badge wrapper with:

```jsx
<Eyebrow className="text-xs font-bold text-info">
  {`Client guide${user?.name ? ` for ${user.name}` : ''}`}
</Eyebrow>
```

In `src/components/ClientVerificationDashboard.jsx`:

- Import `Eyebrow` and retain `StatusBadge` for the real verification state.
- Replace the decorative `Client trust center` badge with:

```jsx
<Eyebrow className="mb-3 text-xs font-bold text-info">Client trust center</Eyebrow>
```

- Remove `mt-4` from the immediately following `h1` because the new eyebrow owns the label-to-heading spacing.

In `src/pages/ProfessionalPages.jsx`:

- Import `Eyebrow`.
- Replace both audited flex/icon wrappers with:

```jsx
<Eyebrow className="mb-2 text-[10px] font-black uppercase tracking-wider text-processing">Professional onboarding</Eyebrow>
<Eyebrow className="mb-2 text-[10px] font-black uppercase tracking-wider text-processing">Verification</Eyebrow>
```

- Remove `IdCard` from the Lucide import if it has no remaining usage. Keep `ShieldCheck`, which is used by real verification content elsewhere.

In `src/components/ClientVerificationReview.jsx`:

- Import `Eyebrow`.
- Replace the decorative admin-only pill/icon wrapper with:

```jsx
<Eyebrow className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">PB Finance admins only</Eyebrow>
```

- Remove `ShieldCheck` from the Lucide import if no other usage remains.

**Step 6: Run focused tests and confirm GREEN**

Run:

```powershell
node --test tests/eyebrow-ui.test.js tests/public-design-system-ui.test.js tests/client-verification-ui.test.js tests/professional-onboarding-ui.test.js
```

Expected: all tests pass; genuine client verification status still renders via `StatusBadge`.

**Step 7: Commit Task 1**

```powershell
git add src/components/ui/Eyebrow.jsx src/pages/PublicPages.jsx src/components/ClientWorkflowOnboardingModal.jsx src/components/ClientVerificationDashboard.jsx src/pages/ProfessionalPages.jsx src/components/ClientVerificationReview.jsx tests/eyebrow-ui.test.js
git commit -m "refactor: simplify decorative eyebrow labels"
```

---

### Task 2: Restore intrinsic upload-card geometry in client and professional workflows

**Files:**

- Modify: `tests/file-dropzone-ui.test.js`
- Create: `tests/responsive-layout-ui.test.js`
- Modify: `src/components/ui/FileDropzone.jsx`
- Modify: `src/components/ClientVerificationDashboard.jsx`
- Modify: `src/pages/ProfessionalPages.jsx`

**Step 1: Add the failing shared dropzone contract**

Append to `tests/file-dropzone-ui.test.js`:

```js
test('shared drop zone keeps intrinsic height in mixed-height workflow grids', () => {
  const rootSurface = source.match(/<SurfaceCard\b[\s\S]*?>/)?.[0] || '';
  assert.ok(rootSurface, 'missing FileDropzone root SurfaceCard');
  assert.doesNotMatch(
    rootSurface,
    /\bh-full\b/,
    'shared drop zones must not consume the full height of wrappers that contain sibling controls',
  );
});
```

If `tests/file-dropzone-ui.test.js` does not already declare `source`, reuse its existing FileDropzone source constant rather than creating a second read.

**Step 2: Add failing mixed-content grid contracts**

Create `tests/responsive-layout-ui.test.js` initially with:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const clientVerification = read('../src/components/ClientVerificationDashboard.jsx');
const professionalPage = read('../src/pages/ProfessionalPages.jsx');

test('mixed-content client and professional upload grids align items to intrinsic height', () => {
  assert.match(clientVerification, /className="grid items-start gap-5 lg:grid-cols-2"/);
  assert.match(professionalPage, /className="grid min-w-0 items-start gap-4 md:grid-cols-3"/);
});
```

**Step 3: Run both focused tests and confirm RED**

Run:

```powershell
node --test tests/file-dropzone-ui.test.js tests/responsive-layout-ui.test.js
```

Expected: FAIL because `FileDropzone` still includes `h-full`, and both upload grids lack `items-start`.

**Step 4: Remove unconditional full-height sizing from FileDropzone**

In `src/components/ui/FileDropzone.jsx`, change the root from:

```jsx
<SurfaceCard as="article" tone={tone === 'trust' ? 'trust' : 'default'} className="h-full p-5">
```

to:

```jsx
<SurfaceCard as="article" tone={tone === 'trust' ? 'trust' : 'default'} className="p-5">
```

Do not add a stretch prop: no current consumer requires it.

**Step 5: Start-align the affected mixed-content grids**

In `src/components/ClientVerificationDashboard.jsx`, change:

```jsx
<div className="grid gap-5 lg:grid-cols-2">
```

to:

```jsx
<div className="grid items-start gap-5 lg:grid-cols-2">
```

In `src/pages/ProfessionalPages.jsx`, change the identity-document grid from:

```jsx
<div className="grid min-w-0 gap-4 md:grid-cols-3">
```

to:

```jsx
<div className="grid min-w-0 items-start gap-4 md:grid-cols-3">
```

Leave the optional credential cards intrinsically sized; the shared `FileDropzone` correction removes their structural risk. Do not add fixed heights or clipping overflow.

**Step 6: Run focused and workflow tests and confirm GREEN**

Run:

```powershell
node --test tests/file-dropzone-ui.test.js tests/responsive-layout-ui.test.js tests/client-verification-ui.test.js tests/professional-onboarding-ui.test.js
```

Expected: all tests pass.

**Step 7: Commit Task 2**

```powershell
git add src/components/ui/FileDropzone.jsx src/components/ClientVerificationDashboard.jsx src/pages/ProfessionalPages.jsx tests/file-dropzone-ui.test.js tests/responsive-layout-ui.test.js
git commit -m "fix: prevent verification upload card overlaps"
```

---

### Task 3: Make the remaining audited small-screen surfaces viewport-safe

**Files:**

- Modify: `tests/responsive-layout-ui.test.js`
- Modify: `src/pages/ClientPages.jsx`
- Modify: `src/pages/AdminPages.jsx`
- Modify: `src/pages/PublicPages.jsx`

**Step 1: Extend the responsive contract test and confirm RED**

Add these source reads and tests to `tests/responsive-layout-ui.test.js`:

```js
const clientPage = read('../src/pages/ClientPages.jsx');
const adminPage = read('../src/pages/AdminPages.jsx');
const publicPage = read('../src/pages/PublicPages.jsx');

test('client Matchmaker uses viewport-safe mobile insets and a capped dynamic height', () => {
  assert.match(clientPage, /fixed inset-x-4 bottom-4/);
  assert.match(clientPage, /h-\[min\(600px,calc\(100dvh-2rem\)\)\]/);
  assert.match(clientPage, /sm:left-auto sm:right-8 sm:bottom-8 sm:w-\[400px\]/);
  assert.doesNotMatch(clientPage, /fixed bottom-8 right-8 w-\[400px\] h-\[600px\]/);
});

test('admin identity header can wrap and truncate without pushing controls off-screen', () => {
  assert.match(adminPage, /flex min-h-16[^\"]*flex-wrap[^\"]*gap-2[^\"]*py-2/);
  assert.match(adminPage, /className="flex min-w-0 flex-1 items-center gap-4"/);
  assert.match(adminPage, /className="min-w-0"/);
  assert.match(adminPage, /className="truncate text-xs/);
  assert.match(adminPage, /className="flex shrink-0 items-center gap-4"/);
});

test('public mobile navigation remains reachable on short viewports', () => {
  const menuStart = publicPage.indexOf('id="public-mobile-navigation"');
  const menuTagStart = publicPage.lastIndexOf('<div', menuStart);
  const menuTagEnd = publicPage.indexOf('>', menuStart);
  const menuTag = publicPage.slice(menuTagStart, menuTagEnd + 1);
  assert.match(menuTag, /max-h-\[calc\(100dvh-4rem\)\]/);
  assert.match(menuTag, /overflow-y-auto/);
  assert.match(menuTag, /overscroll-contain/);
});
```

Run:

```powershell
node --test tests/responsive-layout-ui.test.js
```

Expected: FAIL on the Matchmaker fixed width, Admin header fixed row, and mobile menu without a height cap.

**Step 2: Make the Matchmaker panel responsive**

In `src/pages/ClientPages.jsx`, replace only the Matchmaker panel's geometry classes with:

```jsx
className={`fixed inset-x-4 bottom-4 flex h-[min(600px,calc(100dvh-2rem))] w-auto max-h-[80dvh] flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 origin-bottom-right z-50 dark:border-slate-800 dark:bg-slate-900 sm:left-auto sm:right-8 sm:bottom-8 sm:w-[400px] ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
```

Retain `inert={!isOpen}`, `aria-hidden={!isOpen}`, all callbacks, transition state, content, and drag behavior. Do not alter the separate floating trigger button in this task.

**Step 3: Make the Admin header identity row shrink and wrap**

In `src/pages/AdminPages.jsx`:

- Change the header container to:

```jsx
<div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
```

- Change the identity group to:

```jsx
<div className="flex min-w-0 flex-1 items-center gap-4">
```

- Add `className="min-w-0"` to the identity text wrapper.
- Add `truncate` to the email paragraph while retaining its existing `text-xs`, font, and color classes.
- Change the account-control group to:

```jsx
<div className="flex shrink-0 items-center gap-4">
```

Preserve the current branding, email text, theme toggle, notification UI, and logout callback.

**Step 4: Cap and scroll the public mobile navigation**

In `src/pages/PublicPages.jsx`, add these classes to the open menu container with `id="public-mobile-navigation"`:

```text
max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain
```

Keep its absolute positioning, z-index, full width, shadow, `lg:hidden` visibility, route buttons, login action, and the existing body-scroll lock.

**Step 5: Run focused tests and confirm GREEN**

Run:

```powershell
node --test tests/responsive-layout-ui.test.js tests/client-verification-ui.test.js tests/public-design-system-ui.test.js
```

Expected: all tests pass.

**Step 6: Commit Task 3**

```powershell
git add src/pages/ClientPages.jsx src/pages/AdminPages.jsx src/pages/PublicPages.jsx tests/responsive-layout-ui.test.js
git commit -m "fix: keep dashboard surfaces inside small viewports"
```

---

### Task 4: Review, regression-test, build, and verify rendered geometry

**Files:**

- Review only: every file changed in Tasks 1-3
- Modify only if a verification failure exposes a concrete defect covered by the approved design

**Step 1: Run React-specific review checks**

Use the `vercel:react-best-practices` skill against the changed JSX files. Confirm:

- no component has unnecessary state/effects;
- the new primitive is a pure component;
- imports are used and minimal;
- interactive semantics and focus behavior remain intact;
- responsive classes do not create duplicate or contradictory geometry rules.

Fix only verified issues, then rerun the affected focused tests.

**Step 2: Run the complete automated verification suite**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: all tests pass, ESLint exits 0, and Vite production build exits 0. Record the exact command outputs for the final report.

**Step 3: Start the app for browser verification**

Run the repository's normal development command from `package.json` without changing its configuration. Wait for the printed local URL, then use `vercel:agent-browser-verify` for the first smoke check.

**Step 4: Verify actual layout geometry at the required viewport matrix**

Use agent-browser at:

- 1841 x 694
- 1440 x 900
- 1280 x 720
- 1024 x 768
- 768 x 1024
- 767 x 900
- 390 x 844
- 320 x 568
- 390 x 360

Check the accessible routes/states available in the local environment:

- Public Home, Talent Directory, Enterprise, and Pricing pages.
- Public mobile menu in its open state, including the final Login action.
- Client Verification business selector/dropzone and the Legal name handling/submit card.
- Client Matchmaker in its open state.
- Professional identity and optional credential document rows.
- Admin header with the longest available email and Client Verification review heading.

For each rendered surface, evaluate bounding rectangles and assert:

```js
const intersects = (a, b) => !(
  a.right <= b.left ||
  a.left >= b.right ||
  a.bottom <= b.top ||
  a.top >= b.bottom
);
```

Required outcomes:

- no audited sibling pair intersects;
- `document.documentElement.scrollWidth <= window.innerWidth` unless a deliberately scrollable local strip owns the overflow;
- Matchmaker and open mobile navigation remain inside the viewport;
- all 14 eyebrow texts are visible, icon-free, and adjacent to their headings;
- no Vite error overlay, uncaught page error, or console error appears.

If authenticated surfaces cannot be reached using existing local state, verify their compiled class contracts via the passing tests and explicitly report the browser coverage limitation; do not fabricate data or bypass authentication.

**Step 5: Request independent code review**

Use `superpowers:requesting-code-review` with the approved spec, this plan, the diff base, and the current branch head. Address all in-scope correctness findings and rerun the focused test plus the full verification command affected by each fix.

**Step 6: Perform final verification-before-completion**

Use `superpowers:verification-before-completion`, inspect `git diff --check`, `git status --short --branch`, and the final commit history. Do not claim completion from stale output.

**Step 7: Commit any review-only corrections**

If review or browser verification required a code correction:

```powershell
git add src/components/ui/Eyebrow.jsx src/components/ui/FileDropzone.jsx src/pages/PublicPages.jsx src/pages/ClientPages.jsx src/pages/AdminPages.jsx src/pages/ProfessionalPages.jsx src/components/ClientWorkflowOnboardingModal.jsx src/components/ClientVerificationDashboard.jsx src/components/ClientVerificationReview.jsx tests/eyebrow-ui.test.js tests/file-dropzone-ui.test.js tests/responsive-layout-ui.test.js
git commit -m "fix: address responsive UI review findings"
```

If no corrections were needed, do not create an empty commit.

**Step 8: Hand off the verified branch**

Report:

- the branch and worktree path;
- the exact changed surfaces;
- focused/full test, lint, and build results;
- browser viewports actually verified and any auth-limited surfaces;
- whether the branch is ready to merge.

Do not push, open a pull request, merge, or deploy unless the user separately authorizes that external action.
