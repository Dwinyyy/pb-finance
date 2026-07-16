# Dashboard Account Menu, Client Profile, and Portal Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one avatar-first account menu for both authenticated portals, an editable and verification-aware Client Profile, protected client full-name approval, and role/status-aware client and professional guides.

**Architecture:** Add focused shared disclosure, notification, guide, and session-summary units without replacing the existing portal shells. Add a client-profile domain module, service-only transactional Postgres functions, owner-safe API routes, and isolated client/admin React components; retain the existing verification and professional pending-profile workflows as the regulated sources of truth.

**Tech Stack:** React 19.2, React Router 7.13, Vite 8, Node.js test runner, Vercel Functions, Supabase Postgres/Auth/Storage/Realtime, Tailwind CSS 4, Framer Motion 12, and Lucide React.

## Global Constraints

- The resting client and professional header exposes only one 44 px avatar/account trigger at the top right.
- Desktop capsule and dropdown width is exactly 286 px with the same right edge; narrow width is capped at `calc(100vw - 36px)` with 18 px viewport insets.
- Hover preview is limited to hover-capable fine pointers, uses an 8 px bridge and 180 ms close grace, and never races touch pinning.
- Click/tap pins; Escape and outside interaction close; Escape restores trigger focus without reopening; reduced motion removes slide/scale movement.
- The trigger and every disclosure action retain a minimum 44 px target; hidden disclosure content is unmounted so it cannot receive focus.
- Use Lucide `UserRound`, `Bell`, destination-aware `Sun`/`Moon`, `BookOpen`, `Sparkles`, `LogOut`, and `ArrowLeft`; do not introduce emoji, text glyphs, or custom SVG paths.
- All new UI uses semantic tokens from `docs/design-system/pb-signature-colors.md`; no raw brand hex values or page-owned status colors.
- Client Account permits only display avatar, full name, and display company edits. Email, role, tier, verification state, reviewer data, legal business name, and audit fields remain protected.
- Full name is trimmed, 2-160 characters, and control-character-free. Display company is trimmed, 1-180 characters, and control-character-free.
- Protected name requests require a 1-1,000 character client explanation. Rejection requires a 1-1,000 character client-visible reason; approval notes are optional and at most 1,000 characters.
- Client full-name edits apply immediately only for `draft` or `rejected` verification. `pending_review` and `approved` create one pending request while the active name stays unchanged.
- Display avatar uploads accept signature-matched JPEG/PNG only and are no larger than 3 MB. They never mutate client verification evidence.
- `profiles.company` is canonical; the earliest-created `client_companies` record is the synchronized primary row. Later company rows are not renamed.
- New exposed tables enable RLS and use explicit grants. New privileged functions revoke execution from `PUBLIC`, `anon`, and `authenticated`, grant only `service_role`, use `search_path = ''`, schema-qualify objects, and run as a dedicated NOLOGIN owner.
- The `service_role` key remains server-only. Frontend code never receives it or calls privileged RPCs directly.
- Client verification remains the existing `ClientVerificationDashboard`, mounted under `?tab=profile&section=verification`; legacy `?tab=verification` is normalized with `replace: true`.
- Client guide storage version is `v2`; professional guide storage version is `v1`; both keys are per user and both guides remain manually reopenable.
- Keep the Admin header out of scope; preserve `NotificationBell` as its compatibility trigger.
- Do not add a DOM/browser test dependency. Use pure Node tests, source contracts, Vite SSR, and a mandatory real-browser verification pass.
- Generate the migration filename with `supabase migration new`; do not invent a timestamp. Mirror the committed migration in `supabase/schema.sql`.
- Follow the current Supabase split between explicit grants and RLS, verified against the official [Data API changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) and [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

---

## File Structure

### New production files

- `server/clientProfile.js`: client account/name validation, safe response mapping, request/decision validation, and client session-summary mapping.
- `server/profileImageUpload.js`: shared JPEG/PNG data-URL parsing, signature detection, filename validation, and 3 MB boundary.
- `src/components/dashboardAccountMenuState.js`: pure disclosure reducer and input-capability helpers.
- `src/components/DashboardAccountMenu.jsx`: avatar capsule, action view, notification subview, focus/pointer lifecycle, and responsive positioning.
- `src/components/NotificationPanel.jsx`: reusable notification/push/read/navigation presentation.
- `src/components/ClientProfileDashboard.jsx`: Client Account form, avatar upload, protected-name status, and embedded verification section.
- `src/components/ClientNameChangeReview.jsx`: admin name-request queue and decision workflow.
- `src/components/ClientVerificationWorkspace.jsx`: Verification Cases/Name Changes switcher and pending-name count.
- `src/components/PortalGuideModal.jsx`: shared accessible guide presentation.
- `src/components/ProfessionalWorkflowOnboardingModal.jsx`: professional status-aware guide configuration.
- `src/utils/clientProfileForm.js`: client-side draft, validation, and protected-reason visibility helpers.
- `src/utils/notificationNavigation.js`: safe internal/external notification target classification.
- `src/utils/portalGuideStorage.js`: role/version/user guide keys and first-run persistence.
- `src/utils/sessionSummary.js`: allowlisted session-summary merge and alias normalization.

### New tests

- `tests/dashboard-account-menu-state.test.js`
- `tests/dashboard-account-menu-ui.test.js`
- `tests/notification-panel-ui.test.js`
- `tests/client-profile.test.js`
- `tests/profile-image-upload.test.js`
- `tests/client-profile-api.test.js`
- `tests/client-profile-ui.test.js`
- `tests/client-name-change-schema.test.js`
- `tests/client-name-change-admin-ui.test.js`
- `tests/session-summary.test.js`
- `tests/portal-guides-ui.test.js`

### Existing files modified

- `api/index.js`
- `server/session.js`
- `package.json`
- `src/App.jsx`
- `src/components/ClientVerificationReview.jsx`: add a `showHeading` presentation prop so the workspace has one page heading.
- `src/components/ClientWorkflowOnboardingModal.jsx`
- `src/components/NotificationBell.jsx`
- `src/hooks/useNotifications.js`
- `src/pages/AdminPages.jsx`
- `src/pages/ClientPages.jsx`
- `src/pages/ProfessionalPages.jsx`
- `src/services/api.js`
- `supabase/schema.sql`
- The CLI-generated `supabase/migrations/*_client_account_profile_and_name_changes.sql`
- `tests/client-verification-api.test.js`
- `tests/client-verification-schema.test.js`
- `tests/client-verification-ui.test.js`
- `tests/design-system-contract.test.js`
- `tests/eyebrow-ui.test.js`
- `tests/modal-ui.test.js`
- `tests/professional-onboarding-ui.test.js`
- `tests/responsive-layout-ui.test.js`

## Task Dependency Order

1. Disclosure state model.
2. Reusable notification panel.
3. Shared account-menu component.
4. Client profile/name/image domain helpers.
5. Supabase schema and security.
6. Client/admin API surface.
7. Client Profile UI and routing.
8. Admin name-change review UI.
9. Session-summary propagation and professional approval safety.
10. Shared role-specific guides.
11. Client/professional portal integration.
12. Responsive, security, regression, and browser verification.

---

### Task 1: Account Disclosure State Model

**Files:**
- Create: `src/components/dashboardAccountMenuState.js`
- Create: `tests/dashboard-account-menu-state.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `ACCOUNT_MENU_CLOSE_DELAY_MS`, `createDashboardAccountMenuState()`, `dashboardAccountMenuReducer(state, action)`, `isDashboardAccountMenuOpen(state)`, and `shouldUseHoverPreview({ hoverCapable, pointerType })`.
- Consumes: plain objects only; no DOM globals.

- [ ] **Step 1: Add the focused script and failing reducer tests**

Add to `package.json`:

```json
"test:dashboard-account": "node --test tests/dashboard-account-menu-state.test.js tests/dashboard-account-menu-ui.test.js tests/notification-panel-ui.test.js tests/session-summary.test.js tests/portal-guides-ui.test.js"
```

Create `tests/dashboard-account-menu-state.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNT_MENU_CLOSE_DELAY_MS,
  createDashboardAccountMenuState,
  dashboardAccountMenuReducer,
  isDashboardAccountMenuOpen,
  shouldUseHoverPreview,
} from '../src/components/dashboardAccountMenuState.js';

test('hover preview opens, survives re-entry, and closes only after expiry', () => {
  let state = createDashboardAccountMenuState();
  state = dashboardAccountMenuReducer(state, { type: 'hover-enter' });
  assert.equal(isDashboardAccountMenuOpen(state), true);
  state = dashboardAccountMenuReducer(state, { type: 'hover-close-expired' });
  assert.equal(isDashboardAccountMenuOpen(state), false);
  assert.equal(ACCOUNT_MENU_CLOSE_DELAY_MS, 180);
});

test('pinning is independent from hover and notifications return to actions', () => {
  let state = dashboardAccountMenuReducer(createDashboardAccountMenuState(), { type: 'toggle-pin' });
  state = dashboardAccountMenuReducer(state, { type: 'hover-close-expired' });
  assert.equal(isDashboardAccountMenuOpen(state), true);
  state = dashboardAccountMenuReducer(state, { type: 'show-notifications' });
  assert.equal(state.view, 'notifications');
  state = dashboardAccountMenuReducer(state, { type: 'show-actions' });
  assert.equal(state.view, 'actions');
  state = dashboardAccountMenuReducer(state, { type: 'focus-enter' });
  state = dashboardAccountMenuReducer(state, { type: 'toggle-pin' });
  assert.deepEqual(state, createDashboardAccountMenuState());
});

test('Escape and outside dismissal clear every open source', () => {
  const open = { focusWithin: true, hoverPreview: true, pinned: true, view: 'notifications' };
  assert.deepEqual(
    dashboardAccountMenuReducer(open, { type: 'dismiss' }),
    createDashboardAccountMenuState()
  );
});

test('hover preview accepts only hover-capable mouse input', () => {
  assert.equal(shouldUseHoverPreview({ hoverCapable: true, pointerType: 'mouse' }), true);
  assert.equal(shouldUseHoverPreview({ hoverCapable: false, pointerType: 'mouse' }), false);
  assert.equal(shouldUseHoverPreview({ hoverCapable: true, pointerType: 'touch' }), false);
  assert.equal(shouldUseHoverPreview({ hoverCapable: true, pointerType: 'pen' }), false);
});
```

- [ ] **Step 2: Run the reducer test and confirm RED**

Run: `node --test tests/dashboard-account-menu-state.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `dashboardAccountMenuState.js`.

- [ ] **Step 3: Implement the pure reducer**

Create `src/components/dashboardAccountMenuState.js`:

```js
export const ACCOUNT_MENU_CLOSE_DELAY_MS = 180;

export const createDashboardAccountMenuState = () => ({
  focusWithin: false,
  hoverPreview: false,
  pinned: false,
  view: 'actions',
});

export const isDashboardAccountMenuOpen = (state) => Boolean(
  state?.focusWithin || state?.hoverPreview || state?.pinned
);

export const shouldUseHoverPreview = ({ hoverCapable, pointerType }) => (
  hoverCapable === true && pointerType === 'mouse'
);

export const dashboardAccountMenuReducer = (state, action) => {
  switch (action.type) {
    case 'hover-enter':
      return { ...state, hoverPreview: true };
    case 'hover-close-expired':
      return { ...state, hoverPreview: false };
    case 'toggle-pin':
      return state.pinned
        ? createDashboardAccountMenuState()
        : { ...state, pinned: true };
    case 'focus-enter':
      return { ...state, focusWithin: true };
    case 'focus-leave':
      return { ...state, focusWithin: false };
    case 'show-notifications':
      return { ...state, pinned: true, view: 'notifications' };
    case 'show-actions':
      return { ...state, view: 'actions' };
    case 'dismiss':
      return createDashboardAccountMenuState();
    default:
      return state;
  }
};
```

- [ ] **Step 4: Run the reducer test and confirm GREEN**

Run: `node --test tests/dashboard-account-menu-state.test.js`

Expected: 4 tests pass.

- [ ] **Step 5: Commit the state contract**

```powershell
git add package.json src/components/dashboardAccountMenuState.js tests/dashboard-account-menu-state.test.js
git commit -m "test: define dashboard account disclosure state"
```

### Task 2: Reusable Notification Panel

**Files:**
- Create: `src/components/NotificationPanel.jsx`
- Create: `src/utils/notificationNavigation.js`
- Create: `tests/notification-panel-ui.test.js`
- Modify: `src/components/NotificationBell.jsx`

**Interfaces:**
- Produces: `getNotificationNavigationTarget(actionUrl, origin)` returning `{ kind: 'internal' | 'external' | 'none', href }`.
- Produces: `NotificationPanel({ notificationState, onBack, onNotificationOpened, onRequestClose })`.
- Preserves: `NotificationBell({ notificationState, unreadClassName, userId })` for Admin.

- [ ] **Step 1: Write failing navigation and source-contract tests**

Create `tests/notification-panel-ui.test.js`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getNotificationNavigationTarget } from '../src/utils/notificationNavigation.js';

const panelSource = readFileSync(new URL('../src/components/NotificationPanel.jsx', import.meta.url), 'utf8');
const bellSource = readFileSync(new URL('../src/components/NotificationBell.jsx', import.meta.url), 'utf8');

test('notification targets allow same-origin and HTTP(S), and reject unsafe protocols', () => {
  assert.deepEqual(getNotificationNavigationTarget('/?tab=profile', 'https://pb.test'), {
    href: '/?tab=profile',
    kind: 'internal',
  });
  assert.deepEqual(getNotificationNavigationTarget('https://docs.example.com/help', 'https://pb.test'), {
    href: 'https://docs.example.com/help',
    kind: 'external',
  });
  assert.deepEqual(getNotificationNavigationTarget('javascript:alert(1)', 'https://pb.test'), {
    href: '',
    kind: 'none',
  });
});

test('shared panel owns refresh, retry, push, read, and viewport-safe presentation', () => {
  assert.match(panelSource, /loadNotifications\(\{ showLoading: true \}\)/);
  assert.match(panelSource, /getPushNotificationState/);
  assert.match(panelSource, /markAllRead/);
  assert.match(panelSource, /markRead\(notification\)/);
  assert.match(panelSource, /Retry/);
  assert.match(panelSource, /max-h-\[min\(32rem,calc\(100dvh-8rem\)\)\]/);
  assert.match(panelSource, /overflow-y-auto/);
  assert.match(panelSource, /aria-live="polite"/);
});

test('standalone NotificationBell delegates content to the shared panel', () => {
  assert.match(bellSource, /<NotificationPanel/);
  assert.match(bellSource, /aria-expanded=\{isOpen\}/);
  assert.match(bellSource, /aria-controls=/);
});
```

- [ ] **Step 2: Run the notification test and confirm RED**

Run: `node --test tests/notification-panel-ui.test.js`

Expected: FAIL because `NotificationPanel.jsx` and `notificationNavigation.js` do not exist.

- [ ] **Step 3: Implement safe notification target classification**

Create `src/utils/notificationNavigation.js`:

```js
export const getNotificationNavigationTarget = (actionUrl, origin) => {
  const rawUrl = String(actionUrl || '').trim();
  const safeOrigin = String(origin || '').trim();

  if (!rawUrl || !safeOrigin) return { href: '', kind: 'none' };

  try {
    const url = new URL(rawUrl, safeOrigin);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return { href: '', kind: 'none' };
    }

    if (url.origin === new URL(safeOrigin).origin) {
      return { href: `${url.pathname}${url.search}${url.hash}` || '/', kind: 'internal' };
    }

    return { href: url.href, kind: 'external' };
  } catch {
    return { href: '', kind: 'none' };
  }
};
```

- [ ] **Step 4: Extract notification content without changing behavior**

Create `NotificationPanel.jsx` by moving the current `formatTime`, push-state loading/toggling, heading, mark-all-read control, push preference block, loading/empty/error/list states, and notification navigation out of `NotificationBell.jsx`. Use this exact public shape and navigation sequence:

```jsx
export function NotificationPanel({
  notificationState,
  onBack = null,
  onNotificationOpened = null,
  onRequestClose,
}) {
  const navigate = useNavigate();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushState, setPushState] = useState(null);
  const {
    error,
    isLoading,
    loadNotifications,
    markAllRead,
    markRead,
    notifications,
    unreadCount,
  } = notificationState;

  useEffect(() => {
    loadNotifications({ showLoading: true });
    getPushNotificationState()
      .then(setPushState)
      .catch((error) => setPushMessage(error.message || 'Unable to check push notification settings.'));
  }, [loadNotifications]);

  const openNotification = async (notification) => {
    await markRead(notification);
    onNotificationOpened?.(notification);
    onRequestClose?.();
    const target = getNotificationNavigationTarget(notification.actionUrl, window.location.origin);
    if (target.kind === 'external') window.location.assign(target.href);
    if (target.kind === 'internal') navigate(target.href);
  };

  return (
    <section aria-labelledby="notification-panel-title" className="max-h-[min(32rem,calc(100dvh-8rem))] overflow-hidden bg-surface text-text-primary">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && <Button variant="ghost" onClick={onBack} aria-label="Back to account actions"><ArrowLeft size={17} aria-hidden="true" /></Button>}
          <div><h2 id="notification-panel-title" className="text-sm font-black">Notifications</h2><p className="text-xs text-text-muted">{unreadCount} unread</p></div>
        </div>
        <Button variant="ghost" disabled={!unreadCount} onClick={markAllRead} aria-label="Mark all notifications read"><CheckCheck size={17} aria-hidden="true" /></Button>
      </header>
      <div aria-live="polite" className="max-h-[min(27rem,calc(100dvh-13rem))] overflow-y-auto overscroll-contain">
        {isLoading && <div className="px-4 py-5 text-sm text-text-muted"><Loader2 className="inline animate-spin" size={16} aria-hidden="true" /> Loading notifications</div>}
        {!isLoading && error && <div role="alert" className="space-y-3 px-4 py-5 text-sm text-danger"><p>{error}</p><Button variant="secondary" onClick={() => loadNotifications({ showLoading: true })}>Retry</Button></div>}
        {!isLoading && !error && notifications.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-muted">No notifications yet.</p>}
        {!isLoading && !error && notifications.map((notification) => <button key={notification.id} type="button" onClick={() => openNotification(notification)} className="min-h-11 w-full border-b border-border-subtle px-4 py-3 text-left hover:bg-surface-muted"><span className="block text-sm font-black">{notification.title}</span><span className="block text-xs text-text-muted">{notification.body}</span><span className="sr-only">{notification.isRead ? 'Read' : 'Unread'}</span></button>)}
      </div>
    </section>
  );
}
```

Retain the existing push preference block between the header and scrolling list, but replace slate/cyan/red classes with `surface-muted`, `border-subtle`, `text-muted`, `action`, and `danger` semantic utilities. Its button continues to call `enablePushNotifications` or `disablePushNotifications`, retains the 44 px target, and preserves denied-permission messaging.

- [ ] **Step 5: Reduce `NotificationBell` to a compatible disclosure wrapper**

Keep its current internal/external `notificationState` selection and unread badge. Add `aria-label="Notifications"`, `aria-expanded`, `aria-controls="standalone-notification-panel"`, Escape, and outside-pointer dismissal. Give the unread badge screen-reader text such as `3 unread notifications` instead of relying on color/visible numerals alone. When open, render:

```jsx
<div id="standalone-notification-panel" className="absolute right-0 top-11 z-[80] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-border-subtle bg-surface shadow-modal">
  <NotificationPanel notificationState={notificationState || internalNotificationState} onRequestClose={() => setIsOpen(false)} />
</div>
```

- [ ] **Step 6: Run notification and existing push tests**

Run: `node --test tests/notification-panel-ui.test.js tests/professional-onboarding-ui.test.js tests/professional-notifications.test.js`

Expected: all tests pass; Admin compatibility source assertions remain green.

- [ ] **Step 7: Commit the notification extraction**

```powershell
git add src/components/NotificationBell.jsx src/components/NotificationPanel.jsx src/utils/notificationNavigation.js tests/notification-panel-ui.test.js
git commit -m "refactor: share notification panel content"
```

### Task 3: Shared Dashboard Account Menu

**Files:**
- Create: `src/components/DashboardAccountMenu.jsx`
- Create: `tests/dashboard-account-menu-ui.test.js`
- Modify: `tests/design-system-contract.test.js`
- Test: `tests/dashboard-account-menu-state.test.js`

**Interfaces:**
- Consumes: Task 1 reducer and Task 2 `NotificationPanel`.
- Produces: `DashboardAccountMenu` with the exact prop contract below.

```jsx
DashboardAccountMenu({
  accountTypeLabel,
  avatarUrl,
  companyOrContext,
  isDarkMode,
  matchmakerAction = null,
  name,
  notificationState,
  onGuide,
  onLogout,
  onNotificationOpened,
  onProfile,
  onThemeToggle,
  role,
})
```

`matchmakerAction` is either `null` or `{ label, onToggle, pressed }`.

- [ ] **Step 1: Write failing SSR/source contracts**

Create `tests/dashboard-account-menu-ui.test.js` using the existing Vite SSR pattern from `tests/ui-primitives.test.js`. Render the component inside `MemoryRouter` with a static notification state and assert:

```js
assert.match(html, /aria-label="Open account menu for Aldwin Gotingco"/);
assert.match(html, /aria-expanded="false"/);
assert.match(html, /aria-controls=/);
assert.match(source, /ACCOUNT_MENU_WIDTH_CLASS = 'w-\[min\(286px,calc\(100vw-36px\)\)\]'/);
assert.match(source, /pt-2/);
assert.match(source, /aria-pressed=\{matchmakerAction\.pressed\}/);
assert.match(source, /UserRound/);
assert.match(source, /Bell/);
assert.match(source, /BookOpen/);
assert.match(source, /Sparkles/);
assert.match(source, /LogOut/);
assert.match(source, /alt=\{`\$\{name\} profile`\}/);
assert.match(source, /aria-hidden="true"/);
assert.doesNotMatch(source, /role="menu"/);
assert.doesNotMatch(source, /#[0-9a-f]{3,8}/i);
```

Also assert the closed render contains the avatar/initials but not focusable action buttons, and the trigger retains `min-h-11 min-w-11`.

- [ ] **Step 2: Run the UI test and confirm RED**

Run: `node --test tests/dashboard-account-menu-ui.test.js`

Expected: FAIL because `DashboardAccountMenu.jsx` does not exist.

- [ ] **Step 3: Implement the disclosure lifecycle**

Create `DashboardAccountMenu.jsx` with:

```js
const ACCOUNT_MENU_WIDTH_CLASS = 'w-[min(286px,calc(100vw-36px))]';
const hoverQuery = '(hover: hover) and (pointer: fine)';
```

Use `useReducer(dashboardAccountMenuReducer, undefined, createDashboardAccountMenuState)`, a close-timer ref, wrapper/trigger refs, and `useReducedMotion()`. Pointer enter dispatches `hover-enter` only when `shouldUseHoverPreview({ hoverCapable: window.matchMedia(hoverQuery).matches, pointerType: event.pointerType })` is true. Pointer leave starts the 180 ms timer; re-entry clears it. Clear the timer on unmount.

Install document `pointerdown` and `keydown` listeners only while open. Outside pointer dispatches `dismiss`. Escape sets a `suppressFocusOpenRef`, dispatches `dismiss`, focuses the trigger, and clears suppression in `requestAnimationFrame`; `onFocusCapture` checks this ref before dispatching `focus-enter`. `onBlurCapture` dispatches `focus-leave` only when `relatedTarget` is outside the wrapper.

- [ ] **Step 4: Implement the capsule and both panel views**

Use the same `ACCOUNT_MENU_WIDTH_CLASS` on the open trigger and panel. The trigger remains right anchored and switches between `w-11` and the shared width. Its avatar is a non-shrinking 44 px circle; an image uses an alt value of `<account name> profile`, while an initials fallback is `aria-hidden="true"` because the trigger label already names the account. Name, company/context, and badge are `truncate` and rendered only while open. Give the unread badge explicit screen-reader text. Apply semantic Cobalt action/focus utilities and `motion-reduce:transition-none`.

Place the panel inside an absolute `right-0` wrapper with `top-full pt-2`; that padding is the 8 px pointer bridge. Use `max-sm:fixed max-sm:right-[18px]` plus a measured trigger-bottom CSS variable for the small-screen top. Recompute on open, resize, and scroll. Task 11 gives both portal header containers the same 18 px narrow inset so fixed panel and trigger right edges remain aligned.

The action view order is exactly:

```js
[
  ['profile', UserRound, 'Profile', onProfile],
  ['notifications', Bell, 'Notifications', () => dispatch({ type: 'show-notifications' })],
  ['theme', isDarkMode ? Sun : Moon, isDarkMode ? 'Switch to light mode' : 'Switch to dark mode', onThemeToggle],
  ['guide', BookOpen, role === 'client' ? 'Client guide' : 'Professional guide', onGuide],
]
```

Append Matchmaker only when `matchmakerAction` is non-null and apply `aria-pressed={matchmakerAction.pressed}`. Render Log out after a divider with danger semantics. The notification view renders:

```jsx
<NotificationPanel
  notificationState={notificationState}
  onBack={() => dispatch({ type: 'show-actions' })}
  onNotificationOpened={onNotificationOpened}
  onRequestClose={() => dispatch({ type: 'dismiss' })}
/>
```

Profile, Matchmaker, and Log out dismiss the disclosure before invoking their callbacks. Theme remains open so the destination icon/label updates in place. Guide opens its modal while the disclosure remains mounted behind the modal, allowing the shared modal to restore focus to the Guide button when it closes. Notifications switches views without closing. Every action uses a minimum 44 px target and visible focus ring; the action container is a labelled region, not an incomplete ARIA menu.

- [ ] **Step 5: Add the new files to design-system enforcement**

Extend `tests/design-system-contract.test.js` so `DashboardAccountMenu.jsx` and `NotificationPanel.jsx` are scanned by the existing raw-brand-color prohibition and semantic-token assertions.

- [ ] **Step 6: Run focused UI/state/design tests**

Run: `node --test tests/dashboard-account-menu-state.test.js tests/dashboard-account-menu-ui.test.js tests/notification-panel-ui.test.js tests/design-system-contract.test.js`

Expected: all tests pass.

- [ ] **Step 7: Commit the shared account component**

```powershell
git add src/components/DashboardAccountMenu.jsx tests/dashboard-account-menu-ui.test.js tests/design-system-contract.test.js
git commit -m "feat: add shared dashboard account menu"
```

### Task 4: Client Profile, Protected-Name, and Image Domain Helpers

**Files:**
- Create: `server/clientProfile.js`
- Create: `server/profileImageUpload.js`
- Create: `src/utils/clientProfileForm.js`
- Create: `tests/client-profile.test.js`
- Create: `tests/profile-image-upload.test.js`

**Interfaces:**
- Produces server functions `validateClientProfilePatch(input, context)`, `validateClientNameDecision(input)`, `mapClientAccount(input)`, `mapClientSessionSummary(account)`, `mapClientNameRequest(row)`, `mapAdminClientNameRequest(row, context)`, and `classifyClientProfileDatabaseError(error)`.
- Produces image function `parseProfileImageUpload(body)` and constant `MAX_PROFILE_IMAGE_BYTES`.
- Produces browser functions `createClientProfileDraft(account)`, `validateClientProfileDraft(draft, context)`, and `shouldRequestProtectedNameReason(draft, context)`.

- [ ] **Step 1: Write failing server-domain tests**

Create `tests/client-profile.test.js` with cases for:

```js
test('draft and rejected names update while protected names request approval', () => {
  const input = { company: 'PB Advisory', fullName: 'Aldwin Gotingco', requestReason: 'Correcting my account name.' };
  assert.equal(validateClientProfilePatch(input, { currentName: 'A. Gotingco', verificationStatus: 'draft' }).nameOutcome, 'updated');
  assert.equal(validateClientProfilePatch(input, { currentName: 'A. Gotingco', verificationStatus: 'rejected' }).nameOutcome, 'updated');
  assert.equal(validateClientProfilePatch(input, { currentName: 'A. Gotingco', verificationStatus: 'pending_review' }).nameOutcome, 'pending_approval');
  assert.equal(validateClientProfilePatch(input, { currentName: 'A. Gotingco', verificationStatus: 'approved' }).nameOutcome, 'pending_approval');
});

test('patch validation rejects unknown fields, bad boundaries, and control characters', () => {
  const result = validateClientProfilePatch({
    clientTier: 'vip',
    company: 'PB\u0000Advisory',
    fullName: 'A',
  }, { currentName: 'Aldwin Gotingco', verificationStatus: 'draft' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /clientTier/);
  assert.match(result.errors.join(' '), /2 to 160/);
  assert.match(result.errors.join(' '), /control/i);
});

test('protected changes require a reason and reject a second different pending request', () => {
  const missingReason = validateClientProfilePatch({ company: 'PB', fullName: 'Aldwin Gotingco' }, {
    currentName: 'A. Gotingco',
    verificationStatus: 'approved',
  });
  assert.match(missingReason.errors.join(' '), /explanation/i);

  const duplicate = validateClientProfilePatch({ company: 'PB', fullName: 'Another Name', requestReason: 'Correction' }, {
    currentName: 'A. Gotingco',
    pendingNameRequest: { requestedFullName: 'Aldwin Gotingco' },
    verificationStatus: 'approved',
  });
  assert.match(duplicate.errors.join(' '), /already pending/i);
});

test('client mapping never leaks reviewer, storage, audit, or legal-name fields from an unapproved case', () => {
  const mapped = mapClientAccount({
    profile: { id: 'client-1', email: 'client@example.com', full_name: 'Client Name', company: 'Display Co' },
    verification: { status: 'pending_review', verified_business_name: 'Hidden Legal Co', reviewed_by: 'admin-1' },
  });
  assert.equal(mapped.verification.verifiedBusinessName, null);
  assert.equal(mapped.verification.reviewedBy, undefined);
  assert.equal(mapped.storagePath, undefined);
});
```

- [ ] **Step 2: Write failing image-signature tests**

Create `tests/profile-image-upload.test.js` with PNG/JPEG fixtures and assert signature/MIME/extension agreement, malformed-base64 and empty rejection, and acceptance at exactly 3 MB followed by rejection at 3 MB plus one byte:

```js
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('profile image parser accepts a matching PNG', () => {
  const result = parseProfileImageUpload({
    contentType: 'image/png',
    fileData: `data:image/png;base64,${png.toString('base64')}`,
    fileName: 'avatar.png',
  });
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.fileSize, png.length);
});

test('profile image parser rejects mismatched signature and extension', () => {
  assert.throws(() => parseProfileImageUpload({
    contentType: 'image/jpeg',
    fileData: `data:image/jpeg;base64,${png.toString('base64')}`,
    fileName: 'avatar.jpg',
  }), /does not match/i);
});
```

- [ ] **Step 3: Run both tests and confirm RED**

Run: `node --test tests/client-profile.test.js tests/profile-image-upload.test.js`

Expected: FAIL because both server modules are absent.

- [ ] **Step 4: Implement strict client profile validation and safe mapping**

In `server/clientProfile.js`, use these constants and result shape:

```js
export const CLIENT_PROFILE_PATCH_FIELDS = Object.freeze(['company', 'fullName', 'requestReason']);
export const DIRECT_NAME_STATUSES = new Set(['draft', 'rejected']);
export const PROTECTED_NAME_STATUSES = new Set(['pending_review', 'approved']);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export const validateClientProfilePatch = (input = {}, context = {}) => {
  const errors = [];
  const unexpected = Object.keys(input).filter((key) => !CLIENT_PROFILE_PATCH_FIELDS.includes(key));
  const fullName = String(input.fullName || '').trim();
  const company = String(input.company || '').trim();
  const requestReason = String(input.requestReason || '').trim();
  const currentName = String(context.currentName || '').trim();
  const verificationStatus = String(context.verificationStatus || 'draft');
  const nameChanged = fullName !== currentName;

  if (unexpected.length) errors.push(`Unsupported client profile fields: ${unexpected.join(', ')}.`);
  if (fullName.length < 2 || fullName.length > 160) errors.push('Full name must contain 2 to 160 characters.');
  if (CONTROL_CHARACTERS.test(fullName)) errors.push('Full name cannot contain control characters.');
  if (company.length < 1 || company.length > 180) errors.push('Display company must contain 1 to 180 characters.');
  if (CONTROL_CHARACTERS.test(company)) errors.push('Display company cannot contain control characters.');

  let nameOutcome = 'unchanged';
  if (nameChanged && DIRECT_NAME_STATUSES.has(verificationStatus)) nameOutcome = 'updated';
  if (nameChanged && PROTECTED_NAME_STATUSES.has(verificationStatus)) nameOutcome = 'pending_approval';
  if (nameChanged && !DIRECT_NAME_STATUSES.has(verificationStatus) && !PROTECTED_NAME_STATUSES.has(verificationStatus)) errors.push('The current verification state cannot accept a name change.');
  if (nameOutcome === 'pending_approval' && (requestReason.length < 1 || requestReason.length > 1000)) errors.push('A 1 to 1,000 character explanation is required for this protected name change.');
  if (nameOutcome === 'pending_approval' && CONTROL_CHARACTERS.test(requestReason)) errors.push('The name-change explanation cannot contain control characters.');
  if (context.pendingNameRequest && nameChanged && context.pendingNameRequest.requestedFullName !== fullName) errors.push('A different full-name change is already pending.');

  return {
    errors,
    nameOutcome,
    valid: errors.length === 0,
    value: { company, fullName, requestReason: nameOutcome === 'pending_approval' ? requestReason : null },
  };
};
```

Implement `validateClientNameDecision` with only `approved`/`rejected`, rejection reason required, 1,000-character maximum, and control-character rejection. Mapping functions camel-case only the safe fields defined in the Task 6 response shapes. `mapClientAccount` exposes `verifiedBusinessName` only when verification status is `approved`. `mapClientSessionSummary` emits only `{ id, name, company, avatarUrl, clientTier, clientTierLabel, clientPermissions }` from the canonical active account. `classifyClientProfileDatabaseError` maps stable database messages `PB_CLIENT_NAME_CHANGE_PENDING` and `PB_CLIENT_NAME_CHANGE_STALE`, plus code `23505`, to `{ status: 409, message }`; all other errors retain their original status or use 500.

- [ ] **Step 5: Implement shared image parsing**

In `server/profileImageUpload.js`, export `MAX_PROFILE_IMAGE_BYTES = 3 * 1024 * 1024`. Parse only canonical base64 payloads in `data:image/jpeg;base64,...` and `data:image/png;base64,...`; reject invalid alphabet/padding before decoding; detect the full eight-byte PNG signature or JPEG `ff d8 ff`; require `.jpg`/`.jpeg` for JPEG and `.png` for PNG; sanitize the filename to 180 characters; and return `{ bytes, contentType, fileName, fileSize }`. Reject zero bytes and any decoded payload larger than the constant.

- [ ] **Step 6: Implement browser form helpers**

Create `src/utils/clientProfileForm.js` with the same field bounds and no server-only imports:

```js
export const createClientProfileDraft = (account = {}) => ({
  company: account.company || '',
  fullName: account.fullName || '',
  requestReason: '',
});

export const shouldRequestProtectedNameReason = (draft, context) => (
  ['pending_review', 'approved'].includes(context.verificationStatus || 'draft')
  && String(draft.fullName || '').trim() !== String(context.activeFullName || '').trim()
);
```

`validateClientProfileDraft` returns a field-keyed error object using the exact server bounds, requires the reason only when `shouldRequestProtectedNameReason` is true, and blocks a different name while `pendingNameRequest` exists.

- [ ] **Step 7: Run domain tests and confirm GREEN**

Run: `node --test tests/client-profile.test.js tests/profile-image-upload.test.js`

Expected: all validation, mapping, and image tests pass.

- [ ] **Step 8: Commit the domain helpers**

```powershell
git add server/clientProfile.js server/profileImageUpload.js src/utils/clientProfileForm.js tests/client-profile.test.js tests/profile-image-upload.test.js
git commit -m "feat: define client account profile rules"
```

### Task 5: Supabase Name-Change Schema and Security

**Files:**
- Create with Supabase CLI: `supabase/migrations/*_client_account_profile_and_name_changes.sql`
- Create: `tests/client-name-change-schema.test.js`
- Modify: `supabase/schema.sql`
- Test: `tests/client-verification-schema.test.js`

**Interfaces:**
- Produces tables `client_name_change_requests` and `client_name_change_events`.
- Produces RPCs `save_client_account_profile(...)` and `decide_client_name_change(...)`.
- Produces profile/company/name guards and verification-transition cancellation triggers.
- Consumes: statuses and bounds from Task 4.

- [ ] **Step 1: Write the failing schema contract**

Create `tests/client-name-change-schema.test.js`. Read `supabase/schema.sql`, locate the single migration whose name ends in `_client_account_profile_and_name_changes.sql`, and assert:

```js
for (const source of [schema, migration]) {
  assert.match(source, /create table(?: if not exists)? public\.client_name_change_requests/i);
  assert.match(source, /create table(?: if not exists)? public\.client_name_change_events/i);
  assert.match(source, /where \(status = 'pending'\)/i);
  assert.match(source, /alter table public\.client_name_change_requests enable row level security/i);
  assert.match(source, /create role pb_finance_profile_executor[\s\S]*nologin[\s\S]*noinherit/i);
  assert.doesNotMatch(source, /pb_finance_profile_executor[\s\S]{0,80}bypassrls/i);
  assert.match(source, /create or replace function public\.save_client_account_profile/i);
  assert.match(source, /create or replace function public\.decide_client_name_change/i);
  assert.match(source, /security definer[\s\S]*set search_path = ''/i);
  assert.match(source, /revoke execute on function public\.save_client_account_profile[\s\S]*from public, anon, authenticated/i);
  assert.match(source, /grant execute on function public\.save_client_account_profile[\s\S]*to service_role/i);
  assert.match(source, /PB_CLIENT_NAME_CHANGE_STALE/);
  assert.match(source, /PB_CLIENT_NAME_CHANGE_PENDING/);
}
```

Also assert explicit `service_role` SELECT grants, no direct service-role DML grant on either new table, executor-only RLS policies, protected-name/company guard triggers, and cancellation logic in both verification rejection and reset transactions.

- [ ] **Step 2: Run the schema test and confirm RED**

Run: `node --test tests/client-name-change-schema.test.js`

Expected: FAIL because the migration and schema objects are absent.

- [ ] **Step 3: Discover the CLI command and generate the migration path**

Run:

```powershell
npx -y supabase --help
npx -y supabase migration new --help
npx -y supabase migration new client_account_profile_and_name_changes
```

Expected: the final command creates exactly one timestamped file under `supabase/migrations` ending in `_client_account_profile_and_name_changes.sql`. Use that returned path for every migration edit in this task.

- [ ] **Step 4: Add tables, constraints, and indexes to the generated migration and canonical schema**

Use these table contracts in both files:

```sql
create table if not exists public.client_name_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  current_full_name text not null,
  requested_full_name text not null,
  request_reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_full_name = btrim(current_full_name) and char_length(current_full_name) between 2 and 160),
  check (requested_full_name = btrim(requested_full_name) and char_length(requested_full_name) between 2 and 160),
  check (current_full_name <> requested_full_name),
  check (request_reason = btrim(request_reason) and char_length(request_reason) between 1 and 1000),
  check (current_full_name !~ '[[:cntrl:]]' and requested_full_name !~ '[[:cntrl:]]' and request_reason !~ '[[:cntrl:]]'),
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and decision_reason is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  ),
  check (decision_reason is null or (decision_reason = btrim(decision_reason) and char_length(decision_reason) between 1 and 1000 and decision_reason !~ '[[:cntrl:]]')),
  check (status <> 'rejected' or decision_reason is not null)
);

create unique index if not exists client_name_change_requests_one_pending_per_client_idx
  on public.client_name_change_requests(client_id) where status = 'pending';
create index if not exists client_name_change_requests_client_history_idx
  on public.client_name_change_requests(client_id, created_at desc);
create index if not exists client_name_change_requests_admin_queue_idx
  on public.client_name_change_requests(status, created_at desc);

create table if not exists public.client_name_change_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.client_name_change_requests(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('request_created', 'request_approved', 'request_rejected', 'request_cancelled')),
  reason text,
  created_at timestamptz not null default now(),
  check (reason is null or (reason = btrim(reason) and char_length(reason) between 1 and 1000 and reason !~ '[[:cntrl:]]'))
);
```

Add the existing updated-at trigger to requests. Keep events immutable by granting no UPDATE or DELETE privilege.

- [ ] **Step 5: Add the dedicated executor, RLS, and explicit grants**

Create `pb_finance_profile_executor NOLOGIN NOINHERIT` idempotently and do not grant role membership to `anon`, `authenticated`, or `service_role`. Grant it only schema usage and the table privileges needed by the functions. Add RLS policies targeted only to this executor for the exact operations it performs on `profiles`, `client_companies`, `client_verifications`, requests, and events.

Enable RLS on both new tables. Revoke all table privileges from `PUBLIC`, `anon`, and `authenticated`. Grant `service_role` SELECT on requests for the server-owned read APIs; grant no service-role INSERT/UPDATE/DELETE on requests or events. The executor receives request/event DML through its dedicated policies and grants.

- [ ] **Step 6: Add the atomic profile-save and decision RPCs**

`save_client_account_profile(p_client_id, p_full_name, p_company, p_request_reason default null)` must lock in this global order: profile, verification, existing pending request. It revalidates role, trimmed bounds, control characters, company, and status. It updates company and returns `name_outcome`, nullable `request_id`, and `request_created` so the API can avoid duplicate admin notifications. It then:

- returns `name_outcome = 'unchanged'` when the normalized name matches;
- updates `profiles.full_name` and returns `updated` for missing/draft/rejected verification;
- inserts request plus `request_created` event and returns `pending_approval` for pending/approved verification;
- returns the existing request only when the requested name matches;
- raises `PB_CLIENT_NAME_CHANGE_PENDING` when a different pending request exists.

`decide_client_name_change(p_request_id, p_reviewer_id, p_decision, p_decision_reason default null)` first resolves the request's `client_id` without locking, then follows the same global lock order: profile, verification, request. After the request lock it rechecks the ID/client association, status, current name, and protected verification state. It verifies the reviewer row has role `admin`. Approval sets a transaction-local `pb_finance.client_name_change_approval = 'allowed'`, updates the active name, decides the request, and writes `request_approved`. Rejection preserves the active name, requires the reason, decides the request, and writes `request_rejected`. Any missing, changed, cancelled, or otherwise stale condition raises `PB_CLIENT_NAME_CHANGE_STALE` before mutation.

Both functions are `SECURITY DEFINER`, owned by the executor, fixed to `search_path = ''`, and fully schema-qualified. Revoke execution from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`.

- [ ] **Step 7: Add database guards and same-transaction cancellation**

Add:

- `validate_client_profile_identity_fields` before client `profiles.full_name` or `profiles.company` updates; reject untrimmed, empty, oversized, or control-character values so a direct Data API update cannot bypass the Account rules.
- `prevent_protected_client_full_name_change` before `profiles.full_name` updates; allow protected changes only when the transaction-local approval setting equals `allowed`.
- `sync_client_primary_company` after `profiles.company` updates; set a transaction-local company-sync setting, update only the earliest row ordered by `created_at, id`, or insert one with `profiles.email` as billing email.
- `prevent_direct_primary_client_company_name_change` before `client_companies.name` updates; allow the synchronized primary-row update only when the transaction-local company-sync setting is present.

Replace `reject_client_verification` and `reset_client_verification` in this new migration and `schema.sql`. Each must acquire profile, verification, then pending request in that exact order; cancel the request; record the reviewer and a fixed client-safe cancellation explanation; and insert `request_cancelled` using the same admin actor before returning. Do not copy private verification review notes into the name-request history. This is the same order used by both new RPCs, so concurrent transitions cannot deadlock or partially commit.

Make the company synchronization trigger function `SECURITY DEFINER`, owned by the dedicated executor, fixed to `search_path = ''`, and schema-qualified so it can use only its executor policies. Keep the protected-name and primary-company guard functions narrowly scoped and revoke direct execution of every trigger function from API roles. Revoke and regrant the replaced verification functions so only `service_role` can execute them.

- [ ] **Step 8: Run schema and existing verification tests**

Run: `node --test tests/client-name-change-schema.test.js tests/client-verification-schema.test.js tests/client-verification.test.js`

Expected: all schema and client-verification tests pass.

- [ ] **Step 9: Commit the migration and schema contract**

```powershell
git add supabase/schema.sql supabase/migrations tests/client-name-change-schema.test.js tests/client-verification-schema.test.js
git commit -m "feat: secure client name change approval"
```

### Task 6: Client Profile and Admin Name-Change APIs

**Files:**
- Create: `tests/client-profile-api.test.js`
- Modify: `api/index.js`
- Modify: `server/supabase.js`
- Modify: `src/services/api.js`
- Modify: `tests/client-verification-api.test.js`

**Interfaces:**
- Produces client routes `GET /client/me`, `PATCH /client/me`, and `POST /client/profile-photo`.
- Produces admin routes `GET /admin/client-name-changes` and `POST /admin/client-name-changes/decision`.
- Produces service methods `client.getMyProfile`, `client.updateMyProfile`, `client.uploadProfilePhoto`, `admin.listClientNameChanges`, and `admin.decideClientNameChange`.
- Consumes: Task 4 validators/mappers and Task 5 RPCs.

- [ ] **Step 1: Write failing API/source contracts**

Create `tests/client-profile-api.test.js` and assert all five routes, all five service methods, `/rpc/save_client_account_profile`, `/rpc/decide_client_name_change`, strict allowlisting, 409 classification, cleanup DELETE after upload/database failure, and notification types/URLs. Assert client routes derive the owner from the authenticated client session and reject an injected ID; assert non-admins cannot list/decide and the reviewer ID comes only from `requireAdmin`; assert an admin notification is sent only when the RPC returns `request_created: true`; and assert the existing client verification approval/rejection/reset URLs now use `/?tab=profile&section=verification`.

Use these response contracts:

```js
// GET /client/me
{
  account: { id, email, fullName, company, avatarUrl, role, clientTier, clientTierLabel },
  verification: { status, verifiedBusinessName, submittedAt, reviewedAt },
  pendingNameRequest,
  latestNameRequest,
}

// PATCH /client/me
{
  account,
  verification,
  pendingNameRequest,
  latestNameRequest,
  nameOutcome: 'unchanged' | 'updated' | 'pending_approval',
  sessionSummary,
}

// POST /client/profile-photo
{ avatarUrl, contentType, fileName, fileSize, sessionSummary }

// GET /admin/client-name-changes
{
  pendingCount,
  requests: [{
    id, clientId, currentFullName, requestedFullName, requestReason,
    status, decisionReason, createdAt, reviewedAt,
    client: { email, company },
    verificationStatus,
  }],
}
```

- [ ] **Step 2: Run the API test and confirm RED**

Run: `node --test tests/client-profile-api.test.js`

Expected: FAIL because the routes and service methods are absent.

- [ ] **Step 3: Preserve structured Supabase errors**

In `server/supabase.js`, retain the parsed PostgREST body on thrown errors and copy `status`, `code`, `details`, and `hint` onto the error object. Do not log or return keys/tokens. This lets `classifyClientProfileDatabaseError` reliably convert the two stable database conflicts and `23505` into HTTP 409.

- [ ] **Step 4: Add owner-safe loaders and client endpoints**

In `api/index.js`, import Task 4 functions. Rename `requireClientVerificationSession` to `requireClientServiceSession` and update existing verification routes to use it.

Add a loader that fetches, with service-role access and explicit `select` lists:

- the owner profile;
- the client verification summary;
- the pending name request;
- the latest non-pending request ordered by `created_at desc`.

`GET /client/me` maps only the approved response contract. `PATCH /client/me` calls `validateClientProfilePatch`; on success it calls only `/rpc/save_client_account_profile`, reloads the canonical account, and returns `nameOutcome` plus `sessionSummary`. It never directly patches profiles, companies, verification, requests, or events.

- [ ] **Step 5: Add the client avatar endpoint and harden the shared professional path**

Replace the local `parseImageUpload` implementation with `parseProfileImageUpload` from Task 4. Use a server-generated `randomUUID()` object name in the existing `profile-photos` bucket.

`POST /client/profile-photo` uploads first, patches only `profiles.avatar_url` through the server, reloads the canonical summary, and returns the photo response contract. If the database patch fails, keep the previous avatar and best-effort DELETE the new object. Apply the same parser and cleanup behavior to `POST /talent/profile-photo` without changing its route.

- [ ] **Step 6: Add admin list and decision endpoints**

`GET /admin/client-name-changes` uses `requireAdmin`, reads request/profile/verification context with service-role SELECT, and returns pending first then newest. `POST /admin/client-name-changes/decision` derives `p_reviewer_id` only from the authenticated admin, validates the decision, calls `/rpc/decide_client_name_change`, maps stale/pending database signals to 409, reloads the decided request, and returns it.

After database commit only:

- a newly created request (`request_created: true`) calls `notifyAdmins` with type `client_name_change_requested` and `/?tab=client-verifications&section=name-changes`;
- approval/rejection calls `notifyUser` with `client_name_change_approved` or `client_name_change_rejected` and `/?tab=profile&section=account`.

Notification delivery remains `.catch(() => {})` best effort and cannot roll back the database result.

- [ ] **Step 7: Add frontend service methods**

Add to `backendApi`:

```js
client: {
  getMyProfile: () => request('/client/me'),
  updateMyProfile: (payload) => request('/client/me', { method: 'PATCH', body: payload }),
  uploadProfilePhoto: (payload) => request('/client/profile-photo', { method: 'POST', body: payload }),
},
admin: {
  listClientNameChanges: () => request('/admin/client-name-changes'),
  decideClientNameChange: (payload) => request('/admin/client-name-changes/decision', { method: 'POST', body: payload }),
},
```

Merge these methods into the existing `client` and `admin` objects rather than declaring duplicate keys.

- [ ] **Step 8: Run API, upload, verification, and backend checks**

Run:

```powershell
node --test tests/client-profile-api.test.js tests/profile-image-upload.test.js tests/client-verification-api.test.js
npm run check:backend
```

Expected: all tests and the backend import check pass.

- [ ] **Step 9: Commit the API surface**

```powershell
git add api/index.js server/supabase.js src/services/api.js tests/client-profile-api.test.js tests/client-verification-api.test.js
git commit -m "feat: expose secure client profile APIs"
```

---

### Task 7: Client Profile UI and Routing

**Files:**
- Create: `src/components/ClientProfileDashboard.jsx`
- Create: `tests/client-profile-ui.test.js`
- Modify: `src/pages/ClientPages.jsx`
- Modify: `tests/client-verification-ui.test.js`

**Interfaces:**
- `ClientProfileDashboard({ user, section, onSectionChange, onUserUpdated })` owns the Account/Verification section switcher and account draft.
- `section` is normalized to `account` or `verification`; the component requests changes through `onSectionChange(nextSection)` rather than writing URL state directly.
- `onUserUpdated(sessionSummary)` receives only the allowlisted active account summary returned by Task 6.
- `?tab=profile&section=account` is the account destination; `?tab=profile&section=verification` is the verification destination.

- [ ] **Step 1: Write failing profile and route contracts**

Create `tests/client-profile-ui.test.js`. Read the component/page sources and assert that:

- the profile renders Account and Verification controls;
- Account uses the existing `FormField`, `FileDropzone`, `Button`, `StatusBadge`, and semantic status primitives;
- it calls `backendApi.client.getMyProfile`, `updateMyProfile`, and `uploadProfilePhoto`;
- the protected-name reason is rendered only when `requiresProtectedNameReason` is true;
- save/upload failures do not replace the draft with the old server record;
- `onUserUpdated` is called only with the returned `sessionSummary`;
- the verification section mounts exactly one `ClientVerificationDashboard`;
- `CLIENT_ROUTE_TABS` accepts `profile`, while the primary navigation array does not add a Profile item;
- legacy `?tab=verification` is replaced by `?tab=profile&section=verification` while unrelated search parameters are retained.

Extend `tests/client-verification-ui.test.js` to assert that notification fallbacks and verification actions target `/?tab=profile&section=verification`.

- [ ] **Step 2: Run the UI contracts and confirm RED**

Run:

```powershell
node --test tests/client-profile-ui.test.js tests/client-verification-ui.test.js
```

Expected: FAIL because the profile component and route are absent.

- [ ] **Step 3: Implement the account loader and resilient draft**

In `ClientProfileDashboard.jsx`, load `backendApi.client.getMyProfile()` when the Account section first opens. Initialize the draft with `createClientProfileDraft(account)`, but do not reinitialize a dirty draft after a save or upload error.

Track `loading`, `loadError`, `saving`, `saveError`, `uploading`, and the canonical response separately. Provide an inline Retry action for the loader. Disable only the mutation currently in flight; do not make the entire profile unreadable during a save.

- [ ] **Step 4: Build Account and Verification sections**

Account must render:

- current avatar or initials, plus a JPEG/PNG chooser with a 3 MB hint;
- editable Full name and Company fields;
- the protected-change explanation field and copy explaining approval only when required;
- read-only email, account type/tier, verification status, and verified legal business name;
- pending request status, requested name, submission date, and the latest decision/reason when present;
- one Save changes action and independent profile-photo upload feedback.

While a name request is pending, make the full-name control read-only, show the pending requested name and saved explanation, and leave Company, avatar, Save changes, and Cancel available. Cancel restores the canonical full name/company and clears an unsaved explanation without changing the photo.

Validate with Task 4 helpers before calling the API. On a successful account save, replace the canonical record and draft with the returned account, announce the `nameOutcome`, and call `onUserUpdated(result.sessionSummary)`. On successful photo upload, update only the displayed avatar and call `onUserUpdated(result.sessionSummary)`. Never label the avatar as verification evidence or send it to verification endpoints.

The Verification section must render the existing `ClientVerificationDashboard` unchanged. Section controls use buttons with `aria-pressed`, visible focus states, and semantic tokens.

- [ ] **Step 5: Add profile routing and legacy normalization**

In `ClientPages.jsx`:

1. add `profile` to the set of accepted route tabs but not to the visible primary navigation;
2. derive the profile section with `section === 'verification' ? 'verification' : 'account'`;
3. render `ClientProfileDashboard` for `tab === 'profile'`;
4. preserve unrelated query parameters when switching sections;
5. normalize `tab=verification` with `setSearchParams(nextParams, { replace: true })` so Back does not return to the deprecated URL;
6. route any old verification fallback to the new profile URL.

- [ ] **Step 6: Run profile UI and verification tests**

Run:

```powershell
node --test tests/client-profile-ui.test.js tests/client-verification-ui.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit the client profile UI**

```powershell
git add src/components/ClientProfileDashboard.jsx src/pages/ClientPages.jsx tests/client-profile-ui.test.js tests/client-verification-ui.test.js
git commit -m "feat: add editable client profile workspace"
```

---

### Task 8: Admin Name-Change Review UI

**Files:**
- Create: `src/components/ClientNameChangeReview.jsx`
- Create: `src/components/ClientVerificationWorkspace.jsx`
- Create: `tests/client-name-change-admin-ui.test.js`
- Modify: `src/pages/AdminPages.jsx`
- Modify: `src/components/ClientVerificationReview.jsx`

**Interfaces:**
- `ClientVerificationWorkspace({ section, onSectionChange })` loads the name-change resource once, exposes its pending count in both views, and composes the existing Verification Cases view with the new Name Changes view.
- `ClientNameChangeReview({ nameChangeResource })` renders and mutates the lifted queue through the Task 6 admin service methods.
- Admin URLs are `?tab=client-verifications&section=cases` and `?tab=client-verifications&section=name-changes`.

- [ ] **Step 1: Write failing admin workspace contracts**

Create `tests/client-name-change-admin-ui.test.js` and assert:

- two workspace controls labeled Verification Cases and Name Changes;
- a pending count badge sourced from `pendingCount`;
- request rows show current name, requested name, client explanation, client email, display company, verification status, and request age/date;
- Approve and Reject use `backendApi.admin.decideClientNameChange`;
- Reject requires a client-visible reason and Approve permits an optional note;
- a 409 response renders a stale-decision message and refreshes the list;
- empty, loading, retry, submitting, and success states use shared semantic primitives;
- `AdminPages` accepts and preserves the `section` search parameter;
- `client_name_change_requested` notification fallback targets the Name Changes URL.

- [ ] **Step 2: Run the admin UI contract and confirm RED**

Run: `node --test tests/client-name-change-admin-ui.test.js`

Expected: FAIL because the review components do not exist.

- [ ] **Step 3: Build the name-change queue**

In `ClientVerificationWorkspace`, call `useBackendResource(backendApi.admin.listClientNameChanges, { pendingCount: 0, requests: [] })` regardless of the active section. Pass the returned `{ data, error, isLoading, refetch }` object to `ClientNameChangeReview` so the badge and queue come from one request and the pending count is available while Verification Cases is active.

Implement `ClientNameChangeReview` with retry control, empty state, and pending-first list from that resource. A selected request opens an accessible decision region that repeats the old and requested names before submission. Decided/cancelled requests remain historical context and never expose active decision controls.

For Approve, send `{ requestId, decision: 'approved', reviewNote }`. For Reject, validate and send `{ requestId, decision: 'rejected', reviewNote }`. Disable duplicate submission while the request is in flight. After success, announce the outcome and reload the canonical queue. If the API returns 409, announce that another administrator already decided it and reload without presenting the local choice as successful.

- [ ] **Step 4: Compose the verification workspace**

Implement `ClientVerificationWorkspace` as a two-view wrapper with the single page heading `Client Verification`. Change the existing component signature to `ClientVerificationReview({ showHeading = true })`, preserve every other behavior, and pass `showHeading={false}` from the workspace. The active control uses `aria-current="page"`; the pending count badge remains visible on the Name Changes control from either view.

In `AdminPages.jsx`, normalize missing/unknown sections to `cases`, preserve unrelated query parameters, and render the workspace under the existing `client-verifications` tab. Map the notification fallback for `client_name_change_requested` to `/?tab=client-verifications&section=name-changes`.

- [ ] **Step 5: Run the admin and existing verification tests**

Run:

```powershell
node --test tests/client-name-change-admin-ui.test.js tests/client-verification-ui.test.js
```

Expected: PASS with no existing verification behavior removed.

- [ ] **Step 6: Commit the admin review workspace**

```powershell
git add src/components/ClientNameChangeReview.jsx src/components/ClientVerificationWorkspace.jsx src/components/ClientVerificationReview.jsx src/pages/AdminPages.jsx tests/client-name-change-admin-ui.test.js tests/client-verification-ui.test.js
git commit -m "feat: add client name change review queue"
```

---

### Task 9: Session-Summary Propagation and Professional Approval Safety

**Files:**
- Create: `src/utils/sessionSummary.js`
- Create: `tests/session-summary.test.js`
- Modify: `src/App.jsx`
- Modify: `api/index.js`
- Modify: `server/session.js`
- Modify: `src/pages/ClientPages.jsx`
- Modify: `src/pages/ProfessionalPages.jsx`
- Modify: `src/hooks/useNotifications.js`
- Modify: `tests/professional-onboarding-ui.test.js`

**Interfaces:**
- `toActiveSessionSummary(user)` on the server returns only active identity/entitlement fields understood by the shell.
- `normalizeSessionSummary(summary)` returns the same allowlisted frontend shape and sanitizes nested permission objects.
- `mergeSessionSummary(currentUser, summary)` refuses a different user ID and preserves protected/local session fields not supplied by the server.
- Both portal shells receive `onUserUpdated(summary)` and `refreshSessionUser()` from `App`.
- `useNotifications(userId, options)` accepts optional `options.onRealtimeNotification(notification)` without changing existing callers.

- [ ] **Step 1: Write failing session and professional safety tests**

Create `tests/session-summary.test.js` against both `src/utils/sessionSummary.js` and the pure `toActiveSessionSummary` export from `server/session.js`, with concrete cases for:

- allowlisting `id`, name aliases, display company, avatar aliases, approved title, client tier/label/permissions, professional tier/label/permissions, and profile visibility aliases;
- dropping email changes, role changes, verification/reviewer/audit fields, tokens, and unknown keys;
- dropping unknown keys nested inside client/professional permission objects;
- rejecting a summary whose `id` differs from the active user;
- merging aliases into the existing canonical user shape without erasing unrelated session fields.

Extend `tests/professional-onboarding-ui.test.js` and backend source assertions so that:

- `PATCH /talent/me` never writes submitted `fullName` or `title` directly to active `profiles` before approval;
- approval copies the approved source into active `profiles.full_name` and `profiles.title`;
- talent profile/photo responses contain an active `sessionSummary`, never pending values;
- client/professional pages call `onUserUpdated` only with server summaries.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
node --test tests/session-summary.test.js tests/professional-onboarding-ui.test.js
```

Expected: FAIL because the merge helper/callbacks are absent and the professional submit path still mutates active identity too early.

- [ ] **Step 3: Implement the allowlisted merge helper**

In `server/session.js`, export `toActiveSessionSummary(user)` and build it with own-property checks. The server shape can include only `id`, `name`, `company`, `avatarUrl`, `title`, `clientTier`, `clientTierLabel`, `clientPermissions`, `professionalTier`, `professionalTierLabel`, `professionalPermissions`, and `profileVisibility`. It never emits `email`, `role`, token material, pending profile data, raw verification records, or reviewer/audit data.

Use one explicit frontend field map rather than spreading server data:

```js
const SESSION_FIELD_ALIASES = Object.freeze({
  name: ['name', 'fullName', 'full_name'],
  company: ['company'],
  avatarUrl: ['avatarUrl', 'avatar_url'],
  title: ['title'],
  clientTier: ['clientTier', 'client_tier'],
  clientTierLabel: ['clientTierLabel'],
  clientPermissions: ['clientPermissions'],
  professionalTier: ['professionalTier', 'professional_tier'],
  professionalTierLabel: ['professionalTierLabel'],
  professionalPermissions: ['professionalPermissions'],
  profileVisibility: ['profileVisibility', 'profile_visibility'],
});
```

Include `id` as the identity guard, not as a mutable field. Copy a value only when its own property is present, so a missing field cannot erase the current value. Sanitize nested permission objects through explicit lists matching the existing client and professional capability keys; never spread them. Return the original user unchanged for a mismatched or missing summary ID.

- [ ] **Step 4: Centralize session updates and refreshes in App**

In `App.jsx`, keep a `userRef` synchronized with state and create stable callbacks:

- `handleUserUpdated(summary)` calls `mergeSessionSummary(userRef.current, summary)`, updates the ref and React state, and persists the same sanitized active user through the existing `pb_user` local-storage path;
- `refreshSessionUser()` coalesces concurrent calls with a promise ref, calls `backendApi.auth.me()`, passes `toActiveSessionSummary`-compatible `result.user` into `handleUserUpdated`, and clears the ref in `finally`;
- a window `focus` listener calls `refreshSessionUser` only for an authenticated backend session and is removed on cleanup.

Pass both callbacks to the client and professional page shells. Do not accept arbitrary profile objects from child components.

- [ ] **Step 5: Fix the professional pending/approved identity boundary**

In `api/index.js`, update every professional draft/save/submission branch so `fullName` and `title` remain in the existing pending/review source until approval. Do not patch those values into active `profiles` during `PATCH /talent/me`, including approved-professional draft saves. Split the current `ownerProfilePatch`: preserve required manual-triage updates in their own allowlisted patch, but exclude `full_name` and `title` before approval.

At admin approval, always copy the approved source into `profiles`: use the pending profile when one exists, otherwise use the reviewed professional profile record. Preserve the existing rejection behavior so active identity never shows rejected values. Add an active `sessionSummary` to professional profile/photo responses by reloading the canonical session with `getSessionUser(req)` and mapping it through `toActiveSessionSummary` after the mutation. Append `sessionSummary` to the existing mapped profile/upload object rather than wrapping or renaming the current response, so existing professional form consumers remain compatible.

- [ ] **Step 6: Refresh from relevant realtime notifications**

Extend `useNotifications` without breaking its current return shape. Store `options.onRealtimeNotification` in a ref. After loading a realtime notification payload, invoke the current ref with `payload.new`; do not add the callback identity to the subscription effect dependencies. In each portal page, call `refreshSessionUser()` only for identity-affecting types:

- client: `client_name_change_approved`, `client_name_change_rejected`, `client_verification_approved`, `client_verification_rejected`, and `client_verification_reset`;
- professional: `profile_status_updated`, `identity_verification_updated`, `document_status_updated`, and `resume_status_updated` because each can change the active tier/title context.

The focus refresh remains the recovery path if a realtime event is missed.

- [ ] **Step 7: Run session, professional, and notification regression tests**

Run:

```powershell
node --test tests/session-summary.test.js tests/professional-onboarding-ui.test.js tests/notification-panel-ui.test.js
npm run check:backend
```

Expected: PASS.

- [ ] **Step 8: Commit safe identity propagation**

```powershell
git add src/utils/sessionSummary.js src/App.jsx api/index.js server/session.js src/pages/ClientPages.jsx src/pages/ProfessionalPages.jsx src/hooks/useNotifications.js tests/session-summary.test.js tests/professional-onboarding-ui.test.js
git commit -m "fix: keep pending identity out of active sessions"
```

---

### Task 10: Shared Role-Specific Guides

**Files:**
- Create: `src/components/PortalGuideModal.jsx`
- Create: `src/components/ProfessionalWorkflowOnboardingModal.jsx`
- Create: `src/utils/portalGuideStorage.js`
- Create: `tests/portal-guides-ui.test.js`
- Modify: `src/components/ClientWorkflowOnboardingModal.jsx`
- Modify: `tests/modal-ui.test.js`
- Modify: `tests/eyebrow-ui.test.js`
- Modify: `tests/professional-onboarding-ui.test.js`

**Interfaces:**

```js
export const PORTAL_GUIDE_VERSIONS = Object.freeze({ client: 'v2', professional: 'v1' });

export const getPortalGuideStorageKey = (role, user) => {
  const version = PORTAL_GUIDE_VERSIONS[role];
  const userId = String(user?.id || user?.email || '').trim();
  return version && userId
    ? `pb-finance:portal-guide:${role}:${encodeURIComponent(userId)}:${version}`
    : '';
};

export const shouldShowPortalGuide = (role, user, storage) => {
  const key = getPortalGuideStorageKey(role, user);
  if (!key || !storage) return true;
  try { return storage.getItem(key) !== 'seen'; } catch { return true; }
};

export const markPortalGuideSeen = (role, user, storage) => {
  const key = getPortalGuideStorageKey(role, user);
  if (!key || !storage) return false;
  try { storage.setItem(key, 'seen'); return true; } catch { return false; }
};
```

- `PortalGuideModal({ description, eyebrow, open, onClose, steps, title })` renders the shared accessible presentation.
- `ClientWorkflowOnboardingModal({ clientPermissions, user, open, onClose, onNavigate })` supplies client steps.
- `ProfessionalWorkflowOnboardingModal({ professionalPermissions, user, open, onClose, onNavigate })` supplies professional steps.
- Each step has `{ id, icon, title, description, statusLabel, available, destination }`; an available destination is `{ tab, section? }`, and wrappers call `onNavigate(destination)` only for available steps.

- [ ] **Step 1: Write failing guide storage and UI contracts**

Create `tests/portal-guides-ui.test.js` covering:

- deterministic, per-user storage keys containing role and guide version;
- a missing/unavailable storage object fails open without throwing;
- marking one role/user/version does not mark another;
- both wrappers use `PortalGuideModal` and provide real destination keys;
- locked or unavailable features remain visible with status-aware explanatory copy and cannot navigate;
- the client wrapper has exactly Profile and verification, Discover talent, Shortlist, Interview, and Contracts and billing;
- the professional wrapper has exactly Complete profile, Identity verification, Credentials, Admin review, Opportunities, and Timesheets and earnings;
- manual reopening does not depend on first-run storage state.

Extend modal/eyebrow/professional contracts to recognize the shared modal and semantic styling.

- [ ] **Step 2: Run the guide tests and confirm RED**

Run:

```powershell
node --test tests/portal-guides-ui.test.js tests/modal-ui.test.js tests/eyebrow-ui.test.js tests/professional-onboarding-ui.test.js
```

Expected: FAIL because the shared guide and professional guide do not exist.

- [ ] **Step 3: Implement resilient, versioned guide storage**

Implement the interface code above. The encoded user ID keeps the key per account without exposing a shared `unknown` key. Accept storage as an argument for testability; unavailable storage fails open without throwing.

- [ ] **Step 4: Implement the shared accessible guide modal**

Use the existing modal primitive and semantic PB Signature tokens. Render an ordered step list with a Lucide icon, title, description, status, and optional destination action. The modal must have a visible title/description association, focus containment supplied by the shared primitive, Close action, Escape support, scrollable body, and a non-animated reduced-motion path.

- [ ] **Step 5: Improve the client guide**

Refactor `ClientWorkflowOnboardingModal` into data supplied to the shared modal. Keep the heading personalized with the active client name and use these five approved stages:

1. **Profile and verification** -> `?tab=profile&section=verification` for Basic clients who need to unlock gated steps; Verified/VIP clients open `?tab=profile&section=account` and can switch to Verification there.
2. **Discover talent** -> `discover`.
3. **Shortlist** -> `shortlist`, with the current tier's shortlist-limit explanation.
4. **Interview** -> `interviews` when `canScheduleInterviews`; otherwise locked copy explaining the verification/tier requirement.
5. **Contracts and billing** -> `billing` when `canViewFullDocuments`; otherwise locked copy explaining the verification/tier requirement.

Descriptions must explain why each step matters, what unlocks it, and what the user should expect next. Derive availability only from the current account and existing `clientPermissions`; do not start a second profile request, invent entitlement flags, or add Matchmaker as a guide stage.

- [ ] **Step 6: Add the professional guide**

Implement these six approved status-aware stages:

1. **Complete profile** -> `profile`.
2. **Identity verification** -> the identity section in the existing professional `profile` experience.
3. **Credentials** -> the credential section in the existing professional `profile` experience.
4. **Admin review** -> `profile` with unverified guidance or verified completion copy.
5. **Opportunities** -> `opportunities` only when `canAccessDashboard`.
6. **Timesheets and earnings** -> `earnings` only when `canAccessDashboard`.

Unverified, verified, and feature-restricted users see accurate next-step text based on the existing professional tier/permissions. Do not add a second `/talent/me` request merely to enrich guide copy. Destination buttons call `onNavigate` and close the modal only after a valid navigation request.

- [ ] **Step 7: Run all guide contracts**

Run:

```powershell
node --test tests/portal-guides-ui.test.js tests/modal-ui.test.js tests/eyebrow-ui.test.js tests/professional-onboarding-ui.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit the guide system**

```powershell
git add src/components/PortalGuideModal.jsx src/components/ClientWorkflowOnboardingModal.jsx src/components/ProfessionalWorkflowOnboardingModal.jsx src/utils/portalGuideStorage.js tests/portal-guides-ui.test.js tests/modal-ui.test.js tests/eyebrow-ui.test.js tests/professional-onboarding-ui.test.js
git commit -m "feat: add role-aware portal guides"
```

---

### Task 11: Client and Professional Portal Integration

**Files:**
- Modify: `src/pages/ClientPages.jsx`
- Modify: `src/pages/ProfessionalPages.jsx`
- Modify: `src/App.jsx`
- Modify: `src/hooks/useNotifications.js`
- Modify: `tests/dashboard-account-menu-ui.test.js`
- Modify: `tests/client-profile-ui.test.js`
- Modify: `tests/portal-guides-ui.test.js`
- Modify: `tests/professional-onboarding-ui.test.js`

**Interfaces:**
- Both portal headers render exactly one `DashboardAccountMenu` in the right-side account area.
- Client actions: Profile, Notifications, destination-aware theme action, Guide, conditional Matchmaker, and Log out.
- Professional actions: Profile, Notifications, destination-aware theme action, Guide, and Log out.
- The client context line is the active company; the professional context line is company, then approved title, then `Independent professional`.

- [ ] **Step 1: Extend integration contracts and confirm RED**

Add source/SSR assertions that:

- each portal imports and renders `DashboardAccountMenu` exactly once;
- standalone Guide, theme, notification, logout, and expanded identity controls are removed from the client/professional header action area;
- the closed account control receives only avatar/initials and an accessible name;
- client Profile navigates to `?tab=profile&section=account`, while professional Profile uses its current `?tab=profile` destination;
- client Matchmaker is passed only when the existing `matchmakerVisible` condition is true;
- professional account context uses company -> approved title -> fallback precedence;
- Notifications uses the existing hook exactly once per portal and opens the component subview instead of a second popover;
- Guide opens manually and first-run behavior is per role/user/version;
- logout still calls the existing authenticated logout path.

Run:

```powershell
node --test tests/dashboard-account-menu-ui.test.js tests/client-profile-ui.test.js tests/portal-guides-ui.test.js tests/professional-onboarding-ui.test.js
```

Expected: FAIL on the old header layout.

- [ ] **Step 2: Integrate the client header and guide**

In `ClientPages.jsx`, keep the existing page navigation and replace only the right-side utility/identity controls with `DashboardAccountMenu`. Change the narrow header container padding to `px-[18px] sm:px-6 lg:px-8` so the capsule and fixed dropdown share the 18 px right edge. Pass canonical active user fields, tier label, unread count, notification panel props, theme state/toggle, logout, and action callbacks.

Profile sets `tab=profile&section=account`. Notifications changes the account-menu reducer view rather than mounting `NotificationBell`. Guide opens the improved client guide. Matchmaker uses the existing `matchmakerVisible` gate and existing destination. Preserve unrelated query parameters for internal portal navigation.

Resolve storage with `const guideStorage = typeof window === 'undefined' ? null : window.localStorage` and use `shouldShowPortalGuide('client', user, guideStorage)` once per authenticated user/version to initialize first-run state. Mark it seen when the user closes or follows a valid guide destination. Keep the menu Guide action able to reopen it.

- [ ] **Step 3: Integrate the professional header and guide**

In `ProfessionalPages.jsx`, use the same `px-[18px] sm:px-6 lg:px-8` narrow header padding and replace the same right-side controls with `DashboardAccountMenu`, but omit Matchmaker. Pass the active company; otherwise the approved active title; otherwise `Independent professional` as context. Never derive header identity from a pending submission.

Profile navigates to the existing professional profile destination. Guide uses `ProfessionalWorkflowOnboardingModal` and `shouldShowPortalGuide('professional', user, guideStorage)` with the same SSR-safe storage guard as the client. Use current professional tier/permissions for guide availability and preserve manual reopening.

- [ ] **Step 4: Connect session and realtime callbacks**

Pass the Task 9 `onUserUpdated` callback into `ClientProfileDashboard` and the professional profile/photo success paths. Pass `refreshSessionUser` into the realtime notification callbacks. Also pass an `onNotificationOpened(notification)` handler to `DashboardAccountMenu` that refreshes the session for the same identity-affecting type sets before following a stored notification; this covers approvals loaded after realtime was missed. Memoize both notification callbacks so adding `options.onRealtimeNotification` does not resubscribe on every render.

Keep one notification source per portal: the account menu receives the data/actions returned by the portal's existing `useNotifications` invocation. Admin continues using `NotificationBell` unchanged.

- [ ] **Step 5: Run the portal integration suite**

Run:

```powershell
node --test tests/dashboard-account-menu-ui.test.js tests/client-profile-ui.test.js tests/portal-guides-ui.test.js tests/professional-onboarding-ui.test.js tests/notification-panel-ui.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit portal integration**

```powershell
git add src/pages/ClientPages.jsx src/pages/ProfessionalPages.jsx src/App.jsx src/hooks/useNotifications.js tests/dashboard-account-menu-ui.test.js tests/client-profile-ui.test.js tests/portal-guides-ui.test.js tests/professional-onboarding-ui.test.js
git commit -m "feat: integrate portal account menus and guides"
```

---

### Task 12: Responsive, Security, Regression, and Browser Verification

**Files:**
- Modify: `tests/responsive-layout-ui.test.js`
- Modify: `tests/design-system-contract.test.js`
- Modify: `tests/dashboard-account-menu-ui.test.js`
- Modify: production files from Tasks 1-11 only when a failing acceptance check identifies a defect.

**Acceptance matrix:**
- Roles: client and professional, plus admin regression.
- Viewports: 320 px, 390 px, 768 px, and desktop.
- Inputs: mouse hover, click, touch emulation, keyboard, Escape, and outside interaction.
- Themes/preferences: light, dark, and reduced motion.
- Data states: short/long identity text, no avatar, unread notifications, push unavailable, pending/approved/rejected verification, and pending/stale name request.

- [ ] **Step 1: Add failing cross-cutting source contracts**

Extend the responsive/design/account-menu tests to require:

- one shared width token/class for capsule and dropdown;
- `286px` desktop width and `calc(100vw - 36px)` maximum narrow width;
- 18 px narrow viewport inset, bounded dropdown height, and internal scrolling;
- truncation for long name/company/account labels;
- semantic token classes and no new raw brand hex values;
- 44 px trigger target, focus-visible states, menu/action accessible names, and destination-aware theme text/icon;
- reduced-motion styling and no translate/scale animation in that preference;
- Lucide imports for every requested action icon and no emoji/glyph icon substitutes.

Run:

```powershell
node --test tests/dashboard-account-menu-ui.test.js tests/responsive-layout-ui.test.js tests/design-system-contract.test.js
```

Expected: any missing acceptance contract fails before hardening.

- [ ] **Step 2: Fix only acceptance defects and rerun focused suites**

Apply the smallest production corrections required by the failing contracts. Then run:

```powershell
node --test tests/dashboard-account-menu-state.test.js tests/dashboard-account-menu-ui.test.js tests/notification-panel-ui.test.js
node --test tests/client-profile.test.js tests/profile-image-upload.test.js tests/client-profile-api.test.js tests/client-profile-ui.test.js
node --test tests/client-name-change-schema.test.js tests/client-name-change-admin-ui.test.js
node --test tests/session-summary.test.js tests/portal-guides-ui.test.js
node --test tests/ui-primitives.test.js tests/responsive-layout-ui.test.js tests/client-verification-ui.test.js tests/professional-onboarding-ui.test.js tests/design-system-contract.test.js
```

Expected: every focused suite passes.

- [ ] **Step 3: Run the full static verification gate**

Run:

```powershell
npm test
npm run lint
npm run build
npm run check:backend
git diff --check
```

Expected: all commands exit 0. Record pre-existing warnings separately; do not describe a warning as introduced unless the diff causes it.

- [ ] **Step 4: Verify migration safety without changing a live project**

Run the schema/security contracts against the generated migration and `supabase/schema.sql`. Confirm in the committed SQL that:

- both tables have RLS plus explicit grants;
- `PUBLIC`, `anon`, and `authenticated` cannot execute privileged functions;
- the dedicated executor is NOLOGIN/NOINHERIT and not BYPASSRLS;
- service-role direct DML is absent;
- the client identity-field guard enforces trim, bounds, and control-character rules on direct profile updates;
- the guard rejects direct protected-name edits;
- save, decision, rejection, and reset acquire profile -> verification -> request locks in the same order;
- the decision function is pending-only, reviewer-derived, and auditable.

Do not link/apply the migration to a shared or production Supabase project as part of this implementation. When an authorized disposable/local database is available, run the migration there, exercise both RPC transactions, then run Supabase security/performance advisors and record the results.

- [ ] **Step 5: Run real-browser verification**

Start the Vite app with `npm run dev -- --host 127.0.0.1`, record the printed local URL, then use the `vercel:agent-browser-verify` skill for the browser pass. Use authorized non-production client, professional, and admin development sessions; do not place credentials in commands, screenshots, logs, or the plan. Verify all acceptance-matrix combinations that affect layout or input, with special attention to:

- avatar-only resting state on both portals;
- stable hover entry across the 8 px bridge with no capsule-edge twitch;
- leftward reveal, glow, matching capsule/dropdown widths, viewport containment, and long-text truncation;
- mouse hover preview versus click/touch pinning;
- Escape focus restoration, outside dismissal, tab order, and notifications back-navigation;
- correct Lucide icons and destination-aware Sun/Moon action;
- client Account save, failed-save draft retention, photo upload, protected-name pending state, and embedded Verification;
- admin approve/reject/stale-decision behavior in a separate authenticated session;
- active header identity changing only after approval/realtime refresh;
- client/professional first-run and manual Guide behavior;
- light, dark, reduced-motion, and browser console/network errors.

Capture screenshots for desktop open state and 320 px open state for both roles. Stop the development server after verification.

- [ ] **Step 6: Commit verified hardening when the acceptance pass changed files**

If Steps 1-5 required production or test corrections, run the full gate again and commit only those corrections:

```powershell
git add src api server supabase tests package.json
git commit -m "fix: verify dashboard account experience"
```

If the acceptance pass changed no files, do not create an empty commit.

- [ ] **Step 7: Perform completion review**

Use `superpowers:verification-before-completion` to verify the final command evidence and `superpowers:requesting-code-review` for an independent requirements/diff review. Resolve every blocking finding, rerun the affected focused suite plus the full gate, and report:

- final commits and files changed;
- test/build/browser evidence;
- migration deployment status;
- any non-blocking pre-existing warnings;
- the exact remaining authorized deployment step, if the migration has not been applied.
