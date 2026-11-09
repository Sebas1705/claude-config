# Contributing

Thanks for helping. This is a small project with one rule above all: **a change must never make the installer touch something it did not create.**

## Setup

Node 18+ and git. No dependencies to install.

```sh
git clone https://github.com/Sebas1705/claude-config.git
cd claude-config
npm test        # about 3 seconds; builds throwaway git repositories, never touches your real ~/.claude
```

To try the installer by hand, always use a throwaway folder:

```sh
node install.mjs --dry-run --home /tmp/claude-try
node install.mjs --home /tmp/claude-try && node install.mjs --home /tmp/claude-try --uninstall
```

## What is welcome

- Fixes to the installer, hook or docs, each with a test that fails without the fix.
- Support for another operating system or Node version, with CI proof.
- New default rules for the guard hook, if they stop a common accident and rarely get in the way (a preference belongs behind a config flag, off by default, like `blockCommitTrailers`).
- Changes to the pinned sources: see below.

## Changing a pinned source

A pull request that edits `sources.lock.json` must say, in the description, what changed between the old and the new commit and what you checked: hooks, scripts, network access, anything that runs code or tells the agent to. Update `reviewed`. A source with no declared license is fetched at install time and must not be copied into this repository.

## Style

- Plain Node ESM, no dependencies. Keep `install.mjs` readable top to bottom.
- The installer must stay idempotent and reversible; add a test for any new file or setting it writes (install, second run, uninstall).
- Docs, comments, commits and PRs in English. Commit subjects short and in the imperative.
- Keep personal or company-specific content out of this repository; that is what overlays are for (`docs/CUSTOMIZING.md`).

## Reporting bugs

Open an issue with your OS, Node version, the command you ran and its output (`--dry-run` output is safe to share; remove anything private first). For vulnerabilities see [SECURITY.md](SECURITY.md).
