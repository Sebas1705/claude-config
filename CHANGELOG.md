# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-11-09

### Added
- `--profile <name>` to apply a published profile from `profiles/`, `--no-overlay`, and the `CLAUDE_CONFIG_OVERLAY` environment variable as a per-machine default overlay.
- `profiles/sebas`: the author's own setup, sanitised for publication.
- A privacy test driven by an untracked `.privacy-terms` file, and a check for personal paths, e-mail addresses and tokens in every published file.

- Overlays can `extend` other overlays and profiles (`"extends": ["profile:<name>", "../path"]`), so a private overlay can build on a public profile without copying it.
- Test that the skills in `profiles/` teach conventions without naming specific projects (names come from an untracked `.project-names` file).

### Changed
- The `sebas` profile skills now describe how the projects are built and released in general terms, and tell Claude to learn each project's own conventions first.

### Fixed
- Uninstall restores retired skills even when their parent folder was pruned.

## [1.0.0] - 2026-11-09

### Added
- Installer (`install.mjs`) with `--dry-run`, `--status`, `--uninstall`, `--only`, `--overlay`, `--no-hook`, `--no-claude-md`, `--retire`, `--home`, `--lock`, `--json`. Backs up before changing anything, merges `settings.json` without touching other keys, records a manifest and reverses exactly what it added.
- Third-party sources pinned by full commit SHA in `sources.lock.json` (superpowers, anthropics/skills, wshobson/agents, trailofbits/skills), fetched at install time and verified.
- Guard hook for the Bash tool with configurable rules (`--no-verify`, force-push to protected branches, staging secrets, `rm -rf` of a root, optional commit-trailer rule).
- Default deny rules for secrets and key material, and limited tools for review-only agents.
- Overlays: a private folder with the same layout as `config/` for personal rules, skills, hooks, sources and retire lists.
- Tests on local fixture repositories (installer, overlay, guard hook) and CI on Linux, macOS and Windows.
