# Task 5 report: Public shell and Home

## Implementation

- Commit: `d7f91b6dd93ba20d18470390ca78478f3b150713`
- Migrated the shared public navigation, mobile menu, 404 shell, footer, ROI calculator presentation, FAQ presentation, and every Home section to the PB signature system.
- Used `BrandMark`, `Button`, `SurfaceCard`, and semantic PB tokens without adding dependencies, raw hex values, or violet utilities.
- Left Directory, Enterprise, and Pricing route bodies behaviorally and visually unchanged for Task 6; only their shared shell and footer changed.

## TDD evidence

- Baseline: `npm test` passed 66/66 before production edits.
- RED: `node --test tests/public-design-system-ui.test.js` failed for the expected missing `<BrandMark` signature integration; the route/CTA preservation assertion already passed.
- Additional RED: the SSR contract failed for the expected missing `aria-label="Primary navigation"` signature shell.
- Focused GREEN: `node --test tests/public-design-system-ui.test.js tests/ui-primitives.test.js` passed 11/11.

## Final verification

- `npm test`: passed 69/69.
- `npm run lint`: passed with exit code 0 and no output.
- `npm run build`: passed with exit code 0; Vite transformed 2,534 modules.
- `git diff --check`: passed.
- Source guard: no `violet-*` utilities and no raw hex values remain in `src/pages/PublicPages.jsx`.

## Preservation audit

The pre/post source comparison confirmed identical ordered contracts:

- Route IDs: 4 before / 4 after.
- Event handlers: 34 before / 34 after.
- State declarations: 8 before / 8 after.
- Auth and navigation callback destinations: 24 before / 24 after.
- Scroll-hide and mobile body-lock statements: 5 before / 5 after.
- Static JSX copy was unchanged except for the three duplicated `PB` / `PB Finance` source strings intentionally replaced by the shared `BrandMark` primitive; runtime branding remains present.

## Responsive browser evidence

- Vite page loaded at 320 x 900 with meaningful content and no error overlay.
- At 320px, `innerWidth` and document `scrollWidth` were both 320, so there was no page-level horizontal overflow.
- The mobile menu exposed all navigation/auth targets, set `aria-expanded="true"`, locked `document.body.style.overflow` to `hidden`, and restored it to an empty value after closing.
- The 320px footer fit without clipping and remained visible at the document bottom.
- At 1440 x 900, `innerWidth` and document `scrollWidth` were both 1440 and the Vite error-overlay check was false.
- Interactive snapshots exposed the ROI sliders/switch, FAQ expanded states, Home CTAs, navigation, and footer links with accessible names.

## Concerns

- No blocking concerns for Task 5.
- Non-Home route bodies intentionally retain their legacy styling until Task 6.
- The focused browser pass covered the requested responsive shell in light mode; the plan's final integration pass should still exercise dark mode, reduced motion, and every public route together.
