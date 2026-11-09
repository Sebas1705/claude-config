# Profile: sebas

The author's own setup, published as a worked example of a real overlay (see `docs/CUSTOMIZING.md`). Use it as is, or copy it and make it yours.

```sh
node install.mjs --profile sebas              # on top of the defaults
node install.mjs --profile sebas --retire     # also move aside overlapping skills from older setups
```

| File | Effect |
|---|---|
| `CLAUDE.md` | Replaces the default rules block: conversation in Spanish, repositories in English, no commit trailers, ask before merges/releases/production, secrets in a secrets manager |
| `skills/sebas-design-system` | Shared design rules (tokens, scales, typography, palettes) for the author's public apps |
| `skills/adaptive-ui` | Responsive, adaptive and accessibility checklist for Compose/KMP, SwiftUI hosts, React and Wails |
| `skills/docs-conventions` | README, docs, ADR, changelog, wiki and commit conventions of the author's repositories |
| `skills/release-management` | How the author's projects release (Android/KMP, Go/Wails, Cloudflare Worker, Pages) and which steps need the owner |
| `hooks/guard.config.json` | Turns on the guard hook's commit-trailer rule |
| `overlay.json` | The `--retire` list |

The skills describe the author's own projects: they are examples, and mostly useful if you work on those repositories. The facts in them (palettes, release steps, conventions) were read from the repositories on 2026-11-09 and can drift: check them before relying on one.

Details that are not meant to be public (private projects, where secrets are kept) live in a private overlay that the author applies on their own machines, set as the default with the `CLAUDE_CONFIG_OVERLAY` environment variable (see `docs/CUSTOMIZING.md`).
