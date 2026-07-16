# Responsive Layout Integrity and Plain Eyebrow Design

## Context

The Client Verification dashboard currently allows the **Proof of business** upload card to overlap the following **Legal name handling** card. The shared `FileDropzone` root forces `h-full`, while the business-proof grid item also contains an accepted-document selector above the dropzone. CSS Grid stretches the wrapper to the row height, then the full-height dropzone adds its own sibling height and escapes the wrapper. At the reported 1841 x 694 viewport, the audited intersection is 92 px. The same sizing contract also affects professional identity and document-upload layouts.

A broader responsive audit found three additional viewport failures: the Client AI Matchmaker panel clips below 464 px width, the Admin header can overflow with a long email address, and the public mobile navigation clips actions on short screens.

The visual audit also found 14 decorative eyebrow labels using pill borders, backgrounds, padding, shadows, or icons. These are section-introduction text, not statuses. The existing PB Finance design contract already reserves fully rounded pills for discrete state, so these labels should become plain text while genuine status badges remain unchanged.

## Goals

1. Eliminate the reported Client Verification overlap and matching professional upload-card intersections at every supported viewport.
2. Correct the three additional confirmed responsive clipping and overflow cases.
3. Convert all decorative eyebrow labels to plain text without changing their wording, font size, color, visibility, or meaning.
4. Keep semantic status badges such as **Ready**, **Required**, **Verified**, review states, tier states, and upload states visually distinct and functionally unchanged.
5. Preserve every existing upload, verification, profile, navigation, authentication, and admin-review behavior.
6. Add regression coverage for the shared sizing and eyebrow presentation contracts, then verify actual browser geometry across desktop, tablet, mobile, and short-landscape viewports.

## Non-goals

- No backend, database, Supabase, Stripe, authentication, permission, or protected `verifiedBusinessName` changes.
- No changes to accepted document types, file-size limits, expiration rules, document locking, review states, or notification behavior.
- No global removal of borders, icons, pills, cards, buttons, filters, toggles, or status badges.
- No broad page redesign or replacement of the established PB Finance signature palette and typography.

## Design boundaries

### Semantic states remain pills

`StatusBadge` remains unchanged. It continues to represent document status, verification status, tier state, requirement state, readiness, and other discrete backend-driven states. Functional filter chips, notification counts, switches, buttons, and preview status labels are also excluded from the eyebrow cleanup.

### Decorative eyebrows become plain text

Decorative eyebrows are noninteractive labels positioned immediately before the heading they introduce. They will use a shared text-only `Eyebrow` primitive with:

- `children` for the exact existing copy;
- an `as` prop for the appropriate text element;
- a `className` pass-through for existing typography, color, visibility, alignment, and spacing;
- no icon slot and no default border, radius, background, padding, shadow, or backdrop treatment.

Each label remains visually associated with its heading. Centered sections keep centered eyebrows; left-aligned sections keep left alignment; the mobile-only FAQ label keeps its current responsive visibility. Margins may be reduced after pill padding is removed so the label-to-heading relationship remains intentional.

## Layout architecture

### Intrinsic upload-card height

The shared `FileDropzone` surface will use intrinsic content height instead of unconditional `h-full`. Mixed-content workflow wrappers must measure all of their children rather than allowing the dropzone to consume the wrapper's already-stretched height.

Affected client and professional upload grids will also align mixed-height items at the start where appropriate. This prevents wrapper stretching from becoming an implicit sizing dependency and keeps selector fields, expiration fields, request buttons, helper text, and dropzones in normal document flow.

No current upload flow requires a stretch mode. A future opt-in stretch prop will only be introduced if a real sole-child equal-height use case is identified; it is not part of this change.

### Small-screen overlays and navigation

- **Client AI Matchmaker:** use viewport-aware horizontal insets and width on small screens, retain the 400 px desktop panel, and cap height against `100dvh` so the header, conversation, and input remain reachable.
- **Admin header:** allow the identity/control row to wrap, give text containers `min-width: 0`, truncate the email when necessary, and keep every account control within the viewport.
- **Public mobile navigation:** cap the open menu height below the fixed header, enable internal vertical scrolling and overscroll containment, and keep the login action keyboard- and touch-reachable on short screens.

## Decorative eyebrow inventory

The following 14 labels are in scope:

### Public

1. `Savings Calculator`
2. `Redefining Global Finance Outsourcing`
3. `Process`
4. `FAQ`
5. `Talent Directory Preview`
6. `Enterprise Finance Delivery`
7. `Pod Design Preview`
8. `Engagement Models`
9. `Pricing`

### Client

10. Dynamic `Client guide` text, including the existing user-name suffix
11. `Client trust center`

### Professional

12. `Professional onboarding`
13. `Verification`

### Admin

14. `PB Finance admins only`

The decorative `Sparkles`, `Star`, `IdCard`, and section-label `ShieldCheck` instances will be removed where they serve only these eyebrows. Imports that remain used by real controls or statuses will be retained.

## Responsive fixes in scope

1. Client Verification business-proof selector and dropzone versus the following legal-name/submit card.
2. Professional identity upload rows containing expiration fields, dropzones, and change/removal actions.
3. Professional optional-document rows containing selectors, actions, dropzones, and supporting text.
4. Client AI Matchmaker panel on narrow phones.
5. Admin header with long identity text on narrow phones.
6. Public mobile navigation on short viewports.

The professional credential upload wrapper will be rechecked even though its intermediate auto-height container currently avoids the confirmed intersection.

## Accessibility and behavior preservation

- Eyebrows remain ordinary noninteractive text and stay adjacent to their associated headings in DOM order.
- Decorative icons removed from eyebrows carried no unique accessible information.
- Status text continues using the existing live-region and badge semantics.
- Upload inputs retain labels, descriptions, drag-and-drop behavior, locking, busy states, rejection feedback, open actions, and change/removal actions.
- Mobile overlays and menus retain visible focus, keyboard access, touch targets, and Escape/outside-click behavior already provided by their existing controls.
- No route, callback, API call, payload, or permission gate changes.

## Testing strategy

### TDD regression contracts

Before implementation, add failing tests that prove:

1. The shared `FileDropzone` root does not force `h-full`.
2. Every inventoried eyebrow preserves its exact copy while using the text-only presentation contract.
3. Eyebrow markup contains no decorative icon, pill radius, border, background, pill padding, shadow, or backdrop treatment.
4. `StatusBadge` remains present for actual status and tier use cases.
5. The Matchmaker panel uses a viewport-safe mobile width.
6. The Admin header exposes wrapping and truncation/min-width protections.
7. The public mobile menu exposes a viewport height cap and internal scrolling.

Existing client-verification, professional-onboarding, file-dropzone, public-design-system, permission, API, and protected-business-name tests remain part of the regression suite.

### Browser geometry verification

Verify rendered bounding boxes and horizontal overflow at these representative sizes:

- 1841 x 694, matching the reported Client Verification screenshot;
- 1440 x 900 and 1280 x 720 desktop;
- 1024 x 768 and 768 x 1024 tablet;
- 767 x 900 breakpoint boundary;
- 390 x 844 mobile;
- 320 x 568 compact mobile;
- 390 x 360 short landscape-like viewport.

The browser audit will cover public Home, Directory, Enterprise, and Pricing; Client Verification and Matchmaker; Professional identity and credential uploads; and the Admin header/review surface. Assertions include:

- no sibling bounding-box intersections;
- document and body scroll width never exceeds the viewport unintentionally;
- fixed panels and open menus stay inside the viewport;
- all eyebrow text remains visible and aligned with its target heading;
- no Vite error overlay, page errors, or console errors.

## Acceptance criteria

1. The Proof of business card never covers the legal-name explanation or submit action.
2. Professional identity and optional-document upload rows never cover adjacent cards, controls, or grid rows.
3. The Matchmaker, Admin header, and public mobile menu remain fully reachable at the audited small viewports.
4. All 14 decorative eyebrows have no container shape, border, background, shadow, pill padding, or icon.
5. Exact eyebrow text, text size, color, responsive visibility, and section meaning are preserved.
6. Genuine state badges remain styled as badges.
7. Focused regression tests, the full test suite, lint, and production build pass.
8. Browser geometry and console checks pass across the specified viewport matrix.
