# PB Finance Tier, Onboarding, and Verification UI Design

**Status:** Approved for implementation planning

**Date:** 2026-07-15

**Scope:** User-tier presentation, Professional Onboarding and Profile Setup, Client Verification, and the shared UI primitives used by those surfaces

## Context

PB Finance already has working client and professional verification flows, tier-aware permissions, document locking, profile editing, and manual admin review. The frontend currently expresses those capabilities with repeated hard-coded Tailwind classes and several separate modal, form, upload, card, badge, and button patterns. The result is functional but visually inconsistent, difficult to maintain, and less polished than the trust-sensitive workflows require.

The redesign will introduce a restrained institutional-fintech system: deep navy foundations, controlled blue and cyan accents, warm neutral surfaces, semantic status colors, medium radii, fine borders, and modest elevation. The experience should communicate security and clarity without looking sterile, playful, or overly decorative.

## Goals

1. Establish one CSS-first Tailwind v4 design system for color, typography, spacing, radii, elevation, focus, and motion.
2. Replace repeated form, button, card, upload, toggle, badge, progress, feedback, and modal styles with reusable UI primitives.
3. Make the Client Verification flow read as a guided four-requirement trust workflow.
4. Make Professional Onboarding and Profile Setup easier to scan, complete, and understand at every approval state.
5. Make client and professional tier state visible and consistent without creating a redundant tier-management screen.
6. Improve responsive behavior, keyboard access, error feedback, dark mode, and reduced-motion behavior.
7. Preserve all existing verification rules, document requirements, locking behavior, tier permissions, backend calls, and protected business-name handling.

## Non-goals

- No new admin-facing tier-management product will be created.
- No verification, upload, approval, expiration, notification, or payment business logic will change.
- No backend routes, database schema, storage policy, or Stripe integration will change.
- No public marketing-page redesign is included.
- No new component framework will be installed. The design will use the existing React, Tailwind CSS, Framer Motion, and Lucide stack.
- No fake upload percentage will be shown because the current API does not report byte-level progress.

## Chosen approach

The implementation will use semantic CSS-first tokens in `src/index.css`, small reusable React primitives under `src/components/ui`, and focused composition components for the client and professional workflows. Existing pages will consume these primitives while retaining their current state and API integration.

This is preferable to a page-by-page restyle because the current inconsistency comes from duplicated visual decisions. It is also preferable to adopting a third-party UI kit because PB Finance already has the necessary dependencies and needs a compact, product-specific system rather than another abstraction layer.

## Visual system

### Color

The palette will use semantic roles rather than page-specific color literals:

- `brand`: primary PB Finance action and selected states; a confident mid-to-deep blue.
- `accent`: sparingly used cyan for emphasis, focus detail, and verified highlights.
- `canvas`: application background with a subtle cool neutral tint.
- `surface`: primary card and modal background.
- `surface-muted`: secondary regions, inset sections, and disabled controls.
- `ink`, `ink-muted`, and `ink-subtle`: content hierarchy.
- `border` and `border-strong`: default and emphasized dividers.
- `success`, `warning`, `danger`, and `info`: semantic workflow states with matching soft backgrounds and borders.

Dark mode will preserve the same semantic relationships instead of mechanically inverting colors. Cards will be slightly lighter than the canvas, borders will remain visible without glowing, and status colors will retain sufficient contrast.

### Typography

Outfit remains the product typeface. The system will define a compact scale for labels and metadata, a readable body scale, and a restrained heading scale. Weight will carry hierarchy, but routine body copy will move away from pervasive extra-bold styling. Uppercase tracking is reserved for short eyebrow labels and status metadata.

### Geometry and elevation

- Controls: medium radius, visually compact, and at least 44px high.
- Cards: medium-to-large radius with thin borders and low elevation.
- Modals: large radius on desktop and reduced radius or edge-to-edge treatment on small screens.
- Pills and status badges: fully rounded only when the shape communicates a discrete state.
- Shadows: clean, low-opacity navy shadows. Heavy glow effects are not part of the core system.

### Motion

The system will define one fluid easing curve and consistent short/medium durations. Hover interactions may lift a card or button by one pixel; active states return it to rest and slightly compress the element. Modal overlays fade while panels fade and translate upward a short distance. All nonessential transforms and animations will be disabled or reduced under `prefers-reduced-motion`.

## Shared component architecture

### Button

The existing `Button` component will become the canonical action primitive. It will support primary, secondary, outline, ghost, and danger variants; small, medium, and large sizes; leading icons; loading state; disabled state; and full-width layout. Keyboard focus will use `focus-visible`, not a permanent focus ring. Hover and active effects will be subtle and disabled while busy.

### Form controls

Shared field styling will cover text inputs, textareas, selects, and date inputs. A field composition will support label, optional/required metadata, hint text, inline error text, disabled/read-only states, and stable spacing. Errors will set `aria-invalid`, connect help text with `aria-describedby`, and use both icon/text and color.

### FileDropzone

One accessible drop-zone component will power client and professional document uploads. It will:

- Accept files from click, keyboard activation, or drag and drop.
- Route drop and file-input selection through the same validation callback.
- Display accepted file types and the existing size limit for each document.
- Present distinct empty, drag-active, validating, uploading, uploaded, rejected, locked, disabled, and error states.
- Show the current filename, size, status, expiration date where applicable, and the relevant open/replace/request-change action.
- Remain fully usable on touch devices where drag and drop is unavailable.
- Use an indeterminate spinner and “Uploading securely” copy instead of fabricated progress.

Each document remains a separate file input. The professional PRC, BOA, tax, identity, liveness, resume, and other document rules will not be collapsed into “OR” logic.

### SurfaceCard, StatusBadge, ProgressSummary, and FeedbackBanner

These small presentation primitives will establish consistent card structure, tier/document status display, completion summaries, and success/error notices. Status components will map existing backend values to semantic labels and styles in one place while preserving the underlying value.

### SegmentedControl

Tier preview and binary display controls will use a keyboard-accessible segmented control. It will have a clear selected segment, hover and active states, and an accessible group label. It will not change permissions; it only selects the existing preview mode.

### Modal

The duplicated `PortalModal` implementations will be replaced by one shared modal primitive. It will provide:

- A fixed, blurred overlay and an elevated panel.
- Framer Motion overlay/panel transitions using `AnimatePresence`.
- `role="dialog"`, `aria-modal="true"`, and an accessible title.
- Initial focus, Tab/Shift+Tab focus containment, Escape dismissal, backdrop dismissal, focus restoration, and body scroll locking.
- Sticky header and action footer where long forms require them.
- Default and wide sizes, a mobile bottom-sheet-like layout, and a reduced-motion fallback.

Destructive or consequential forms will not close from an accidental click inside the panel. Busy forms will prevent duplicate submission.

## User-tier presentation

There is no standalone User Tiers page. Tier information is currently expressed through permission objects, navigation access, status copy, and the professional “View Profile As” feature. The redesign will keep that architecture and improve only the visible tier surfaces.

- Client tiers will display the backend-provided Basic or Verified label consistently in the client shell and relevant verification/status areas.
- Professional tiers will display the backend-provided Unverified, Basic, or Verified label where available. No frontend-only tier will be invented.
- Tier badges will use the shared status system rather than custom per-page pills.
- Locked navigation or actions will continue to be driven by current permission checks.
- “View Profile As” becomes a segmented Basic Client / Verified Client control with a concise explanation of what each audience can see.
- Preview content continues to come from `backendApi.talent.getProfilePreview`; the frontend must not infer document visibility.

## Client dashboard and verification flow

The client shell will gain a calmer responsive workspace, consistent horizontal gutters, a clearer active navigation state, and a visible tier badge near the account identity. The restyle will not change which tabs a tier may access.

Client Verification will be organized as follows:

1. A page header containing the trust-center label, title, short explanation, status badge, and “N of 4 ready” progress summary.
2. A compact status panel for draft, pending review, rejected, or approved state. Admin notes and `verifiedBusinessName` remain prominent and read-only.
3. A responsive two-column requirement grid for Valid ID, Liveness Selfie, Profile Picture, and Proof of Business.
4. Each requirement card uses the shared drop zone and clearly shows document guidance, current status, rejection reason, file metadata, and available action.
5. Proof of Business retains the exact accepted choices: US EIN Letter (CP575), State Business Registration, or EU VAT Certificate. The type selector sits above the drop area and locks with the document.
6. A final review band explains legal-name handling and contains the submission action. The action remains disabled until the backend reports `canSubmit`.

Errors that apply to one upload appear inside that requirement card; page/network errors and successful submissions appear in a live feedback banner near the top. Pending-review and approved documents remain locked.

## Professional dashboard and onboarding flow

The professional shell will use the same canvas, navigation, gutters, tier status, and content-width rules as the client shell while retaining professional-specific navigation and permissions.

The dashboard header will group account status, approval requirements, completion progress, tier-preview control, and the primary next action. Profile content will use generous card spacing and clearer separation between personal profile, availability/rates, skills/tools, identity, and regulated credentials.

Professional Onboarding will keep the existing data and behavior but improve information architecture:

- Identity Verification contains Valid ID front, optional ID back, and Liveness Selfie as distinct requirements.
- Valid ID expiration inputs remain attached to their corresponding files.
- Resume remains a separate required upload.
- Required Regulatory Inputs remain a dedicated section when the mapped professional title requires them.
- PRC licenses, BOA accreditations, tax certifications, and mapped certification requirements remain separate upload cards with their own expiration dates and approval state.
- Other Documents remain visually secondary and do not appear to block approval.
- Approved documents display a locked state and expose Request Change/Removal rather than Replace.
- Expired or soon-expiring documents use the shared warning/danger presentation without changing existing cron or downgrade behavior.

The page will use responsive one-, two-, or three-column grids according to available width. Section descriptions will explain why a document is needed and what blocks approval without repeating the same long paragraph in every card.

## Profile Settings modal

Profile Settings will use the shared wide modal and a structured layout:

- The desktop layout uses a narrow profile-photo panel and a wider form column; mobile stacks them.
- The photo zone includes the existing guidance for proper attire, neutral background, and professional pose.
- Bio, rates, titles, skills, tools, work preferences, availability, experience, and location use the shared field system.
- Related fields are grouped under short section headings rather than presented as one uninterrupted list.
- The footer remains visible while scrolling and contains Cancel and Save Profile actions.
- Save errors appear in an `aria-live` summary and next to the affected field where the frontend can identify it.
- The modal never expands inline inside the dashboard.

## Document Change/Removal modal

Identity and credential change requests will share one presentation pattern while preserving their existing submit handlers and payloads.

- The header identifies the locked document and uses a warning status, not a destructive red treatment.
- A select provides the existing predefined reasons.
- The custom explanation field appears when the chosen reason requires it and remains available as supporting context where currently permitted.
- The modal explains that the document stays approved and locked until an admin reviews the request.
- The sticky footer contains Cancel and Submit Request. Submission errors remain in the modal.
- The pending-request state disables duplicate requests and communicates that admin review is in progress.

## Responsive and accessibility behavior

- Target breakpoints follow the existing Tailwind responsive model, with mobile-first single-column layouts.
- Dashboard content stays within a consistent maximum width while using fluid gutters.
- Navigation remains horizontally scrollable on narrow screens without hiding active state.
- All interactive targets are at least 44px where layout permits.
- Icons that do not convey unique meaning are hidden from assistive technology; meaningful icon-only controls receive labels.
- Status is never communicated by color alone.
- Focus styles are high-contrast and visible only for keyboard-style focus.
- Feedback uses polite or assertive live regions according to severity.
- Light mode, dark mode, keyboard-only use, 320px mobile width, tablet, desktop, 200% zoom, and reduced motion are explicit verification targets.

## Data flow and state boundaries

The redesign does not introduce a new state-management layer.

- Existing page components continue to own server-resource and form state.
- Shared UI components receive serializable presentation props and emit user intent through callbacks.
- Upload validation remains in the workflow/domain layer; `FileDropzone` displays validation results and does not know business rules.
- Tier and permission decisions remain backend-driven.
- `verifiedBusinessName` remains read-only, is rendered exactly as returned, and is not copied into editable client form state.
- Modal open/close state stays in the owning workflow. The shared modal manages only interaction mechanics such as focus and scroll locking.

This boundary keeps presentation reusable without hiding domain rules inside generic components.

## Error and loading handling

- Upload validation errors appear before any API call.
- Upload, submit, preview, and profile-save requests show an in-context busy state and prevent duplicate actions.
- A failed request preserves the user's form values and uploaded-document context.
- Rejection reasons remain attached to the affected document.
- Disabled actions include nearby explanatory copy when the reason is not obvious.
- Empty, loading, failed, partially complete, submitted, approved, rejected, locked, pending-change, expiring, and expired states will all have intentional presentations.

## Test and verification strategy

Implementation will follow test-first increments using the repository's existing `node --test` suite.

1. Add or update source-contract tests for semantic design tokens and shared component usage.
2. Add pure-function tests for status/tier presentation mappings and upload-state derivation where logic is extracted.
3. Extend Client Verification UI tests for all four distinct requirements, accepted business-document types, drag/drop semantics, locked states, feedback semantics, and the protected legal business name.
4. Extend Professional Onboarding UI tests for distinct identity/credential uploads, expiration inputs, locked-change actions, tier-preview control, and modal composition.
5. Run the focused verification tests, then the complete test suite, ESLint, and production build.
6. Start the Vite development server and verify the client and professional flows in a browser at mobile, tablet, and desktop sizes.
7. Check keyboard navigation, focus return, Escape/backdrop behavior, drag/drop and click upload paths, dark mode, reduced motion, console errors, and obvious visual regressions.

## Expected file boundaries

The exact implementation plan may refine names, but the intended boundaries are:

- `src/index.css`: semantic Tailwind theme tokens, base styles, and shared motion utilities.
- `src/components/ui/Button.jsx`: canonical action component.
- `src/components/ui/Modal.jsx`: accessible animated portal modal.
- `src/components/ui/FormField.jsx`: field structure and shared form-control styling.
- `src/components/ui/FileDropzone.jsx`: accessible upload interaction and visual states.
- `src/components/ui/StatusBadge.jsx`: tier and workflow status presentation.
- `src/components/ui/SurfaceCard.jsx`: consistent card composition.
- `src/components/ui/SegmentedControl.jsx`: tier-preview control.
- `src/components/ClientVerificationDashboard.jsx`: client workflow composition.
- `src/pages/ProfessionalPages.jsx`: professional workflow integration, with focused extraction if needed to prevent further growth of the already-large page file.
- `src/pages/ClientPages.jsx`: client-shell integration.
- Existing tests under `tests/`: design-system and workflow coverage.

## Acceptance criteria

- The target client and professional surfaces visibly share one design language in both themes.
- No target workflow uses a bespoke modal, upload button, form-control style, tier toggle, or status badge when the shared primitive applies.
- All required client and professional documents remain distinct and obey their current rules.
- Drag-and-drop and click/keyboard upload paths produce the same validation and upload behavior.
- Profile Settings and both document-change request flows use the shared animated modal.
- Client and professional layouts remain usable from 320px mobile width through large desktop widths.
- Tier labels and visibility remain driven by existing backend data and permissions.
- `verifiedBusinessName` remains exact, protected, read-only, and visible in the approved client state.
- The complete test suite, ESLint, production build, and browser verification pass before the branch is considered complete.
