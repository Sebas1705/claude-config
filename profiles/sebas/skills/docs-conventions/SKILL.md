---
name: docs-conventions
description: Use when writing or editing a README, docs/, a wiki, a CHANGELOG, AGENTS.md or CLAUDE.md, an ADR, a diagram, a PR title or any bilingual (es/en) content in the owner's repositories. Gives the shared conventions and tells you to learn each repository's own docs rules first.
---

# Documentation conventions

How the owner's repositories document themselves. Where a repository already has its own rules, those win; this file is the default and the tie-breaker. Derive numbers (versions, counts, dates) from the source, never from an older doc.

## 1. Discover first
Before writing, read what the repository already says about itself: `AGENTS.md` (the agent contract), `CONTRIBUTING.md`, `docs/` (look for `adr/`, `designs/`, `plans/`, `RELEASE.md`), the README's section order, an existing `CHANGELOG.md`, a wiki's own conventions file, and the last twenty commit subjects. Match their language, headings, naming and format. If the repository has a "checks" block (a fenced code block listing the commands that must pass), run it before you finish.

## 2. Language
- Everything committed is **English**: docs, code comments, commits, PRs, branches and workflow comments.
- Spanish appears only in UI resources (`values-es`, `es` data fields), Spanish sample data and Play Console labels.
- A second language for a README or case study goes in a separate file (`README.es.md`) and only when asked.
- Conversation with the owner is in Spanish.
- English wikis stay in English; if the project enforces it with a script, run the script.

## 3. The agent contract
`AGENTS.md` is the contract for agents; `CLAUDE.md` is one line that tells the agent to read and follow it (plus the language rule). Keep the "checks" block current. Update the docs in the same change as the behavior or process they describe, and do not change release or governance rules silently.

## 4. README skeleton
H1 name, badges (CI, latest release including pre-releases, license), a one- or two-sentence pitch, Download (site and releases), screenshots, `## Features`, `## Architecture` (links), `## Tech stack`, `## Development`, `## License`.

## 5. Docs layout in an app repository
Root: `README`, `ARCHITECTURE.md`, `MODULE_MAP.md` (the contract of a feature module), `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` (MIT). Under `docs/`: `adr/`, `designs/YYYY-MM-DD-<topic>-design.md`, `plans/YYYY-MM-DD-<id>-<slug>.md`, `RELEASE.md`, store-listing and release-audit notes, `BRAND.md`.

## 6. ADRs
Write one when a choice closes off alternatives: would a competent newcomer reasonably do the opposite in six months, and is it hard to reverse?
- File `NNNN-slug.md` (four digits), one decision per file, titled as a decision.
- Sections: Status (`proposed | accepted | superseded by ADR NNNN`), Date (from git history), Area, Context (facts only), Decision (present tense), Consequences (benefits, costs, how it is checked), and Alternatives considered when the repository's README promises them.
- An accepted ADR is never rewritten: add a new one and mark the old one superseded. Keep the index table in `adr/README.md` current (number, decision, status, date).
- If the reason is not written anywhere, write "not recorded"; never invent a rationale. Link PRs.
- Formats differ slightly between repositories (header style, status words, whether front matter is required): match the local one. In a repository with none, create `docs/adr/` with a README index and a short template.
- For the general method use the `architecture-decision-records` skill.

## 7. CHANGELOG
Keep a Changelog 1.1: `## [Unreleased]` on top, `## [X.Y.Z] - YYYY-MM-DD`, sections Added / Changed / Fixed / Security, user-facing sentences ending with PR numbers. Some repositories prepare it in a dedicated "Prepare the X.Y.Z changelog" PR, some generate it in the release workflow, some rely on generated release notes only: follow the repository. Where generated notes are the record, **PR titles are the changelog**, so write them for users.

## 8. Wikis
- Organise pages by how they age (current state, decisions, studies, brand), plus a journal only where the wiki already has one.
- A freshness-tracked wiki puts `status: current | frozen | draft` and `verified: YYYY-MM-DD` in every page's front matter; bump `verified` only after re-reading the page against reality. Use relative links, list new pages in the build index, and run the wiki's build checks.
- "If it is not in an ADR, it is not decided."

## 9. Diagrams
Use the tool the repository already uses (ASCII boxes, PlantUML, HTML/SVG, HTML plus JSON) and never mix tools in one repository. For a new repository, Mermaid fenced in Markdown (GitHub renders it). Check files are UTF-8 when box-drawing characters are used.

## 10. Commits and PRs
- A short imperative English subject in the repository's style; with squash merges the PR title is the subject, with `(#NN)` appended. If the repository uses conventional commits keep `type(scope): subject`; `feat`, `fix` and `perf` are user-facing, the rest are hidden from release notes.
- Branches `feature/`, `fix/`, `chore/`, `docs/`.
- Commits carry only the owner's identity: no `Co-Authored-By`, no "Generated with" footer.
- PR template sections: Summary / Changes / Checklist, plus a changelog label where the repository uses one.

## 11. Before finishing
Docs updated in the same PR, links valid, counts and versions re-derived from the source, the language rule respected, no secrets or tokens printed.
