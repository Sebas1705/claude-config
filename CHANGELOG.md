# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-09

### Added
- Installer (`install.mjs`) with `--dry-run`, `--status`, `--uninstall`, `--only`, `--overlay`, `--no-hook`, `--no-claude-md`, `--retire`, `--home`, `--lock`, `--json`. Backs up before changing anything, merges `settings.json` without touching other keys, records a manifest and reverses exactly what it added.
- Third-party sources pinned by full commit SHA in `sources.lock.json` (superpowers, anthropics/skills, wshobson/agents, trailofbits/skills), fetched at install time and verified.
- Guard hook for the Bash tool with configurable rules (`--no-verify`, force-push to protected branches, staging secrets, `rm -rf` of a root, optional commit-trailer rule).
- Default deny rules for secrets and key material, and limited tools for review-only agents.
- Overlays: a private folder with the same layout as `config/` for personal rules, skills, hooks, sources and retire lists.
- Tests on local fixture repositories (installer, overlay, guard hook) and CI on Linux, macOS and Windows.
