---
name: sebas-design-system
description: Use when designing or changing UI in any of the owner's apps or sites - colors, typography, shapes, spacing, icons, brand tokens, themes, strings and motion. Gives the shared rules and the token pipeline, and tells you to learn each project's own brand files first.
---

# Design system: how the owner's projects are designed

The project in front of you always wins. These are the habits shared by the owner's apps and sites; where a project has its own spec, follow that and treat this as the default for gaps.

## 1. Discover first (before touching UI)
Read, in this order, whatever exists: the brand or design doc (`docs/BRAND.md`, `docs/DESIGN_SYSTEM.md`, `docs/design.md`, a wiki `brand/` section), the token file (`brand/tokens.json`), the theme code (`Theme.kt`, `Color.kt`, `Type.kt`, `Shape.kt`, a CSS `:root` block, a Tailwind `@theme`), the string resources, and the agent contract (`AGENTS.md`). Note the accent, the scales, the fonts, how dark mode is chosen and how strings are named. Use those values; never invent a color or a size the project already defines.

## 2. Principles
1. **One accent, used sparingly.** It marks what is chosen or done, not decoration.
2. **Accent for text differs from accent for fills** (`accent`, `onAccent`, `accentText`). Check contrast and write the ratio down. Amber and yellow are fill-only.
3. **Semantic colors are separate tokens** (success, warning, error). Red is reserved for real errors and never used for neutral facts such as a debt or a status. Never carry meaning in hue alone.
4. **Light and dark are both first-class** and follow the system. On the web, `prefers-color-scheme` plus an optional manual override (`:root[data-theme]` or a `.dark` class, with the `:root:not([data-theme='light'])` pattern); wrap theme storage in try/catch.
5. **The logo lives on icon, splash, empty states and credits**, never as a mascot inside working screens.
6. The primary content (the number, the thing the user came for) is the biggest element. Text is sentence case, friendly and direct; an error says what happened and what to do.
7. Material 3 is the base on Android and KMP, always behind a custom theme object that maps the brand to M3 roles. Never ship raw Material defaults.

## 3. Token pipeline (use it for any new app)
One source of truth, `brand/tokens.json` (colors light and dark, logo geometry, fonts). It generates the Kotlin tokens (a test fails if they differ), the icons and splash (a script with a `--check` mode that CI runs) and the web CSS variables. **Never hand-edit generated files**: change the JSON, regenerate, run the check. Projects that only have a theme file should still keep brand colors in one place.

## 4. Scales (defaults when the project has none)
- Shapes 4 / 8 / 12 / 16 plus 24 or 28 dp.
- Spacing 4 / 8 / 12 / 16 / 24 / 32 dp.
- Touch target 48 dp (44 px on the web), list row 56, primary button 52.
- No shadows when background and surface already contrast; press feedback follows the visible shape.

## 5. Typography
Bundled, OFL-licensed fonts: a display face and a body face (and a mono face for data), **tabular figures (`tnum`) for numbers**, loaded locally (for example `@fontsource`) so the app works offline. Do not rely on system fonts for brand text unless the project chose that deliberately for accessibility.

## 6. By platform
- **Compose / KMP:** `AppTheme(darkTheme = isSystemInDarkTheme())`, a `ColorScheme` mapping, `Shapes`, `Typography`, and a `CompositionLocal` for brand extras. Shared components live in a UI module and hold no hard-coded text. Every component gets light and dark previews and a screenshot test. The brand color wins over dynamic color.
- **SwiftUI / iOS:** when iOS is a thin host around the Compose view, keep it thin and let Compose handle insets. If native screens are added, mirror the tokens from the JSON.
- **React web:** CSS custom properties, bundled fonts, a skip link, visible focus. Tailwind v4 projects remap the scale through `@theme`; others use plain CSS variables.
- **Desktop shells (Wails):** the same CSS-variable approach, dark by default. Desktop density (24-34 px controls) is a deliberate exception: say so in the change.

## 7. Icons and assets
Adaptive icon + monochrome (themed) layer + PNG mipmaps (App Distribution cannot read adaptive icons) + an opaque 1024 px iOS icon + a 512 px store icon. Follow the icon set the project already uses; do not mix sets.

## 8. Strings
English is the default, Spanish is the second language, **every UI string is a resource with the same key in both files**, and components receive already-localized text. Accessibility strings are parametrised (`Move %1$s up`). Follow the project's key naming (module-prefixed snake_case is the default for new code). Money and number formatting live in common code.

## 9. Motion
Purposeful: one animation per interaction, a haptic on confirm, and always a no-animation path. Respect reduced motion (CSS `prefers-reduced-motion`, framer `useReducedMotion()`, a reduce-motion flag in Compose).

## 10. Gaps worth fixing when you pass by
Brand colors duplicated across several files without a test, apps without a contrast test, apps with no window-size handling, mixed icon sets, and animations with no reduce-motion hook. Raise them with the owner; do not rewrite unasked.

Related: `adaptive-ui` for responsive, adaptive and accessibility checks; `frontend-design` for aesthetic direction on new web UI.
