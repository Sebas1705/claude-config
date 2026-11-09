---
name: sebas-design-system
description: Use when designing or changing UI in any of Sebas' projects (Haltera, Owlsplit, YouKnow, Omni-Impostor, Folio editor, portfolio carreerV2, Nimbo, WinForge, Templetry) - colors, typography, shapes, spacing, icons, brand tokens, themes, strings and motion. Gives the shared rules, the token pipeline and each project's palette.
---

# Sebas' design system

Before touching UI, read the project's own spec: `docs/BRAND.md`, `docs/DESIGN_SYSTEM.md` (Owlsplit), `docs/design.md` (Omni-Impostor), `brand/tokens.json`, `templetry/wiki/brand/guidelines.md`. The project wins over this file. Colors, sizes and counts below were read from the repos on 2026-11-09; re-check them before relying on one.

## Principles shared across the projects
1. **Material 3 is the base** on every Android/KMP app, with a custom theme object that maps the brand to M3 roles (`AppTheme`, `OwlsplitTheme`, `CareerTheme`, `CareTheme`, `DemoTheme`). Never raw Material defaults.
2. **One accent, used sparingly** (Owlsplit "single accent", Templetry "brass is spent, not sprayed", WinForge "ember lights only what is done or chosen").
3. **Accent for text differs from accent for fills** (`accentText` vs `accent`, `onAccent`). Record the contrast ratio. Amber/yellow is fill only.
4. **Semantic colors are separate tokens** (success, warning, error). Red is reserved: never for debts in Owlsplit. Never encode meaning in hue alone.
5. **Light and dark are both first-class**, following the system. Web: `prefers-color-scheme` plus an optional manual override (`.dark` class, or `:root[data-theme]` with the `:root:not([data-theme='light'])` pattern).
6. **The logo appears only on icon, splash, empty/welcome states and credits**, never as a mascot inside working screens.
7. Primary content (numbers, the thing the user came for) is the biggest element; sentence-case, friendly, direct text; errors say what happened and what to do.

## Token pipeline (Haltera and Owlsplit; copy it for new apps)
`brand/tokens.json` (colors light/dark, logo geometry, fonts) is the single source. It feeds the Kotlin tokens (`BrandTokensTest` fails if they differ), the icons and splash (`scripts/brand.mjs [--png|--check]`, `--check` runs in CI) and the web CSS variables (Owlsplit: `--os-*` kebab-case). **Never hand-edit generated files.** To change a color: edit `tokens.json`, regenerate, run the test. Haltera's `tokens.json` is the template for a new project.

## Scales
- Shapes 4/8/12/16 plus 24 or 28 dp (Haltera 4/8/12/16/28, Owlsplit container 16, control 12, pill, dialog 24).
- Spacing 4-8-12-16-24-32 dp (Owlsplit `Spacing`, Omni `AppDimens.spacing`). YouKnow differs (6-12-24-32-48): keep each project's own.
- Touch target 48 dp, list row 56, primary button 52 (Owlsplit `Sizes`). Web public sites 44 px (`min-h-11`).
- No shadows when background/surface contrast is enough; press feedback follows the visible shape.

## Typography
Bundled, OFL-licensed fonts: display + body (+ mono for data), **tabular figures (`tnum`) for numbers**. Haltera Barlow Semi Condensed + Inter; Owlsplit Inter; carreerV2 Space Grotesk / Inter / JetBrains Mono; Nimbo and WinForge Bricolage Grotesque for display. Never rely on system fonts for brand text.

## Per-platform recipes
- **Compose / KMP:** `AppTheme(darkTheme = isSystemInDarkTheme())` + `ColorScheme` mapping + `Shapes` + `Typography` + a `CompositionLocal` for brand extras. Components live in `core:ui` and never hold hard-coded text. Every component gets light and dark previews and a screenshot test (Owlsplit: Roborazzi + `DesignCatalog`). Brand color wins over dynamic color (policy in Haltera/Owlsplit).
- **SwiftUI / iOS:** only a thin host around the Compose view today (`iosApp/iosApp/ContentView.swift`). Keep it thin; if native views are added, mirror tokens from `tokens.json`.
- **React web:** CSS custom properties; fonts via `@fontsource` (bundled, works offline); `.skip-link`; theme storage wrapped in try/catch (Nimbo `prefs.ts`). carreerV2 is the only Tailwind v4 project: the "ink" palette is Tailwind's `violet-*`/`purple-*` scales remapped in `src/index.css` (so `violet-600` is the brand `#4A5AF0`), not a class called `ink`.
- **Wails desktop (Nimbo, WinForge, Templetry desktop):** same CSS-variable approach, dark default, desktop density (24-34 px controls) is a deliberate exception, say so in the change.

## Icons and assets
Adaptive icon + monochrome (themed) layer + PNG mipmaps (Firebase App Distribution cannot read adaptive icons) + iOS 1024 opaque + store 512. No single icon library rule: Owlsplit uses Tabler outline (1.75-2 px, 20/24 dp), Omni Material Outlined; follow the project.

## Strings and i18n
English default + Spanish, **every UI string a resource, same keys in both files**, components receive already-localized strings. Parametrised accessibility strings (`Move %1$s up`). Key naming differs per project (Haltera `<module>_<name>`, YouKnow `feature_<mod>_<name>`, Omni `core_resources_<name>`, Owlsplit unprefixed, carreerV2 nested `section.key`, Nimbo camelCase): follow the project; for a new one use module-prefixed snake_case. Money and number formatting live in common code.

## Motion
Purposeful, one animation per interaction, always an `animate=false` path, haptic on confirm. Respect reduced motion: CSS `prefers-reduced-motion` plus framer `useReducedMotion()` on web, `LocalReduceMotion` in Owlsplit. Haltera has about 121 animation call sites and no reduce-motion hook yet.

## Palettes (verify against the project before use)
| Project | Palette |
|---|---|
| Haltera | iron orange `#FF5A1F` on graphite `#1E2126`; `onAccent` graphite (5.2:1 vs 3.1 with white) |
| Owlsplit | blue `#3B4BF5`, amber beak `#E8B04B` |
| Folio editor and carreerV2 | ink indigo `#4A5AF0`, teal `#00A896` |
| Templetry | Ink & Brass: Ink `#15171e`, Linen `#eae7de`, Brass `#d9a441` (normative: `wiki/brand/guidelines.md`) |
| WinForge | steel and ember, accent `#ff9f2e` |
| Nimbo | paper/ink with LED green `#0fae78` |
| YouKnow, Omni-Impostor | M3 Theme Builder exports, 3 contrast levels x light/dark (Omni blue `#1565C0`, teal `#00796B`) |
| nanodemo | dark only, bench-panel palette |

## Known gaps (do not copy them as if they were rules)
YouKnow and Omni are not tokenised in JSON; Owlsplit has no window-size handling; icon policy is mixed. Fix them when you touch those areas, with the owner's agreement.

Related: `adaptive-ui` for responsive, adaptive and accessibility checks; `frontend-design` for aesthetic direction on new web UI.
