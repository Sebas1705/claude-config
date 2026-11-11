# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-11-11

### Security
- The guard hook now parses commands instead of searching for text: quotes, `VAR=x` prefixes, `sudo`/`env`, `git -C`/`-c`, push refspecs and `bash -c "..."` (three levels). It closes the bypasses an audit found: `git push origin +main`, `-fu`, `:main`, `--mirror`, `git -c core.hooksPath=...`, `FOO=1 git commit -n`, `rm -rf /*`, `rm -rf ~/`, `rm -r -f /`, and it no longer blocks `feature/main-menu`.
- New rule `blockSecretReads`: `cat .env`, `cp release.jks`, `grep ... ~/.aws/credentials` and similar through the shell. The `Read(...)` deny rules only cover the Read tool.
- The installer's cache is private to the user, and a cached checkout is reused only if it is unmodified and at the pinned commit.

### Fixed
- The Windows-path check of the privacy test never matched a real path.
- Documentation claimed more than the code does: the installer "executes nothing" (it registers a third-party session-start hook that runs later), review-only agents "cannot write files" (Bash can), and the deny rules "stop reading secrets" (only the Read tool).

### Added
- `dependabot.yml` for the GitHub Actions used by CI, and CI actions pinned by commit SHA.

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
