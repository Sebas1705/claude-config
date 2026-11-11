# Security

## Threat model in one paragraph

Installing this repository changes what a coding agent reads and runs on your machine. Skills, agents and commands are text that steers Claude, a hook is a program run as your user, and `settings.json` decides what is allowed. The risks are therefore (1) a compromised or changed upstream source, (2) a hook that does more than it says, and (3) the installer damaging your existing configuration.

## What protects you

- **Pinned commits.** Every third-party source is a full commit SHA, verified after fetch. Upstream changes do not reach you until someone updates the lock and reviews the diff.
- **Review notes.** `reviewed` in `sources.lock.json` records when the pinned content was read, looking for hooks, scripts, network access and prompt-injection text.
- **Copy-only installer.** It never executes what it fetches. It does register one third-party hook: superpowers' session-start script, which Claude Code then runs at the start of every session as your user. It was read at the pinned commit; `--no-hook` skips it, and `--only` can leave the source out entirely.
- **Per-user cache.** Fetched sources are cached in a folder private to your user (mode 0700 where the OS has modes) and reused only if the checkout is unmodified and at the pinned commit; otherwise it is fetched again.
- **Non-destructive.** It backs up `settings.json` and `CLAUDE.md`, never overwrites a file it did not create, merges only its own keys, records everything in a manifest, and `--uninstall` reverses exactly that.
- **Local guard.** `config/hooks/guard.js` has no network access, writes nothing and reads only an optional `guard.config.json` next to it.

## What does not

- The guard hook is a guardrail against accidents. It parses commands but cannot follow variables, scripts or obfuscation. Its secret-read rule is a heuristic, and the `Read(...)` deny rules cover only the Read tool, not the shell.
- Review-only agents lose the edit and write tools but keep Bash, which can write files: this narrows them, it does not sandbox them.
- Deny rules cover the files named in them, not every secret on your disk.
- Third-party content is trusted as far as you trust its authors and your own reading of it. A skill can still ask Claude to do something unwise; keep Claude Code's permission prompts on for anything you would not do yourself.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting on this repository ("Security" tab, "Report a vulnerability"). Do not open a public issue for a vulnerability. Include the installer or hook version (commit), your OS and Node version, and steps to reproduce. This is a personal open-source project: expect a reply within a few days, not an SLA.

Reports about the third-party sources themselves belong to those projects.
