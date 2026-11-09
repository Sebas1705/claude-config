---
name: release-management
description: Use when the user asks to release, tag, publish, ship, promote a store track, bump a version or prepare release notes for one of the owner's projects (Android/KMP apps, Go/Wails desktop apps, a Cloudflare Worker, Pages sites, a browser extension). Encodes how the projects release and which steps only the owner may take.
---

# Release management

Each repository's own release doc and workflows are the source of truth. This skill is how to read them and what the owner expects. Read the live state (tags, workflow runs, repository variables); notes and memory about versions go stale.

## 1. Discover first (read-only, always)
1. Read `docs/RELEASE.md` (or `RELEASING.md`, `docs/release-policy.md`) and `.github/workflows/release*.yml`. Never guess a secrets-manager project, a store track or a version scheme: read it there.
2. Identify the project type: an `androidApp/` or `composeApp/` with `fastlane/` is a KMP/Android app; `wails.json` is a Wails desktop app; `wrangler.toml` or `wrangler.jsonc` is a Cloudflare Worker; `wxt.config.ts` is a browser extension; `mkdocs.yml` or a Pages workflow is a docs site.
3. `git status`, the current branch (releases come from `main`), `gh run list --branch main --limit 5` green, `gh release list -L 5`, `gh variable list` (store track and release status live there).
4. Next version: SemVer from the PR titles merged since the last tag (`feat` is minor, `fix` and `perf` are patch, breaking is major; while 0.x, breaking is minor). Android versionCode is usually `git rev-list --count HEAD` and needs full history; versionName is the tag without the `v`. Some repositories differ (run number, manual bump): follow their policy.

## 2. Rules that apply everywhere
- Tags are `vX.Y.Z`, pre-releases `vX.Y.Z-alpha.N` or `-beta.N`. A tag is a release. Some workflows accept only plain `vX.Y.Z`: check the version regex.
- Every release asset ships with a SHA-256 (`.sha256` or `SHA256SUMS`).
- Secrets live in a secrets manager, never in the repository or in chat. CI usually holds only a read-only access token for it (a Cloudflare Worker repository may keep its own credentials as CI secrets). Runner credentials are removed at the end of the job (`if: always()`).
- An APK that embeds a secret is **never** attached to a public GitHub Release: Firebase App Distribution only.
- Release notes come from PR titles. Keep titles user-facing; `feat`, `fix` and `perf` are shown, `docs`, `ci`, `chore`, `build`, `test`, `refactor` and `style` are hidden.
- Commits and PRs carry only the owner's identity: no `Co-Authored-By`, no "Generated with" footer.

## 3. Ask the owner before (hard gate)
Merging a PR, pushing a tag, running a release or any `workflow_dispatch`, promoting a store track or changing a rollout, deploying database or Firestore rules, any production write or deletion. Show the exact command and wait. Merging is allowed without asking only where the owner has said so for that repository and CI is green.

## 4. Runbooks

### A. KMP/Android app to GitHub Release + App Distribution + Play
1. Main is green. Run the repository's release checks if present (a `verify-release` script, a release-notes `--check`). Read the store release-audit doc if there is one.
2. If the repository keeps a CHANGELOG, merge a "Prepare the X.Y.Z changelog" PR first.
3. `git tag vX.Y.Z && git push origin vX.Y.Z` (ask first). The release workflow validates the version, builds the signed APK/AAB, creates the GitHub Release (`--generate-notes`, `--prerelease` when there is a suffix), uploads to App Distribution with notes and, when the repository variable for the Play track is set, uploads the AAB and `mapping.txt` to Play through fastlane.
4. Every merge to main may already ship a tester build to the `testers` group.
5. Track promotion is a manual workflow (from, to, rollout 0.01 to 1; below 1 is a staged rollout; run it again to raise the rollout). Ask before each promotion.
6. When the project has a download site, the release redeploys it so the `/apk` redirect and `latest.json` point at the new build.
7. Verify: `gh release view`, assets and SHA-256, the App Distribution upload, the Play track state, and versionCode equals the commit count.
Owner-only: Play Console setup (app signing, content declarations, service account), setting the track variable, and keeping an off-PC copy of the release keystore (it cannot be replaced).

### B. Tester-only Android APK
Some apps ship only through App Distribution (no GitHub Release, no store): either because the APK embeds a secret or because they are internal. The tag is the only path where a release workflow exists; version code policy varies (commit count, run number or manual bump), so read it. A signed build must refuse to continue if it was signed with the debug key.

### C. Go / Wails desktop
- Library or CLI: a tag runs tests, cross-builds the targets and creates the Release with `SHA256SUMS`. Package-manager manifests (Homebrew tap, Scoop bucket) are regenerated from the latest release, often on a daily schedule, so expect up to a day of lag unless the release dispatches an event.
- Wails app: bump the version file, `wails.json` `productVersion` and the changelog section (a test checks they agree), then tag. The workflow builds the installers and portable builds with checksums. File-name suffixes can be load-bearing (an in-app updater matches them): never rename assets.
- A manual run on main is a dry run that publishes nothing: do it first.

### D. Cloudflare Worker API
A push to the deploy branch runs the type check, the tests and the deploy (`wrangler`). That push is a production deploy: ask first unless the owner asked for the change. Content changes go through dated data-update files applied by a script, not by hand.

### E. Pages and docs sites
A push to main builds and deploys (GitHub Pages or Cloudflare Pages). Run the site's own checks locally first (lint, tests, link and freshness checks).

## 5. Output
Report the version, versionCode, tag, links, what ran, what is pending, and a short numbered guide of the owner-only steps.
