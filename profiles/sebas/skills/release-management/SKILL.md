---
name: release-management
description: Use when the user asks to release, tag, publish, ship, promote a track, bump a version or prepare release notes in any of Sebas' projects (Android/KMP apps, Go/Wails desktop apps, the Cloudflare Worker API, Pages sites). Encodes how his repos really release and which steps are owner-only.
---

# Release management (Sebas' projects)

The repo's own release doc and workflows are the source of truth. This skill tells you how to read them and what the owner
expects. Read the current state (tags, workflows, variables) instead of trusting memory notes: versions in memory go stale.

## 1. Detect the project type
| Evidence | Type | Reference |
|---|---|---|
| `androidApp/` or `composeApp/` + `fastlane/` | KMP/Android app (Haltera, Owlsplit, YouKnow, Omni-Impostor) | A / B |
| `wails.json`, `go.mod` | Go/Wails desktop (Templetry desktop, Nimbo, WinForge) or Go CLI (Templetry engine) | C |
| `wrangler.toml` / `wrangler.jsonc` | Cloudflare Worker (career-api-worker) | D |
| `wxt.config.ts` | Browser extension (ad-skipper) | zip on GitHub Release |
| `mkdocs.yml`, Pages workflow | Docs site | push to main deploys |

## 2. Pre-flight (read-only, always first)
1. Read `docs/RELEASE.md` (or `RELEASING.md`, `docs/release-policy.md`) and `.github/workflows/release*.yml`. Never guess a secrets-manager project or a track: read it from there.
2. `git status`, current branch (releases come from `main`; Omni-Impostor's release workflow also checks the tagged commit is on main).
3. `gh run list --branch main --limit 5` is green. `gh release list -L 5`. `gh variable list` (shows `PLAY_TRACK`, `PLAY_RELEASE_STATUS`).
4. Next version: SemVer from the PR titles merged since the last tag (`feat` = minor, `fix`/`perf` = patch, breaking = major; while 0.x, breaking = minor).
5. Android: next versionCode = `git rev-list --count HEAD` (needs full history). versionName = tag without the leading `v`.

## 3. Rules that apply everywhere
- Tags are `vX.Y.Z`, pre-releases `vX.Y.Z-alpha.N` / `-beta.N` (Omni-Impostor accepts only plain `vX.Y.Z`). A tag is a release.
- Every release asset ships with a SHA-256 (`.sha256` or `SHA256SUMS`).
- Secrets live in a secrets manager, never in the repo or in chat; GitHub only holds a read-only access token (exception: the Worker API repo keeps its Cloudflare credentials as GitHub secrets). Runner credentials are removed at the end (`if: always()`).
- An APK that embeds a secret is NEVER attached to a public GitHub Release: Firebase App Distribution only.
- Release notes come from PR titles (generated notes). Keep PR titles user-facing; `feat|fix|perf` are shown, `docs|ci|chore|build|test|refactor|style` are hidden.
- Commits and PRs carry only the owner's identity: no `Co-Authored-By`, no "Generated with" footer.

## 4. Ask the owner before (hard gate)
Merging a PR, pushing a tag, running a release/`workflow_dispatch`, promoting a Play track or changing its rollout, deploying Firestore rules, any production write or deletion. Show the exact command you would run and wait. The owner has authorised merging Haltera PRs once CI is green and the test matrix is reviewed; everything else still asks.

## 5. Runbooks (as the repos do them today)

### A. KMP/Android app to GitHub Release + App Distribution + Play (Haltera, Owlsplit)
Secrets-manager project per app (read it from the workflow); it holds the signing keystore, service accounts and `google-services`.
1. Main green; optional `node scripts/verify-release.mjs` (Haltera), `node scripts/release-notes.mjs --check` (Owlsplit). Read `docs/play/RELEASE-AUDIT.md` if present.
2. Owlsplit/YouKnow: merge a "Prepare the X.Y.Z changelog" PR first. Haltera has no changelog step.
3. `git tag vX.Y.Z && git push origin vX.Y.Z` (ask first). `release.yml` validates the version, builds the signed APK/AAB, creates the GitHub Release (`--generate-notes`, `--prerelease` if there is a suffix), uploads to App Distribution with notes and, if the repo variable `PLAY_TRACK` is set, to Play (AAB + `mapping.txt`, via fastlane supply).
4. Per merge to main, `distribute.yml` already ships a tester build to the `testers` group.
5. `play-promote.yml` is manual (from track, to track, rollout 0.01 to 1; below 1 is a staged rollout; run again to raise it). Ask before every promotion.
6. Owlsplit also redeploys Hosting after the release so `owlsplit.web.app/apk` and `/download/latest.json` point at the new APK.
7. Verify: `gh release view`, assets + SHA-256, App Distribution upload, Play track state, versionCode = commit count.
Owner-only: Play Console setup (app signing, content declarations, service account), `gh variable set PLAY_TRACK`, keeping an off-PC copy of the release keystore (it cannot be replaced).

### B. Tester-only Android APK (YouKnow, nanodemo, career-editor-kmp, Omni dev builds)
- YouKnow: tag `vX.Y.Z` is the only path (Production flavor; Release + APK + sha256 + App Distribution).
- career-editor-kmp: App Distribution only; never a public Release.
- nanodemo: App Distribution only (no GitHub Releases).
- Omni-Impostor: push to `develop` ships tester builds; tag on main runs `release.yml` and appends `CHANGELOG.md`; Play upload is manual from a signed AAB.
Version code differs per repo (commit count in most, run number in YouKnow's policy, manual bump in Omni): read the repo's policy.

### C. Go / Wails desktop
- templetry/engine: tag `v*` runs tests, cross-builds 6 targets, creates the Release with `SHA256SUMS`. No GoReleaser. It does not send `engine-released`, so Homebrew tap and Scoop bucket update on their daily cron (up to a day of lag).
- templetry/desktop: tag builds Windows (NSIS), Linux, macOS universal; `follow-engine.yml` bumps the engine dependency daily.
- Nimbo: bump `VERSION`, `wails.json` `productVersion` and the CHANGELOG section (a test checks they agree), tag; builds Linux binary, Docker image on ghcr, Windows zip and unsigned MSI. A manual run on main is a dry run.
- WinForge: tag builds `WinForge-<tag>-windows-amd64.exe`, `-windows-installer.exe` and `SHA256SUMS`; the in-app updater depends on those exact suffixes. Manual run = dry run.
Always dry-run first when the repo offers it.

### D. Cloudflare Worker API (career-api-worker)
Push to `development` runs type-check, `npm test`, `npm run deploy` (wrangler). Worker `career-api`, KV `CAREER_KV`, domain `api.sebas1705.dev`. Content changes go in `data-updates/YYYY-MM-DD-<slug>.json` applied with `apply.mjs`. A push to `development` is a production deploy: ask first unless the owner asked for the change.

## 6. Output
Report version, versionCode, tag, links, what ran, what is pending, and a short numbered guide of owner-only steps.
