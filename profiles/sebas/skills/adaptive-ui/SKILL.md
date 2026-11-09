---
name: adaptive-ui
description: Use when building or reviewing responsive, adaptive or accessible UI in the owner's projects - phone, tablet and foldable layouts and window size classes in Compose, edge-to-edge and insets, SwiftUI host rules, mobile-first React and Wails layouts, contrast, touch targets, screen readers, reduced motion and the light/dark x es/en x device test matrix.
---

# Adaptive UI and accessibility checklist

Adaptivity is uneven across the owner's apps: only some have real window-size handling, so do not assume the one you are in has it.

## 1. Discover first
Search the project for an existing window-size helper (`WindowSize`, `WindowSizeClass`, `LocalWindowSize`, `centeredContent`), for how navigation switches between bar, rail and drawer, and for the accessibility and design docs. Reuse what is there. If nothing exists, add the helper below rather than scattering `widthIn` calls.

## 2. Pick the window class first
- **KMP apps:** a small common-code helper: width classes at 600 / 840 dp, height classes at 480 / 900 dp, provided once at the root (`BoxWithConstraints` -> `LocalWindowSize`). It also covers landscape phones. This is the preferred model.
- **Android-only apps:** androidx `WindowSizeClass` (`isCompact`, `isMedium`, `isExpanded`).
- Do not mix the two in one app.

## 3. Compose / KMP
- Navigation: bottom bar (compact) -> rail (medium, expanded or landscape phone) -> drawer (large).
- Content width: one `Modifier.centeredContent()` that caps content at 720 dp (sheets 640 dp), used on every screen.
- Expanded: two columns or list-detail where it helps; do not just stretch a phone layout.
- `enableEdgeToEdge()` in the activity, insets consumed once at the shell, `imePadding` in forms, system-bar icon contrast checked.
- Do not lock orientation; test split-screen and resizable windows; text must survive 200 % font scale.

## 4. SwiftUI / iOS
When iOS is a thin host around the Compose view, safe areas and insets belong to Compose and the host only does `ignoresSafeArea(.keyboard)`. If native SwiftUI screens appear: `ViewThatFits` or size classes, Dynamic Type, VoiceOver labels, `accessibilityReduceMotion`. Without a Mac, iOS runtime behavior cannot be tested: say so.

## 5. React web and Wails
- Mobile-first: base styles, then `sm:` / `md:` / `lg:`. `viewport-fit=cover` with `env(safe-area-inset-*)`, `dvh` instead of `vh`, no horizontal scroll at 375 px, a reading measure of about 68ch, print CSS where useful.
- Public sites: touch targets 44 px (`min-h-11`). Desktop apps: breakpoints around 720 / 1000 / 1100 px, two columns collapsing to one; 24-34 px controls are an accepted desktop exception, stated in the change.
- A horizontally scrolling strip must not trigger the page's swipe or arrow-key navigation (mark it, and ignore keys typed in inputs).
- Theme: respect `prefers-color-scheme`, allow a manual override, keep storage in try/catch.

## 6. Accessibility (all platforms)
- Contrast WCAG AA 4.5:1 **tested in code** (a unit test that fails when any scheme pair is below 4.5:1), not just checked once.
- Never convey meaning by color alone. Amber and yellow are fill only.
- Touch targets 48 dp / 44 px. Icons that mean something get a `contentDescription`, parametrised when needed (`Move %1$s up`); decorative ones get `null`. `clearAndSetSemantics` for composite rows. `Icons.AutoMirrored` for directional icons.
- Web: a visible `:focus-visible` ring (2 px, 3 px for audiences that need more), a skip link, `aria-live` for section changes, semantic headings and roles, and axe-core (wcag2a, wcag2aa, wcag21aa) in the end-to-end tests.
- Reduced motion: CSS `prefers-reduced-motion` and `useReducedMotion()` on the web, a reduce-motion flag in Compose. Add the hook if the project animates without one.
- Apps for older users: body text of at least 17 px, line-height 1.7, a 3 px focus ring, a cream rather than white background, an AAA contrast target for body text, and no meaning in blue or cyan alone.

## 7. Test matrix before calling it done
Light and dark x Spanish and English x phone, small phone, tablet and landscape phone x font scale 100 % and 200 %. Cover back navigation, rotation and process death on Android, using more than one emulator when the project runs a test matrix. Attach screenshots to the PR. Say honestly what you could not test.

Related: `sebas-design-system` (tokens and scales), `wcag-audit-patterns`, `screen-reader-testing`, `accessibility-audit`, `edge-to-edge`.
