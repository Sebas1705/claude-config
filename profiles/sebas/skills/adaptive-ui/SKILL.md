---
name: adaptive-ui
description: Use when building or reviewing responsive, adaptive or accessible UI in Sebas' projects - phone/tablet/foldable layouts and window size classes in Compose, edge-to-edge and insets, SwiftUI host rules, mobile-first React and Wails layouts, contrast, touch targets, screen readers, reduced motion and the light/dark x es/en x device test matrix.
---

# Adaptive UI and accessibility checklist

Facts below come from the repos (read 2026-11-09). Adaptivity is solved properly only in **Haltera**; Owlsplit and the Folio editor have no window-size handling, so a phone layout stretches on tablets there.

## 1. Pick the window class first
- KMP apps: **copy Haltera's `core/ui/.../adaptive/WindowSize.kt`**: width classes at 600 / 840 dp, height classes at 480 / 900 dp, `ProvideWindowSize` (a `BoxWithConstraints` at the root) and `LocalWindowSize`. It works in common code and also handles landscape phones.
- Android-only apps (YouKnow, Omni-Impostor): androidx `WindowSizeClass` (`isCompact/isMedium/isExpanded`).
- Do not mix both in one app.

## 2. Compose / KMP
- Navigation: bottom bar (compact) -> rail (medium/expanded or landscape phone, Haltera's `useNavigationRail`) -> drawer (large).
- Content width: `Modifier.centeredContent()` caps content at 720 dp (sheets 640 dp); use it on every screen instead of ad-hoc `widthIn`.
- Expanded: two columns or list-detail where it helps; do not just stretch.
- `enableEdgeToEdge()` in the activity; consume insets once at the shell and not per screen; `imePadding` in forms; check system-bar icon contrast.
- Do not lock orientation; test split-screen and resizable windows.
- Text must survive 200 % font scale without clipping.

## 3. SwiftUI / iOS
Today iOS is a thin host around the Compose view (`ContentView.swift`): safe areas and insets are handled by Compose, the host only does `ignoresSafeArea(.keyboard)`. If native SwiftUI screens are ever added: `ViewThatFits` / size classes, Dynamic Type, VoiceOver labels, `accessibilityReduceMotion`. There is no Mac for iOS runtime tests: say what could not be tested.

## 4. React web
- Mobile-first (carreerV2: base styles, then `sm:` / `md:` / `lg:`), `viewport-fit=cover` with `env(safe-area-inset-*)`, `dvh` instead of `vh`, no horizontal scroll at 375 px, a reading measure around 68ch, print CSS where useful.
- Public sites: touch targets 44 px (`min-h-11`). Wails desktop apps (Nimbo, WinForge, Templetry desktop): breakpoints around 720 / 1000 / 1100 px, two columns collapsing to one; 24-34 px controls are an accepted desktop-density exception, state it.
- Theme: respect `prefers-color-scheme`, optional manual override, storage wrapped in try/catch.
- Horizontal scroll strips need `data-no-swipe` in carreerV2 so section swipes do not hijack them, and text inputs must not trigger the deck's arrow-key navigation.

## 5. Accessibility (all platforms)
- Contrast WCAG AA 4.5:1 **tested in code**: copy Omni-Impostor's `ContrastTest` (fails if any scheme pair is below 4.5:1) into Haltera and Owlsplit, which only test token equality today.
- Never convey meaning by color alone. Amber/yellow is fill only.
- Touch targets 48 dp / 44 px. Icons that mean something get a `contentDescription`, parametrised when needed (`Move %1$s up`); decorative ones get `null`. `clearAndSetSemantics` for composite rows. Use `Icons.AutoMirrored` for directional icons.
- Web: visible `:focus-visible` ring (2 px), skip link, `aria-live` for section changes, semantic headings and roles, axe-core (wcag2a/aa/21aa) in Playwright as in carreerV2's `e2e/smoke.spec.ts`.
- Reduced motion: CSS `prefers-reduced-motion` + `useReducedMotion()` on web; `LocalReduceMotion` in Owlsplit. Haltera still lacks a hook: add one when touching its animations.
- Audience overrides: for apps aimed at older users, body text of at least 17 px, line-height 1.7, a 3 px focus ring, a cream background, an AAA contrast target for body text, and no meaning in blue/cyan alone.

## 6. Test matrix before calling it done
light and dark x Spanish and English x phone, small phone, tablet and landscape phone x font scale 100 % and 200 %. Haltera: both emulators (emulator-5554 and emulator-5556), back, rotation and process death. Attach screenshots to the PR. Report honestly what you could not test.

Related: `sebas-design-system` (tokens and palettes), `wcag-audit-patterns`, `screen-reader-testing`, `accessibility-audit` (installed plugins), `edge-to-edge`.
