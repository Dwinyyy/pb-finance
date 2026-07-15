# PB Finance Signature Colors

This is the canonical color contract for PB Finance UI and UX work. New components use semantic utilities first; direct signature primitives are reserved for the brand compositions documented below.

## Selection rule

1. Choose the component intent: surface, content, action, information, verified, processing, warning, danger, or premium detail.
2. Use the matching semantic token or shared primitive.
3. Never use Emerald for incomplete work, Champagne for warnings, Signal for approval, or Amber for success.
4. Update this guide, `src/index.css`, contrast tests, and affected UI tests together when the palette changes.

## Primitive tokens

These values are normative and are the source for runtime theme tokens, semantic aliases, documentation examples, and automated contrast checks.

The signature anchors are PB Midnight `#0B1F3A`, PB Cobalt `#2563EB`, PB Emerald `#047857`, PB Signal Cyan `#0E7490`, PB Champagne `#A67C38`, PB Pearl `#F7F9FC`, and PB Ink `#0A1628`.

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

PB Cobalt is the one signature family that exposes a complete numeric ramp because existing code consumes `primary-50` through `primary-950`. The compatibility alias is exact and deprecated for newly migrated code.

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

## Semantic mappings

Future UI work consumes these semantic roles instead of selecting a signature primitive by appearance.

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

## Feedback states

Feedback surfaces use complete foreground/background/border triplets so pages do not invent one-off translucent stock colors.

| Semantic state | Light foreground / surface / border | Dark foreground / surface / border |
| --- | --- | --- |
| `info` | `#1D4ED8` / `#EFF6FF` / `#93C5FD` | `#93C5FD` / `#10284F` / `#2563EB` |
| `verified` | `#047857` / `#D1FAE5` / `#6EE7B7` | `#34D399` / `#0B2B22` / `#047857` |
| `processing` | `#0E7490` / `#CFFAFE` / `#67E8F9` | `#22D3EE` / `#082A33` / `#0E7490` |
| `warning` | `#92400E` / `#FEF3C7` / `#F59E0B` | `#FCD34D` / `#2B1D08` / `#B45309` |
| `danger` | `#912018` / `#FEE4E2` / `#F97066` | `#FDA29B` / `#2A1214` / `#B42318` |

## Contrast rules

| Context | Approved contract |
| --- | --- |
| Text and controls | Every documented foreground/background token pairing must meet WCAG AA in both themes. |
| Filled brand controls | Darker Cobalt, Emerald, or Signal anchors use white text. Pair a bright fill with PB Ink only after a verified contrast check. |
| Amber or Champagne fills | Use PB Ink; do not pair these anchors with white body text at insufficient contrast. |
| Bright dark-mode accents | `#60A5FA`, `#34D399`, `#22D3EE`, and `#D9BC78` are for focus rings, text, icons, borders, or soft surfaces. |
| Borders | `border-subtle` is decorative. Form boundaries, focus structure, and meaningful graphical separators use `border-control`, which must clear a 3:1 non-text contrast target against its paired surface. |

Dark mode preserves the same semantic relationships instead of mechanically inverting colors. Canvas, surfaces, borders, text, and expressive colors must remain distinct without neon visual noise.

## Prohibited uses

| Color or token | Prohibited use | Required meaning or alternative |
| --- | --- | --- |
| PB Emerald / `verified` | Incomplete steps, pending work, or decorative progress | Verified, approved, completed, or healthy progress only |
| Attention Amber / `warning` | Approval or success | Pending review, upcoming expiration, attention, or consequential choice |
| Danger Crimson / `danger` | General decoration or non-destructive information | Rejection, invalid input, destructive action, or expired failure only |
| PB Signal Cyan / `processing` | Approval or completed states | Technology, activity, liveness, automation, processing, or preview behavior |
| PB Champagne / `premium-detail` | Warnings, low-contrast body text, broad fills, or an invented paid-tier meaning | Scarce premium details, thin separators, and small highlights |
| Raw brand hex values or page-owned status colors | New component styling when a semantic token or shared primitive exists | Use the matching semantic utility or shared UI primitive |
| `primary-*` compatibility aliases | New or migrated target UI | Use canonical semantic names; retain the exact aliases only for compatibility |

## Governance

- `src/index.css` is the runtime source of truth.
- This guide is the human-readable reference for product, design, and engineering.
- React components consume semantic utilities or shared primitives rather than raw brand hex values.
- Stock Tailwind color namespaces are not globally redefined.
- Palette changes update runtime tokens, this guide, contrast tests, and affected UI tests and visual snapshots together.
