---
name: docs-conventions
description: Use when writing or editing README, docs/, wikis, CHANGELOG, AGENTS.md/CLAUDE.md, ADRs, diagrams, PR titles or any bilingual (es/en) content in Sebas' repos. Encodes the conventions his repos already share and where they differ.
---

# Documentation conventions (Sebas' projects)

Match what the repo already does; where repos differ, this file says which one to follow. Derive numbers (versions, counts) from source, never copy them from old docs.

## Language
- Everything committed is **English**: docs, code comments, commits, PRs, branches, workflow comments.
- Spanish only in UI resources (`values-es/strings.xml`, Compose resources, `es` data fields), Spanish sample data and Play Console labels.
- Second language for READMEs/case studies goes in a separate file (`README.es.md`, `case-study.es.md`), only when asked.
- Chat with the owner is in Spanish.
- Wikis: English pages.

## Agent contract
- `AGENTS.md` is the contract. `CLAUDE.md` is one line: read and follow `AGENTS.md` (plus the language rule).
- Keep the fenced block ```` ```sh templetry:checks ```` (commands that must pass before finishing) and the "came from a template" block. Never hand-edit `.templetry-answers.yml`; use `templetry pieces` / `update`.
- Update docs in the same change as the behavior or process they describe. Do not change release or governance rules silently.

## README skeleton
H1 name, badges (CI, latest release with prereleases, license), 1-2 sentence pitch, Download (site + GitHub Releases), screenshots, `## Features`, `## Architecture` (links), `## Tech stack`, `## Development`, `## License`.

## Root docs and `docs/` (KMP apps)
Root: `README`, `ARCHITECTURE.md`, `MODULE_MAP.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` (MIT).
`docs/`: `adr/`, `designs/YYYY-MM-DD-<topic>-design.md`, `plans/YYYY-MM-DD-<id>-<slug>.md`, `RELEASE.md`, `play/`, `BRAND.md`.

## ADRs
Write one when a choice closes off alternatives: would a competent newcomer reasonably do the opposite in six months, and is it hard to reverse?
- File `NNNN-slug.md` (four digits), one decision per file, title phrased as a decision. Sections: Status (`proposed | accepted | superseded by ADR NNNN`), Date (from git history), Area, Context (facts only), Decision, Consequences, and Alternatives considered where the repo's README promises it.
- An accepted ADR is never rewritten: add a new one and mark the old one superseded. Update the index table in `adr/README.md`.
- If the rationale is not written anywhere, say "not recorded"; do not invent it. Link PRs (#NN).
- Folders and formats differ, so match the local one: Haltera and Owlsplit `docs/adr/` (default: Haltera's `TEMPLATE.md`); `templetry/wiki/adr/` (`**Status:** ... · **Date:** ...`).js`).
- For a repo with none, create `docs/adr/` with a README index and Haltera's template. For the general method use the `architecture-decision-records` skill.

## CHANGELOG
Keep a Changelog 1.1: `## [Unreleased]` on top, `## [X.Y.Z] - YYYY-MM-DD`, sections Added / Changed / Fixed / Security, user-facing sentences ending with PR numbers. Owlsplit and YouKnow prepare it in a "Prepare the X.Y.Z changelog" PR; Omni-Impostor's `release.yml` appends it; Nimbo's section is the release notes. Repos without one (Haltera, Templetry, WinForge, nanodemo) rely on generated notes: PR titles are the changelog, so write them for users.

## Wikis
- Templetry wiki: `guide/ architecture/ study/ adr/ spec/ journal/ brand/`, mkdocs `--strict`; `state-of-the-art.md` is the single current picture; "if it's not in an ADR, it's not decided".
- Wikis that track freshness: every page has front matter `status: current|frozen|draft` and `verified: YYYY-MM-DD`; only bump `verified` after re-reading the page against reality. Relative links only, and list new pages in the build index.
- carreer wiki: hub README, `state-of-the-art.md`, `journal/YYYY-MM-DD-*.md`, `operations/secrets.md`.

## Diagrams
Follow the tool the repo already uses: ASCII boxes (Haltera), PlantUML (YouKnow, Omni-Impostor), HTML+JSON (Templetry wiki). New repo: Mermaid fenced in Markdown (GitHub renders it); never mix tools in one repo. Check file encoding is UTF-8 when box-drawing characters are used.

## Commits and PRs
- Short imperative English subject, in the repo's style. Where the repo uses conventional commits keep `type(scope): subject`, and with squash merges the PR title is the subject, with `(#NN)` appended.
- Branches `feature/`, `fix/`, `chore/`, `docs/`.
- Commits carry only the owner's identity: no `Co-Authored-By`, no "Generated with" footer (a guard hook blocks them).
- PR template sections: Summary / Changes / Checklist (+ "Changelog label" in Owlsplit, YouKnow, Omni).

## Before finishing
Docs updated in the same PR, links valid, counts and versions re-derived from source, language rule respected, no secrets or tokens printed.
