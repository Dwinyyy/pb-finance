# PB Finance Signature UI System and Core Surface Refresh

**Status:** Revised; awaiting user review for implementation planning

**Date:** 2026-07-15

**Scope:** Signature color system, public landing pages, user-tier presentation, Professional Onboarding and Profile Setup, Client Verification, and the shared UI primitives used by those surfaces

## Context

PB Finance already has working public marketing pages, client and professional verification flows, tier-aware permissions, document locking, profile editing, and manual admin review. The frontend currently expresses those capabilities with repeated hard-coded Tailwind classes and several separate modal, form, upload, card, badge, and button patterns. The public Home, Directory, Enterprise, and Pricing views also mix slate, blue, cyan, violet, and emerald accents without a durable brand contract. The result is functional but visually inconsistent, difficult to maintain, and less polished than the trust-sensitive product requires.

The redesign will introduce a restrained institutional-fintech system: deep navy foundations, controlled blue and cyan accents, warm neutral surfaces, semantic status colors, medium radii, fine borders, and modest elevation. The experience should communicate security and clarity without looking sterile, playful, or overly decorative.

## Goals

1. Establish one CSS-first Tailwind v4 design system for color, typography, spacing, radii, elevation, focus, and motion.
2. Replace repeated form, button, card, upload, toggle, badge, progress, feedback, and modal styles with reusable UI primitives.
3. Make the Client Verification flow read as a guided four-requirement trust workflow.
4. Make Professional Onboarding and Profile Setup easier to scan, complete, and understand at every approval state.
5. Make client and professional tier state visible and consistent without creating a redundant tier-management screen.
6. Improve responsive behavior, keyboard access, error feedback, dark mode, and reduced-motion behavior.
7. Preserve all existing verification rules, document requirements, locking behavior, tier permissions, backend calls, and protected business-name handling.
8. Integrate five brand feelings—Trust & Security, Wealth & Growth, Innovation & Tech, Action & Highlights, and Clarity & Luxury—through intentional color placement rather than decorative color repetition.
9. Apply the same signature system to every existing public landing route: Home, Talent Directory preview, Enterprise/Agency, Pricing, shared navigation/footer, and the public not-found state.
10. Finalize and document named PB Finance signature colors, semantic aliases, dark-mode pairings, contrast rules, and future-use guidance so later UI work extends the system instead of inventing new colors.

## Non-goals

- No new admin-facing tier-management product will be created.
- No verification, upload, approval, expiration, notification, or payment business logic will change.
- No backend routes, database schema, storage policy, or Stripe integration will change.
- No new landing routes, marketing claims, pricing model, information architecture, or large copy rewrite will be introduced; existing public content and behavior will be restyled and recomposed only where needed for consistency and responsiveness.
- No unrelated authenticated pages will receive a full bespoke redesign. They may inherit global tokens and shared primitive improvements safely.
- No new component framework will be installed. The design will use the existing React, Tailwind CSS, Framer Motion, and Lucide stack.
- No separate logo-design project is included. The existing PB monogram may be expressed with the signature palette, and the default Vite-purple favicon will be replaced with a simple PB-branded favicon so no off-brand color remains in public chrome.
- No fake upload percentage will be shown because the current API does not report byte-level progress.

## Chosen approach

The implementation will use semantic CSS-first tokens in `src/index.css`, durable brand guidance under `docs/design-system`, small reusable React primitives under `src/components/ui`, and focused composition in the public, client, and professional workflows. Existing pages will consume these primitives while retaining their current state and API integration. The palette will be layered: premium neutral surfaces provide clarity, navy and blue establish trust, and tightly controlled growth, innovation, and action accents reinforce only the sections whose meaning they match.

The color architecture has two layers. Stable PB primitives (`pb-midnight`, `pb-cobalt`, `pb-emerald`, `pb-signal`, `pb-champagne`, `pb-pearl`, and `pb-ink`) preserve brand identity. Semantic aliases (`canvas`, `surface`, `text-primary`, `action`, `verified`, `processing`, `warning`, and `danger`) express component intent and change appropriately between light and dark themes. Pages consume the semantic layer; direct primitive use is limited to deliberate brand compositions documented in the signature guide.

This is preferable to a page-by-page restyle because the current inconsistency comes from duplicated visual decisions. It is also preferable to adopting a third-party UI kit because PB Finance already has the necessary dependencies and needs a compact, product-specific system rather than another abstraction layer.

## Visual system

### Color

The palette will use semantic roles rather than page-specific color literals. Its hierarchy follows a roughly 70/20/10 balance: premium neutral surfaces dominate, trust colors provide structure, and expressive accents remain scarce enough to feel meaningful.

| Feeling | Core color direction | Intended use |
| --- | --- | --- |
| Trust & Security | PB Midnight `#0B1F3A` | App chrome, verification headers, identity sections, lock states, and protected-data callouts |
| Wealth & Growth | PB Emerald `#047857` | Approved and completed states, positive progress, verified business identity, readiness, savings, and successful outcomes |
| Innovation & Tech | PB Signal Cyan `#0E7490` | Liveness, drag-active and processing states, preview technology, automation cues, and technical helper details |
| Action & Highlights | PB Cobalt `#2563EB` | Primary calls to action, selected navigation, focus rings, active controls, and upload initiation |
| Clarity & Luxury | PB Pearl `#F7F9FC`, PB Ink `#0A1628`, and PB Champagne `#A67C38` | Canvas, cards, modals, typography hierarchy, premium separators, restrained eyebrow details, and generous negative space |

These five expressive anchors plus Pearl and Ink are the finalized PB Finance signature palette. The similarly placed `#1D4ED8` becomes the strong/hover member of the Cobalt family rather than a competing “security blue.” Indigo is removed from the canonical palette because Signal Cyan already owns the Innovation & Tech role. Attention Amber and Danger Crimson remain functional colors, not signature colors.

### Signature color contract

The following token values are normative. They are the source values for Tailwind theme tokens, semantic aliases, documentation examples, and automated contrast checks.

| Token | Default | Soft | Strong | Contract |
| --- | --- | --- | --- | --- |
| `pb-midnight` | `#0B1F3A` | `#E8EEF5` | `#071426` | Dominant trust/security and dark brand foundation |
| `pb-cobalt` | `#2563EB` | `#DBEAFE` | `#1D4ED8` | Primary action, selection, link, and focus color |
| `pb-emerald` | `#047857` | `#D1FAE5` | `#065F46` | Verified, approved, complete, savings, and positive growth |
| `pb-signal` | `#0E7490` | `#CFFAFE` | `#155E75` | Innovation, liveness, processing, automation, and technical context |
| `pb-champagne` | `#A67C38` | `#F7EFD9` | `#805B2A` | Scarce premium detail, fine separators, and select eyebrow accents |
| `pb-pearl` | `#F7F9FC` | `#FFFFFF` | `#EEF3F8` | Clear, premium light canvas and surface hierarchy |
| `pb-ink` | `#0A1628` | `#526175` | `#050B14` | Primary and secondary content hierarchy |
| `attention` | `#B45309` | `#FEF3C7` | `#92400E` | Pending review, expiration attention, and consequential requests |
| `danger` | `#B42318` | `#FEE4E2` | `#912018` | Validation failure, rejection, expiration failure, and destructive actions |

PB Cobalt is the one signature family that exposes a complete numeric ramp because existing code consumes `primary-50` through `primary-950`. The compatibility alias is exact and deprecated for newly migrated code:

| Ramp token | Value | Compatibility alias |
| --- | --- | --- |
| `pb-cobalt-50` | `#EFF6FF` | `primary-50` |
| `pb-cobalt-100` | `#DBEAFE` | `primary-100` |
| `pb-cobalt-200` | `#BFDBFE` | `primary-200` |
| `pb-cobalt-300` | `#93C5FD` | `primary-300` |
| `pb-cobalt-400` | `#60A5FA` | `primary-400` |
| `pb-cobalt-500` | `#3B82F6` | `primary-500` |
| `pb-cobalt-600` | `#2563EB` | `primary-600` |
| `pb-cobalt-700` | `#1D4ED8` | `primary-700` |
| `pb-cobalt-800` | `#1E40AF` | `primary-800` |
| `pb-cobalt-900` | `#1E3A8A` | `primary-900` |
| `pb-cobalt-950` | `#172554` | `primary-950` |

The default semantic surface mappings are also fixed:

| Semantic role | Light theme | Dark theme |
| --- | --- | --- |
| `canvas` | `#F7F9FC` | `#07111F` |
| `surface` | `#FFFFFF` | `#0D1B2A` |
| `surface-muted` | `#EEF3F8` | `#13263A` |
| `text-primary` | `#0A1628` | `#F8FAFC` |
| `text-muted` | `#526175` | `#A8B4C4` |
| `border-subtle` | `#D9E2EC` | `#21364D` |
| `border-control` | `#7C8FA5` | `#526B86` |
| `action-fill` | `#2563EB` | `#2563EB` |
| `focus` | `#2563EB` | `#60A5FA` |
| `verified-fill` | `#047857` | `#047857` |
| `verified-accent` | `#047857` | `#34D399` |
| `processing-fill` | `#0E7490` | `#0E7490` |
| `processing-accent` | `#0E7490` | `#22D3EE` |
| `premium-detail` | `#A67C38` | `#D9BC78` |

Feedback surfaces use complete foreground/background/border triplets so pages do not invent one-off translucent stock colors:

| Semantic state | Light foreground / surface / border | Dark foreground / surface / border |
| --- | --- | --- |
| `info` | `#1D4ED8` / `#EFF6FF` / `#93C5FD` | `#93C5FD` / `#10284F` / `#2563EB` |
| `verified` | `#047857` / `#D1FAE5` / `#6EE7B7` | `#34D399` / `#0B2B22` / `#047857` |
| `processing` | `#0E7490` / `#CFFAFE` / `#67E8F9` | `#22D3EE` / `#082A33` / `#0E7490` |
| `warning` | `#92400E` / `#FEF3C7` / `#F59E0B` | `#FCD34D` / `#2B1D08` / `#B45309` |
| `danger` | `#912018` / `#FEE4E2` / `#F97066` | `#FDA29B` / `#2A1214` / `#B42318` |

These values are anchors, not a license to use raw hex codes in page components. `@theme` and semantic custom properties will expose the primitive signature families and aliases such as `canvas`, `surface`, `surface-muted`, `text-primary`, `text-muted`, `border-subtle`, `border-control`, `action`, `focus`, `info`, `verified`, `processing`, `warning`, and `danger`.

### Signature color governance

- `src/index.css` is the runtime source of truth. React components consume semantic utilities or shared primitives rather than raw brand hex values.
- `docs/design-system/pb-signature-colors.md` is the human-readable reference for future product, design, and engineering work. It records exact values, approved pairings, examples, prohibited uses, and dark-mode mappings.
- `AGENTS.md` will receive a short design-system rule directing future UI work to the canonical tokens and guide.
- Target JSX must not make independent status decisions with stock `slate`, `cyan`, `emerald`, `violet`, or `primary` classes when a semantic token exists.
- The existing `primary-*` family maps exactly to the documented Cobalt ramp for compatibility, but new and migrated target code uses the canonical semantic names.
- Stock Tailwind Slate, Cyan, Emerald, and other color namespaces will not be globally redefined. Target surfaces migrate deliberately so unrelated pages cannot change color semantics by accident.
- Palette changes require one intentional change set updating runtime tokens, documentation, token tests, contrast checks, and affected visual snapshots together.
- “Finalized” means canonical and governed for future work, not technically immutable when accessibility or product requirements justify a reviewed change.

Semantic safety takes precedence over brand expression:

- Emerald represents verified, approved, completed, or healthy progress. It will not decorate incomplete steps.
- Amber represents attention, upcoming expiration, pending review, or a consequential choice. It will not imply success.
- Red remains exclusive to rejection, invalid input, destructive action, or expired failure states.
- Signal Cyan communicates technology, activity, or preview behavior; it will not replace Emerald approval states.
- Champagne communicates premium restraint through thin details and small highlights. It will never become a low-contrast body-text color or imply a paid tier that does not exist.
- Amber and champagne anchors will use dark ink when they appear on filled surfaces; they will not be paired with white body text at insufficient contrast.
- Bright dark-mode accents (`#60A5FA`, `#34D399`, `#22D3EE`, and `#D9BC78`) are for focus rings, text, icons, borders, or soft surfaces. Filled controls keep the darker Cobalt, Emerald, or Signal anchors with white text, or pair a bright fill with PB Ink after a verified contrast check.
- `border-subtle` is decorative; form boundaries, focus structure, and meaningful graphical separators use `border-control`, which is selected to clear a 3:1 non-text contrast target against its paired surface.

Dark mode will preserve the same semantic relationships instead of mechanically inverting colors. The canvas will use a deep blue-black, cards will be slightly lighter, borders will remain visible without glowing, and expressive colors will be desaturated enough to avoid neon visual noise. Text and control combinations must meet WCAG AA contrast.

### Color choreography by workflow

- **Client Verification:** Trust navy anchors the page and identity requirements; innovation cyan marks liveness and active upload processing; growth emerald appears only as evidence becomes complete or approved; action cobalt owns the final submit action; pearl surfaces and restrained champagne details keep the experience clear and premium.
- **Professional Onboarding:** Trust colors frame identity and regulated credentials; innovation colors distinguish liveness, automation, and file-processing moments; growth colors show completion and verified standing; amber draws attention to missing or expiring evidence; premium neutrals keep dense document sections calm.
- **Tier presentation:** Basic and unverified tiers use clear neutral styling, verified tiers use growth emerald supported by a subtle trust-blue edge, and preview controls use action/innovation colors without suggesting that preview mode changes the account tier.
- **Profile Settings:** Clarity and luxury dominate through pearl surfaces, ink typography, spacious grouping, and a fine champagne divider. Cobalt appears only on Save; growth appears only after a successful save.
- **Document Change/Removal:** Trust navy explains that the approved file remains protected, amber identifies the request as consequential and pending admin review, cobalt submits the request, and red appears only when validation or submission fails.

Every section has one dominant feeling and at most one expressive supporting accent; Pearl, Ink, and neutral surfaces remain the majority. No card or section displays all signature colors at once. The only approved expressive gradient is a restrained Cobalt-to-Signal treatment for selected hero or technology emphasis; status indicators and body surfaces remain solid colors.

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

The existing `Button` component will become the canonical action primitive. It will support primary, secondary, outline, ghost, and danger variants; small, medium, and large sizes; leading icons; loading state; disabled state; and full-width layout. Primary actions use action cobalt, protected or secondary actions use trust navy or neutral styling, successful completion is communicated outside the button with growth feedback, and danger remains red. Keyboard focus will use `focus-visible`, not a permanent focus ring. Hover and active effects will be subtle and disabled while busy.

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

The drop zone uses a neutral resting state, innovation cyan while dragging or processing, growth emerald only after a valid upload completes, trust navy when a document is approved and locked, amber for pending change or expiration attention, and red for rejection or validation failure.

Each document remains a separate file input. The professional PRC, BOA, tax, identity, liveness, resume, and other document rules will not be collapsed into “OR” logic.

### SurfaceCard, StatusBadge, ProgressSummary, and FeedbackBanner

These small presentation primitives will establish consistent card structure, tier/document status display, completion summaries, and success/error notices. Status components will map existing backend values to semantic labels and styles in one place while preserving the underlying value. Centralizing the mapping prevents visually attractive accent colors from overriding the meaning of backend statuses.

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

## Public marketing and landing pages

The shared public shell and every existing marketing route will adopt the signature system without changing route behavior, content claims, CTA destinations, or pricing logic.

### Shared navigation, mobile menu, and footer

- Pearl and white surfaces create clarity in the sticky navigation; PB Midnight anchors the monogram, primary text, and footer.
- PB Cobalt owns the active route, keyboard focus, and public CTAs. Champagne appears only as a fine monogram or divider detail.
- The mobile menu retains its current routes and scroll-lock behavior, gains consistent 44px targets, and shows the active destination through shape/weight as well as color.
- The footer remains a stable PB Midnight brand anchor with high-contrast links and restrained Cobalt focus/hover states.
- The default purple Vite favicon is replaced by a simple PB monogram using Midnight, Cobalt, and Pearl so browser chrome matches the finalized palette.

### Home (`/`)

- **Hero:** Pearl canvas, Midnight headline, Cobalt primary CTA, one restrained Cobalt-to-Signal emphasis, and a fine Champagne eyebrow detail communicate trust, action, innovation, and premium clarity without a rainbow treatment.
- **Audience paths and credibility strip:** Cobalt marks clickable paths; Midnight communicates vetting/compliance; Emerald is reserved for substantiated savings or positive outcomes. The current unrelated violet savings accent is removed.
- **Service capabilities:** Pearl/white cards and Ink typography carry the premium foundation. Each card uses restrained semantic icon details rather than changing to a different decorative color on hover.
- **ROI calculator:** Neutral inputs and Cobalt controls keep the tool clear; Emerald belongs to calculated savings and positive results. Trust colors frame assumptions and disclosures.
- **Process and FAQ:** Neutral cards, Midnight structure, and Cobalt interaction states prioritize comprehension.
- **Secure matching and final CTA:** A Midnight foundation, Signal technical cues, Emerald completed statuses, Cobalt action, and one subtle Champagne detail close the page with trust and momentum.

### Talent Directory preview (`/talents`)

- Trust colors frame privacy, identity, and locked-document messaging.
- Emerald appears only on verified credentials or genuinely available/positive status.
- Signal Cyan identifies technical metadata or preview behavior; Cobalt owns filters, selected states, unlock actions, and links.
- Existing responsive filter scrolling, card content, locked visibility, and CTA behavior remain unchanged.

### Enterprise/Agency (`/agency`)

- The enterprise hero uses PB Midnight with a predictable tokenized overlay so remote-image contrast remains stable.
- Champagne is limited to an enterprise eyebrow or fine premium edge; Emerald supports substantiated capability/outcome lists; Signal Cyan identifies pod structure, systems, and process cues.
- Engagement-model cards use a Pearl individual option and a Midnight managed-pod option. Cobalt owns actions; no decorative color implies an unsupported tier or guarantee.

### Pricing (`/pricing`)

- Pearl/white surfaces and Ink typography make comparison clear; the enterprise option uses Midnight for distinction.
- Cobalt owns both plan actions and focus states. Signal Cyan may identify managed-team structure, while Emerald is limited to factual inclusions or positive outcomes.
- Champagne may highlight a small featured detail but cannot imply that a plan is objectively best or add a paid tier that the current pricing model does not define.

### Public not-found and auth entry

- The public 404 state uses the same canvas, typography, and action tokens as the public shell.
- Login and registration overlays opened from public CTAs inherit the canonical modal, field, button, and color tokens. Authentication behavior, validation, roles, and navigation remain unchanged.

## User-tier presentation

There is no standalone User Tiers page. Tier information is currently expressed through permission objects, navigation access, status copy, and the professional “View Profile As” feature. The redesign will keep that architecture and improve only the visible tier surfaces.

- Client tiers will display the backend-provided Basic or Verified label consistently in the client shell and relevant verification/status areas.
- Professional tiers will display the backend-provided Unverified, Basic, or Verified label where available. No frontend-only tier will be invented.
- Tier badges will use the shared status system rather than custom per-page pills: neutral for Basic/Unverified and growth emerald with a restrained trust-blue detail for Verified.
- Locked navigation or actions will continue to be driven by current permission checks.
- “View Profile As” becomes a segmented Basic Client / Verified Client control with a concise explanation of what each audience can see.
- Preview content continues to come from `backendApi.talent.getProfilePreview`; the frontend must not infer document visibility.

## Client dashboard and verification flow

The client shell will gain a calmer responsive workspace, consistent horizontal gutters, a clearer active navigation state, and a visible tier badge near the account identity. The restyle will not change which tabs a tier may access.

Client Verification will be organized as follows:

1. A trust-led page header containing the trust-center label, title, short explanation, status badge, and “N of 4 ready” progress summary. Trust navy provides structure while the progress indicator earns growth color only as requirements become complete.
2. A compact status panel for draft, pending review, rejected, or approved state. Admin notes and `verifiedBusinessName` remain prominent and read-only.
3. A responsive two-column requirement grid for Valid ID, Liveness Selfie, Profile Picture, and Proof of Business.
4. Each requirement card uses the shared drop zone and clearly shows document guidance, current status, rejection reason, file metadata, and available action.
5. Proof of Business retains the exact accepted choices: US EIN Letter (CP575), State Business Registration, or EU VAT Certificate. The type selector sits above the drop area and locks with the document.
6. A final review band explains legal-name handling and contains the submission action. The action remains disabled until the backend reports `canSubmit`.

Errors that apply to one upload appear inside that requirement card; page/network errors and successful submissions appear in a live feedback banner near the top. Pending-review and approved documents remain locked.

## Professional dashboard and onboarding flow

The professional shell will use the same canvas, navigation, gutters, tier status, and content-width rules as the client shell while retaining professional-specific navigation and permissions.

The dashboard header will group account status, approval requirements, completion progress, tier-preview control, and the primary next action. Profile content will use generous card spacing and clearer separation between personal profile, availability/rates, skills/tools, identity, and regulated credentials. Wealth/growth color supports positive completion and verified standing, while innovation color is reserved for liveness, processing, preview, and automated-expiration cues.

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
- Pearl and white surfaces, ink hierarchy, and a fine champagne accent create the premium tone; fields remain neutral so the cobalt Save action is unmistakable.
- The footer remains visible while scrolling and contains Cancel and Save Profile actions.
- Save errors appear in an `aria-live` summary and next to the affected field where the frontend can identify it.
- The modal never expands inline inside the dashboard.

## Document Change/Removal modal

Identity and credential change requests will share one presentation pattern while preserving their existing submit handlers and payloads.

- The header identifies the locked document and uses a warning status, not a destructive red treatment.
- Trust navy communicates continued document protection while amber communicates that the requested change requires admin attention.
- A select provides the existing predefined reasons.
- The custom explanation field appears when the chosen reason requires it and remains available as supporting context where currently permitted.
- The modal explains that the document stays approved and locked until an admin reviews the request.
- The sticky footer contains Cancel and Submit Request. Submission errors remain in the modal.
- The pending-request state disables duplicate requests and communicates that admin review is in progress.

## Responsive and accessibility behavior

- Target breakpoints follow the existing Tailwind responsive model, with mobile-first single-column layouts.
- Dashboard content stays within a consistent maximum width while using fluid gutters.
- Dashboard and public-route navigation remains horizontally scrollable or collapses into the existing mobile menu on narrow screens without hiding active state.
- All interactive targets are at least 44px.
- Icons that do not convey unique meaning are hidden from assistive technology; meaningful icon-only controls receive labels.
- Status is never communicated by color alone.
- Focus styles are high-contrast and visible only for keyboard-style focus.
- Feedback uses polite or assertive live regions according to severity.
- Light mode, dark mode, keyboard-only use, 320px mobile width, tablet, desktop, 200% zoom, and reduced motion are explicit verification targets for the public shell, all four public routes, public auth entry, and the client/professional workflows.
- Every documented foreground/background token pairing must meet WCAG AA in both themes before it is accepted into the signature guide.

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

1. Add source-contract tests for the exact canonical signature tokens, semantic aliases, light/dark mappings, compatibility alias, and documentation/AGENTS references.
2. Add a target-surface guard against raw brand hex values and independent stock status-color decisions in migrated JSX.
3. Add pure-function tests for status/tier presentation mappings and upload-state derivation where logic is extracted.
4. Add public-page UI contract tests covering the shared navigation/footer and Home, Directory, Enterprise, Pricing, 404, and public auth-entry compositions.
5. Extend Client Verification UI tests for all four distinct requirements, accepted business-document types, drag/drop semantics, locked states, feedback semantics, and the protected legal business name.
6. Extend Professional Onboarding UI tests for distinct identity/credential uploads, expiration inputs, locked-change actions, tier-preview control, and modal composition.
7. Run the focused design-system and workflow tests, then the complete test suite, ESLint, and production build.
8. Start the Vite development server and verify `/`, `/talents`, `/agency`, and `/pricing` in light and dark themes at mobile, tablet, and desktop sizes, including mobile navigation, footer, CTA destinations, pricing cards, directory filters, and public auth entry.
9. Verify client and professional flows at the same responsive sizes, then check keyboard navigation, focus return, Escape/backdrop behavior, drag/drop and click upload paths, reduced motion, 200% zoom, token contrast, console errors, and obvious visual regressions.

## Expected file boundaries

The exact implementation plan may refine names, but the intended boundaries are:

- `src/index.css`: semantic Tailwind theme tokens, base styles, and shared motion utilities.
- `src/App.css`: remove the unimported Vite starter stylesheet after confirming it has no consumers, eliminating a competing stale token source.
- `index.html`: use the PB Finance product title and the signature favicon reference without changing application bootstrapping.
- `docs/design-system/pb-signature-colors.md`: canonical future-facing palette, pairing, usage, and governance guide.
- `AGENTS.md`: concise rule requiring future UI work to use canonical tokens and the signature-color guide.
- `src/components/ui/BrandMark.jsx`: one small PB monogram primitive for public, client, and professional chrome so color and geometry cannot drift between duplicated marks.
- `src/components/ui/Button.jsx`: canonical action component.
- `src/components/ui/Modal.jsx`: accessible animated portal modal.
- `src/components/ui/FormField.jsx`: field structure and shared form-control styling.
- `src/components/ui/FileDropzone.jsx`: accessible upload interaction and visual states.
- `src/components/ui/StatusBadge.jsx`: tier and workflow status presentation.
- `src/components/ui/SurfaceCard.jsx`: consistent card composition.
- `src/components/ui/SegmentedControl.jsx`: tier-preview control.
- `src/components/ClientVerificationDashboard.jsx`: client workflow composition.
- `src/pages/PublicPages.jsx`: shared public shell plus Home, Directory, Enterprise, Pricing, and not-found integration.
- `src/App.jsx`: signature-token integration for authentication overlays reached from public CTAs, without auth behavior changes.
- `src/pages/ProfessionalPages.jsx`: professional workflow integration, with focused extraction if needed to prevent further growth of the already-large page file.
- `src/pages/ClientPages.jsx`: client-shell integration.
- `public/favicon.svg`: PB-monogram favicon using the signature palette instead of the default Vite-purple asset.
- Existing tests under `tests/`: design-system and workflow coverage.

## Acceptance criteria

- One named, exact PB Finance signature palette is implemented in runtime tokens, documented for future UI/UX work, and referenced by repository guidance.
- Home, Talent Directory preview, Enterprise/Agency, Pricing, shared public navigation/footer, public 404, client surfaces, and professional surfaces visibly share one design language in both themes.
- The five requested feelings are visible in the sections mapped to them: trust/security in identity and protection, wealth/growth in verified progress, innovation/tech in liveness and processing, action/highlights in primary interactions and attention states, and clarity/luxury in the neutral foundation and finishing details.
- Color use remains semantically consistent: green never decorates incomplete work, amber never signals approval, red remains reserved for failure/destructive states, and champagne never reduces text contrast or invents a paid-tier meaning.
- PB Midnight and PB Cobalt remain the dominant brand colors, PB Champagne remains a scarce premium detail, and no target section creates a rainbow effect.
- Migrated target JSX contains no raw signature hex values or independent semantic status-color choices when a canonical token or shared primitive applies.
- No target workflow uses a bespoke modal, upload button, form-control style, tier toggle, or status badge when the shared primitive applies.
- All required client and professional documents remain distinct and obey their current rules.
- Drag-and-drop and click/keyboard upload paths produce the same validation and upload behavior.
- Profile Settings and both document-change request flows use the shared animated modal.
- Client and professional layouts remain usable from 320px mobile width through large desktop widths.
- All public routes and the mobile public shell remain usable from 320px through large desktop widths without changing routes, content, CTA destinations, auth behavior, or pricing behavior.
- Tier labels and visibility remain driven by existing backend data and permissions.
- `verifiedBusinessName` remains exact, protected, read-only, and visible in the approved client state.
- The complete test suite, ESLint, production build, token contrast checks, and browser verification pass before the branch is considered complete.
