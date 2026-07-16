# Dashboard Account Menu, Client Profile, and Portal Guides Design

**Date:** 2026-07-16

**Status:** Approved for implementation planning

## Objective

Replace the separate client and professional dashboard account controls with one shared avatar-first account menu, add an editable Client Profile destination that contains the existing verification workflow, protect trusted client full-name changes behind admin approval, improve the client guide, and add a professional guide.

## Approved Product Decisions

- The avatar or profile picture is the only account control visible at the top right of client and professional dashboard headers.
- Hover or keyboard focus expands the account capsule to the left and reveals the account name, company or professional context, and account type.
- The expanded capsule and its dropdown share one 286 px desktop width and aligned right edge.
- The disclosure uses a stable 8 px hover buffer and a 180 ms close grace period so the moving capsule edge cannot flicker or twitch.
- Click or tap pins the disclosure open. Escape and outside interaction close it.
- The client account menu contains Profile, Notifications, theme, Client Guide, permission-gated AI Matchmaker, and Log out.
- The professional account menu contains Profile, Notifications, theme, Professional Guide, and Log out.
- Log out is the final separated danger action. AI Matchmaker and Log out no longer remain as standalone header controls.
- Client Profile is editable and contains the client verification workflow.
- A client can change their full name directly while verification is `draft` or `rejected`.
- A client full-name change requires PB Finance admin approval while verification is `pending_review` or `approved`. The current name remains active until approval.
- Existing professional pending-profile review continues to protect approved professional profile changes, including full-name changes.
- The client guide becomes permission-aware. The professional portal receives a new status-aware guide.
- New components use the canonical semantic tokens in `docs/design-system/pb-signature-colors.md` and do not introduce raw brand colors or page-owned status colors.

## Existing System Fit

The authenticated application selects `ClientPortal` or `ProfessionalPortal` by role and uses `?tab=` search parameters for workspace destinations. Both portals duplicate the dashboard header and account-control markup. The client currently exposes verification as `?tab=verification` and has no Profile destination or client profile API. The professional portal already embeds identity and credential verification inside `?tab=profile` and already has editable Profile Settings.

The existing `NotificationBell` owns notification loading, read actions, action-URL navigation, and browser push preferences. The existing client guide is a first-run modal with fixed Discover, Shortlist, Interview, and Contract steps. It is not tier-aware and teaches Basic clients about destinations they cannot access. The professional portal has no guide.

The common `profiles` record contains `full_name`, `company`, `avatar_url`, role, and client tier. Client verification stores regulated evidence and `verified_business_name` separately. These trust domains remain separate: editable display-company data must never populate or replace the approved legal business name.

## Chosen Architecture

Use focused shared components while retaining the current client and professional portal shells. Do not replace both portals with a new generic dashboard framework.

### `DashboardAccountMenu`

Create one role-agnostic account disclosure that consumes:

- `accountTypeLabel`
- `avatarUrl`
- `companyOrContext`
- `isDarkMode`
- `matchmakerAction`, when eligible
- `name`
- notification state
- `onGuide`
- `onLogout`
- `onProfile`
- `onThemeToggle`
- role

The component owns disclosure state, pointer grace, focus behavior, click pinning, Escape handling, outside dismissal, focus restoration, responsive positioning, and reduced-motion behavior. It renders ordinary buttons in a labelled account-actions region rather than claiming `role="menu"` without implementing the complete ARIA menu keyboard model.

Use Lucide `UserRound`, `Bell`, destination-aware `Sun` or `Moon`, `BookOpen`, `Sparkles`, `LogOut`, and `ArrowLeft` icons for the corresponding actions. Do not use emoji, text glyphs, or improvised SVG paths. The theme label and icon describe the mode the action will switch to. The disclosure uses semantic surface, text, border, action, focus, and danger utilities from the PB Finance design contract.

For eligible clients, AI Matchmaker toggles the existing `matchmakerVisible` experience and reports its state with `aria-pressed`; it does not mount a second matchmaker or introduce a separate destination.

### Shared notification content

Extract the notification list, push preference controls, read actions, loading state, error state, and notification navigation into a reusable notification panel. `DashboardAccountMenu` shows that panel as an internal second view with a Back action. The panel is viewport-bounded and uses internal vertical scrolling so a long notification list cannot extend past the screen. Keep `NotificationBell` as a compatibility wrapper for any surface that still needs a standalone bell, including Admin unless separately redesigned.

Opening Notifications refreshes the list and push state exactly as the current bell does. Selecting a notification marks it read, closes the account disclosure, and follows its safe same-origin or external action URL.

### Session-summary updates

Add `onUserUpdated` and `refreshSessionUser` paths from the authenticated App state into both portals. Successful client profile responses update the root session summary so the account capsule immediately reflects an allowed name, company, and avatar change without requiring logout or refresh. Relevant name/profile approval notifications and window-focus recovery call `refreshSessionUser`, which reloads the active `/auth/me` summary so admin decisions made in another session appear in the capsule.

Professional Profile Settings continue to own the detailed talent profile. Professional draft saves must not copy `pending_profile` values into the root session. Save and realtime handlers report only active, approved header-summary fields upward; a professional approval notification or focus recovery refreshes the session summary after the decision. The header does not start an independent polling loop or a second `/talent/me` request.

## Account Interaction

### Resting state

Only a 44 px circular avatar or initials fallback is visible at the top right. The trigger retains a minimum 44 px target and an accessible name such as `Open account menu for Aldwin Gotingco`.

### Expanded state

The right-anchored capsule expands to 286 px. Because the avatar remains the first flex item, it visibly travels left while the name, company or context, and tier badge appear to its right. A Cobalt focus/glow treatment communicates interactivity without using Emerald success color or excessive neon styling.

The dropdown appears below at the same 286 px width and right alignment. A shared width token prevents capsule and panel drift.

### Input behavior

- On devices matching `(hover: hover) and (pointer: fine)`, mouse hover opens immediately.
- The expanded pointer region includes an invisible 8 px buffer.
- Pointer leave starts a 180 ms close timer; re-entry cancels it.
- Click or tap toggles a pinned-open state.
- Focus entering the disclosure opens it.
- Escape closes it and restores focus to the trigger.
- An outside pointer interaction closes it.
- Moving from the trigger into the dropdown never dismisses it.
- Reduced motion removes sliding and scaling while preserving visibility changes.

Touch and coarse-pointer `pointerenter`/`pointerleave` events do not drive hover preview. One tap produces one pinned-state transition; any compatibility mouse event following that touch is ignored. The interaction-state helper distinguishes hover preview from pinned state so a real mouse can preview after touch input without inheriting a stale close timer.

### Responsive behavior

At narrow widths, both capsule and dropdown use the same value capped by `calc(100vw - 36px)`. The dropdown uses fixed positioning with 18 px safe insets where necessary. Long names, companies, titles, and account labels truncate without changing the avatar size or pushing content outside the viewport.

## Client Profile Experience

Add `profile` as a valid client destination. It is reachable from the account menu and does not need to become another permanent workspace-navigation button.

The page has two clear sections controlled by `section` search state:

1. `account`
2. `verification`

`?tab=profile` defaults to Account. `?tab=profile&section=verification` opens Verification.

### Account section

Display and edit:

- Profile picture or initials fallback.
- Full name.
- Display company.

Display as read-only:

- Account email.
- Account type or tier.
- Verification status.
- Approved `verifiedBusinessName`, when present.

Use `profiles.company` as the canonical account display-company value. The supported write path is a service-only transactional operation that locks the client profile, updates `profiles.company`, and updates the earliest-created `client_companies` row used by the existing primary-company accessor. If no company row exists, it creates one with the account billing email. A database trigger synchronizes that same primary row after any other permitted `profiles.company` update, and authenticated users cannot update the primary company name directly through the Data API. This keeps the canonical display records consistent without renaming any later company rows. `verifiedBusinessName` remains a separate protected value sourced only from approved verification.

Trim full name and display company before comparison and persistence. Full name is required, must contain 2 to 160 characters, and cannot contain control characters. Display company is required, must contain 1 to 180 characters, and cannot contain control characters.

When a client in `pending_review` or `approved` state types a name different from the active name, reveal a required `Why are you requesting this change?` textarea and explain that the active name remains visible until PB Finance approves the request. The explanation validates at 1 to 1,000 trimmed characters. Cancelling Account edits restores the persisted fields and clears the unsaved explanation; failed validation or submission retains every draft field. While a request is already pending, show its requested name and explanation instead of offering another name submission, while leaving unrelated company and avatar edits available.

### Account avatar versus verification evidence

The account avatar is ordinary display profile media stored in `profiles.avatar_url`. The client verification `profile_photo` remains regulated evidence. Updating the visible avatar never replaces, supersedes, unlocks, or changes approved verification evidence.

Extend the existing profile-photo upload pipeline for the client-authorized display-avatar endpoint. Accept only JPEG and PNG files whose extension, declared MIME type, and decoded file signature agree, and reject empty files or files larger than the existing 3 MB project limit. Generate the storage object path on the server, retain the previous avatar on validation or storage failure, and update only `profiles.avatar_url` after upload succeeds.

### Verification section

Mount the existing `ClientVerificationDashboard` without duplicating its API calls, evidence state, protected legal name, upload rules, or submission logic.

Normalize legacy `?tab=verification` destinations to `?tab=profile&section=verification` with `replace: true`. Update new client verification notification fallbacks and action URLs to the new destination while continuing to accept old stored URLs.

## Protected Client Full Name

### Trust rule

The protection threshold is client verification state:

- `draft`: a valid full-name edit applies immediately.
- `rejected`: a valid full-name edit applies immediately.
- `pending_review`: a different full name creates an admin request.
- `approved`: a different full name creates an admin request.

Submitting a protected request does not change `profiles.full_name`, the session summary, verification evidence, client tier, or `verifiedBusinessName`.

### `client_name_change_requests`

Create one auditable request record containing:

- `id`
- `client_id`
- `current_full_name`
- `requested_full_name`
- `request_reason`
- `status`: `pending`, `approved`, `rejected`, or `cancelled`
- `decision_reason`
- `reviewed_at`
- `reviewed_by`
- `created_at`
- `updated_at`

A partial unique index permits at most one `pending` request per client. The requested name follows the Account full-name rules. A protected request requires a trimmed explanation of 1 to 1,000 characters. Empty, control-character, unchanged, or oversized requested names are rejected before persistence. Rejection requires a client-visible decision reason of 1 to 1,000 characters; an optional approval note has the same maximum.

### Audit events

Create `client_name_change_events` with request, client, actor, event type, safe reason, and timestamp. Supported events are request creation, approval, rejection, and cancellation. The event references the request rather than duplicating full-name values in arbitrary metadata.

### Database enforcement

Enable RLS on both new public-schema tables. Direct `anon` and `authenticated` mutations are revoked. The application reads and mutates records through authenticated server endpoints using narrowly scoped service-role access. Explicitly grant only the privileges required by the service role.

Add a database guard that rejects a client `profiles.full_name` change while verification is `pending_review` or `approved` unless the update occurs inside the service-only approval operation. The guard applies even if a client attempts to bypass the UI and call the Data API directly.

The profile-save and decision operations are atomic, security-definer functions owned by a non-login database owner and callable only by the server with `service_role`. Revoke execution from `PUBLIC`, `anon`, and `authenticated`, grant it only to `service_role`, set a fixed search path, and schema-qualify referenced objects. The decision function locks the pending request and rechecks:

- Request status is still `pending`.
- The target profile still belongs to a client.
- The stored current name still matches the profile name.
- Verification still requires protection.
- The reviewer is an authenticated PB Finance admin at the API boundary.

Approval updates `profiles.full_name`, the request decision fields, and the audit event in one transaction. Rejection updates only the request and audit event. Both outcomes notify the client after the transaction commits.

### Verification-state changes

If verification becomes `draft` or `rejected` through rejection or reset while a protected name request is pending, the same trusted verification transition cancels that request and writes a cancellation event. The client may then edit directly under the approved rule. A stale admin decision receives `409` and cannot change the name.

### Client-facing status

While a name request is pending, Account shows:

- The current active name.
- The requested name.
- Request date.
- `Awaiting PB Finance approval` status.

Approval refreshes the session summary and displays the new name. Rejection preserves the current name and displays the client-visible decision reason. `GET /client/me` returns both the current pending request, when present, and the most recent decided or cancelled request so rejection feedback survives navigation and reload; a newer request supersedes the older status card.

## Client Profile API

Add focused client endpoints:

- `GET /client/me`: safe client account summary, verification summary, current pending name request, and most recent decided or cancelled name request.
- `PATCH /client/me`: save validated account fields or create a protected name request according to verification state.
- `POST /client/profile-photo`: upload and save a validated display avatar without touching verification evidence.

The PATCH response identifies whether the name was `unchanged`, `updated`, or `pending_approval` and returns the canonical session-summary fields. Company updates, permitted immediate name updates, pending-request creation, and the associated audit event use the service-only transactional profile-save operation, so a failed write cannot leave display records partially synchronized.

The client cannot send email, role, tier, verification state, reviewer fields, `verifiedBusinessName`, storage paths, audit fields, or decision state.

## Admin Review Experience

Extend the existing Client Verifications admin destination with a `Name changes` view and pending count. Each request displays:

- Current full name.
- Requested full name.
- Client email and display company for context.
- Verification state.
- Request reason and submission time.

Admins may approve or reject. Rejection requires a client-visible reason. Approval remains disabled for stale or cancelled requests. The API performs the final authorization and state rechecks; disabled UI controls are not treated as security boundaries.

## Professional Portal Integration

The professional account menu opens the existing `profile` destination. The capsule shows:

- Professional name.
- Company or organization when available.
- Otherwise, the approved professional title or `Independent professional` fallback.
- Unverified or Verified account type.

The professional menu does not show AI Matchmaker. Professional name and other approved-profile changes continue through the existing `pending_profile` and admin-review flow. The change does not create a second professional name-request system.

## Role-Specific Guides

Use a shared guide modal shell and role-specific step configuration. Each step exposes a real destination callback and a status-aware explanation.

### Client Guide v2

1. Profile and verification.
2. Discover talent.
3. Shortlist.
4. Interview.
5. Contracts and billing.

Basic clients see what verification unlocks for gated steps instead of being told those actions are already available. Available steps navigate directly to the corresponding tab or profile section. The guide continues to personalize its heading with the client name.

Use a new versioned per-user storage key so existing clients see the improved guide once. The account menu always provides a manual reopen action.

### Professional Guide v1

1. Complete profile.
2. Identity verification.
3. Credentials.
4. Admin review.
5. Opportunities.
6. Timesheets and earnings.

Unverified professionals receive onboarding and approval guidance. Verified professionals receive ongoing profile, opportunity, and earnings guidance. Each available action opens the existing profile, opportunity, or earnings destination. Show the guide once per professional using a per-user versioned storage key and keep it reopenable from the account menu.

## Error Handling

- Invalid or missing fields produce field-specific messages and do not mutate stored data.
- A failed profile save retains the local draft so the user can retry.
- Avatar type, signature, size, and storage errors leave the previous avatar unchanged.
- A second protected name request returns `409` with the current pending request.
- Stale, already-decided, cancelled, mismatched-current-name, or no-longer-protected decisions return `409` without partial updates.
- Admin rejection requires a non-empty client-visible reason.
- Database and audit writes for a decision are atomic.
- In-app, email, and push notification failures are best effort after commit and do not roll back a valid profile update or decision.
- Notification-panel errors remain inside the panel with a retry action and do not close the account disclosure.

## Accessibility

- The trigger exposes an accessible name, `aria-expanded`, and `aria-controls`.
- The disclosure is reachable and operable by keyboard, mouse, and touch.
- Escape closes and restores focus.
- Focus never enters hidden content.
- Every action retains a minimum 44 px touch target and visible focus ring.
- The notification subview has a labelled heading and Back action.
- Unread counts have accessible text, not color-only meaning.
- Avatar images use a meaningful account-name alt value; initials are hidden from assistive technology when the trigger label already names the account.
- Motion respects the global reduced-motion preference.
- Light and dark states use approved semantic token pairings and WCAG AA contrast contracts.

## Testing Strategy

Implementation follows test-first development.

### Account disclosure unit and render contracts

- Pointer enter opens and pointer re-entry cancels delayed close.
- Pointer leave closes after the 180 ms grace period.
- Click or touch pinning is independent of hover preview.
- Coarse pointers do not start hover preview, and a touch followed by compatibility mouse events toggles only once.
- Escape and outside interaction close correctly.
- Focus opens, stays open within the panel, and returns to the trigger on Escape.
- Reduced-motion state removes movement.
- SSR markup includes accessible trigger and panel relationships.
- Client and professional integrations render the correct role-specific actions exactly once.
- Capsule and dropdown consume the same width contract.

Because the current project has no DOM interaction test framework, keep state transitions in a small pure helper or reducer that Node tests can exercise. Use existing static and SSR contracts for markup. Do not add a new browser-test dependency solely for this component unless the implementation cannot be verified otherwise.

### Client profile and name-protection tests

- GET returns only safe owner fields and the owner's pending request.
- PATCH validates name and company boundaries.
- Draft and rejected name edits apply directly.
- Pending-review and approved name edits create a request and leave the active name unchanged.
- Unchanged names do not create requests.
- Duplicate pending requests return `409`.
- Protected requests require and preserve a valid client explanation.
- GET restores the pending request and latest decided or cancelled status, including a rejection reason.
- Clients cannot submit protected or admin-owned fields.
- Company save keeps the canonical display records synchronized.
- Avatar upload does not mutate verification evidence.
- Direct owner attempts to change a protected name fail at the database boundary.
- Approval atomically updates the name, request, and event.
- Rejection preserves the active name and stores the decision reason.
- Verification reset or rejection cancels a pending request.
- Stale decisions cannot update a profile.
- Approval-notification and window-focus recovery refresh the active client session summary.
- New request tables have RLS and explicit grants, and privileged functions are not executable by `PUBLIC`, `anon`, or `authenticated`.

### Routing and guide tests

- `?tab=profile` opens Client Account.
- `?tab=profile&section=verification` opens the existing verification component.
- Legacy `?tab=verification` normalizes without losing notification navigation.
- Client guide steps match permissions and route correctly.
- Professional guide steps match verification status and route correctly.
- Professional pending-profile values never replace active capsule identity before approval; approval and focus recovery refresh the safe summary.
- Versioned first-run keys are per user and manual reopen remains available.

### Completion verification

Run:

- Focused account-menu, UI primitive, client verification, professional onboarding, responsive layout, guide, and design-system tests.
- Full `npm test`.
- `npm run lint`.
- `npm run build`.
- Backend import check.
- Available schema, RLS, grant, and security tests.

Perform browser checks for both portals at 320 px, 390 px, 768 px, and desktop widths in light and dark modes. Exercise mouse hover at every capsule edge, pointer movement into the dropdown, click pinning, outside dismissal, keyboard-only navigation, Escape focus restoration, touch toggling, notification subview/back behavior, long identity text, reduced motion, profile save refresh, guide navigation, and old verification notification links. Confirm no horizontal overflow, overlap, flicker, console error, or inaccessible hidden focus target.

## Out of Scope

- Redesigning the Admin dashboard header.
- A generic approval engine shared between clients and professionals.
- Automated OCR, legal-name matching, or third-party identity verification.
- Allowing users to edit account email, role, tier, verification decisions, or `verifiedBusinessName`.
- Replacing the existing client or professional portal shell and workspace navigation.
- Treating the display avatar as verification evidence.
- Adding company registration requirements for professionals who operate independently.

## Acceptance Criteria

1. Client and professional headers show only the account avatar at the top right.
2. Hover, focus, click, touch, Escape, outside dismissal, and edge movement behave without flicker.
3. Expanded identity and dropdown use matching widths, aligned edges, semantic colors, proper icons, and responsive bounds.
4. All approved role-specific actions remain reachable through the account menu.
5. Client Profile edits display company and avatar, embeds the existing verification workflow, and updates the header summary immediately.
6. Draft or rejected clients can change full name directly; pending or approved clients create an auditable admin request without changing the active name.
7. Database enforcement prevents direct protected-name changes, and admin decisions are authorized, atomic, and stale-safe.
8. Existing professional profile and verification workflows remain intact while gaining the shared account menu and professional guide.
9. Client and professional guides are status-aware, actionable, first-run once per version, and manually reopenable.
10. Focused tests, full tests, lint, build, schema/security checks, and the browser verification matrix pass.
