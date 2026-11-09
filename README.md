# claude-config

A reproducible, reviewable [Claude Code](https://claude.com/claude-code) setup you can install on any machine (Windows, macOS, Linux) with one command, and undo with one command.

It gives you a sensible baseline instead of an empty `~/.claude`:

- **A guard hook** that stops a few classic accidents before they run: `git commit --no-verify`, force-pushing to `main`/`master`, staging keystores or `.env` files, `rm -rf /`.
- **Deny rules** so Claude cannot read `.env` files, `~/.ssh`, `~/.aws`, `~/.config/gh`, keystores or service-account keys.
- **Method skills** from [superpowers](https://github.com/obra/superpowers): brainstorming, planning, test-driven development, systematic debugging, code review, verification before claiming success, git worktrees.
- **Official skills** from [anthropics/skills](https://github.com/anthropics/skills) (`skill-creator`, `claude-api`, `mcp-builder`, `webapp-testing`, `frontend-design`).
- **Architecture, security, docs, database, accessibility and .NET plugins** from [wshobson/agents](https://github.com/wshobson/agents) (14 plugins: agents, commands and skills).
- **Security skills** from [Trail of Bits](https://github.com/trailofbits/skills) (`sharp-edges`, `differential-review`, `supply-chain-risk-auditor`, `agentic-actions-auditor`).
- **Limited tools for review-only agents** (code reviewer, architect review, security auditors, threat modeling, UI validator): `Read, Grep, Glob, Bash`, so a reviewer cannot edit files.

Everything third-party is **pinned to an exact commit** and **fetched at install time**, never copied into this repository. You can see the full plan before anything changes.

## Quick start

Requirements: Node 18 or newer, and git.

```sh
git clone https://github.com/Sebas1705/claude-config.git
cd claude-config
node install.mjs --dry-run    # shows exactly what would be added, changes nothing in your Claude folder
node install.mjs              # installs it; then start a new Claude Code session
```

Check it, and undo it:

```sh
node install.mjs --status       # is everything the installer added still there?
node install.mjs --uninstall    # removes exactly what it added, nothing else
```

The Claude folder is `~/.claude`, or `$CLAUDE_CONFIG_DIR` if set, or whatever you pass with `--home <dir>`. Try it on a throwaway folder first:

```sh
node install.mjs --home /tmp/claude-test
```

## What it will and will not touch

| It does | It does not |
|---|---|
| Back up `settings.json` and `CLAUDE.md` to `<home>/backups/claude-config-<time>/` before changing anything | Overwrite a skill, agent or command that already exists and is not its own (it reports it as `kept`) |
| Add its hooks and deny rules to `settings.json` if they are missing | Touch any other key of `settings.json`, or hooks from other tools |
| Insert its rules into `CLAUDE.md` inside a marked block (`<!-- claude-config:begin -->`) | Change the text you wrote in `CLAUDE.md` |
| Record everything in `<home>/.claude-config/manifest.json` | Run any downloaded code: it only copies files |
| Be safe to re-run: a second run changes nothing in `settings.json` | Need network access after the files are fetched |

## Options

```
node install.mjs [options]

  --dry-run          print the plan, change nothing in the Claude folder
  --status           check that what was installed is still present
  --uninstall        remove what was installed, and the settings/CLAUDE.md entries it added
  --home <dir>       Claude folder (default: $CLAUDE_CONFIG_DIR or ~/.claude)
  --only a,b         install only these sources (ids from sources.lock.json)
  --overlay <dir>    apply a private overlay on top (see docs/CUSTOMIZING.md)
  --no-hook          do not register the superpowers session-start hook
  --no-claude-md     do not touch CLAUDE.md
  --retire           move the skills listed under "retire" (from an overlay) to skills-removed/
  --lock <file>      use another lock file
  --json             machine-readable output
```

`--only` takes the ids in `sources.lock.json`: `superpowers`, `anthropic-skills`, `wshobson-agents`, `trailofbits-skills`. For example, only the method skills:

```sh
node install.mjs --only superpowers
```

## Make it yours: overlays

Your own `CLAUDE.md`, skills, extra deny rules, hook settings and extra third-party sources do not belong in a fork of this repo. Put them in an **overlay**: a separate folder (usually a private git repo) with the same layout as `config/`, applied on top with `--overlay`.

```sh
node install.mjs --overlay ../my-claude-overlay
```

A working example you can copy is in [`examples/overlay/`](examples/overlay). Full guide: [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md).

## Safety model

Skills, agents and commands are instructions that Claude follows with *your* permissions, and a hook runs as your user. So:

- **Pinned, not floating.** Each source in [`sources.lock.json`](sources.lock.json) names a full 40-character commit SHA. After fetching, the installer verifies it got exactly that commit. A moved branch or a rewritten upstream cannot change what you receive.
- **Reviewed before pinning.** `reviewed` in the lock is the date the content at that commit was read, with attention to hooks, scripts and network access. Read it yourself too: it is a few hundred small markdown files.
- **No execution of fetched code.** The installer copies files. The only things that execute later are the hooks you can read in `config/hooks/` and the session-start hook from superpowers.
- **Nothing is vendored.** Third-party licenses differ (MIT, CC BY-SA 4.0, and one repository with no declared license), so they are downloaded from their own repositories, not redistributed here.
- **Local only.** The guard hook has no network access and writes no files.

More in [SECURITY.md](SECURITY.md). Technical details of every file and format: [docs/REFERENCE.md](docs/REFERENCE.md).

## The guard hook

`config/hooks/guard.js` is a `PreToolUse` hook for the Bash tool. It exits with code 2 and a reason when a command matches a rule, and Claude sees the reason and picks another approach.

| Rule | Default | Blocks |
|---|---|---|
| `blockNoVerify` | on | `git commit --no-verify` and `-n` |
| `blockForcePush` | on | `git push --force` / `-f` to a protected branch (`--force-with-lease` is allowed) |
| `blockSecretStaging` | on | `git add` of `.jks`, `.keystore`, `.p12`, `.pfx`, `.pem`, `id_rsa`, `.env*`, service-account JSON |
| `blockRmRoot` | on | `rm -rf` on `/`, `~`, `$HOME` or a drive root |
| `blockCommitTrailers` | **off** | commits with a `Co-Authored-By` or "Generated with" trailer (a preference, so opt-in) |
| `protectedBranches` | `main`, `master` | which branches the force-push rule protects |

Change a rule with a `guard.config.json` next to the hook (an overlay can ship one):

```json
{ "blockCommitTrailers": true, "protectedBranches": ["main", "release"] }
```

The hook is a guardrail against accidents, not a security boundary: a determined command can get around string matching. Use it together with Claude Code's own permission system.

## Updating the pinned sources

1. In a clone of the upstream, read `git diff <pinned>..<new>`. Look at hooks, scripts and anything touching the network.
2. Edit `commit` and `reviewed` for that source in `sources.lock.json`.
3. `node install.mjs --dry-run`, then `npm test`, then install.

## Troubleshooting

- **`git is required`**: install git and make sure it is on your `PATH`.
- **`git fetch failed for <source>`**: the machine cannot reach GitHub, or the pinned commit no longer exists upstream. Nothing is installed from a source that failed.
- **A skill was `kept`, not installed**: you already have one with that name. Rename or remove yours, or leave it; the installer never overwrites files it did not create.
- **Nothing shows up in Claude Code**: start a *new* session; skills and hooks load at startup.
- **Windows**: the superpowers session-start hook runs through `bash` (Git for Windows provides it). Use `--no-hook` if you do not have it.
- **Something went wrong**: `node install.mjs --uninstall`, or restore `settings.json` and `CLAUDE.md` from `<home>/backups/`.

## Development

```sh
npm test    # node --test: installer against local fixture repositories, and the guard hook
```

No dependencies. CI runs the tests on Linux, macOS and Windows with Node 18, 20 and 22. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits and licenses

This repository (installer, guard hook, docs) is [MIT](LICENSE). The pinned sources keep their own licenses and are not redistributed here:
[obra/superpowers](https://github.com/obra/superpowers) (MIT), [anthropics/skills](https://github.com/anthropics/skills) (no license declared in the repository),
[wshobson/agents](https://github.com/wshobson/agents) (MIT), [trailofbits/skills](https://github.com/trailofbits/skills) (CC BY-SA 4.0).
This project is not affiliated with Anthropic or with those projects.
